import PurchaseProcessModel from "../models/purchase.process.model.js";

const ok = (res, data, message = "Success", meta = undefined, status = 200) =>
  res.status(status).json({
    success: true,
    message,
    data,
    ...(meta ? { meta } : {}),

  });

const fail = (res, status, message, code = "BAD_REQUEST", details = undefined) =>
  res.status(status).json({
    success: false,
    error: { code, message, details },
  });

const wrap = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    console.error("[purchase.process.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
      stack: error?.stack,
    });

    return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
};

const todayDate = () => new Date().toISOString().slice(0, 10);
const getBuyerIdFromBody = (req) => req.body?.buyerId;
const getBuyerIdFromQuery = (req) => req.query?.buyerId;

export const getPurchaseProcessByPropertyId = wrap(async (req, res) => {
  const process = await PurchaseProcessModel.findByPropertyId(
    req.params.propertyId,
    getBuyerIdFromQuery(req)
  );

  if (!process) {
    return fail(res, 404, "Purchase process not found for this property", "NOT_FOUND");
  }

  return ok(res, process, "Purchase process retrieved successfully");
});

export const requestInspection = wrap(async (req, res) => {
  const process = await PurchaseProcessModel.requestInspection(
    req.params.propertyId,
    getBuyerIdFromBody(req),
    req.body
  );

  return ok(res, process, "Inspection requested successfully");
});

export const confirmInspection = wrap(async (req, res) => {
  const existing = await PurchaseProcessModel.findInspectionPaymentByPropertyId(
    req.params.propertyId,
    getBuyerIdFromBody(req)
  );

  if (!existing) {
    return fail(
      res,
      404,
      "Inspection request not found for this property",
      "NOT_FOUND"
    );
  }

  const process = await PurchaseProcessModel.confirmInspection(
    req.params.propertyId,
    getBuyerIdFromBody(req),
    req.body
  );

  return ok(res, process, "Inspection confirmed successfully");
});

export const requestPayment = wrap(async (req, res) => {
  const body = req.body || {};
  const payload = {
    ...body,
    requestPaymentDate: body.requestPaymentDate || todayDate(),
  };

  const process = await PurchaseProcessModel.requestPayment(
    req.params.propertyId,
    body.buyerId,
    payload
  );

  return ok(res, process, "Payment requested successfully");
});

export const requestContractSigning = wrap(async (req, res) => {
  const process = await PurchaseProcessModel.requestContractSigning(
    req.params.propertyId,
    getBuyerIdFromBody(req),
    req.body
  );

  return ok(res, process, "Contract signing requested successfully");
});

export const confirmContractSigning = wrap(async (req, res) => {
  const existing = await PurchaseProcessModel.findContractUploadByPropertyId(
    req.params.propertyId,
    getBuyerIdFromBody(req)
  );

  if (!existing) {
    return fail(
      res,
      404,
      "Contract signing request not found for this property",
      "NOT_FOUND"
    );
  }

  const process = await PurchaseProcessModel.confirmContractSigning(
    req.params.propertyId,
    getBuyerIdFromBody(req),
    req.body
  );

  return ok(res, process, "Contract signing confirmed successfully");
});

export const confirmDocumentUpload = wrap(async (req, res) => {
  const existing = await PurchaseProcessModel.findContractUploadByPropertyId(
    req.params.propertyId,
    getBuyerIdFromBody(req)
  );

  if (!existing) {
    return fail(
      res,
      404,
      "Contract process not found for this property",
      "NOT_FOUND"
    );
  }

  const body = req.body || {};
  const payload = {
    ...body,
    documentUploadDate: body.documentUploadDate || todayDate(),
    processCompletion: body.processCompletion ?? true,
  };

  const process = await PurchaseProcessModel.confirmDocumentUpload(
    req.params.propertyId,
    body.buyerId,
    payload
  );

  return ok(res, process, "Document upload confirmed successfully");
});
