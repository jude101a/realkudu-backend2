import { Router } from "express";
import {
  addGalleryImage,
  certifySeller,
  checkCanListProperties,
  deactivateSeller,
  deleteSeller,
  getAllSellers,
  getCountsByStatus,
  getCountsByType,
  getCountsByVerificationStatus,
  getProfileCompletion,
  getSeller,
  getSellerWithUserId,
  getTopRatedSellers,
  getTotalStatistics,
  getVerifiedSellers,
  loginSeller,
  reactivateSeller,
  registerCompanySeller,
  registerIndividualSeller,
  rejectSeller,
  removeGalleryImage,
  restoreSeller,
  searchSellers,
  suspendSeller,
  updateBankingDetails,
  updateBusinessProfile,
  updateCompanyDocuments,
  updateIndividualKYC,
  updateSellerRatings,
  updateTermsAcceptance,
  verifySeller,
} from "../controllers/seller.controller.js";
import { getSellerPropertyListings } from "../controllers/seller.property.listing.controller.js";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { validate } from "../middlewares/validate.middleware.js";
import {
  adminDeactivateSellerSchema,
  adminDeleteSellerSchema,
  adminRejectSellerSchema,
  adminRestoreSellerSchema,
  adminSuspendSellerSchema,
  adminUpdateRatingsSchema,
  adminVerifySellerSchema,
  registerCompanySellerSchema,
  registerIndividualSellerSchema,
  sellerIdParamSchema,
  sellerListQuerySchema,
  sellerPropertyListingQuerySchema,
  sellerSearchQuerySchema,
  sellerUserLoginSchema,
  updateBusinessProfileSchema,
  updateCompanyDocumentsSchema,
  updateIndividualKycSchema,
  userIdParamSchema,
} from "../validators/seller.validator.js";

const router = Router();
const protectedRouter = Router();
const adminRouter = Router();
const adminOnly = [protect, requireRole("admin")];

// ===============================
// PUBLIC READ ROUTES
// Put fixed/static routes first
// Dynamic :id routes last
// ===============================

router.get("/", validate({ query: sellerListQuerySchema }), getAllSellers);

router.get(
  "/search",
  validate({ query: sellerSearchQuerySchema }),
  searchSellers
);

router.get("/verified", getVerifiedSellers);

router.get("/top-rated", getTopRatedSellers);

// auth/public action
router.post(
  "/login/:id",
  validate({ params: sellerIdParamSchema }),
  loginSeller
);

// nested dynamic route before plain /:id
router.get(
  "/:id/properties",
  validate({
    params: sellerIdParamSchema,
    query: sellerPropertyListingQuerySchema,
  }),
  getSellerPropertyListings
);

// plain dynamic route LAST
router.get(
  "/:id",
  validate({ params: sellerIdParamSchema }),
  getSeller
);



// ===============================
// PROTECTED USER ROUTES
// Static first, dynamic last
// ===============================

protectedRouter.use(protect);

// auth
protectedRouter.post(
  "/login",
  validate({ body: sellerUserLoginSchema }),
  loginSeller
);

// register
protectedRouter.post(
  "/register/individual",
  validate({ body: registerIndividualSellerSchema }),
  registerIndividualSeller
);

protectedRouter.post(
  "/register/company",
  validate({ body: registerCompanySellerSchema }),
  registerCompanySeller
);

// explicit named routes first
protectedRouter.get(
  "/user/:userId",
  validate({ params: userIdParamSchema }),
  getSellerWithUserId
);

// dynamic nested routes
protectedRouter.get(
  "/:id/profile-completion",
  validate({ params: sellerIdParamSchema }),
  getProfileCompletion
);

protectedRouter.get(
  "/:id/can-list-properties",
  validate({ params: sellerIdParamSchema }),
  checkCanListProperties
);

// updates
protectedRouter.put(
  "/:id/profile",
  validate({
    params: sellerIdParamSchema,
    body: updateBusinessProfileSchema,
  }),
  updateBusinessProfile
);

protectedRouter.put(
  "/:id/banking",
  validate({ params: sellerIdParamSchema }),
  updateBankingDetails
);

protectedRouter.put(
  "/:id/kyc/individual",
  validate({
    params: sellerIdParamSchema,
    body: updateIndividualKycSchema,
  }),
  updateIndividualKYC
);

protectedRouter.put(
  "/:id/kyc/company",
  validate({
    params: sellerIdParamSchema,
    body: updateCompanyDocumentsSchema,
  }),
  updateCompanyDocuments
);

protectedRouter.put(
  "/:id/terms",
  validate({ params: sellerIdParamSchema }),
  updateTermsAcceptance
);

// gallery
protectedRouter.post(
  "/:id/gallery",
  validate({ params: sellerIdParamSchema }),
  addGalleryImage
);

protectedRouter.delete(
  "/:id/gallery/:imageUrl",
  validate({ params: sellerIdParamSchema }),
  removeGalleryImage
);



// ===============================
// ADMIN ROUTES
// Fixed analytics first
// Dynamic :id actions after
// ===============================

adminRouter.get(
  "/analytics/counts-by-status",
  getCountsByStatus
);

adminRouter.get(
  "/analytics/counts-by-verification",
  getCountsByVerificationStatus
);

adminRouter.get(
  "/analytics/counts-by-type",
  getCountsByType
);

adminRouter.get(
  "/analytics/total-statistics",
  getTotalStatistics
);

// dynamic actions
adminRouter.put(
  "/:id/ratings",
  validate({
    params: sellerIdParamSchema,
    body: adminUpdateRatingsSchema,
  }),
  updateSellerRatings
);

adminRouter.post(
  "/:id/verify",
  validate({
    params: sellerIdParamSchema,
    body: adminVerifySellerSchema,
  }),
  verifySeller
);

adminRouter.post(
  "/:id/reject",
  validate({
    params: sellerIdParamSchema,
    body: adminRejectSellerSchema,
  }),
  rejectSeller
);

adminRouter.post(
  "/:id/suspend",
  validate({
    params: sellerIdParamSchema,
    body: adminSuspendSellerSchema,
  }),
  suspendSeller
);

adminRouter.post(
  "/:id/deactivate",
  validate({
    params: sellerIdParamSchema,
    body: adminDeactivateSellerSchema,
  }),
  deactivateSeller
);

adminRouter.post(
  "/:id/reactivate",
  validate({ params: sellerIdParamSchema }),
  reactivateSeller
);

adminRouter.post(
  "/:id/certify",
  validate({ params: sellerIdParamSchema }),
  certifySeller
);

adminRouter.post(
  "/:id/restore",
  validate({
    params: sellerIdParamSchema,
    body: adminRestoreSellerSchema,
  }),
  restoreSeller
);

adminRouter.delete(
  "/:id",
  validate({
    params: sellerIdParamSchema,
    body: adminDeleteSellerSchema,
  }),
  deleteSeller
);

router.use(protectedRouter);
router.use(adminOnly, adminRouter);

export default router;
