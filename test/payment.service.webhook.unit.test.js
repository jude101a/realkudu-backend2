import test from "node:test";
import assert from "node:assert/strict";

import PaymentService from "../src/services/payment.js";
import EscrowService from "../src/services/escrow.service.js";

test("settleSellerPayout releases escrow after successful payment and deducts fees", async () => {
  const originalMarkHeld = EscrowService.markHeld;
  const originalApproveBuyer = EscrowService.approveBuyer;

  const calls = {
    markHeld: null,
    approveBuyer: null,
  };

  try {
    EscrowService.markHeld = async (id) => {
      calls.markHeld = id;
      return { id, status: "HELD" };
    };

    EscrowService.approveBuyer = async (id) => {
      calls.approveBuyer = id;
      return { id, status: "RELEASED" };
    };

    const result = await PaymentService.settleSellerPayout({
      escrow: { id: "escrow-123", status: "PENDING" },
      paidTransaction: {
        reference: "ref_123",
        amount: 25000,
        seller_id: "seller-456",
      },
      sellerId: "seller-456",
    });

    assert.equal(calls.markHeld, "escrow-123");
    assert.equal(calls.approveBuyer, "escrow-123");
    assert.equal(result.status, "RELEASED");
  } finally {
    EscrowService.markHeld = originalMarkHeld;
    EscrowService.approveBuyer = originalApproveBuyer;
  }
});
