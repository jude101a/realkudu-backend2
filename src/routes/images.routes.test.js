import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import jwt from "jsonwebtoken";

import imagesRouter from "./utility.routes/images.routes.js";

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const createTestServer = async () => {
  process.env.JWT_SECRET ||= "test-secret";

  const app = express();
  app.use("/api/images", imagesRouter);

  const server = app.listen(0);
  await once(server, "listening");
  return server;
};

const authHeaders = () => ({
  authorization: `Bearer ${jwt.sign(
    { id: "55555555-5555-5555-5555-555555555555", role: "seller" },
    process.env.JWT_SECRET
  )}`,
});

test("media upload rejects unsupported file types before Cloudinary", async (t) => {
  const server = await createTestServer();
  t.after(() => closeServer(server));

  const form = new FormData();
  form.set("propertyId", "33333333-3333-4333-8333-333333333333");
  form.set("file", new Blob(["hello"], { type: "text/plain" }), "notes.txt");

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/images/createImages`,
    {
      method: "POST",
      headers: authHeaders(),
      body: form,
    }
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "INVALID_FILE_TYPE");
});

test("media upload accepts video MIME types and reports Cloudinary config errors", async (t) => {
  const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const originalApiKey = process.env.CLOUDINARY_API_KEY;
  const originalApiSecret = process.env.CLOUDINARY_API_SECRET;
  const originalCloudinaryUrl = process.env.CLOUDINARY_URL;

  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;
  delete process.env.CLOUDINARY_URL;

  t.after(() => {
    if (originalCloudName) process.env.CLOUDINARY_CLOUD_NAME = originalCloudName;
    if (originalApiKey) process.env.CLOUDINARY_API_KEY = originalApiKey;
    if (originalApiSecret) process.env.CLOUDINARY_API_SECRET = originalApiSecret;
    if (originalCloudinaryUrl) process.env.CLOUDINARY_URL = originalCloudinaryUrl;
  });

  const server = await createTestServer();
  t.after(() => closeServer(server));

  const form = new FormData();
  form.set("propertyId", "33333333-3333-4333-8333-333333333333");
  form.set("file", new Blob(["fake-video"], { type: "video/mp4" }), "walkthrough.mp4");

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/images/createImages`,
    {
      method: "POST",
      headers: authHeaders(),
      body: form,
    }
  );
  const body = await response.json();

  assert.equal(response.status, 502);
  assert.equal(body.success, false);
  assert.equal(body.error.code, "CLOUDINARY_UPLOAD_ERROR");
});
