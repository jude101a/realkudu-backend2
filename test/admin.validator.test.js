import test from 'node:test';
import assert from 'node:assert/strict';
import {
  propertyIdParamSchema,
  sellerIdParamSchema,
  rejectListingBody,
  rejectKycBody,
} from '../src/validators/admin.validator.js';

const validUuid = '11111111-1111-4111-8111-111111111111';

test('propertyIdParamSchema validates uuid', () => {
  const { error } = propertyIdParamSchema.validate({ propertyId: validUuid });
  assert.equal(!!error, false);
});

test('sellerIdParamSchema validates uuid', () => {
  const { error } = sellerIdParamSchema.validate({ sellerId: validUuid });
  assert.equal(!!error, false);
});

test('rejectListingBody accepts reason', () => {
  const { error } = rejectListingBody.validate({ reason: 'Not allowed' });
  assert.equal(!!error, false);
});

test('rejectKycBody accepts reason', () => {
  const { error } = rejectKycBody.validate({ reason: 'Docs invalid' });
  assert.equal(!!error, false);
});
