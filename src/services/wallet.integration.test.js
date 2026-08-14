import assert from "node:assert/strict";
import test from "node:test";

import { EscrowService, ESCROW_STATUS } from "./escrow.service.js";
import { TransferService } from "./transfer.service.js";
import { LEDGER_TYPES, WalletService } from "./wallet.service.js";

const makeFakeDb = ({ escrow }) => {
  const state = {
    financeAccount: {
      finance_id: "finance-1",
      user_id: escrow.seller_id,
      user_role: "SELLER",
      wallet_balance: 0,
      commission_balance: 0,
      total_earnings: 0,
      total_withdrawn: 0,
      total_properties_sold: 0,
      total_sales_value: 0,
      is_active: true,
      created_at: "2026-08-12T00:00:00.000Z",
      updated_at: "2026-08-12T00:00:00.000Z",
    },
    ledger: [],
    transfers: [],
    queries: [],
  };

  const query = async (sql, params = []) => {
    const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
    state.queries.push({ sql: normalized, params });

    if (
      normalized === "begin" ||
      normalized === "commit" ||
      normalized === "rollback" ||
      normalized.startsWith("create table") ||
      normalized.startsWith("create index")
    ) {
      return { rows: [], rowCount: 0 };
    }

    if (normalized.startsWith("insert into finance_accounts")) {
      state.financeAccount.user_id = params[0];
      return { rows: [{ ...state.financeAccount }], rowCount: 1 };
    }

    if (normalized.startsWith("select 1 from wallet_ledger")) {
      const exists = state.ledger.some((entry) => entry.reference === params[0]);
      return { rows: exists ? [{ "?column?": 1 }] : [], rowCount: exists ? 1 : 0 };
    }

    if (normalized.startsWith("update finance_accounts")) {
      const [, payoutAmount, grossAmount] = params;
      state.financeAccount.wallet_balance += payoutAmount;
      state.financeAccount.total_earnings += payoutAmount;
      state.financeAccount.total_properties_sold += 1;
      state.financeAccount.total_sales_value += grossAmount;
      return { rows: [{ ...state.financeAccount }], rowCount: 1 };
    }

    if (normalized.startsWith("insert into wallet_ledger")) {
      const [
        sellerId,
        entryType,
        amount,
        balanceAfter,
        currency,
        reference,
        escrowId,
        transactionId,
        description,
        metadata,
      ] = params;
      const direction = normalized.includes("values ($1, $2, 'credit'")
        ? "CREDIT"
        : "DEBIT";
      const row = {
        id: `ledger-${state.ledger.length + 1}`,
        seller_id: sellerId,
        entry_type: entryType,
        direction,
        amount,
        balance_after: balanceAfter,
        currency,
        reference,
        escrow_id: escrowId,
        transaction_id: transactionId,
        transfer_id: null,
        description,
        metadata: JSON.parse(metadata),
        created_at: `2026-08-12T00:00:0${state.ledger.length}.000Z`,
      };
      state.ledger.push(row);
      return { rows: [row], rowCount: 1 };
    }

    if (normalized.startsWith("update escrows")) {
      escrow.status = ESCROW_STATUS.RELEASED;
      escrow.released_at = "2026-08-12T00:00:10.000Z";
      return { rows: [{ ...escrow }], rowCount: 1 };
    }

    if (normalized.includes("select coalesce(sum(payout_amount)")) {
      const [sellerId, statuses] = params;
      const total = state.transfers
        .filter((transfer) => transfer.seller_id === sellerId)
        .filter((transfer) => statuses.includes(transfer.status))
        .reduce((sum, transfer) => sum + Number(transfer.payout_amount), 0);
      return { rows: [{ total }], rowCount: 1 };
    }

    if (normalized.startsWith("select * from wallet_ledger")) {
      const [sellerId, limit, offset] = params;
      const rows = state.ledger
        .filter((entry) => entry.seller_id === sellerId)
        .slice(offset, offset + limit);
      return { rows, rowCount: rows.length };
    }

    if (normalized.startsWith("select count(*)::int as total from wallet_ledger")) {
      const [sellerId] = params;
      const total = state.ledger.filter((entry) => entry.seller_id === sellerId).length;
      return { rows: [{ total }], rowCount: 1 };
    }

    throw new Error(`Unhandled fake DB query: ${normalized}`);
  };

  return {
    state,
    async query(sql, params) {
      return query(sql, params);
    },
    async connect() {
      return {
        query,
        release() {},
      };
    },
  };
};

