import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import estateRoutes from "./estate.routes.js";
import EstateModel from "../models/estate.model.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const ids = {
  estate: "66666666-6666-4666-8666-666666666666",
  seller: "77777777-7777-4777-8777-777777777777",
};

const userToken = jwt.sign({ id: ids.seller, role: "user" }, process.env.JWT_SECRET);
const adminToken = jwt.sign({ id: ids.seller, role: "admin" }, process.env.JWT_SECRET);

const originalMethods = {
  create: EstateModel.create,
  findById: EstateModel.findById,
  findAllBySeller: EstateModel.findAllBySeller,
  findResidentialBySeller: EstateModel.findResidentialBySeller,
  findLandEstatesBySeller: EstateModel.findLandEstatesBySeller,
  updateCoverImage: EstateModel.updateCoverImage,
  updateDetails: EstateModel.updateDetails,
  softDelete: EstateModel.softDelete,
};

let server;
let baseUrl;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { status: response.status, body };
};

before(() => {
  const app = express();
  app.use(express.json());
  app.use("/estates", estateRoutes);

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();

  EstateModel.create = originalMethods.create;
  EstateModel.findById = originalMethods.findById;
  EstateModel.findAllBySeller = originalMethods.findAllBySeller;
  EstateModel.findResidentialBySeller = originalMethods.findResidentialBySeller;
  EstateModel.findLandEstatesBySeller = originalMethods.findLandEstatesBySeller;
  EstateModel.updateCoverImage = originalMethods.updateCoverImage;
  EstateModel.updateDetails = originalMethods.updateDetails;
  EstateModel.softDelete = originalMethods.softDelete;
});

beforeEach(() => {
  const paged = {
    rows: [{ id: ids.estate, seller_id: ids.seller, name: "Test Estate" }],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  };

  EstateModel.create = async (payload) => ({ id: ids.estate, ...payload });
  EstateModel.findById = async () => ({ id: ids.estate, seller_id: ids.seller, name: "Test Estate" });
  EstateModel.findAllBySeller = async () => paged;
  EstateModel.findResidentialBySeller = async () => paged;
  EstateModel.findLandEstatesBySeller = async () => paged;
  EstateModel.updateCoverImage = async () => ({ id: ids.estate, cover_image_url: "https://example.com/cover.jpg" });
  EstateModel.updateDetails = async () => ({ id: ids.estate, name: "Updated Estate" });
  EstateModel.softDelete = async () => ({ id: ids.estate });
});

test("GET /estates/seller/:sellerId returns seller estates", async () => {
  const result = await request(`/estates/seller/${ids.seller}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(Array.isArray(result.body.data), true);
});

test("GET /estates/seller/:sellerId/residential returns residential estates", async () => {
  const result = await request(`/estates/seller/${ids.seller}/residential`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("GET /estates/seller/:sellerId/land returns land estates", async () => {
  const result = await request(`/estates/seller/${ids.seller}/land`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("GET /estates/:id returns estate by id", async () => {
  const result = await request(`/estates/${ids.estate}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("GET /estates/:id validates UUID params", async () => {
  const result = await request("/estates/not-a-uuid");
  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("POST /estates requires auth", async () => {
  const result = await request("/estates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sellerId: ids.seller,
      name: "New Estate",
      address: "100 Estate Road",
    }),
  });

  assert.equal(result.status, 401);
});

test("POST /estates creates estate with valid payload", async () => {
  const result = await request("/estates", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      sellerId: ids.seller,
      name: "New Estate",
      address: "100 Estate Road",
      isLandEstate: false,
    }),
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
});

test("PUT /estates/:id/cover updates cover image", async () => {
  const result = await request(`/estates/${ids.estate}/cover`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ coverImageUrl: "https://example.com/cover.jpg" }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("PUT /estates/:id/cover-image updates cover image (alias route)", async () => {
  const result = await request(`/estates/${ids.estate}/cover-image`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ coverImageUrl: "https://example.com/cover.jpg" }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("PUT /estates/:id updates details", async () => {
  const result = await request(`/estates/${ids.estate}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ name: "Updated Estate" }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("DELETE /estates/:id requires admin role", async () => {
  const result = await request(`/estates/${ids.estate}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${userToken}` },
  });

  assert.equal(result.status, 403);
});

test("DELETE /estates/:id deletes estate as admin", async () => {
  const result = await request(`/estates/${ids.estate}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});
