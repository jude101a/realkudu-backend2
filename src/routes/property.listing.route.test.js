import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";

import pool from "../config/db.js";
import propertyListingRouter from "./property.listing.route.js";

const LIST_ROW = {
  property_type: "land",
  id: "11111111-1111-1111-1111-111111111111",
  name: "Sample Land",
  location: "Lekki, Lagos",
  price: "2500000",
  seller_id: "22222222-2222-2222-2222-222222222222",
  created_at: "2026-04-17T00:00:00.000Z",
  updated_at: "2026-04-17T00:00:00.000Z",
  details: { country: "Nigeria" },
  total_count: 1,
};

const closeServer = (server) =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const createTestServer = async () => {
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use("/api/properties", propertyListingRouter);

  const server = app.listen(0);
  await once(server, "listening");
  return server;
};

test("getUserSpecific supports GET search across q, location, type, and body filters", async (t) => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes("GROUP BY property_type")) {
      return { rows: [{ property_type: "land", count: 1 }] };
    }

    return { rows: [LIST_ROW] };
  };

  t.after(() => {
    pool.query = originalQuery;
  });

  const server = await createTestServer();
  t.after(() => closeServer(server));

  const baseUrl = `http://127.0.0.1:${server.address().port}/api/properties/getUserSpecific`;

  const getResponse = await fetch(
    `${baseUrl}?q=lekki&location=Nigeria&propertyType=all&page=1&limit=20`
  );
  assert.equal(getResponse.status, 200);

  const getBody = await getResponse.json();
  assert.equal(getBody.success, true);
  assert.equal(getBody.meta.total, 1);
  assert.equal(getBody.meta.appliedFilters.q, "lekki");
  assert.equal(getBody.meta.appliedFilters.location, "Nigeria");
  assert.equal(getBody.meta.appliedFilters.propertyType, "all");
  assert.equal(getBody.data[0].details.country, "Nigeria");

  assert.match(calls[0].sql, /a\.house_name ILIKE/);
  assert.match(calls[0].sql, /l\.property_name ILIKE/);
  assert.match(calls[0].sql, /h\.address ILIKE/);
  assert.match(calls[0].sql, /h\.house_type ILIKE/);
  assert.match(calls[0].sql, /apartment_user\.country ILIKE/);
  assert.match(calls[0].sql, /land_user\.country ILIKE/);
  assert.match(calls[0].sql, /house_user\.country ILIKE/);
  assert.doesNotMatch(calls[0].sql, /h\.house_name/);
  assert.ok(calls[0].params.includes("%lekki%"));
  assert.ok(calls[0].params.includes("%Nigeria%"));

  const postResponse = await fetch(baseUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Detached",
      houseType: "Duplex",
      propertyType: "houses",
      page: 2,
      limit: 5,
    }),
  });
  assert.equal(postResponse.status, 200);

  const postBody = await postResponse.json();
  assert.equal(postBody.success, true);
  assert.equal(postBody.meta.page, 2);
  assert.equal(postBody.meta.limit, 5);
  assert.equal(postBody.meta.appliedFilters.name, "Detached");
  assert.equal(postBody.meta.appliedFilters.houseType, "Duplex");
  assert.equal(postBody.meta.appliedFilters.propertyType, "house");
  assert.match(calls[2].sql, /h\.house_type ILIKE/);
  assert.doesNotMatch(calls[2].sql, /h\.house_name/);
  assert.ok(calls[2].params.includes("%Detached%"));
  assert.ok(calls[2].params.includes("%Duplex%"));
  assert.equal(calls[2].params.at(-2), 5);
  assert.equal(calls[2].params.at(-1), 5);
});

test("getUserSpecific returns exact query error details instead of a blind internal error", async (t) => {
  const originalQuery = pool.query;

  pool.query = async () => {
    const error = new Error("column h.house_name does not exist");
    error.code = "42703";
    throw error;
  };

  t.after(() => {
    pool.query = originalQuery;
  });

  const server = await createTestServer();
  t.after(() => closeServer(server));

  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/properties/getUserSpecific?propertyType=house`
  );
  assert.equal(response.status, 500);

  const body = await response.json();
  assert.equal(body.success, false);
  assert.equal(body.error.code, "QUERY_ERROR");
  assert.equal(body.error.message, "Property query failed");
  assert.equal(body.error.details.databaseCode, "42703");
  assert.match(body.error.details.databaseMessage, /house_name/);
});