test("escrow release creates commission split, transfer, wallet balance, and ledger history", async () => {
  const escrow = {
    id: "11111111-1111-1111-1111-111111111111",
    transaction_id: "22222222-2222-2222-2222-222222222222",
    property_id: "33333333-3333-3333-3333-333333333333",
    buyer_id: "44444444-4444-4444-4444-444444444444",
    seller_id: "55555555-5555-5555-5555-555555555555",
    agent_id: "66666666-6666-6666-6666-666666666666",
    status: ESCROW_STATUS.HELD,
    transaction: {
      id: "22222222-2222-2222-2222-222222222222",
      amount: 100000,
      currency: "NGN",
    },
  };
  const db = makeFakeDb({ escrow });

  const escrowRepository = {
    async findById(id) {
      assert.equal(id, escrow.id);
      return { ...escrow, transaction: { ...escrow.transaction } };
    },
  };

  const transferRepository = {
    async create(payload) {
      const row = {
        id: "transfer-1",
        reference: payload.reference,
        escrow_id: payload.escrowId,
        seller_id: payload.sellerId,
        recipient_code: payload.recipientCode,
        amount: payload.amount,
        platform_fee: payload.platformFee,
        agent_commission: payload.agentCommission,
        payout_amount: payload.payoutAmount,
        status: payload.status,
        gateway_response: payload.gatewayResponse,
      };
      db.state.transfers.push(row);
      return row;
    },
    async markProcessing(reference, response) {
      const transfer = db.state.transfers.find((row) => row.reference === reference);
      transfer.status = "PROCESSING";
      transfer.gateway_response = response;
      return transfer;
    },
    async markFailed() {
      throw new Error("transfer should not fail in this integration test");
    },
  };

  const paystackCalls = [];
  const paystackClient = {
    async initiateTransfer(payload) {
      paystackCalls.push(payload);
      return { status: true, data: { transfer_code: "TRF_CODE" } };
    },
  };

  const walletService = new WalletService({ db });
  const transferService = new TransferService({
    transferRepository,
    paystackClient,
  });
  transferService.generateReference = () => "TRF-INTEGRATION-1";

  const escrowService = new EscrowService({
    escrowRepository,
    transfers: transferService,
    walletService,
    db,
  });

  const released = await escrowService.releaseEscrow(escrow.id, "RCP_SELLER");
  const transfer = db.state.transfers[0];
  const wallet = await walletService.getSellerWallet(escrow.seller_id);

  assert.equal(released.status, ESCROW_STATUS.RELEASED);

  assert.equal(transfer.amount, 100000);
  assert.equal(transfer.platform_fee, 2000);
  assert.equal(transfer.agent_commission, 1000);
  assert.equal(transfer.payout_amount, 97000);
  assert.equal(transfer.status, "PROCESSING");

  assert.deepEqual(paystackCalls[0], {
    source: "balance",
    amount: 9700000,
    recipient: "RCP_SELLER",
    reason: "RealKudu Property Settlement",
    reference: "TRF-INTEGRATION-1",
  });

  assert.equal(wallet.balance, 97000);
  assert.equal(wallet.pendingPayouts, 97000);
  assert.equal(wallet.availableBalance, 0);
  assert.equal(wallet.totalEarnings, 97000);
  assert.equal(wallet.totalPropertiesSold, 1);
  assert.equal(wallet.totalSalesValue, 100000);

  assert.equal(wallet.history.total, 2);
  assert.equal(wallet.history.rows[0].type, LEDGER_TYPES.ESCROW_RELEASE);
  assert.equal(wallet.history.rows[0].direction, "CREDIT");
  assert.equal(wallet.history.rows[0].amount, 100000);
  assert.equal(wallet.history.rows[0].balanceAfter, 100000);
  assert.deepEqual(wallet.history.rows[0].metadata, {
    payoutAmount: 97000,
    platformFee: 2000,
    agentCommission: 1000,
  });

  assert.equal(wallet.history.rows[1].type, LEDGER_TYPES.COMMISSION_DEDUCTION);
  assert.equal(wallet.history.rows[1].direction, "DEBIT");
  assert.equal(wallet.history.rows[1].amount, 3000);
  assert.equal(wallet.history.rows[1].balanceAfter, 97000);
});
