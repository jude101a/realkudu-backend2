import { Router } from "express";
import * as TenantController from "../controllers/tenant.controller.js";
import { validate } from "../middlewares/validate.middleware.js";
import * as tenantValidators from "../validators/tenant.validator.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();

// Public read
router.get(
	"/by-tenant",
	validate({ query: tenantValidators.byTenantQuery }),
	TenantController.getTenantMetaByTenant
);
router.get(
	"/by-property",
	validate({ query: tenantValidators.byPropertyQuery }),
	TenantController.getTenantMetaByProperty
);

// Protected mutations
router.post(
	"/",
	protect,
	validate({ body: tenantValidators.createTenantSchema }),
	TenantController.createTenantMeta
);
router.put(
	"/:tenantMetaId/mark-rent-paid",
	protect,
	validate({ params: tenantValidators.tenantMetaIdParam, body: tenantValidators.markRentPaidSchema }),
	TenantController.markRentPaid
);
router.put(
	"/:tenantMetaId/outstanding-balance",
	protect,
	validate({ params: tenantValidators.tenantMetaIdParam, body: tenantValidators.updateOutstandingSchema }),
	TenantController.updateOutstandingBalance
);
router.post(
	"/:tenantMetaId/serve-notice",
	protect,
	validate({ params: tenantValidators.tenantMetaIdParam, body: tenantValidators.serveNoticeSchema }),
	TenantController.serveTenantNotice
);
router.post(
	"/:tenantMetaId/terminate",
	protect,
	validate({ params: tenantValidators.tenantMetaIdParam, body: tenantValidators.terminateSchema }),
	TenantController.terminateTenantTenancy
);
router.delete(
	"/:tenantMetaId",
	protect,
	validate({ params: tenantValidators.tenantMetaIdParam }),
	TenantController.deleteTenantMeta
);

export default router;
