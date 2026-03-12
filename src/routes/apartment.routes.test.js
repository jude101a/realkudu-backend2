import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import apartmentRoutes from "./apartment.routes.js";
import ApartmentModel from "../models/apartment.model.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const ids = {
  apartment: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  house: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  seller: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
};

const userToken = jwt.sign({ id: ids.seller, role: "user" }, process.env.JWT_SECRET);

const originalMethods = {
  create: ApartmentModel.create,
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
  app.use("/apartments", apartmentRoutes);

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();
  ApartmentModel.create = originalMethods.create;
});

beforeEach(() => {
  ApartmentModel.create = async (payload) => ({ id: ids.apartment, ...payload });
});

test("POST /apartments requires auth", async () => {
  const result = await request("/apartments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      houseId: ids.house,
      sellerId: ids.seller,
      apartmentAddress: "12 Test Street",
    }),
  });

  assert.equal(result.status, 401);
  assert.equal(result.body.success, false);
});

test("POST /apartments creates an apartment", async () => {
  const result = await request("/apartments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      houseId: ids.house,
      sellerId: ids.seller,
      apartmentAddress: "12 Test Street",
      numberOfBedrooms: 2,
      rentAmount: 150000,
    }),
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.id, ids.apartment);
});
