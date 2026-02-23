import SellerModel, {
  SellerStatus,
  SellerType,
  SellerVerificationStatus,
} from "../models/seller.model.js";

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

const assertUuid = (res, value, field) => {
  if (!isUuid(value)) {
    fail(res, 400, `${field} must be a valid UUID`, "VALIDATION_ERROR");
    return false;
  }
  return true;
};

const registerSeller = async (req, res, type) => {
  const {
    userId,
    businessName,
    businessAddress,
    businessEmail,
    businessPhone,
    cacNumber,
    tinNumber,
    cacDocumentUrl,
    businessSpecification,
    businessProfileImageUrl,
  } = req.body || {};

  if (!assertUuid(res, userId, "userId")) return;

  if (!businessName || String(businessName).trim().length < 2) {
    return fail(
      res,
      400,
      "businessName must be at least 2 characters",
      "VALIDATION_ERROR"
    );
  }

  if (type === SellerType.COMPANY && !cacNumber) {
    return fail(res, 400, "cacNumber is required for company sellers", "VALIDATION_ERROR");
  }

  const payload = {
    userId,
    businessName: String(businessName).trim(),
    businessAddress: businessAddress ?? null,
    businessEmail:
      businessEmail === undefined || businessEmail === null || businessEmail === ""
        ? null
        : normalizeEmail(businessEmail),
    businessPhone: normalizePhone(businessPhone),
    cacNumber: type === SellerType.COMPANY ? cacNumber ?? null : null,
    tinNumber: tinNumber ?? null,
    cacDocumentUrl: cacDocumentUrl ?? null,
    businessSpecification: businessSpecification ?? null,
    businessProfileImageUrl: businessProfileImageUrl ?? null,
  };

  const created =
    type === SellerType.COMPANY
      ? await SellerModel.registerCompanySellerWithUserValidation(payload)
      : await SellerModel.registerIndividualSellerWithUserValidation(payload);

  return ok(
    res,
    {
      message:
        type === SellerType.COMPANY
          ? "Company seller profile created successfully"
          : "Individual seller profile created successfully",
      data: sanitizeSeller(created.rows[0]),
    },
    201
  );
};

export const registerIndividualSeller = withErrorHandling(async (req, res) =>
  registerSeller(req, res, SellerType.INDIVIDUAL)
);

export const registerCompanySeller = withErrorHandling(async (req, res) =>
  registerSeller(req, res, SellerType.COMPANY)
);

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
