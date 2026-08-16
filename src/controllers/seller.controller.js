import { logger } from "@sentry/node";
import SellerModel, {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from "../models/seller.model.js";
  import { notificationQueue } from "../queues/notification.queue.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ok = (res, payload, status = 200) =>
  res.status(status).json({ success: true, ...payload });

const fail = (res, status, message, code = "BAD_REQUEST", details = undefined) =>
  res.status(status).json({
    success: false,
    error: { code, message, details },
  });

const withErrorHandling = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    if (error?.code === "USER_NOT_FOUND") {
      return fail(res, 404, "User not found", "USER_NOT_FOUND");
    }
    if (error?.code === "SELLER_EXISTS") {
      return fail(res, 409, "Seller profile already exists for this user", "SELLER_EXISTS");
    }
    if (error?.code === "23505") {
      return fail(res, 409, "Duplicate seller data detected", "CONFLICT");
    }

    console.error("[seller.controller] unhandled error", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
    });
    return fail(res, 500, "Internal server error", "INTERNAL_ERROR");
  }
};

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizePhone = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return String(value).trim();
};
const isUuid = (value) => UUID_RE.test(String(value || ""));

const parsePagination = (query) => {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 50, 1), 100);
  const offset = Math.max(Number.parseInt(query.offset, 10) || 0, 0);
  return { limit, offset };
};

