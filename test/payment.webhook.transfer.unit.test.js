import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

import PaymentController from '../src/controllers/payment.controller.js';
import WebhookController from '../src/controllers/webhook.controller.js';
import PaymentService from '../src/services/payment.js';
import WebhookService from '../src/services/webhooks.service.js';
import TransferController from '../src/controllers/transfer.controller.js';
import TransferService from '../src/services/transfer.service.js';
import TransactionRepository from '../src/repositories/transaction.repositories.js';

test('PaymentController.initialize initializes a payment for the current buyer', async () => {
  const original = PaymentService.initialize;
  const calls = [];

  PaymentService.initialize = async (payload) => {
    calls.push(payload);
    return {
      reference: 'REF_123',
      authorizationUrl: 'https://paystack.test/pay',
      accessCode: 'ACCESS_123',
      transaction: { reference: 'REF_123', status: 'PENDING' },
    };
  };

  const req = {
    user: { id: 'buyer-1' },
    body: {
      propertyId: 'prop-1',
      paymentType: 'BOOKING',
      callbackUrl: 'https://app.example/callback',
    },
  };

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  await PaymentController.initialize(req, res, () => {});

  assert.deepEqual(calls[0], {
    buyerId: 'buyer-1',
    propertyId: 'prop-1',
    paymentType: 'BOOKING',
    callbackUrl: 'https://app.example/callback',
  });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.reference, 'REF_123');

  PaymentService.initialize = original;
});

test('PaymentController.verify returns the verified transaction', async () => {
  const original = PaymentService.verify;
  PaymentService.verify = async (reference) => {
    assert.equal(reference, 'REF_123');
    return { reference, status: 'SUCCESS' };
  };

  const req = { params: { reference: 'REF_123' } };
  const res = {
    body: null,
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  await PaymentController.verify(req, res, () => {});

  assert.equal(res.body.success, true);
  assert.equal(res.body.data.reference, 'REF_123');
  assert.equal(res.body.data.status, 'SUCCESS');

  PaymentService.verify = original;
});

test('PaymentController.refund delegates to PaymentService.refund', async () => {
  const original = PaymentService.refund;
  PaymentService.refund = async (reference, amount) => {
    assert.equal(reference, 'REF_123');
    assert.equal(amount, 2500);
    return { reference, amount, status: 'processing' };
  };

  const req = {
    body: { reference: 'REF_123', amount: 2500 },
  };
  const res = {
    body: null,
    json(payload) {
      this.body = payload;
      return this;
    },
  };

  await PaymentController.refund(req, res, () => {});

  assert.equal(res.body.success, true);
  assert.equal(res.body.data.reference, 'REF_123');
  assert.equal(res.body.data.amount, 2500);

  PaymentService.refund = original;
});

test('PaymentController.webhook rejects invalid Paystack signatures', async () => {
  const original = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = 'secret-key';

  const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'REF_999' } });
  const req = {
    body: Buffer.from(payload),
    headers: {
      'x-paystack-signature': 'bad-signature',
    },
  };
  const res = {
    statusCode: 200,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };

  await PaymentController.webhook(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.body, 'Invalid signature');

  if (original === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = original;
});

test('PaymentController.webhook accepts a valid signature and processes the event', async () => {
  const original = process.env.PAYSTACK_SECRET_KEY;
  process.env.PAYSTACK_SECRET_KEY = 'secret-key';

  const originalHandler = PaymentService.handleWebhookEvent;
  let handledEvent = null;
  PaymentService.handleWebhookEvent = async (event) => {
    handledEvent = event;
  };

  const payload = JSON.stringify({ event: 'charge.success', data: { reference: 'REF_200' } });
  const signature = crypto
    .createHmac('sha512', 'secret-key')
    .update(Buffer.from(payload))
    .digest('hex');

  const req = {
    body: Buffer.from(payload),
    headers: {
      'x-paystack-signature': signature,
    },
  };
  const res = {
    statusCode: 200,
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
  };

  await PaymentController.webhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(handledEvent.event, 'charge.success');
  assert.equal(handledEvent.data.reference, 'REF_200');

  PaymentService.handleWebhookEvent = originalHandler;
  if (original === undefined) delete process.env.PAYSTACK_SECRET_KEY;
  else process.env.PAYSTACK_SECRET_KEY = original;
});

test('WebhookController.handle delegates to WebhookService.process and returns 200', async () => {
  const original = WebhookService.process;
  let seenBody = null;
  WebhookService.process = async (body) => {
    seenBody = body;
  };

  const req = { body: { event: 'charge.success', data: { reference: 'REF_300' } } };
  const res = {
    sendStatus(code) {
      this.code = code;
      return this;
    },
  };
  const next = () => {};

  await WebhookController.handle(req, res, next);

  assert.equal(res.code, 200);
  assert.deepEqual(seenBody, { event: 'charge.success', data: { reference: 'REF_300' } });

  WebhookService.process = original;
});

test('WebhookController.handle passes errors to next()', async () => {
  const original = WebhookService.process;
  let thrown = new Error('bad webhook');
  WebhookService.process = async () => {
    throw thrown;
  };

  let nextError = null;
  const req = { body: { event: 'charge.success' } };
  const res = { sendStatus() {} };

  await WebhookController.handle(req, res, (err) => {
    nextError = err;
  });

  assert.equal(nextError, thrown);

  WebhookService.process = original;
});

