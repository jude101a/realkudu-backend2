import { renderBaseTemplate, button, propertyCard } from "./emailBase.js";




const APP_NAME = "RealKudu";
const BRAND_COLOR = "#0f172a";
const ACCENT_COLOR = "#2563eb";
const SUPPORT_EMAIL = "support@realkudu.com";

// 1. SECURITY ALERT — new login, password change, suspicious activity
export const buildSecurityAlertEmail = ({ userName, action, device, location, time, secureLink }) =>
  renderBaseTemplate({
    preheader: `Security alert on your Real Kudu account`,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:20px;color:#c0392b;">⚠️ Security Alert</h2>
      <p style="font-size:15px;color:#444;">Hi ${userName}, we detected: <strong>${action}</strong></p>
      <table style="width:100%;font-size:13px;color:#666;margin:16px 0;">
        <tr><td style="padding:4px 0;"><strong>Device:</strong></td><td>${device}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Location:</strong></td><td>${location}</td></tr>
        <tr><td style="padding:4px 0;"><strong>Time:</strong></td><td>${time}</td></tr>
      </table>
      <p style="font-size:14px;color:#444;">If this was you, no action is needed.</p>
      ${button(secureLink, "Secure My Account", "#c0392b")}
    `,
    footerNote: "If you didn't do this, secure your account immediately.",
  });

// 2. ACCOUNT ACTION NEEDED — verify, complete KYC, reactivate, incomplete profile
export const buildAccountActionEmail = ({ actionCall, userName, reason, actionLink, deadline }) =>
  renderBaseTemplate({
    preheader: actionCall,
    bodyHtml: `
      <h2 style="margin:0 0 12px; font-size:20px; color:#1a1a1a;">Action Needed 🔔</h2>
      <p style="margin:0 0 16px; font-size:15px; line-height:22px; color:#444;">
        Hi ${userName}, ${reason}
      </p>
      ${
        deadline
          ? `<p style="margin:0 0 8px; font-size:13px; color:${WARNING_COLOR};">
               Please complete this by <strong>${deadline}</strong> to avoid interruption.
             </p>`
          : ""
      }
      ${actionLink ? button(actionLink, actionText) : ""}
      ${actionLink ? fallbackLink(actionLink) : ""}
      <p style="margin:16px 0 0; font-size:12px; line-height:18px; color:#94a3b8;">
        If you weren't expecting this notification, please contact our support team.
      </p>
    `,
  });

// 3. INQUIRY ALERT — notify property owner/agent of a new lead
export const buildInquiryAlertEmail = ({ ownerName, propertyTitle, inquirerName, inquirerContact, message, dashboardLink }) =>
  renderBaseTemplate({
    preheader: `New inquiry on ${propertyTitle}`,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">📩 New Inquiry</h2>
      <p style="font-size:15px;color:#444;">Hi ${ownerName}, you have a new inquiry on <strong>${propertyTitle}</strong>.</p>
      <table style="width:100%;font-size:13px;color:#666;margin:16px 0;background:#fafafa;border-radius:6px;">
        <tr><td style="padding:10px;"><strong>From:</strong> ${inquirerName}</td></tr>
        <tr><td style="padding:0 10px;"><strong>Contact:</strong> ${inquirerContact}</td></tr>
        <tr><td style="padding:10px;"><strong>Message:</strong><br/>${message}</td></tr>
      </table>
      ${button(dashboardLink, "Respond Now")}
    `,
  });

// 4. PAYMENT — receipt / confirmation
export const buildPaymentEmail = ({ userName, amount, reference, date, method, receiptLink }) =>
  renderBaseTemplate({
    preheader: `Payment confirmation — ${amount}`,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:20px;color:#1a7a3c;">✅ Payment Received</h2>
      <p style="font-size:15px;color:#444;">Hi ${userName}, we've received your payment.</p>
      <table style="width:100%;font-size:13px;color:#666;margin:16px 0;background:#fafafa;border-radius:6px;">
        <tr><td style="padding:10px;"><strong>Amount:</strong></td><td>${amount}</td></tr>
        <tr><td style="padding:0 10px 10px;"><strong>Reference:</strong></td><td>${reference}</td></tr>
        <tr><td style="padding:0 10px 10px;"><strong>Method:</strong></td><td>${method}</td></tr>
        <tr><td style="padding:0 10px 10px;"><strong>Date:</strong></td><td>${date}</td></tr>
      </table>
      ${button(receiptLink, "View Receipt", "#1a7a3c")}
    `,
  });

// 5. PURCHASE PROCESS — step-based update (offer made, agreement signed, closing, etc.)
export const buildPurchaseProcessEmail = ({ userName, propertyTitle, stage, nextStep, trackingLink }) =>
  renderBaseTemplate({
    preheader: `Update on your purchase — ${propertyTitle}`,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">🏠 Purchase Update</h2>
      <p style="font-size:15px;color:#444;">Hi ${userName}, your purchase of <strong>${propertyTitle}</strong> has moved to:</p>
      <p style="font-size:17px;font-weight:bold;color:#e67e22;margin:12px 0;">${stage}</p>
      <p style="font-size:14px;color:#666;">${nextStep}</p>
      ${button(trackingLink, "Track Progress")}
    `,
  });