const sanitizeSeller = (row) => ({
  id: row.id,
  userId: row.user_id,
  businessName: row.business_name,
  businessAddress: row.business_address,
  businessEmail: row.business_email,
  businessPhone: row.business_phone,
  cacNumber: row.cac_number,
  tinNumber: row.tin_number,
  cacDocumentUrl: row.cac_document_url,
  businessSpecification: row.business_specification,
  businessProfileImageUrl: row.business_profile_image_url,
  type: row.cac_number ? SellerType.COMPANY : SellerType.INDIVIDUAL,
  verificationStatus: row.is_verified
    ? SellerVerificationStatus.VERIFIED
    : SellerVerificationStatus.UNVERIFIED,
  status: row.deleted_at
    ? SellerStatus.DELETED
    : row.is_active
    ? SellerStatus.ACTIVE
    : SellerStatus.INACTIVE,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

/**
 * Seller registration.
 *
 * Scalability approach:
 * Each seller type declares its own required fields, payload shape, and
 * DB call in SELLER_FIELD_CONFIG. Adding a new seller type (e.g. NGO,
 * SoleProprietor) means adding one config entry — no changes needed to
 * validation flow, response handling, or the route handlers below.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const normalizeEmailOrNull = (email) =>
  email === undefined || email === null || email === "" ? null : normalizeEmail(email);

const normalizePhoneOrNull = (phone) =>
  phone === undefined || phone === null || phone === "" ? null : normalizePhone(phone);

/**
 * Pure UUID check (no res side-effects), so it can be reused inside
 * createSeller without coupling business logic to the HTTP layer.
 *
 * NOTE: if you already have a pure validator elsewhere (e.g. inside
 * whatever module defines `assertUuid`), swap this out for that and
 * delete this local copy.
 */
const isValidUuid = (value) => typeof value === "string" && UUID_RE.test(value);

// ---------------------------------------------------------------------------
// Per-seller-type configuration
// ---------------------------------------------------------------------------

const SELLER_FIELD_CONFIG = {
  [SellerType.INDIVIDUAL]: {
    // Fields beyond userId/businessName that must be present for this type
    required: [
      { field: "businessEmail", label: "businessEmail" },
      { field: "businessPhone", label: "businessPhone" },
      { field: "sellerFaceCaptureUrl", label: "sellerFaceCaptureUrl" },
    ],
    buildPayload: (body) => ({
      userId: body.userId,
      businessName: String(body.businessName).trim(),
      businessSpecification: body.businessSpecification ?? null,
      businessEmail: normalizeEmailOrNull(body.businessEmail),
      businessPhone: normalizePhoneOrNull(body.businessPhone),
      sellerFaceCaptureUrl: body.sellerFaceCaptureUrl ?? null,
      sellerType: SellerType.INDIVIDUAL,
    }),
    register: (payload) =>
      SellerModel.registerIndividualSellerWithUserValidation(payload),
    successMessage: "Individual seller profile created successfully",
  },

  [SellerType.COMPANY]: {
    required: [{ field: "cacNumber", label: "cacNumber" },
      { field: "primaryShareholderName", label: "primaryShareholderName" },
      { field: "primaryShareholderEmail", label: "primaryShareholderEmail" },
      { field: "primaryShareholderPhone", label: "primaryShareholderPhone" },
      { field: "primaryShareholderIdDocumentUrl", label: "primaryShareholderIdDocumentUrl" },
      { field: "primaryShareholderNin", label: "primaryShareholderNin" },
      {field: "businessEmail", label: "businessEmail" },
      {field: "businessPhone", label: "businessPhone" },
      {field: "businessAddress", label: "businessAddress" },
      {field: "memorandumDocumentUrl", label: "memorandumDocumentUrl" },
      {field: "tinNumber", label: "tinNumber" },


    ],
    buildPayload: (body) => ({
      userId: body.userId,
      businessName: String(body.businessName).trim(),
      businessAddress: body.businessAddress ?? null,
      businessEmail: normalizeEmailOrNull(body.businessEmail),
      businessPhone: normalizePhoneOrNull(body.businessPhone),
      cacNumber: body.cacNumber ?? null,
      tinNumber: body.tinNumber ?? null,
      cacDocumentUrl: body.cacDocumentUrl ?? null,
      memorandumDocumentUrl: body.memorandumDocumentUrl ?? null,
      utilityBillDocumentUrl: body.utilityBillDocumentUrl ?? null,
      businessProfileImageUrl: body.businessProfileImageUrl ?? null,
      additionalShareholders: body.additionalShareholders ?? null,
      businessLga: body.businessLga ?? null,
      businessState: body.businessState ?? null,
      businessWebsite: body.businessWebsite ?? null,
      businessDescription: body.businessDescription ?? null,
      businessSpecification: body.businessSpecification ?? null,
      primaryShareholderName: body.primaryShareholderName ?? null,
      primaryShareholderEmail: normalizeEmailOrNull(body.primaryShareholderEmail),
      primaryShareholderPhone: normalizePhoneOrNull(body.primaryShareholderPhone),
      primaryShareholderIdDocumentUrl:
        body.primaryShareholderIdDocumentUrl ?? null,
      primaryShareholderNin: body.primaryShareholderNin ?? null,
      sellerType: SellerType.COMPANY,
    }),
    register: (payload) =>
      SellerModel.registerCompanySellerWithUserValidation(payload),
    successMessage: "Company seller profile created successfully",
  },
};

// ---------------------------------------------------------------------------
// Core logic (no res coupling — easy to unit test, easy to reuse)
// ---------------------------------------------------------------------------

/**
 * Validates and creates a seller of the given type.
 * Returns a plain result object instead of writing to `res`, so callers
 * decide how/whether to respond (this is what fixes the "notification
 * fires even on failed creation" bug in the original company handler).
 */
async function createSeller(req, type) {
  const body = req.body || {};
  const { userId, businessName } = body;

  const config = SELLER_FIELD_CONFIG[type];
  if (!config) {
    // Internal guard only — should never be hit via the exported handlers.
    return {
      ok: false,
      status: 500,
      message: `Unsupported seller type: ${type}`,
      code: "INTERNAL_ERROR",
    };
  }

  if (!isValidUuid(userId)) {
    return {
      ok: false,
      status: 400,
      message: "userId must be a valid UUID",
      code: "VALIDATION_ERROR",
    };
  }

  if (!businessName || String(businessName).trim().length < 2) {
    return {
      ok: false,
      status: 400,
      message: "businessName must be at least 2 characters",
      code: "VALIDATION_ERROR",
    };
  }

  for (const { field, label } of config.required) {
    if (!body[field]) {
      return {
        ok: false,
        status: 400,
        message: `${label} is required for ${type} sellers`,
        code: "VALIDATION_ERROR",
      };
    }
  }

  const payload = config.buildPayload(body);
  const created = await config.register(payload);

  return {
    ok: true,
    status: 201,
    message: config.successMessage,
    data: sanitizeSeller(created.rows[0]),
  };
}

// ---------------------------------------------------------------------------
// Route handlers (thin — just translate result -> HTTP response)
// ---------------------------------------------------------------------------

export const registerIndividualSeller = withErrorHandling(async (req, res) => {
  const result = await createSeller(req, SellerType.INDIVIDUAL);

  if (!result.ok) {
    return fail(res, result.status, result.message, result.code);
  }

  return ok(res, { message: result.message, data: result.data }, result.status);
});

export const registerCompanySeller = withErrorHandling(async (req, res) => {
  const result = await createSeller(req, SellerType.COMPANY);

  if (!result.ok) {
    return fail(res, result.status, result.message, result.code);
  }

  ok(res, { message: result.message, data: result.data }, result.status);

  // Fire-and-forget: notification failure should never affect the
  // already-sent success response above.
  try {
    await sendNotification({
      user: {
        id: req.userId,
        email: req.sellerEmail,
      },
      title: "Registration Successful",
      message:
        "Welcome onboard! Your company seller account has been created successfully.",
      channels: ["PUSH", "EMAIL", "IN_APP"],
      data: {},
    });
  } catch (error) {
    logger.error("Failed to send seller registration notification", error);
    // TODO: replace with your logger, e.g. logger.error("seller notification failed", error)
    console.error("Failed to send seller registration notification:", error);
  }
});

export const loginSeller = withErrorHandling(async (req, res) => {
  const { userId } = req.body || {};
  if (!assertUuid(res, userId, "userId")) return;

  const found = await SellerModel.findByUserId(userId);
  const seller = found.rows[0];
  if (!seller) return fail(res, 404, "Seller account not found", "SELLER_NOT_FOUND");


  return ok(res, { message: "Login successful", data: sanitizeSeller(seller) });
});

export const getSeller = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const found = await SellerModel.findById(req.params.id);
  if (!found.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  return ok(res, { data: sanitizeSeller(found.rows[0]) });
});

export const getSellerWithUserId = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.userId, "userId")) return;
  const found = await SellerModel.findByUserId(req.params.userId);
  if (!found.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  return ok(res, { data: sanitizeSeller(found.rows[0]) });
});

