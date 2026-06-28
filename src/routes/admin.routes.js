import { Router } from "express";
import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import {
  bootstrapOwner,
  getAdminUsersList,
  getAdminUserDetail,
  getAdminStats,
  getTrafficStats,
  getFinancialStats,
  getTransactionsList,
  getTransactionDetail,
  getStaffAccountsList,
  createStaffAccount,
  getStakeholdersList,
  createStakeholder,
  updateStakeholder,
  updateStakeholderPassword,
  updateStakeholderStatus,
  updateMyPassword,
  getActivityLogs,
  getApiStats,
} from "../controllers/admin.controller.js";

const router = Router();

/* -------------------------------------------------------------------------- */
/*                            PUBLIC ROUTES                                  */
/* -------------------------------------------------------------------------- */

/**
 * @route   POST /admin/owner/bootstrap
 * @desc    Bootstrap the first owner account (requires setup key)
 * @access  Public
 */
router.post("/owner/bootstrap", bootstrapOwner);

/* -------------------------------------------------------------------------- */
/*                        PROTECTED ROUTES (ADMIN ONLY)                      */
/* -------------------------------------------------------------------------- */

// Apply authentication middleware to all routes below
router.use(protect);

/**
 * @route   GET /admin/users
 * @desc    Get list of all users (paginated, searchable)
 * @access  Admin, Regional Manager
 */
router.get(
  "/users",
  requireRole("admin", "regional_manager"),
  getAdminUsersList
);

/**
 * @route   GET /admin/users/:userId
 * @desc    Get user details
 * @access  Admin, Regional Manager, Customer Care
 */
router.get(
  "/users/:userId",
  requireRole("admin", "regional_manager", "customer_care"),
  getAdminUserDetail
);

/**
 * @route   GET /admin/stats
 * @desc    Get dashboard statistics
 * @access  Admin
 */
router.get("/stats", requireRole("admin"), getAdminStats);

/**
 * @route   GET /admin/traffic
 * @desc    Get traffic statistics
 * @access  Admin
 */
router.get("/traffic", requireRole("admin"), getTrafficStats);

/**
 * @route   GET /admin/financial-stats
 * @desc    Get financial statistics
 * @access  Admin
 */
router.get("/financial-stats", requireRole("admin"), getFinancialStats);

/**
 * @route   GET /admin/api-stats
 * @desc    Get API statistics
 * @access  Admin
 */
router.get("/api-stats", requireRole("admin"), getApiStats);

/**
 * @route   GET /admin/transactions
 * @desc    Get list of transactions (paginated)
 * @access  Admin, Customer Care
 */
router.get(
  "/transactions",
  requireRole("admin", "customer_care"),
  getTransactionsList
);

/**
 * @route   GET /admin/transactions/:transactionId
 * @desc    Get transaction details
 * @access  Admin, Customer Care
 */
router.get(
  "/transactions/:transactionId",
  requireRole("admin", "customer_care"),
  getTransactionDetail
);

/**
 * @route   GET /admin/accounts
 * @desc    Get all staff accounts (owner, admin, regional_manager, customer_care)
 * @access  Admin
 */
router.get("/accounts", requireRole("admin"), getStaffAccountsList);

/**
 * @route   POST /admin/accounts
 * @desc    Create a new staff account
 * @access  Admin
 */
router.post("/accounts", requireRole("admin"), createStaffAccount);

/**
 * @route   GET /admin/stakeholders
 * @desc    Get list of stakeholders (admin staff, paginated, searchable)
 * @access  Admin
 */
router.get("/stakeholders", requireRole("admin"), getStakeholdersList);

/**
 * @route   POST /admin/stakeholders
 * @desc    Create a new stakeholder
 * @access  Admin
 */
router.post("/stakeholders", requireRole("admin"), createStakeholder);

/**
 * @route   PATCH /admin/stakeholders/:userId
 * @desc    Update stakeholder details
 * @access  Admin
 */
router.patch("/stakeholders/:userId", requireRole("admin"), updateStakeholder);

/**
 * @route   PATCH /admin/stakeholders/:userId/password
 * @desc    Reset stakeholder password
 * @access  Admin
 */
router.patch(
  "/stakeholders/:userId/password",
  requireRole("admin"),
  updateStakeholderPassword
);

/**
 * @route   PATCH /admin/stakeholders/:userId/status
 * @desc    Update stakeholder account status
 * @access  Admin
 */
router.patch(
  "/stakeholders/:userId/status",
  requireRole("admin"),
  updateStakeholderStatus
);

/**
 * @route   PATCH /admin/me/password
 * @desc    Update own password
 * @access  Owner, Admin, Regional Manager, Customer Care
 */
router.patch(
  "/me/password",
  requireRole("owner", "admin", "regional_manager", "customer_care"),
  updateMyPassword
);

/**
 * @route   GET /admin/activity-logs
 * @desc    Get admin activity logs (paginated, filterable by admin)
 * @access  Admin
 */
router.get("/activity-logs", requireRole("admin"), getActivityLogs);

export default router;
