import express from "express";
import {
  register,
  login,
  updateProfile,
  changePassword,
  setLawyerStatus,
  getUserByEmail,
  getUserFullname,
  getUserBasicInfoById,
  verifyEmail,
  verifyUser,
  socialLogin,
  testEmail,
  resetPassword,
  verifyOtp,
  resetPasswordRequest,
} from "../controllers/user.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";
import { getUserNotifications } from "../services/notifications.service.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management and authentication
 */

/* -------------------------------------------------------------------------- */
/*                               AUTH                                         */
/* -------------------------------------------------------------------------- */
router.post("/register", register);
router.post("/login", login);
router.post("/social-login", socialLogin);
router.get("/verify-email", verifyEmail);
router.post("/send-test-email", testEmail);
router.post("/verify-otp", verifyOtp);

/* -------------------------------------------------------------------------- */
/*                               PROFILE                                      */
/* -------------------------------------------------------------------------- */
router.put("/:id", protect, updateProfile);
router.post("/:id/change-password", protect, changePassword);
router.post("/password-reset", protect, resetPassword);
router.post("/password-reset-request", protect, resetPasswordRequest);
router.post("/:id/verify-user", protect, requireRole("user"), verifyUser );

/* -------------------------------------------------------------------------- */
/*                               ADMIN / ROLE                                 */
/* -------------------------------------------------------------------------- */
router.put(
  "/:id/lawyer-status",
  protect,
  requireRole("admin"),
  setLawyerStatus
);

/* -------------------------------------------------------------------------- */
/*                               LOOKUPS                                      */
/* -------------------------------------------------------------------------- */
router.get("/email/:email", getUserByEmail);
router.get("/fullname/:email", protect, getUserFullname);

/**
 * @swagger
 * /api/users/{id}/basic:
 *   get:
 *     summary: Get basic user info by ID
 *     description: Retrieve basic user profile information without password or token data.
 *     tags:
 *       - Users
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Basic user info retrieved
 *       400:
 *         description: Invalid user ID format
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
router.get("/:id/basic", protect, getUserBasicInfoById);
router.get("/get/:id/basic", protect, getUserBasicInfoById);
  
router.get("/userNotifications/:id", protect, getUserNotifications);

export default router;