export const getAllSellers = withErrorHandling(async (req, res) => {
  const { limit, offset } = parsePagination(req.query);
  const result = await SellerModel.findWithFilters(
    {
      type: req.query.type,
      status: req.query.status,
      verificationStatus: req.query.verificationStatus,
      limit,
      offset,
    }
  );

  return ok(res, {
    data: result.rows.map(sanitizeSeller),
    count: result.rowCount,
    limit,
    offset,
  });
});

export const searchSellers = withErrorHandling(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (q.length < 2) {
    return fail(res, 400, "Search query must be at least 2 characters", "VALIDATION_ERROR");
  }

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);

  const result = await SellerModel.searchSellers(q, limit, offset);
  return ok(res, {
    data: result.rows.map(sanitizeSeller),
    count: result.rowCount,
    query: q,
    limit,
    offset,
  });
});

export const getTopRatedSellers = withErrorHandling(async (req, res) => {
  const minRating = Number.parseFloat(req.query.minRating) || 4;
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 100);
  const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
  const result = await SellerModel.findTopRatedSellers(minRating, limit, offset);
  return ok(res, {
    data: result.rows.map(sanitizeSeller),
    count: result.rowCount,
    minRating,
    limit,
    offset,
  });
});

export const getVerifiedSellers = withErrorHandling(async (req, res) => {
  const { limit, offset } = parsePagination(req.query);
  const result = await SellerModel.findVerifiedSellers(limit, offset);
  return ok(res, {
    data: result.rows.map(sanitizeSeller),
    count: result.rowCount,
    limit,
    offset,
  });
});

export const updateBusinessProfile = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.updateBusinessProfile(req.params.id, req.body || {});
  if (!result.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  try {
    await sendNotification({
    user: {
      id: req.params.id,
      email: req.sellerEmail,
    },
    title: "Update Alert",
    message: "Your business profile has been updated successfully.",
    channels: ["PUSH","EMAIL", "IN_APP"],
    data: {
    
    },
  });
  
  } catch (error) {
    
  }
  return ok(res, { message: "Profile updated successfully", data: sanitizeSeller(result.rows[0]) });
});

