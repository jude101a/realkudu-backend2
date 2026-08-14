import test from 'node:test';
import assert from 'node:assert/strict';
import Joi from 'joi';
import {
  createTenantSchema,
  markRentPaidSchema,
  updateOutstandingSchema,
  serveNoticeSchema,
  terminateSchema,
  byTenantQuery,
  byPropertyQuery,
  tenantMetaIdParam,
} from '../src/validators/tenant.validator.js';

const validUuid = '11111111-1111-4111-8111-111111111111';

test('createTenantSchema allows valid payload', () => {
  const payload = {
    tenant_id: validUuid,
    property_id: validUuid,
    rent_amount: 50000,
    rent_currency: 'NGN',
    rent_frequency: 'monthly',
    tenancy_start_date: '2026-08-01',
  };
  const { error, value } = createTenantSchema.validate(payload);
  assert.equal(!!error, false);
  assert.equal(value.rent_frequency, 'monthly');
});

test('createTenantSchema rejects missing required fields', () => {
  const payload = { tenant_id: validUuid };
  const { error } = createTenantSchema.validate(payload);
  assert.ok(error, 'Expected validation error');
});

test('markRentPaidSchema accepts paymentDate', () => {
  const { error } = markRentPaidSchema.validate({ paymentDate: '2026-08-12' });
  assert.equal(!!error, false);
});

test('updateOutstandingSchema requires outstandingAmount', () => {
  const { error } = updateOutstandingSchema.validate({});
  assert.ok(error, 'Expected validation error');
});

test('serveNoticeSchema requires noticeDate', () => {
  const { error } = serveNoticeSchema.validate({});
  assert.ok(error, 'Expected validation error');
});

test('terminateSchema requires terminationDate', () => {
  const { error } = terminateSchema.validate({});
  assert.ok(error, 'Expected validation error');
});

test('query and params schemas validate uuids', () => {
  assert.equal(!!byTenantQuery.validate({ tenantID: validUuid }).error, false);
  assert.equal(!!byPropertyQuery.validate({ propertyID: validUuid }).error, false);
  assert.equal(!!tenantMetaIdParam.validate({ tenantMetaId: validUuid }).error, false);
});
