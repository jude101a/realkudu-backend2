import nodemailer from "nodemailer";
import { buildEmailVerification, buildResetPasswordEmail, buildAccountActionEmail } from "./email.templates.js";

const SMTP_PORT = Number(process.env.SMTP_PORT);

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true only for port 465, false (STARTTLS) for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  family: 4, // forces IPv4 at the socket level — more reliable than a custom dns.lookup override
  connectionTimeout: 10000, // fail fast (10s) instead of hanging if network is bad
});

/**
 * Send verification email
 */
export const sendVerificationEmail = async (email, link) => {
  const mailOptions = {
    from: `"Real Kudu" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify your email",
    html: buildEmailVerificationTemplate({ link, userName }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId, info.response);
    return info;
  } catch (err) {
    console.error("❌ Mail error:", err.message, err.code, err.responseCode, err.response);
    throw err;
  }
};
export const sendPasswordResetEmail = async (email, otp, userName) => {
  const mailOptions = {
    from: `"Real Kudu" <${process.env.SMTP_USER}>`, 
    to: email,
    subject: "Password Reset Request",
    html: buildPasswordResetEmailTemplate({ otp, userName }),
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId, info.response);
    return info;
  } catch (err) {
    console.error("❌ Mail error:", err.message, err.code, err.responseCode, err.response);
    throw err;
  }
};

export const sendAccountActionEmail = async ({email, actionCall, userName, reason, actionLink, deadline }) => {
  const mailOptions = {
    from: `"Real Kudu" <${process.env.SMTP_USER}>`,
    to: email,
    subject: actionCall,
    html: buildAccountActionEmail({ actionCall, userName, reason, actionLink, deadline }),
  };
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent:", info.messageId, info.response);
    return info;
  } catch (err) {
    console.error("❌ Mail error:", err.message, err.code, err.responseCode, err.response);
    throw err;
  }
};