import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send verification email
 */
export const sendVerificationEmail = async (email, link) => {
  const mailOptions = {
    from: `"Real Kudu" <${process.env.SMTP_USER}>`,
    to: email,
    subject: "Verify your email",
    html: `
      <h2>Welcome 👋</h2>
      <p>Click the link below to verify your email:</p>
      <a href="${link}">${link}</a>
      <p>This link expires in 24 hours.</p>
    `,
  };

  // ✅ THIS IS WHERE IT GOES
  await transporter.sendMail(mailOptions).catch((err) => {
    console.error("Mail error:", err);
  });
};