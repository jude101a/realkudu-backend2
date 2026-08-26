import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import axios from "axios";
import crypto from "crypto";
import {
  createUser,
  findUserByEmail,
  findUserById,
  getUserBasicInfoByIdModel,
  getUserFullnameByEmail,
  updatePassword as updatePasswordModel,
  updateUser as updateUserModel,
  updateUserById,
  updateUserIsLawyer,
  verifyUserAccount
} from "../models/user.models.js";
  import { notificationQueue } from "../queues/notification.queue.js";

import { sendVerificationEmail } from "../utils/email.js";
import { sendNotification } from "../services/notification.service.js";

const SALT_ROUNDS = 12;
const JWT_EXPIRES_IN = "7d";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const isUuid = (value) => UUID_RE.test(String(value || ""));

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const normalizeProvider = (provider) => String(provider || "").trim().toLowerCase();

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
  phoneNumber: user.phone_number,
  maritalStatus: user.marital_status,
  occupation: user.occupation,
  workPlace: user.place_of_work,
  positionAtWork: user.position_at_work,
  address: user.address,
  age : user.date_of_birth,
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
try {
  await sendNotification({
  user: {
    id: user.id,
    email: user.email,
  },
  title: "Login Alert",
  message: "Welcome back! You have successfully logged in to your account.",
  channels: ["PUSH",],
  data: {
  
  },
});

} catch (error) {
  
}
    
    return sendSuccess(res, 200, {
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
};

const verifyGoogleToken = async (idToken) => {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;

  if (!googleClientId) {
    throw new Error("Google social login is not configured: GOOGLE_CLIENT_ID is missing.");
  }

  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(
    idToken
  )}`;
  const { data } = await axios.get(url, { timeout: 10000 });

  if (!data?.email || !data?.sub) {
    throw new Error("Google token did not return a valid user identity");
  }

  if (data.aud && data.aud !== googleClientId) {
    throw new Error("Google token audience mismatch");
  }

  if (data.iss && !["accounts.google.com", "https://accounts.google.com"].includes(data.iss)) {
    throw new Error("Google token issuer mismatch");
  }

  return {
    email: data.email,
    firstName: data.given_name || data.name || "",
    lastName: data.family_name || "",
    providerId: data.sub,
    profileImageUrl: data.picture || null,
  };
};

const verifyFacebookToken = async (accessToken) => {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      "Facebook social login is not configured: FACEBOOK_APP_ID and FACEBOOK_APP_SECRET are required."
    );
  }

  const accessTokenWithApp = `${appId}|${appSecret}`;
  const debugTokenUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(
    accessToken
  )}&access_token=${encodeURIComponent(accessTokenWithApp)}`;
  const { data: debugData } = await axios.get(debugTokenUrl, { timeout: 10000 });

  if (!debugData?.data?.is_valid) {
    throw new Error("Facebook token is invalid or expired");
  }

  if (debugData.data.app_id && debugData.data.app_id !== appId) {
    throw new Error("Facebook token does not belong to this application");
  }

  const appsecretProof = crypto
    .createHmac("sha256", appSecret)
    .update(accessToken)
    .digest("hex");

  const profileUrl = `https://graph.facebook.com/me?fields=id,email,first_name,last_name,picture&access_token=${encodeURIComponent(
    accessToken
  )}&appsecret_proof=${encodeURIComponent(appsecretProof)}`;
  const { data } = await axios.get(profileUrl, { timeout: 10000 });

  return {
    email: data.email,
    firstName: data.first_name || data.name || "",
    lastName: data.last_name || "",
    providerId: data.id,
    profileImageUrl: data.picture?.data?.url || null,
  };
};

const verifyTwitterToken = async (bearerToken) => {
  const hasTwitterConfig = Boolean(
    process.env.TWITTER_CLIENT_ID || process.env.TWITTER_CLIENT_SECRET || process.env.TWITTER_BEARER_TOKEN
  );

  if (!hasTwitterConfig) {
    throw new Error(
      "X/Twitter social login is not configured: set TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, or TWITTER_BEARER_TOKEN."
    );
  }

  const url = `https://api.twitter.com/2/users/me?user.fields=profile_image_url,name,username`;
  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
    },
    timeout: 10000,
  });

  if (!data?.data?.id) {
    throw new Error("X/Twitter token is invalid or missing user identity");
  }

  return {
    email: data.data?.email || null,
    firstName: data.data?.name || "",
    lastName: "",
    providerId: data.data?.id,
    profileImageUrl: data.data?.profile_image_url || null,
  };
};