test('PaymentService.handleWebhookEvent ignores duplicate successful charge events', async () => {
  const originalFind = TransactionRepository.findByReference;
  const originalMarkSuccess = TransactionRepository.markSuccessful;
  const originalMarkFailed = TransactionRepository.markFailed;

  let markSuccessfulCalled = 0;
  let markFailedCalled = 0;

  TransactionRepository.findByReference = async () => ({
    reference: 'REF_DUP',
    amount: 100,
    status: 'SUCCESS',
  });
  TransactionRepository.markSuccessful = async () => {
    markSuccessfulCalled += 1;
  };
  TransactionRepository.markFailed = async () => {
    markFailedCalled += 1;
  };

  await PaymentService.handleWebhookEvent({
    event: 'charge.success',
    data: { reference: 'REF_DUP', amount: 10000 },
  });

  assert.equal(markSuccessfulCalled, 0);
  assert.equal(markFailedCalled, 0);

  TransactionRepository.findByReference = originalFind;
  TransactionRepository.markSuccessful = originalMarkSuccess;
  TransactionRepository.markFailed = originalMarkFailed;
});

test('TransferService.prepareTransfer calculates fees and builds the transfer record', async () => {
  const original = TransferService.transferRepository.create;
  let received = null;

  TransferService.transferRepository = {
    create: async (payload) => {
      received = payload;
      return { ...payload, id: 'tx-1' };
    },
  };

  const escrow = { amount: 1000, sellerId: 'seller-1', id: 'escrow-1' };
  const transfer = await TransferService.prepareTransfer({
    escrow,
    recipientCode: 'RCP_123',
    reason: 'Settlement',
  });

  assert.equal(transfer.reference.startsWith('TRF-'), true);
  assert.equal(transfer.amount, 1000);
  assert.equal(transfer.platformFee, 20);
  assert.equal(transfer.agentCommission, 10);
  assert.equal(transfer.payoutAmount, 970);
  assert.equal(received.recipientCode, 'RCP_123');
  assert.equal(received.status, 'PENDING');

  TransferService.transferRepository = { create: original };
});

test('TransferService.sendTransfer calls Paystack and marks the transfer as processing', async () => {
  const originalRepo = TransferService.transferRepository;
  const originalPaystack = TransferService.paystack;

  let paystackPayload = null;
  let repoReference = null;

  TransferService.paystack = {
    initiateTransfer: async (payload) => {
      paystackPayload = payload;
      return { status: true, data: { transfer_code: 'T_123' } };
    },
  };

  TransferService.transferRepository = {
    markProcessing: async (reference, response) => {
      repoReference = { reference, response };
      return { reference, response, status: 'PROCESSING' };
    },
    markFailed: async () => {},
  };

  const transfer = {
    reference: 'TRF-1',
    recipient_code: 'RCP_123',
    payout_amount: 970,
  };

  const result = await TransferService.sendTransfer(transfer, 'Settlement');

  assert.equal(paystackPayload.amount, 97000);
  assert.equal(paystackPayload.reference, 'TRF-1');
  assert.equal(result.status, 'PROCESSING');
  assert.equal(repoReference.reference, 'TRF-1');

  TransferService.transferRepository = originalRepo;
  TransferService.paystack = originalPaystack;
});

test('TransferService.verifyTransfer updates the transfer status based on the gateway response', async () => {
  const original = TransferService.paystack;
  const originalMarkSuccess = TransferService.transferRepository.markSuccess;
  let seenReference = null;

  TransferService.paystack = {
    verifyTransfer: async (reference) => ({
      data: { status: 'SUCCESS' },
      status: 'SUCCESS',
    }),
  };

  TransferService.transferRepository = {
    ...TransferService.transferRepository,
    markSuccess: async (reference, response) => {
      seenReference = { reference, response };
      return { reference, status: 'SUCCESS' };
    },
  };

  const result = await TransferService.verifyTransfer('TRF-2');

  assert.equal(result.status, 'SUCCESS');
  assert.equal(seenReference.reference, 'TRF-2');

  TransferService.paystack = original;
  TransferService.transferRepository.markSuccess = originalMarkSuccess;
});

test('TransferController.getStatus and listSellerTransfers return the service data', async () => {
  const originalStatus = TransferService.getTransferStatus;
  const originalList = TransferService.listSellerTransfers;

  let statusCall = null;
  let listCall = null;

  TransferService.getTransferStatus = async (reference) => {
    statusCall = reference;
    return { reference, status: 'SUCCESS' };
  };

  TransferService.listSellerTransfers = async (sellerId, query) => {
    listCall = { sellerId, query };
    return { rows: [{ reference: 'TRF-3', status: 'SUCCESS' }], total: 1 };
  };

  const statusReq = { params: { reference: 'TRF-7' } };
  const statusRes = { body: null, json(payload) { this.body = payload; return this; } };
  await TransferController.getStatus(statusReq, statusRes, () => {});
  assert.equal(statusCall, 'TRF-7');
  assert.equal(statusRes.body.data.status, 'SUCCESS');

  const listReq = { params: { sellerId: 'seller-7' }, query: { page: '2', limit: '10' } };
  const listRes = { body: null, json(payload) { this.body = payload; return this; } };
  await TransferController.listSellerTransfers(listReq, listRes, () => {});
  assert.equal(listCall.sellerId, 'seller-7');
  assert.equal(listCall.query.page, '2');
  assert.equal(listRes.body.data.total, 1);

  TransferService.getTransferStatus = originalStatus;
  TransferService.listSellerTransfers = originalList;
});
