import test, { after, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import jwt from "jsonwebtoken";
import imagesRoutes from "./utility.routes/images.routes.js";
import ImagesModel from "../models/utility.models/images.js";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const ids = {
  image: "11111111-1111-4111-8111-111111111111",
  propertyA: "22222222-2222-4222-8222-222222222222",
  propertyB: "33333333-3333-4333-8333-333333333333",
  user: "44444444-4444-4444-8444-444444444444",
};

const userToken = jwt.sign({ id: ids.user, role: "user" }, process.env.JWT_SECRET);

const originalMethods = {
  insertImage: ImagesModel.insertImage,
  getPropertyImage: ImagesModel.getPropertyImage,
  getPropertyImagesByPropertyIds: ImagesModel.getPropertyImagesByPropertyIds,
  deleteImage: ImagesModel.deleteImage,
  deletePropertyImages: ImagesModel.deletePropertyImages,
  bulkDeletePropertyImages: ImagesModel.bulkDeletePropertyImages,
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
  app.use("/images", imagesRoutes);

  server = app.listen(0);
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(() => {
  server.close();

  ImagesModel.insertImage = originalMethods.insertImage;
  ImagesModel.getPropertyImage = originalMethods.getPropertyImage;
  ImagesModel.getPropertyImagesByPropertyIds = originalMethods.getPropertyImagesByPropertyIds;
  ImagesModel.deleteImage = originalMethods.deleteImage;
  ImagesModel.deletePropertyImages = originalMethods.deletePropertyImages;
  ImagesModel.bulkDeletePropertyImages = originalMethods.bulkDeletePropertyImages;
});

beforeEach(() => {
  ImagesModel.insertImage = async (payload) => ({ imageId: ids.image, ...payload });
  ImagesModel.getPropertyImage = async () => [
    { imageId: ids.image, propertyId: ids.propertyA, imageUrl: "https://example.com/a.jpg", isCover: true },
  ];
  ImagesModel.getPropertyImagesByPropertyIds = async () => [
    { imageId: ids.image, propertyId: ids.propertyA, imageUrl: "https://example.com/a.jpg", isCover: true },
    { imageId: "55555555-5555-4555-8555-555555555555", propertyId: ids.propertyB, imageUrl: "https://example.com/b.jpg", isCover: false },
  ];
  ImagesModel.deleteImage = async () => ({ imageId: ids.image });
  ImagesModel.deletePropertyImages = async () => [{ imageId: ids.image, propertyId: ids.propertyA }];
  ImagesModel.bulkDeletePropertyImages = async () => [
    { imageId: ids.image, propertyId: ids.propertyA },
    { imageId: "55555555-5555-4555-8555-555555555555", propertyId: ids.propertyB },
  ];
});

test("GET /images/property/:propertyId returns property images", async () => {
  const result = await request(`/images/property/${ids.propertyA}`);
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(Array.isArray(result.body.data), true);
});

test("GET /images/property/:propertyId validates UUID params", async () => {
  const result = await request("/images/property/not-a-uuid");
  assert.equal(result.status, 400);
  assert.equal(result.body.success, false);
});

test("POST /images/bulk/get-by-property-ids returns combined image list", async () => {
  const result = await request("/images/bulk/get-by-property-ids", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ propertyIds: [ids.propertyA, ids.propertyB] }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.meta.total, 2);
});

test("POST /images requires auth", async () => {
  const result = await request("/images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      propertyId: ids.propertyA,
      imageUrl: "https://example.com/a.jpg",
      isCover: true,
    }),
  });

  assert.equal(result.status, 401);
});

test("POST /images creates image with valid payload", async () => {
  const result = await request("/images", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      propertyId: ids.propertyA,
      imageUrl: "https://example.com/a.jpg",
      isCover: true,
    }),
  });

  assert.equal(result.status, 201);
  assert.equal(result.body.success, true);
});

test("DELETE /images/:imageId deletes single image", async () => {
  const result = await request(`/images/${ids.image}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${userToken}` },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
});

test("DELETE /images/property/:propertyId deletes all images for one property", async () => {
  const result = await request(`/images/property/${ids.propertyA}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${userToken}` },
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.meta.deletedCount, 1);
});

test("DELETE /images/bulk/delete-by-property-ids deletes by multiple properties", async () => {
  const result = await request("/images/bulk/delete-by-property-ids", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({ propertyIds: [ids.propertyA, ids.propertyB] }),
  });

  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.meta.deletedCount, 2);
});