export const updateBankingDetails = withErrorHandling(async (_req, res) =>
  fail(res, 501, "Banking details endpoint is not supported by the current schema", "NOT_IMPLEMENTED")
);

export const updateIndividualKYC = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.updateIndividualKycBySellerId(req.params.id, req.body || {});
  if (!result.rowCount) return fail(res, 404, "Individual seller not found", "SELLER_NOT_FOUND");
  return ok(res, { message: "KYC documents updated successfully", data: result.rows[0] });
});

export const updateCompanyDocuments = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.updateCompanyDocuments(req.params.id, req.body || {});
  if (!result.rowCount) return fail(res, 404, "Company seller not found", "SELLER_NOT_FOUND");
  return ok(res, { message: "Company documents updated successfully", data: sanitizeSeller(result.rows[0]) });
});

export const addGalleryImage = withErrorHandling(async (_req, res) =>
  fail(res, 501, "Gallery endpoint is not supported by the current schema", "NOT_IMPLEMENTED")
);

export const removeGalleryImage = withErrorHandling(async (_req, res) =>
  fail(res, 501, "Gallery endpoint is not supported by the current schema", "NOT_IMPLEMENTED")
);

export const verifySeller = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.setVerification(req.params.id, true);
  if (!result.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  return ok(res, { message: "Seller verified successfully", data: sanitizeSeller(result.rows[0]) });
});

export const rejectSeller = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.setVerification(req.params.id, false);
  if (!result.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  return ok(res, { message: "Seller verification rejected", data: sanitizeSeller(result.rows[0]) });
});

export const suspendSeller = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.setActive(req.params.id, false);
  if (!result.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  return ok(res, { message: "Seller suspended successfully", data: sanitizeSeller(result.rows[0]) });
});

export const deactivateSeller = suspendSeller;

export const reactivateSeller = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.setActive(req.params.id, true);
  if (!result.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  return ok(res, { message: "Seller reactivated successfully", data: sanitizeSeller(result.rows[0]) });
});

export const certifySeller = verifySeller;

export const updateTermsAcceptance = withErrorHandling(async (_req, res) =>
  fail(res, 501, "Terms endpoint is not supported by the current schema", "NOT_IMPLEMENTED")
);

export const updateSellerRatings = withErrorHandling(async (_req, res) =>
  fail(res, 501, "Ratings endpoint is not supported by the current schema", "NOT_IMPLEMENTED")
);

export const getProfileCompletion = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const seller = await SellerModel.findById(req.params.id);
  if (!seller.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  const percentage = await SellerModel.getProfileCompletionPercentage(req.params.id);
  return ok(res, {
    sellerId: req.params.id,
    profileCompletionPercentage: percentage,
  });
});

export const checkCanListProperties = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const seller = await SellerModel.findById(req.params.id);
  if (!seller.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  const canList = await SellerModel.canListProperties(req.params.id);
  return ok(res, { sellerId: req.params.id, canListProperties: canList });
});

export const getCountsByStatus = withErrorHandling(async (_req, res) => {
  const result = await SellerModel.getCountByStatus();
  return ok(res, { data: result.rows });
});

export const getCountsByVerificationStatus = withErrorHandling(async (_req, res) => {
  const result = await SellerModel.getCountByVerificationStatus();
  return ok(res, { data: result.rows });
});

export const getCountsByType = withErrorHandling(async (_req, res) => {
  const result = await SellerModel.getCountByType();
  return ok(res, { data: result.rows });
});

export const getTotalStatistics = withErrorHandling(async (_req, res) => {
  const result = await SellerModel.getTotalStatistics();
  return ok(res, { data: result.rows[0] || {} });
});

export const deleteSeller = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.softDelete(req.params.id);
  if (!result.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  return ok(res, { message: "Seller deleted successfully", data: sanitizeSeller(result.rows[0]) });
});

export const restoreSeller = withErrorHandling(async (req, res) => {
  if (!assertUuid(res, req.params.id, "id")) return;
  const result = await SellerModel.restore(req.params.id);
  if (!result.rowCount) return fail(res, 404, "Seller not found", "SELLER_NOT_FOUND");
  return ok(res, { message: "Seller restored successfully", data: sanitizeSeller(result.rows[0]) });
});

export { SellerType, SellerVerificationStatus, SellerStatus };
