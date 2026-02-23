import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByEmail,
  findUserById,
  getUserFullnameByEmail,
  updatePassword as updatePasswordModel,
  updateUser as updateUserModel,
  updateUserById,
  updateUserIsLawyer,
} from "../models/user.models.js";
import { sendVerificationEmail } from "../utils/email.js";

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "7d";

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const sendSuccess = (res, status, payload) =>
  res.status(status).json({ success: true, ...payload });

const sendError = (res, status, message) =>
  res.status(status).json({ success: false, error: message });

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  firstName: user.first_name,
  lastName: user.last_name,
  role: user.role,
  isVerified: user.is_verified,
});

export const register = async (req, res, next) => {
  try {
    const requiredFields = [
      "email",
      "password",
      "firebaseUid",
      "firstName",
      "lastName",
    ];

    const missing = requiredFields.filter(
      (field) => req.body[field] === undefined || req.body[field] === null
    );

    if (missing.length) {
      return sendError(res, 400, `Missing required fields: ${missing.join(", ")}`);
    }

    const email = normalizeEmail(req.body.email);
    if (!validateEmail(email)) {
      return sendError(res, 400, "Invalid email format");
    }

    if (String(req.body.password).length < 6) {
      return sendError(res, 400, "Password must be at least 6 characters");
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return sendError(res, 409, "User already exists");
    }

    const passwordHash = await bcrypt.hash(req.body.password, SALT_ROUNDS);

    const userPayload = {
      email,
      password: passwordHash,
      firebaseUid: req.body.firebaseUid,
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      phone: req.body.phone || null,
      transactionPin: req.body.transactionPin || null,
      address: req.body.address || null,
      occupation: req.body.occupation || null,
      positionAtWork: req.body.positionAtWork || null,
      placeOfWork: req.body.placeOfWork || null,
      localGovernmentArea: req.body.localGovernmentArea || null,
      state: req.body.state || null,
      country: req.body.country || "Nigeria",
      maritalStatus: req.body.maritalStatus || "single",
      numberOfChildren: req.body.numberOfChildren ?? 0,
      hobbies: req.body.hobbies || null,
      role: req.body.role || "user",
    };

    const user = await createUser(userPayload);

    if (process.env.EMAIL_VERIFICATION_SECRET && process.env.APP_BASE_URL) {
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.EMAIL_VERIFICATION_SECRET,
        { expiresIn: "24h" }
      );
      const verificationLink = `${process.env.APP_BASE_URL}/api/users/verify-email?token=${token}`;
      await sendVerificationEmail(user.email, verificationLink).catch(() => {});
    }

    return sendSuccess(res, 201, { user: sanitizeUser(user) });
  } catch (err) {
    return next(err);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.query;
    if (!token) {
      return sendError(res, 400, "Verification token is required");
    }
    if (!process.env.EMAIL_VERIFICATION_SECRET) {
      return sendError(res, 500, "EMAIL_VERIFICATION_SECRET not configured");
    }

    const decoded = jwt.verify(token, process.env.EMAIL_VERIFICATION_SECRET);
    const user = await updateUserById(decoded.id, { isVerified: true });

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, { message: "Email verified successfully" });
  } catch (_) {
    return sendError(res, 400, "Invalid or expired verification token");
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return sendError(res, 400, "Email and password are required");
    }

    const user = await findUserByEmail(normalizeEmail(email));
    if (!user) {
      return sendError(res, 401, "Invalid credentials");
    }

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) {
      return sendError(res, 401, "Invalid credentials");
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return sendSuccess(res, 200, {
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = ["firstName", "lastName", "phone"];
    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (!Object.keys(updates).length) {
      return sendError(res, 400, "No valid fields provided");
    }

    const updatedUser = await updateUserModel(id, updates);
    if (!updatedUser) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, { user: sanitizeUser(updatedUser) });
  } catch (err) {
    return next(err);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return sendError(res, 400, "Old and new password are required");
    }

    if (String(newPassword).length < 6) {
      return sendError(res, 400, "New password too short");
    }

    const user = await findUserById(id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) {
      return sendError(res, 401, "Old password incorrect");
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await updatePasswordModel(id, newHash);

    return sendSuccess(res, 200, {
      message: "Password updated successfully",
    });
  } catch (err) {
    return next(err);
  }
};

export const setLawyerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { isLawyer } = req.body;

    if (typeof isLawyer !== "boolean") {
      return sendError(res, 400, "isLawyer must be a boolean");
    }

    const updatedUser = await updateUserIsLawyer(id, isLawyer);
    if (!updatedUser) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, { user: sanitizeUser(updatedUser) });
  } catch (err) {
    return next(err);
  }
};

export const getUserByEmail = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.params.email);
    const user = await findUserByEmail(email);

    if (!user) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, { user: sanitizeUser(user) });
  } catch (err) {
    return next(err);
  }
};

export const getUserFullname = async (req, res, next) => {
  try {
    const email = normalizeEmail(req.params.email);
    const fullname = await getUserFullnameByEmail(email);

    if (!fullname) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, { fullname });
  } catch (err) {
    return next(err);
  }
};
