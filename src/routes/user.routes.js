import express from "express";
import {
  register,
  login,
  updateProfile,
  changePassword,
  setLawyerStatus,
  getUserByEmail,
  getUserFullname,
  verifyEmail,
} from "../controllers/user.controller.js";

import { protect } from "../middlewares/auth.middleware.js";
import { requireRole } from "../middlewares/role.middleware.js";

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
router.get("/verify-email", verifyEmail);

/* -------------------------------------------------------------------------- */
/*                               PROFILE                                      */
/* -------------------------------------------------------------------------- */
router.put("/:id", protect, updateProfile);
router.post("/:id/change-password", protect, changePassword);

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
router.get("/email/:email", protect, getUserByEmail);
router.get("/fullname/:email", protect, getUserFullname);

export default router;
