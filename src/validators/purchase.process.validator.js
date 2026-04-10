import Joi from "joi";

const uuid = Joi.string().guid({ version: ["uuidv4", "uuidv5"] });
const dateString = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/);
const timeString = Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/);
const notes = Joi.string().trim().max(2000).allow("", null);
const meetingPoint = Joi.string().trim().min(2).max(500);

export const propertyIdParamSchema = Joi.object({
  propertyId: uuid.required(),
});

export const purchaseProcessQuerySchema = Joi.object({
  buyerId: uuid.required(),
});

export const requestInspectionSchema = Joi.object({
  buyerId: uuid.required(),
  inspectionDate: dateString.required(),
  inspectionTime: timeString.required(),
  inspectionAdditionalNotes: notes,
  inspectionMeetingPoint: meetingPoint.required(),
});

export const confirmInspectionSchema = Joi.object({
  buyerId: uuid.required(),
  inspectionDate: dateString,
  inspectionTime: timeString,
  inspectionAdditionalNotes: notes,
  inspectionMeetingPoint: meetingPoint,
});

export const requestPaymentSchema = Joi.object({
  buyerId: uuid.required(),
  requestPaymentDate: dateString,
  requestPaymentAdditionalNotes: notes,
});

export const requestContractSigningSchema = Joi.object({
  buyerId: uuid.required(),
  contractSigningDate: dateString.required(),
  contractSigningTime: timeString.required(),
  contractSigningMeetingPoint: meetingPoint.required(),
  contractSigningAdditionalNotes: notes,
});

export const confirmContractSigningSchema = Joi.object({
  buyerId: uuid.required(),
  contractSigningDate: dateString,
  contractSigningTime: timeString,
  contractSigningMeetingPoint: meetingPoint,
  contractSigningAdditionalNotes: notes,
});

export const confirmDocumentUploadSchema = Joi.object({
  buyerId: uuid.required(),
  documentUploadDate: dateString,
  processCompletion: Joi.boolean().default(true),
});
