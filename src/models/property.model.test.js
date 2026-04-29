import assert from "node:assert/strict";
import test from "node:test";

import pool from "../config/db.js";
import PropertyModel from "./property.model.js";

test("property search casts enum/text fields before ILIKE", async (t) => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });

    if (sql.includes("COUNT(*)")) {
      return { rows: [{ count: 1 }] };
    }

    return { rows: [{ property_id: "property-1" }] };
  };

  t.after(() => {
    pool.query = originalQuery;
  });

  const result = await PropertyModel.list({
    filters: {
      q: "Nkanu west",
      propertyType: "house",
    },
  });

  assert.equal(result.total, 1);
  assert.equal(result.rows.length, 1);

  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.match(call.sql, /property_type = \$1/);
    assert.match(call.sql, /COALESCE\(property_type::text, ''\) ILIKE \$2 ESCAPE/);
    assert.doesNotMatch(call.sql, /property_type ILIKE/);
    assert.deepEqual(call.params.slice(0, 2), ["house", "%Nkanu west%"]);
  }
});

test("property search escapes LIKE wildcard characters", async (t) => {
  const originalQuery = pool.query;
  const calls = [];

  pool.query = async (sql, params) => {
    calls.push({ sql, params });
    return sql.includes("COUNT(*)")
      ? { rows: [{ count: 0 }] }
      : { rows: [] };
  };

  t.after(() => {
    pool.query = originalQuery;
  });

  await PropertyModel.list({
    filters: {
      q: "50%_off\\promo",
    },
  });

  assert.equal(calls[0].params[0], "%50\\%\\_off\\\\promo%");
});
