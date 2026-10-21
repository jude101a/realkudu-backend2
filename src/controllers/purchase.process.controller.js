import PurchaseProcessModel from "../models/purchase.process.model.js";
import PropertyModel from "../models/property.model.js";
import { sendNotification } from "../services/notification.service.js";
import PurchasePaymentProcessModel from "../models/payment.model.js";

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

    return fail(res, error?.status || 500, error?.status ? error.message : "Internal server error", error?.status === 403 ? "FORBIDDEN" : error?.status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR");
  }
};

const todayDate = () => new Date().toISOString().slice(0, 10);
const getBuyerIdFromBody = (req) => req.body?.buyerId;
const getAuthenticatedUserId = (req) => req.user?.id || req.user?.user_id || req.user?.seller_id;

const notifyOrderParties = async (order, orderId, title, body, step) =>
  Promise.all([order.buyer_id, order.seller_id].filter(Boolean).map((userId) =>
    sendNotification({ userId, title, body, data: { orderId, step } })
  ));

export const requestAllocation = wrap(async (req, res) => {
  const result = await PurchaseProcessModel.requestAllocation(
    req.params.orderId,
    getAuthenticatedUserId(req),
    req.body || {}
  );
  await notifyOrderParties(
    result.order,
    req.params.orderId,
    "Property allocation requested",
    "The buyer has requested allocation of the property. Awaiting seller confirmation.",
    result.currentStep.step
  );
  return ok(res, result, "Property allocation requested successfully", undefined, 201);
});

export const confirmAllocation = wrap(async (req, res) => {
  const result = await PurchaseProcessModel.confirmAllocation(
    req.params.orderId,
    getAuthenticatedUserId(req),
    req.body || {}
  );
  await notifyOrderParties(
    result.order,
    req.params.orderId,
    "Property allocation confirmed",
    "The seller has confirmed allocation of the property.",
    result.currentStep.step
  );
  return ok(res, result, "Property allocation confirmed successfully");
});

export const getCurrentPurchaseStep = wrap(async (req, res) => {
  const result = await PurchaseProcessModel.getCurrentPurchaseStep(req.params.orderId);
  if (!result) return fail(res, 404, "Purchase order not found", "NOT_FOUND");
  return ok(res, result, "Current purchase step retrieved successfully");
});

export const confirmCurrentPurchaseStep = wrap(async (req, res) => {
  const party = String(req.body?.party || "").toLowerCase();
  if (!["buyer", "seller"].includes(party)) {
    return fail(res, 400, "party must be buyer or seller", "BAD_REQUEST");
  }
  const userId = getAuthenticatedUserId(req);
  const result = await PurchaseProcessModel.confirmCurrentStep(req.params.orderId, party, userId);
  if (!result) return fail(res, 404, "Purchase order not found", "NOT_FOUND");

  const message = `${party === "buyer" ? "Buyer" : "Seller"} confirmed completion of ${result.currentStep.step}.`;
  await notifyOrderParties(result.order, req.params.orderId, "Purchase step updated", message, result.currentStep.step);
  return ok(res, result, "Purchase step confirmation saved");
});

export const getPurchaseProcessByOrderId = getCurrentPurchaseStep;

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

export const scheduleInspectionForAllBuyers = wrap(async (req, res) => {
  const sellerId = req.user?.seller_id || req.user?.id || req.user?.user_id;
  const scheduled = await PurchasePaymentProcessModel.scheduleInspectionForProperty(
    req.params.propertyId,
    sellerId,
    req.body || {}
  );

  await Promise.all(scheduled.map(({ buyer_id, property_id, inspection_date, inspection_time, inspection_meeting_point }) =>
    sendNotification({
      userId: buyer_id,
      channels: ["EMAIL","PUSH"],
      jobName : "sendAccountActionEmail",
      title: "Property inspection scheduled",
      body: `An inspection for property ${property_id} has been scheduled for ${inspection_date} at ${inspection_time}. Meeting point: ${inspection_meeting_point}`,
      data: { propertyId: property_id, inspectionDate: inspection_date, inspectionTime: inspection_time },
    })
  ));

  return ok(
    res,
    { scheduledCount: scheduled.length, inspections: scheduled },
    scheduled.length ? "Inspection scheduled for eligible buyers" : "No eligible buyers need an inspection"
  );
});

export const confirmInspection = wrap(async (req, res) => {
  const existing = await PurchaseProcessModel.findByOrderId(
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

export const initiateOrder = wrap(async (req, res) => {
  const process = await PurchaseProcessModel.initiateOrder(
    req.params.propertyId,
    getBuyerIdFromBody(req),
    req.body
  );  
});
