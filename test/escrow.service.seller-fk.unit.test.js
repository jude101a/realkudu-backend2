import test from "node:test";
import assert from "node:assert/strict";

import EscrowService from "../src/services/escrow.service.js";
import SellerModel from "../src/models/seller.model.js";
import EscrowRepository from "../src/repositories/escrow.repository.js";

test("createFromTransaction resolves a user_id to a sellers.id before escrow insert", async () => {
  const originalFindById = SellerModel.findById;
  const originalFindByUserId = SellerModel.findByUserId;
  const originalCreate = EscrowRepository.create;

  const seen = {};

  try {
    SellerModel.findById = async (id) => {
      if (id === "user-99") {
        return { rows: [] };
      }
      if (id === "seller-123") {
        return { rows: [{ id: "seller-123", user_id: "user-99" }] };
      }
      return { rows: [] };
    };

    SellerModel.findByUserId = async (id) => {
      if (id === "user-99") {
        return { rows: [{ id: "seller-123", user_id: "user-99" }] };
      }
      return { rows: [] };
    };

    EscrowRepository.create = async (payload) => {
      seen.payload = payload;
      return payload;
    };

    const result = await EscrowService.createFromTransaction({
      id: "txn-1",
      seller_id: "user-99",
      buyer_id: "buyer-1",
      property_id: "property-1",
    });

    assert.equal(result.sellerId, "seller-123");
    assert.equal(seen.payload.sellerId, "seller-123");
    assert.equal(seen.payload.transactionId, "txn-1");
  } finally {
    SellerModel.findById = originalFindById;
    SellerModel.findByUserId = originalFindByUserId;
    EscrowRepository.create = originalCreate;
  }
});
