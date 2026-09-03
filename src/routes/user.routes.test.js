import assert from "node:assert/strict";
import test from "node:test";
import bcrypt from "bcrypt";
import { __setInternalPoolForTests } from "../config/db.js";

process.env.DISABLE_REDIS = "true";
process.env.JWT_SECRET ||= "test-secret";

test("register creates a user account", async (t) => {
  // stub DB pool to simulate INSERT returning a new user row
  __setInternalPoolForTests({
    query: async (text, params) => {
      if (/INSERT INTO \w+ \(/i.test(text)) {
        return {
          rows: [
            {
              id: "11111111-1111-1111-1111-111111111111",
              email: params[0],
              first_name: params[3],
              last_name: params[4],
              role: params[17] || "user",
              is_verified: false,
              phone_number: params[5],
              password_hash: params[1],
            },
          ],
        };
      }
      return { rows: [] };
    },
    on: () => {},
    end: async () => {},
  });

  const { register } = await import("../controllers/user.controller.js");
  const req = {
    body: {
      email: "alice@example.com",
      password: "secret123",
      firebaseUid: "firebase-uid-123",
      firstName: "Alice",
      lastName: "Example",
    },
  };

  const res = {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };

  await register(req, res, () => {});

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.user.email, "alice@example.com");
  assert.equal(res.payload.user.firstName, "Alice");
  assert.equal(res.payload.user.lastName, "Example");
});

test("login fails cleanly when JWT secret is missing", async (t) => {
  const originalSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  // stub DB pool to return a single user row for select
  __setInternalPoolForTests({
    query: async (text, params) => {
      if (/SELECT \*/i.test(text)) {
        return {
          rows: [
            {
              id: "22222222-2222-2222-2222-222222222222",
              email: params[0] || "alice@example.com",
              role: "user",
              password_hash: await bcrypt.hash("secret123", 12),
              first_name: "Alice",
              last_name: "Example",
              is_verified: true,
              phone_number: null,
            },
          ],
        };
      }
      return { rows: [] };
    },
    on: () => {},
    end: async () => {},
  });

  const { login } = await import("../controllers/user.controller.js");
  const req = { body: { email: "alice@example.com", password: "secret123" } };

  const res = {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
  };

  await login(req, res, () => {});

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.success, false);
  assert.equal(res.payload.error, "JWT_SECRET is not configured");

  if (originalSecret) process.env.JWT_SECRET = originalSecret;
});
