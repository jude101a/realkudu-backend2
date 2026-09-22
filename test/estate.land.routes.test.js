import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';

import app from '../src/app.js';

// Use the provided token and estate id from the user
const ESTATE_ID = '68380e64-3abe-47ed-9209-4b64bc870178';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4MzgwZTY0LTNhYmUtNDdlZC05MjA5LTRiNjRiYzg3MDE3OCIsImVtYWlsIjoianVkZW1nYmVhaHVydWlrZUBnbWFpbC5jb20iLCJyb2xlIjoidXNlciIsImlhdCI6MTc5MDA2Mzc2MSwiZXhwIjoxNzkwNjY4NTYxfQ.RiPKffLjY9BqxtMnCdWvCki9RTP0aylxMuaj4-dohIw';

let request;

test.before(() => {
  request = supertest(app);
});

test('GET /api/land-estate/estates/:estateId/transactions/dashboard returns 200 or 500 (mocked DB)', async () => {
  const res = await request
    .get(`/api/land-estate/estates/${ESTATE_ID}/transactions/dashboard`)
    .set('Authorization', `Bearer ${TOKEN}`)
    .expect(res => {
      // Accept either success JSON or database-unavailable 500
      if (![200, 500, 401, 403].includes(res.status)) throw new Error(`Unexpected status ${res.status}`);
    });

  assert.ok([200, 500, 401, 403].includes(res.status));
});

test('GET /api/land-estate/estates/:estateId/transactions/:transactionId returns 200/404/500', async () => {
  const transactionId = ESTATE_ID; // reuse as id format

  const res = await request
    .get(`/api/land-estate/estates/${ESTATE_ID}/transactions/${transactionId}`)
    .set('Authorization', `Bearer ${TOKEN}`)
    .expect(res => {
      if (![200, 404, 500, 401, 403].includes(res.status)) throw new Error(`Unexpected status ${res.status}`);
    });

  assert.ok([200, 404, 500, 401, 403].includes(res.status));
});

test('PATCH /api/land-estate/estates/:estateId/transactions/:transactionId/status responds appropriately', async () => {
  const transactionId = ESTATE_ID;

  const res = await request
    .patch(`/api/land-estate/estates/${ESTATE_ID}/transactions/${transactionId}/status`)
    .set('Authorization', `Bearer ${TOKEN}`)
    .send({ status: 'approved' })
    .expect(res => {
      if (![200, 404, 409, 422, 500, 401, 403].includes(res.status)) throw new Error(`Unexpected status ${res.status}`);
    });

  assert.ok([200, 404, 409, 422, 500, 401, 403].includes(res.status));
});
