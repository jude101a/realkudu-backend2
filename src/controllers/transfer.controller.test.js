import test from "node:test";
import assert from "node:assert/strict";
import TransferController from "./transfer.controller.js";
import TransferService from "../services/transfer.service.js";

test("initiate returns a created transfer response", async () => {
  const original = TransferService.initiateTransfer;
  const captured = [];

  TransferService.initiateTransfer = async (payload) => {
    captured.push(payload);
    return { reference: "TRF-1", status: "PENDING" };
  };

  const req = {
    user: { id: "user-1" },
    body: {
      escrow: { amount: 1000 },
      recipientCode: "RCP_123",
      reason: "Settlement",
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
  const next = () => {};

  await TransferController.initiate(req, res, next);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(captured[0], {
    escrow: { amount: 1000 },
    recipientCode: "RCP_123",
    reason: "Settlement",
  });
  assert.equal(res.body.success, true);
  assert.equal(res.body.data.reference, "TRF-1");

  TransferService.initiateTransfer = original;
});
