import PurchaseProcessModel from "../models/purchase.process.model.js";
import PropertyModel from "../models/property.model.js";

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

  const token = req.headers.authorization?.split(' ')[1];
    const { user_id, seller_id } = jwt.verify(token, process.env.JWT_SECRET);

   const property = await PropertyModel.findById(req.params.propertyId);
   const seller = await SellerModel.findById(seller_id);
   const buyer = await findUserById(user_id);
  if (!property) {
    return fail(res, 404, "Property not found", "NOT_FOUND");
  }
  const process = await PurchaseProcessModel.requestInspection(
    req.params.propertyId,
    getBuyerIdFromBody(req),
    req.body
  );
  try {
      await sendNotification({
  title: "Inspection Requested",
  body: `You have requested an inspection for ${property.name}.\nThe firm will now be in charge of legal affairs of the property.\nIf you did not make this change, please contact support immediately.`,
  channels: ["EMAIL", "PUSH"],
  data: {
    "property":property
  },
  email: buyer.email,
  jobName: "sendAccountActionEmail",
  userName: buyer.first_name,
  userId: user_id,
});

try {
      await sendNotification({
  title: "Property Inspection Requested",
  body: `A customer have requested an inspection for ${property.name}.\n Do well to schedule for inspection as soon as possible.\n\n If you have further questions, please contact support immediately.`,
  channels: ["EMAIL", "PUSH"],
  data: {},
  email: seller.email,
  jobName: "sendAccountActionEmail",
  userName: seller.first_name,
  userId: seller_id,
});
    } catch (error) {
      logger.error("Failed to send property inspection requested notification:", error.message || error);
    }
    } catch (error) {
      logger.error("Failed to send inspection request notification:", error.message || error);
    }

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

  try {
      await sendNotification({
  title: "Inspection Confirmed",
  body: `Your inspection for ${property.name} has been confirmed.\nBelow are the details.\n please contact support immediately.`,
  channels: ["EMAIL", "PUSH"],
  data: {},
  email: seller.email,
  jobName: "sendAccountActionEmail",
  userName: seller.first_name,
  userId: seller_id,
});
    } catch (error) {
      logger.error("Failed to send inspection confirmed notification:", error.message || error);
    }
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
