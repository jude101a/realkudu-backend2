import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import houseRoutes from "./house.routes.js";
import HouseModel from "../models/house.model.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const ids = {
  house: "11111111-1111-4111-8111-111111111111",
  seller: "22222222-2222-4222-8222-222222222222",
  estate: "33333333-3333-4333-8333-333333333333",
  lawyer: "44444444-4444-4444-8444-444444444444",
  caretaker: "55555555-5555-4555-8555-555555555555",
};

const userToken = jwt.sign({ id: ids.seller, role: "user" }, process.env.JWT_SECRET);
const adminToken = jwt.sign({ id: ids.seller, role: "admin" }, process.env.JWT_SECRET);

const originalMethods = {
  create: HouseModel.create,
  findById: HouseModel.findById,
  findAll: HouseModel.findAll,
  findByEstate: HouseModel.findByEstate,
  findBySeller: HouseModel.findBySeller,
  findStandaloneBySeller: HouseModel.findStandaloneBySeller,
  updateCoverImage: HouseModel.updateCoverImage,
  updateLawyer: HouseModel.updateLawyer,
  updateCaretaker: HouseModel.updateCaretaker,
  updateFields: HouseModel.updateFields,
  softDelete: HouseModel.softDelete,
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
  app.use("/houses", houseRoutes);

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();

  HouseModel.create = originalMethods.create;
  HouseModel.findById = originalMethods.findById;
  HouseModel.findAll = originalMethods.findAll;
  HouseModel.findByEstate = originalMethods.findByEstate;
  HouseModel.findBySeller = originalMethods.findBySeller;
  HouseModel.findStandaloneBySeller = originalMethods.findStandaloneBySeller;
  HouseModel.updateCoverImage = originalMethods.updateCoverImage;
  HouseModel.updateLawyer = originalMethods.updateLawyer;
  HouseModel.updateCaretaker = originalMethods.updateCaretaker;
  HouseModel.updateFields = originalMethods.updateFields;
  HouseModel.softDelete = originalMethods.softDelete;
});

beforeEach(() => {
  HouseModel.create = async (payload) => ({ id: ids.house, ...payload });
  HouseModel.findById = async () => ({ id: ids.house, name: "Test House" });
  HouseModel.findAll = async () => ({
    rows: [{ id: ids.house, name: "Test House" }],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  HouseModel.findByEstate = async () => ({
    rows: [{ id: ids.house, estate_id: ids.estate }],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  HouseModel.findBySeller = async () => ({
    rows: [{ id: ids.house, seller_id: ids.seller }],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  HouseModel.findStandaloneBySeller = async () => ({
    rows: [{ id: ids.house, seller_id: ids.seller, is_single_house: true }],
    total: 1,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  HouseModel.updateCoverImage = async () => ({ id: ids.house, cover_image_url: "https://example.com/new.jpg" });
  HouseModel.updateLawyer = async () => ({ id: ids.house, lawyer_id: ids.lawyer });
  HouseModel.updateCaretaker = async () => ({ id: ids.house, caretaker_id: ids.caretaker });
  HouseModel.updateFields = async () => ({ id: ids.house, name: "Updated House" });
  HouseModel.softDelete = async () => ({ id: ids.house });
});

test("GET /houses returns paginated list", async () => {
  const result = await request("/houses");
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(Array.isArray(result.body.data), true);
});

test("GET /houses/standalone validates required sellerId query", async () => {
  const result = await request("/houses/standalone");
  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("GET /houses/standalone returns data when sellerId provided", async () => {
  const result = await request(`/houses/standalone?sellerId=${ids.seller}&isSingleHouse=true`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("GET /houses/seller/:sellerId returns seller houses", async () => {
  const result = await request(`/houses/seller/${ids.seller}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("GET /houses/estate/:estateId returns estate houses", async () => {
  const result = await request(`/houses/estate/${ids.estate}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("GET /houses/:id returns a single house", async () => {
  const result = await request(`/houses/${ids.house}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("POST /houses requires auth", async () => {
  const result = await request("/houses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sellerId: ids.seller, name: "A", isSingleHouse: true }),
  });
  assert.equal(result.status, 401);
});

test("POST /houses creates a house", async () => {
  const result = await request("/houses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      sellerId: ids.seller,
      estateId: ids.estate,
      name: "My House",
      type: "duplex",
      address: "12 Test Street",
      isSingleHouse: true,
      state: "Lagos",
      lga: "Eti-Osa",
    }),
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
});

test("POST /houses/createHouse (legacy) still works", async () => {
  const result = await request("/houses/createHouse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      sellerId: ids.seller,
      name: "Legacy House",
      isSingleHouse: false,
    }),
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
});

test("PUT /houses/:id/cover updates cover image", async () => {
  const result = await request(`/houses/${ids.house}/cover`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ coverImageUrl: "https://example.com/new.jpg" }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("PUT /houses/:id/lawyer updates lawyer", async () => {
  const result = await request(`/houses/${ids.house}/lawyer`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ lawyerId: ids.lawyer }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("PUT /houses/:id/caretaker updates caretaker", async () => {
  const result = await request(`/houses/${ids.house}/caretaker`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ caretakerId: ids.caretaker }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("PUT /houses/:id updates house details", async () => {
  const result = await request(`/houses/${ids.house}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ name: "Updated House" }),
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("DELETE /houses/:id requires admin role", async () => {
  const result = await request(`/houses/${ids.house}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${userToken}` },
  });
  assert.equal(result.status, 403);
});

test("DELETE /houses/:id deletes as admin", async () => {
  const result = await request(`/houses/${ids.house}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});