// 6. PROMOTIONS — property upsell / marketing
export const buildPromotionEmail = ({ userName, headline, blurb, properties = [] }) =>
  renderBaseTemplate({
    preheader: headline,
    bodyHtml: `
      <h2 style="margin:0 0 12px;font-size:20px;color:#1a1a1a;">${headline}</h2>
      <p style="font-size:15px;color:#444;">Hi ${userName}, ${blurb}</p>
      ${properties.map(propertyCard).join("")}
    `,
    footerNote: "You're receiving this because you subscribed to Real Kudu updates.",
  });


  /**
 * Password reset email template — OTP based.
 * @param {Object} params
 * @param {string} params.otp - The one-time password/code (e.g. 6 digits)
 * @param {string} [params.userName] - Recipient's name, optional
 * @param {string} [params.expiresInMinutes] - OTP validity window, default 15
 * @param {string} [params.supportEmail] - Support contact for "wrong recipient" / "didn't request this"
 * @param {string} [params.appName] - Product name shown in header/footer
 * @returns {string} HTML email markup
 */
export const buildResetPasswordEmail = ({
  otp,
  userName = "User",
  expiresInMinutes = 15,
  supportEmail = "support@realkudu.com",
  appName = "Real Kudu",
}) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Reset your password</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:32px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background-color:#0f172a; padding:24px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:#ffffff; font-size:18px; font-weight:600; letter-spacing:0.2px;">
                    ${appName}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px; font-size:20px; line-height:28px; color:#0f172a; font-weight:600;">
                Reset your password
              </h1>

              <p style="margin:0 0 16px; font-size:15px; line-height:22px; color:#334155;">
                Hi ${userName},
              </p>

              <p style="margin:0 0 24px; font-size:15px; line-height:22px; color:#334155;">
                We received a request to reset the password on your ${appName} account. Use the one-time code below to continue. This code is valid for <strong>${expiresInMinutes} minutes</strong>.
              </p>

              <!-- OTP Block -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background-color:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:20px;">
                    <span style="font-size:32px; font-weight:700; letter-spacing:8px; color:#0f172a; font-family: 'Courier New', monospace;">
                      ${otp}
                    </span>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 24px; font-size:14px; line-height:20px; color:#64748b;">
                Enter this code in the app to set a new password. Do not share this code with anyone — our team will never ask you for it.
              </p>

              <!-- Security warning: didn't request this -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
                <tr>
                  <td style="background-color:#fef2f2; border-left:4px solid #dc2626; border-radius:4px; padding:14px 16px;">
                    <p style="margin:0; font-size:13px; line-height:19px; color:#991b1b;">
                      <strong>Didn't request this?</strong> If you did not ask to reset your password, your account may be at risk. Please log in and change your password immediately, and consider enabling additional account security.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Wrong recipient warning -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
                <tr>
                  <td style="background-color:#fffbeb; border-left:4px solid #d97706; border-radius:4px; padding:14px 16px;">
                    <p style="margin:0; font-size:13px; line-height:19px; color:#92400e;">
                      <strong>Not your email?</strong> If this message was sent to you by mistake and this is not your account, please delete this email immediately and do not use the code above.
                    </p>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; background-color:#f8fafc; border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px; font-size:12px; line-height:18px; color:#94a3b8;">
                Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#2563eb; text-decoration:none;">${supportEmail}</a>
              </p>
              <p style="margin:0; font-size:12px; line-height:18px; color:#94a3b8;">
                &copy; ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/**
 * Sign-up email verification (OTP). Sent immediately after account creation
 * to confirm the user owns the email address before granting full access.
 *
 * @param {Object} params
 * @param {string} params.userName - Recipient's display name
 * @param {string} params.otp - One-time verification code (e.g. 6 digits)
 * @param {string} [params.expiresInMinutes] - OTP validity window, default 15
 * @returns {string} Full HTML email
 */
export const buildEmailVerification = ({
  userName,
  otp,
  expiresInMinutes = 15,
}) =>
  renderBaseTemplate({
    preheader: `Your verification code is ${otp}`,
    bodyHtml: `
      <h2 style="margin:0 0 12px; font-size:20px; color:#1a1a1a;">Verify your email 👋</h2>
 
      <p style="margin:0 0 16px; font-size:15px; line-height:22px; color:#444;">
        Hi ${userName}, welcome to ${APP_NAME}! Use the code below to confirm your email address and finish setting up your account.
      </p>
 
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td align="center" style="background-color:#f1f5f9; border:1px solid #e2e8f0; border-radius:8px; padding:20px;">
            <span style="font-size:32px; font-weight:700; letter-spacing:8px; color:#0f172a; font-family: 'Courier New', monospace;">
              ${otp}
            </span>
          </td>
        </tr>
      </table>
 
      <p style="margin:0 0 20px; font-size:13px; line-height:19px; color:#64748b;">
        This code expires in <strong>${expiresInMinutes} minutes</strong>. Enter it in the app to activate your account. Don't share this code with anyone — our team will never ask you for it.
      </p>
 
      <p style="margin:0; font-size:12px; line-height:18px; color:#94a3b8;">
        Didn't create a ${APP_NAME} account? You can safely ignore this email — no account will be created without verification.
      </p>
    `,
  });