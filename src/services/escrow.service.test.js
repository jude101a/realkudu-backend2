import assert from "node:assert/strict";
import test from "node:test";

import { ESCROW_STATUS, EscrowService } from "./escrow.service.js";

test("escrow status transitions from pending to held to released", async () => {
  const escrow = {
    id: "11111111-1111-1111-1111-111111111111",
    transaction_id: "22222222-2222-2222-2222-222222222222",
    property_id: "33333333-3333-3333-3333-333333333333",
    buyer_id: "44444444-4444-4444-4444-444444444444",
    seller_id: "55555555-5555-5555-5555-555555555555",
    agent_id: null,
    status: ESCROW_STATUS.PENDING,
  };

  const calls = [];
  const db = {
    async connect() {
      return {
        async query(sql, params = []) {
          const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
          if (["begin", "commit", "rollback"].includes(normalized)) {
            return { rows: [] };
          }
          if (normalized.startsWith("update escrows")) {
            escrow.status = ESCROW_STATUS.RELEASED;
            escrow.released_at = "2026-08-07T00:00:00.000Z";
            return { rows: [{ ...escrow }] };
          }
          throw new Error(`Unexpected query: ${normalized}`);
        },
        release() {},
      };
    },
  };
  const walletService = {
    async recordEscrowRelease() {
      calls.push({ method: "recordEscrowRelease" });
    },
  };
  const escrowRepository = {
    async findById(id) {
      assert.equal(id, escrow.id);
      return { ...escrow };
    },
    async updateStatus(id, status) {
      calls.push({ method: "updateStatus", id, status });
      escrow.status = status;
      return { ...escrow };
    },
  };

  const service = new EscrowService({ escrowRepository, walletService, db });

  const held = await service.markHeld(escrow.id);
  assert.equal(held.status, ESCROW_STATUS.HELD);

  const released = await service.releaseEscrow(escrow.id);
  assert.equal(released.status, ESCROW_STATUS.RELEASED);
  assert.equal(released.released_at, "2026-08-07T00:00:00.000Z");

  assert.deepEqual(calls, [
    { method: "updateStatus", id: escrow.id, status: ESCROW_STATUS.HELD },
    { method: "recordEscrowRelease" },
  ]);
});
