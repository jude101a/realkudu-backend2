import TenantModel from "../models/tenant.model.js";
import PropertyModel from "../models/property.model.js";
import { wrapHandler } from "../utils/controllerHelpers.js";

const ok = (res, data, message = "Success", meta = undefined, status = 200) =>
  res.status(status).json({ success: true, message, data, ...(meta ? { meta } : {}) });

const fail = (res, status, message, code = "BAD_REQUEST", details = undefined) =>
  res.status(status).json({ success: false, error: { code, message, details } });

const isUuid = (value) => typeof value === "string" && /^[0-9a-f\-]{36}$/i.test(value);

export const createTenantMeta = wrapHandler(async (req, res) => {
  const payload = req.body || {};
  const created = await TenantModel.createTenantMeta(payload);
  // attempt to link tenant to the property record
  try {
    if (created?.property_id && created?.tenant_id) {
      await PropertyModel.update(created.property_id, { tenantId: created.tenant_id });
    }
  } catch (err) {
    // non-fatal: linking failure should not prevent creating tenant meta
    console.warn("Failed to update property tenant link", err?.message || err);
  }
  return ok(res, created, "Tenant meta created", undefined, 201);
});

export const getTenantMetaByTenant = wrapHandler(async (req, res) => {
  const tenantId = req.query.tenantID || req.query.tenantId || req.params.tenantId;
  if (!tenantId || !isUuid(tenantId)) return fail(res, 400, "tenantId is required and must be a UUID", "VALIDATION_ERROR");
  const record = await TenantModel.getTenantMetaByTenant(tenantId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Tenant meta retrieved successfully");
});

export const getTenantMetaByProperty = wrapHandler(async (req, res) => {
  const propertyId = req.query.propertyID || req.query.propertyId || req.params.propertyId;
  if (!propertyId || !isUuid(propertyId)) return fail(res, 400, "propertyId is required and must be a UUID", "VALIDATION_ERROR");
  const record = await TenantModel.getTenantMetaByProperty(propertyId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Tenant meta retrieved successfully");
});

export const markRentPaid = wrapHandler(async (req, res) => {
  const { tenantMetaId } = req.params;
  if (!isUuid(tenantMetaId)) return fail(res, 400, "tenantMetaId must be UUID", "VALIDATION_ERROR");
  const paymentDate = req.body.paymentDate || new Date().toISOString();
  const nextDueDate = req.body.nextDueDate || null;
  const record = await TenantModel.markRentPaid(tenantMetaId, paymentDate, nextDueDate);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Rent marked as paid");
});

export const updateOutstandingBalance = wrapHandler(async (req, res) => {
  const { tenantMetaId } = req.params;
  if (!isUuid(tenantMetaId)) return fail(res, 400, "tenantMetaId must be UUID", "VALIDATION_ERROR");
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount)) return fail(res, 400, "amount must be a number", "VALIDATION_ERROR");
  const record = await TenantModel.updateOutstandingBalance(tenantMetaId, amount);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Outstanding balance updated");
});

export const serveTenantNotice = wrapHandler(async (req, res) => {
  const { tenantMetaId } = req.params;
  if (!isUuid(tenantMetaId)) return fail(res, 400, "tenantMetaId must be UUID", "VALIDATION_ERROR");
  const record = await TenantModel.serveNotice(tenantMetaId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, record, "Notice served");
});

export const terminateTenantTenancy = wrapHandler(async (req, res) => {
  const { tenantMetaId } = req.params;
  if (!isUuid(tenantMetaId)) return fail(res, 400, "tenantMetaId must be UUID", "VALIDATION_ERROR");
  const record = await TenantModel.terminateTenancy(tenantMetaId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  try {
    if (record?.property_id) {
      // clear tenant_id on the property
      await PropertyModel.update(record.property_id, { tenantId: null });
    }
  } catch (err) {
    console.warn("Failed to unlink tenant from property", err?.message || err);
  }
  return ok(res, record, "Tenancy terminated");
});

export const deleteTenantMeta = wrapHandler(async (req, res) => {
  const { tenantMetaId } = req.params;
  if (!isUuid(tenantMetaId)) return fail(res, 400, "tenantMetaId must be UUID", "VALIDATION_ERROR");
  const record = await TenantModel.deleteTenantMeta(tenantMetaId);
  if (!record) return fail(res, 404, "Tenant meta not found", "NOT_FOUND");
  return ok(res, { id: tenantMetaId }, "Tenant meta deleted successfully");
});

export default {
  createTenantMeta,
  getTenantMetaByTenant,
  getTenantMetaByProperty,
  markRentPaid,
  updateOutstandingBalance,
  serveTenantNotice,
  terminateTenantTenancy,
  deleteTenantMeta,
};