const verifySocialToken = async (provider, token) => {
  if (!provider || !token) throw new Error("provider and token are required");

  const normalizedProvider = normalizeProvider(provider);

  if (normalizedProvider === "google") return verifyGoogleToken(token);
  if (normalizedProvider === "facebook" || normalizedProvider === "fb") return verifyFacebookToken(token);
  if (normalizedProvider === "twitter" || normalizedProvider === "x") return verifyTwitterToken(token);

  throw new Error("Unsupported provider");
};

export const socialLogin = async (req, res, next) => {
  try {
    const { provider, token, rememberMe = false, email: suppliedEmail } = req.body;
    if (!provider || !token) return sendError(res, 400, "provider and token are required");

    let profile;
    try {
      profile = await verifySocialToken(provider, token);
    } catch (err) {
      return sendError(res, 400, `Invalid ${provider} token: ${err.message}`);
    }

    const email = (profile.email || suppliedEmail || "").toLowerCase();
    if (!email) {
      return sendError(
        res,
        400,
        "Could not retrieve email from provider. Please ensure the provider returned an email or send it from the client."
      );
    }

    let user = await findUserByEmail(email);
    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

      const userPayload = {
        email,
        password: passwordHash,
        firebaseUid: null,
        firstName: profile.firstName || "",
        lastName: profile.lastName || "",
        phone: null,
        transactionPin: null,
        address: null,
        occupation: null,
        positionAtWork: null,
        placeOfWork: null,
        localGovernmentArea: null,
        state: null,
        country: "Nigeria",
        maritalStatus: "single",
        numberOfChildren: 0,
        hobbies: null,
        role: "user",
      };

      user = await createUser(userPayload);
      // mark verified
      // await updateUserById(user.id, { is_verified: true });
    }

    const expiresIn = rememberMe ? "30d" : JWT_EXPIRES_IN;
    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    try {
      await sendNotification({
        user: { id: user.id, email: user.email },
        title: "Login Alert",
        message: `Logged in via ${provider}`,
        channels: ["PUSH"],
        data: {},
      });
    } catch (e) {}

    return sendSuccess(res, 200, { token: jwtToken, user: sanitizeUser(user) });
  } catch (err) {
    return next(err);
  }
};

export const verifyUser = async (req, res, next) => {
  try {
    const { userId, nin, bvn, utilityBillType, utilityBillUrl, faceCaptureUrl } = req.body;
    if (!isUuid(userId)) {
      return sendError(res, 400, "userId must be a valid UUID");
    }

    const user = await findUserById(userId);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

   try {
    await verifyUserAccount(userId, {
      nin,
      bvn,
      utilityBillType,
      utilityBillUrl,
      faceCaptureUrl
    }
  
  );} catch (error) {
    return sendError(res, 400, "Verification failed: " + error.message);
  }
    

    return sendSuccess(res, 200, { user: sanitizeUser(user) });
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

    try {
  await sendNotification({
  user: {
    id: id,
    email: await findUserById(id).then(u => u.email),
  },
  title: "Your Profile Was Updated",
  message: "Your profile has been updated successfully. If you did not make this change, please contact support immediately.",
  channels: ["EMAIL","IN_APP"],
  data: {
  
  },
});

} catch (error) {
  
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


try {
  await sendNotification({
  user: {
    id: user.id,
    email: user.email,
  },
  title: "Security Alert",
  message: "Your password has been changed successfully. If you did not make this change, please contact support immediately.",
  channels: ["PUSH", "EMAIL", "IN_APP"],
  data: {
  
  },
});

} catch (error) {
  
}

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


    try {
  await sendNotification({
  user: {
    id: id,
    email: await findUserById(id).then(u => u.email),
  },
  title: "Status Update Alert",
  message: "Your lawyer status has been updated successfully.",
  channels: ["PUSH", "EMAIL", "IN_APP"],
  data: {
  
  },
});

} catch (error) {
  
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

export const getUserBasicInfoById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isUuid(id)) {
      return sendError(res, 400, "id must be a valid UUID");
    }

    const isOwner = req.user?.id === id;
    const isAdmin = req.user?.role === "admin";
    if (!isOwner && !isAdmin) {
      return sendError(res, 403, "Forbidden");
    }

    const user = await getUserBasicInfoByIdModel(id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    return sendSuccess(res, 200, { user });
  } catch (err) {
    return next(err);
  }
};
