const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { ethers } = require("ethers");
const crypto = require("crypto");

// Lazy load nodemailer to avoid deployment timeout
let nodemailer = null;
/**
 * Lazy load nodemailer module
 * @return {object} Nodemailer module
 */
function getNodemailer() {
  if (!nodemailer) {
    nodemailer = require("nodemailer");
  }
  return nodemailer;
}

// Lazy load TOTP libraries
let authenticator = null;
let qrcode = null;

/**
 * Get authenticator from otplib (lazy loaded)
 * @return {object} Authenticator instance
 */
function getAuthenticator() {
  if (!authenticator) {
    const { authenticator: auth } = require("otplib");
    authenticator = auth;
  }
  return authenticator;
}

/**
 * Get QRCode library (lazy loaded)
 * @return {object} QRCode module
 */
function getQRCode() {
  if (!qrcode) {
    qrcode = require("qrcode");
  }
  return qrcode;
}

admin.initializeApp();

// =============================================================================
// SECURE WALLET CLOUD SYNC - Envelope Encryption
// =============================================================================
// The client encrypts the wallet with the user's password (AES-256-GCM).
// The server adds a SECOND layer of encryption with a server-side master key.
// Even if Firebase is compromised, attackers need BOTH:
//   1. User's password (for client-side decryption)
//   2. Server master key (for server-side decryption)
// =============================================================================

// Server-side master key - in production, use Secret Manager
const SERVER_ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY ||
  "vcn-server-key-2026-very-secure-32b"; // MUST be 32 bytes for AES-256

/**
 * Server-side AES-256-GCM encryption
 * @param {string} data - Data to encrypt (already client-encrypted)
 * @return {string} Base64 encoded encrypted data with IV prepended
 */
function serverEncrypt(data) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(SERVER_ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  // Format: IV (16 bytes) + AuthTag (16 bytes) + Encrypted Data
  const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, "base64")]);
  return combined.toString("base64");
}

/**
 * Server-side AES-256-GCM decryption
 * @param {string} encryptedBase64 - Base64 encoded encrypted data
 * @return {string} Decrypted data (still client-encrypted)
 */
function serverDecrypt(encryptedBase64) {
  const combined = Buffer.from(encryptedBase64, "base64");

  if (combined.length < 33) { // IV(16) + AuthTag(16) + at least 1 byte
    throw new Error("Invalid encrypted data format");
  }

  const iv = combined.slice(0, 16);
  const authTag = combined.slice(16, 32);
  const encryptedData = combined.slice(32);

  const key = Buffer.from(SERVER_ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedData, undefined, "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// =============================================================================
// EMAIL SERVICE - Nodemailer with Google Workspace / Gmail
// =============================================================================
// For Google Workspace (visai.io):
// 1. Enable 2FA on the Google Workspace account
// 2. Go to: Google Account > Security > App Passwords
// 3. Create new app password for "Mail"
// 4. Set environment variables:
//    firebase functions:secrets:set EMAIL_USER
//    firebase functions:secrets:set EMAIL_APP_PASSWORD
// =============================================================================

const EMAIL_CONFIG = {
  host: "smtp.gmail.com", // Works for both Gmail and Google Workspace
  port: 587,
  secure: false, // Use TLS
  auth: {
    user: process.env.EMAIL_USER || "jays@visai.io",
    pass: process.env.EMAIL_APP_PASSWORD || "", // App Password
  },
};

/**
 * Create email transporter
 * @return {object} Nodemailer transporter
 */
function getEmailTransporter() {
  return getNodemailer().createTransport(EMAIL_CONFIG);
}

/**
 * Send security email (verification code, suspicious activity alert)
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} htmlContent - HTML email body
 * @return {Promise<boolean>} Success status
 */
async function sendSecurityEmail(to, subject, htmlContent) {
  try {
    // Check if email is configured
    if (!process.env.EMAIL_APP_PASSWORD) {
      console.warn("[Email] Email not configured, skipping email to:", to);
      console.log("[Email] Subject:", subject);
      return false;
    }

    const transporter = getEmailTransporter();

    const mailOptions = {
      from: `"Vision Chain Security" <${EMAIL_CONFIG.auth.user}>`,
      to: to,
      subject: subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
    console.log(`[Email] Security email sent to ${to}`);
    return true;
  } catch (err) {
    console.error("[Email] Failed to send:", err);
    return false;
  }
}

/**
 * Generate device verification email HTML
 * @param {string} code - Verification code
 * @param {string} deviceInfo - Device details
 * @return {string} HTML content
 */
/**
 * Base email layout wrapper - premium dark theme, inline styles for email client compatibility
 * @param {string} bodyContent - Inner HTML content
 * @param {string} previewText - Preview text for email clients
 * @return {string} Complete HTML email
 */
function emailBaseLayout(bodyContent, previewText = "") {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Vision Chain</title>
  <!--[if mso]><style>table,td{font-family:Arial,sans-serif!important}</style><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#08080a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${previewText ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${previewText}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#08080a;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:linear-gradient(145deg,#111113,#0d0d0f);border:1px solid rgba(255,255,255,0.06);border-radius:20px;overflow:hidden;">
        <!-- Logo Header -->
        <tr><td style="padding:28px 32px 20px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;">
                  <circle cx="16" cy="16" r="15" stroke="#22d3ee" stroke-width="2" fill="none"/>
                  <path d="M16 6 L22 16 L16 26 L10 16 Z" fill="#22d3ee" opacity="0.3"/>
                  <path d="M16 10 L20 16 L16 22 L12 16 Z" fill="#22d3ee"/>
                </svg>
                <span style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:0.5px;margin-left:10px;vertical-align:middle;">Vision Chain</span>
              </td>
              <td align="right">
                <span style="font-size:10px;font-weight:700;color:#22d3ee;background:rgba(34,211,238,0.1);padding:4px 10px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">Testnet</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Body Content -->
        <tr><td style="padding:32px;">
          ${bodyContent}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:20px 32px 28px;border-top:1px solid rgba(255,255,255,0.04);">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td>
              <p style="margin:0 0 8px;font-size:11px;color:#555;line-height:1.5;">
                This is an automated message from Vision Chain. Do not reply to this email.
              </p>
              <p style="margin:0;font-size:10px;color:#333;">
                &copy; ${new Date().getFullYear()} Vision Chain &middot; Powered by VISAI
              </p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Reusable email UI components (inline-styled for email client compatibility)
 */
const emailComponents = {
  /** Section title with icon indicator */
  sectionTitle: (text, color = "#22d3ee") => `
    <h2 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">${text}</h2>
  `,

  /** Subtitle / description */
  subtitle: (text) => `
    <p style="margin:0 0 24px;font-size:14px;color:#888;line-height:1.6;">${text}</p>
  `,

  /** Info card (key-value pairs) */
  infoCard: (rows, accentColor = "#22d3ee") => {
    const rowsHtml = rows.map(([label, value, highlight]) => `
      <tr>
        <td style="padding:10px 16px;font-size:12px;font-weight:600;color:#666;text-transform:uppercase;letter-spacing:0.5px;white-space:nowrap;">${label}</td>
        <td align="right" style="padding:10px 16px;font-size:14px;font-weight:700;color:${highlight ? accentColor : "#fff"};">${value}</td>
      </tr>
    `).join("");
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;margin:0 0 24px;overflow:hidden;">
        ${rowsHtml}
      </table>
    `;
  },

  /** Highlighted code/value box */
  codeBox: (value, accentColor = "#22d3ee") => `
    <div style="text-align:center;margin:24px 0;">
      <div style="display:inline-block;font-size:32px;font-weight:800;letter-spacing:6px;color:${accentColor};background:rgba(${accentColor === "#22d3ee" ? "34,211,238" : "168,85,247"},0.08);padding:16px 32px;border-radius:12px;border:1px solid rgba(${accentColor === "#22d3ee" ? "34,211,238" : "168,85,247"},0.15);">
        ${value}
      </div>
    </div>
  `,

  /** Primary CTA button */
  button: (text, url, color = "#22d3ee", textColor = "#000") => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td align="center">
        <a href="${url}" target="_blank" style="display:inline-block;background:${color};color:${textColor};font-size:13px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.5px;text-transform:uppercase;">${text}</a>
      </td></tr>
    </table>
  `,

  /** Warning/alert box */
  alertBox: (content, type = "warning") => {
    const colors = {
      warning: { bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", accent: "#ef4444" },
      info: { bg: "rgba(34,211,238,0.08)", border: "rgba(34,211,238,0.15)", accent: "#22d3ee" },
      success: { bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.15)", accent: "#22c55e" },
    };
    const c = colors[type] || colors.warning;
    return `
      <div style="background:${c.bg};border:1px solid ${c.border};border-radius:12px;padding:16px 20px;margin:16px 0;">
        <p style="margin:0;font-size:13px;color:${c.accent};line-height:1.5;">${content}</p>
      </div>
    `;
  },

  /** Chain route visualization (Vision -> Destination) */
  chainRoute: (fromChain, toChain) => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td align="center" width="38%">
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.15);border-radius:12px;padding:16px 12px;">
            <div style="font-size:20px;margin-bottom:6px;">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" style="display:inline-block;vertical-align:middle;">
                <circle cx="16" cy="16" r="12" stroke="#3b82f6" stroke-width="2" fill="none"/>
                <path d="M16 10v12M12 14l4-4 4 4" stroke="#3b82f6" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div style="font-size:10px;font-weight:800;color:#3b82f6;text-transform:uppercase;letter-spacing:1px;">${fromChain}</div>
          </div>
        </td>
        <td align="center" width="24%">
          <div style="font-size:18px;color:#a855f7;">
            <svg width="24" height="12" viewBox="0 0 24 12" fill="none" style="display:inline-block;vertical-align:middle;">
              <path d="M0 6h20M16 1l5 5-5 5" stroke="#a855f7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </td>
        <td align="center" width="38%">
          <div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.15);border-radius:12px;padding:16px 12px;">
            <div style="font-size:20px;margin-bottom:6px;">
              <svg width="24" height="24" viewBox="0 0 32 32" fill="none" style="display:inline-block;vertical-align:middle;">
                <circle cx="16" cy="16" r="12" stroke="#a855f7" stroke-width="2" fill="none"/>
                <path d="M22 16a6 6 0 1 1-6-6M22 10v6h-6" stroke="#a855f7" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </div>
            <div style="font-size:10px;font-weight:800;color:#a855f7;text-transform:uppercase;letter-spacing:1px;">${toChain}</div>
          </div>
        </td>
      </tr>
    </table>
  `,

  /** Status badge */
  statusBadge: (text, type = "success") => {
    const colors = { success: "#22c55e", pending: "#f59e0b", error: "#ef4444" };
    const c = colors[type] || colors.success;
    return `<span style="display:inline-block;font-size:10px;font-weight:800;color:${c};background:rgba(${type === "success" ? "34,197,94" : type === "pending" ? "245,158,11" : "239,68,68"},0.12);padding:4px 12px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;">${text}</span>`;
  },

  /** Divider */
  divider: () => `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;">
      <tr><td style="border-top:1px solid rgba(255,255,255,0.04);"></td></tr>
    </table>
  `,

  /** Mono text (for hashes, addresses) */
  monoText: (text) => `<span style="font-family:'SF Mono',SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:11px;color:#666;">${text}</span>`,
};

// =============================================================================
// FIRESTORE TEMPLATE SYSTEM - Load admin-editable templates with {{variable}} support
// =============================================================================

/**
 * Load a custom email template from Firestore emailTemplates collection.
 * Returns { subject, bodyHtml } if found, or null if not found.
 * @param {string} templateId - Template document ID
 * @return {Promise<{subject: string, bodyHtml: string}|null>}
 */
async function loadCustomTemplate(templateId) {
  try {
    const templateDoc = await db.collection("emailTemplates").doc(templateId).get();
    if (templateDoc.exists) {
      const data = templateDoc.data();
      if (data.bodyHtml) {
        return { subject: data.subject || "", bodyHtml: data.bodyHtml };
      }
    }
    return null;
  } catch (err) {
    console.error(`[Email] Failed to load custom template "${templateId}":`, err.message);
    return null;
  }
}

/**
 * Replace {{variable}} placeholders in a template string with actual values.
 * @param {string} template - Template string with {{var}} placeholders
 * @param {Object} variables - Key-value pairs for replacement
 * @return {string} Rendered string
 */
function renderTemplate(template, variables) {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

/**
 * Generate device verification email HTML
 * Checks Firestore for custom template first, falls back to hardcoded.
 * @param {string} code - Verification code
 * @param {string} deviceInfo - Device details
 * @return {Promise<string>|string} HTML content
 */
async function generateVerificationEmailHtml(code, deviceInfo) {
  const custom = await loadCustomTemplate("verification");
  if (custom) {
    const body = renderTemplate(custom.bodyHtml, { code, deviceInfo: deviceInfo || "Unknown device" });
    const subject = renderTemplate(custom.subject, { code });
    return emailBaseLayout(body, subject);
  }
  const body = `
    ${emailComponents.sectionTitle("Device Verification")}
    ${emailComponents.subtitle("A new device is attempting to access your wallet. Enter the code below to verify this login.")}
    ${emailComponents.codeBox(code)}
    ${emailComponents.alertBox(`<strong>Device Info:</strong><br/>${deviceInfo || "Unknown device"}`, "info")}
    ${emailComponents.alertBox("This code expires in <strong>15 minutes</strong>. If you didn't request this, someone may be trying to access your account. Secure your account immediately.", "warning")}
  `;
  return emailBaseLayout(body, `Your Vision Chain verification code: ${code}`);
}

/**
 * Generate suspicious activity alert email HTML
 * @param {string} reason - Alert reason
 * @param {string} details - Activity details
 * @return {Promise<string>} HTML content
 */
async function generateSuspiciousActivityEmailHtml(reason, details) {
  const custom = await loadCustomTemplate("suspicious");
  if (custom) {
    const body = renderTemplate(custom.bodyHtml, { reason, details });
    const subject = renderTemplate(custom.subject, { reason });
    return emailBaseLayout(body, subject);
  }
  const body = `
    ${emailComponents.sectionTitle("Security Alert")}
    ${emailComponents.subtitle("We detected suspicious activity on your Vision Chain account.")}
    ${emailComponents.alertBox(`<strong>Reason:</strong> ${reason}`, "warning")}
    ${emailComponents.infoCard([
    ["Activity Details", "", false],
  ], "#ef4444")}
    <div style="background:rgba(255,255,255,0.03);padding:14px 16px;border-radius:10px;margin:0 0 20px;">
      <p style="margin:0;font-size:12px;font-family:'SF Mono',monospace;color:#888;line-height:1.6;word-break:break-all;">${details}</p>
    </div>
    ${emailComponents.divider()}
    <p style="margin:0 0 6px;font-size:13px;color:#ccc;font-weight:600;">If this wasn't you, please:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0 8px;">
      <tr><td style="padding:4px 0;font-size:13px;color:#888;">&bull; Change your password immediately</td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#888;">&bull; Review your recent account activity</td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#888;">&bull; Enable two-factor authentication</td></tr>
    </table>
  `;
  return emailBaseLayout(body, `Security Alert: ${reason}`);
}

// =============================================================================
// SECURITY FEATURES - Rate Limiting, Device Fingerprint, IP Anomaly Detection
// =============================================================================

/**
 * Rate Limiting: Prevent brute-force attacks
 * @param {string} email - User email
 * @param {object} db - Firestore instance
 * @return {Promise<void>} Throws if rate limited
 */
async function checkRateLimit(email, db) {
  const rateLimitDoc = await db.collection("security_rate_limits").doc(email).get();

  if (rateLimitDoc.exists) {
    const data = rateLimitDoc.data();
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // 15 minutes

    // Clean up old attempts
    const recentAttempts = (data.attempts || []).filter(
      (t) => now - t < windowMs,
    );

    if (recentAttempts.length >= 5) {
      const waitMinutes = Math.ceil((windowMs - (now - recentAttempts[0])) / 60000);
      throw new HttpsError(
        "resource-exhausted",
        `Too many attempts. Please try again in ${waitMinutes} minutes.`,
      );
    }

    // Update attempts
    await db.collection("security_rate_limits").doc(email).update({
      attempts: [...recentAttempts, now],
    });
  } else {
    await db.collection("security_rate_limits").doc(email).set({
      attempts: [Date.now()],
    });
  }
}

/**
 * Clear rate limit on successful authentication
 * @param {string} email - User email
 * @param {object} db - Firestore instance
 */
async function clearRateLimit(email, db) {
  try {
    await db.collection("security_rate_limits").doc(email).delete();
  } catch (e) {
    // Ignore if doesn't exist
  }
}

/**
 * Device Fingerprint: Track known devices
 * @param {string} email - User email
 * @param {string} deviceFingerprint - Client-generated device fingerprint
 * @param {object} db - Firestore instance
 * @return {Promise<{isNewDevice: boolean, requiresVerification: boolean}>}
 */
async function checkDeviceFingerprint(email, deviceFingerprint, db) {
  if (!deviceFingerprint) {
    return { isNewDevice: true, requiresVerification: false };
  }

  const deviceDoc = await db.collection("security_devices").doc(email).get();

  if (!deviceDoc.exists) {
    // First device - save it
    await db.collection("security_devices").doc(email).set({
      devices: [{
        fingerprint: deviceFingerprint,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        verified: true, // First device is auto-verified
      }],
    });
    return { isNewDevice: false, requiresVerification: false };
  }

  const data = deviceDoc.data();
  const existingDevice = data.devices.find((d) => d.fingerprint === deviceFingerprint);

  if (existingDevice) {
    // Known device - update last seen
    const updatedDevices = data.devices.map((d) =>
      d.fingerprint === deviceFingerprint ? { ...d, lastSeen: Date.now() } : d,
    );
    await db.collection("security_devices").doc(email).update({ devices: updatedDevices });
    return { isNewDevice: false, requiresVerification: false };
  }

  // New device - requires verification
  const newDevice = {
    fingerprint: deviceFingerprint,
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    verified: false,
    verificationCode: crypto.randomBytes(3).toString("hex").toUpperCase(),
    verificationExpiry: Date.now() + 15 * 60 * 1000, // 15 minutes
  };

  await db.collection("security_devices").doc(email).update({
    devices: admin.firestore.FieldValue.arrayUnion(newDevice),
  });

  return {
    isNewDevice: true,
    requiresVerification: true,
    verificationCode: newDevice.verificationCode,
  };
}

/**
 * IP Anomaly Detection: Track geographic patterns
 * @param {string} email - User email
 * @param {string} ipAddress - Client IP
 * @param {object} db - Firestore instance
 * @return {Promise<object>} Result with suspicious flag and optional reason
 */
async function checkIpAnomaly(email, ipAddress, db) {
  if (!ipAddress || ipAddress === "::1" || ipAddress === "127.0.0.1") {
    return { suspicious: false }; // Local development
  }

  const ipDoc = await db.collection("security_ip_history").doc(email).get();

  if (!ipDoc.exists) {
    // First access - save IP
    await db.collection("security_ip_history").doc(email).set({
      knownIps: [{
        ip: ipAddress,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        accessCount: 1,
      }],
      lastAccessIp: ipAddress,
      lastAccessTime: Date.now(),
    });
    return { suspicious: false };
  }

  const data = ipDoc.data();
  const knownIp = data.knownIps.find((i) => i.ip === ipAddress);

  if (knownIp) {
    // Known IP - update
    const updatedIps = data.knownIps.map((i) =>
      i.ip === ipAddress ?
        { ...i, lastSeen: Date.now(), accessCount: (i.accessCount || 0) + 1 } :
        i,
    );
    await db.collection("security_ip_history").doc(email).update({
      knownIps: updatedIps,
      lastAccessIp: ipAddress,
      lastAccessTime: Date.now(),
    });
    return { suspicious: false };
  }

  // New IP - check if suspicious
  const timeSinceLastAccess = Date.now() - (data.lastAccessTime || 0);
  const tooFast = timeSinceLastAccess < 5 * 60 * 1000; // Less than 5 minutes

  // Add new IP to history
  await db.collection("security_ip_history").doc(email).update({
    knownIps: admin.firestore.FieldValue.arrayUnion({
      ip: ipAddress,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      accessCount: 1,
    }),
    lastAccessIp: ipAddress,
    lastAccessTime: Date.now(),
  });

  if (tooFast && data.knownIps.length > 0) {
    return {
      suspicious: true,
      reason: "Access from new IP address very quickly after previous access",
      previousIp: data.lastAccessIp,
      newIp: ipAddress,
    };
  }

  return { suspicious: false, isNewIp: true };
}

/**
 * Log security event for audit trail
 * @param {string} email - User email
 * @param {string} action - Action type
 * @param {object} details - Event details
 * @param {object} db - Firestore instance
 */
async function logSecurityEvent(email, action, details, db) {
  try {
    await db.collection("security_audit_log").add({
      email: email,
      action: action,
      details: details,
      timestamp: admin.firestore.Timestamp.now(),
    });
  } catch (e) {
    console.error("[Security] Failed to log event:", e);
  }
}

const db = admin.firestore();

// ============================================================================
// VISION CHAIN - PAYMASTER CONFIGURATION
// ============================================================================
//
// [BLOCKCHAIN CONSTRAINTS - DO NOT CHANGE WITHOUT UNDERSTANDING THESE]
//
// Vision Chain uses Clique PoA (Proof of Authority) consensus.
// Current chain parameters (as of 2026-02-14):
//   - Chain ID:       3151909
//   - Block Period:   5 seconds (1 block every 5s)
//   - Gas Limit:      30,000,000 (30M per block)
//   - Sealer Nodes:   1 (node-2, address 0xd4FeD8Fe5946aDA714bb664D6B5F2C954acf6B15)
//   - Max TPS:        ~285 (simple transfer) / ~92 (ERC20 transfer)
//
// TIMEOUT DERIVATION (all timeouts must respect block period):
//   - RPC read timeout:       15s = 3 blocks worth of time (adequate for read calls)
//   - TX send timeout:        30s = 6 blocks (allow retries if first block is missed)
//   - TX confirmation wait:   60s = 12 blocks (TX should confirm within 1-2 blocks,
//                              but allow extra time for network delays)
//   - balanceOf timeout:      12s = ~2.5 blocks (read-only, should respond in <1 block)
//   - Cloud Function timeout: 300s = HARD LIMIT set by Firebase (cannot exceed)
//
// NONCE MANAGEMENT:
//   - Always use "latest" (confirmed) nonce, never "pending"
//   - Each TX explicitly sets nonce to prevent ethers.js from using "pending" count
//   - If TX fails mid-sequence, the unused nonce creates a gap that blocks
//     ALL future TXs from this wallet until the gap is filled (self-transfer)
//
// RPC ROUTING:
//   - rpc.visionchain.co MUST route to the sealer node (node-2, port 8546)
//   - If routed to a non-sealer node, TXs depend on P2P propagation which
//     is unreliable and causes TXs to be stuck in mempool indefinitely
//   - The RPC proxy (api.visionchain.co/rpc-proxy) also routes to node-1 (port 8545)
//     and has the same propagation issue; use only as read-only fallback
//
// ============================================================================

const RPC_URL = "http://46.224.221.201:8546"; // Direct to sealer node-2 (bypasses nginx -> non-sealer node-1)
const RPC_FALLBACK = "https://rpc.visionchain.co"; // nginx -> node-1 (non-sealer, read-only fallback)

// Block period in seconds - used to derive safe timeout values
const BLOCK_PERIOD_SECONDS = 5;

// Vision Chain Executor - MUST be set via Firebase Secrets
// firebase functions:secrets:set VCN_EXECUTOR_PK
const VCN_EXECUTOR_PK = (process.env.VCN_EXECUTOR_PK || "").trim();

// Legacy fallback for existing functions (will be removed after migration)
const EXECUTOR_PRIVATE_KEY = VCN_EXECUTOR_PK || (process.env.EXECUTOR_PK || "").trim();

// --- VCN Token Address (Vision Chain v2) ---
const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// --- BridgeStaking Contract Config ---
const BRIDGE_STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6"; // V3 (with stakeFor)

const BRIDGE_STAKING_ABI = [
  "function setTargetAPY(uint256 _apyBasisPoints) external",
  "function fundRewardPool(uint256 amount) external",
  "function withdrawRewardPool(uint256 amount) external",
  "function depositFees(uint256 amount) external",
  "function setBridge(address _bridge) external",
  // eslint-disable-next-line max-len
  "function getRewardInfo() external view returns (uint256, uint256, uint256, uint256, uint256)",
  "function owner() external view returns (address)",
];

// --- VisionAgentSBT Contract Config (EIP-5192) ---
const AGENT_SBT_ADDRESS = "0x25fD5C55Dd5ed38DcaF2821AE5Cba1092f6BDffc";
const AGENT_SBT_ABI = [
  "function mintAgentIdentity(address to, string agentName, string platform) external returns (uint256)",
  "function getAgentByAddress(address wallet) external view returns (uint256, string, string, uint256)",
  "function totalSupply() external view returns (uint256)",
  "function locked(uint256 tokenId) external view returns (bool)",
  "function isMinter(address) external view returns (bool)",
  "function setMinter(address minter, bool allowed) external",
  "function revokeIdentity(uint256 tokenId) external",
  "function isRevoked(uint256 tokenId) external view returns (bool)",
  "function revoked(uint256 tokenId) external view returns (bool)",
  "event Locked(uint256 tokenId)",
  "event Revoked(uint256 indexed tokenId, string agentName)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];
const SBT_MINT_FEE = "1"; // 1 VCN minting fee

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
];

// =============================================================================
// UNIFIED PAYMASTER - Single entry point for all gasless transfers
// Supports: transfer (immediate), timelock (scheduled), batch (multiple)
// =============================================================================

const VCN_TOKEN_ABI = [
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
];

/**
 * Unified Paymaster API
 *
 * Request body:
 * {
 *   type: 'transfer' | 'timelock' | 'batch',
 *   user: string,              // Sender address
 *   recipient: string,         // For transfer/timelock
 *   amount: string,            // Wei amount for transfer/timelock
 *   fee: string,               // Fee in wei
 *   deadline: number,          // Permit deadline (unix timestamp)
 *   signature: string | {v,r,s}, // EIP-712 permit signature
 *
 *   // TimeLock specific
 *   unlockTime?: number,       // Unix timestamp for scheduled execution
 *   userEmail?: string,        // For notifications
 *
 *   // Batch specific
 *   transactions?: Array<{recipient, amount, name?}>
 * }
 */
exports.paymaster = onRequest({ cors: true, invoker: "public", timeoutSeconds: 300, secrets: ["VCN_EXECUTOR_PK", "SEPOLIA_RELAYER_PK", "VCN_SEPOLIA_ADDRESS", "EMAIL_USER", "EMAIL_APP_PASSWORD"] }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      type = "transfer",
      user,
      recipient,
      amount,
      fee,
      deadline,
      signature,
      unlockTime,
      userEmail,
      transactions,
      senderAddress,
      // Bridge specific
      srcChainId,
      dstChainId,
      token,
      nonce,
      expiry,
      intentSignature,
      // Staking specific
      stakeAction, // 'stake', 'unstake', 'withdraw', 'claim'
    } = req.body;

    console.log(`[Paymaster] Request type: ${type} from ${user}`);

    // Health check / RPC diagnostic endpoint
    if (type === "health") {
      const rpcs = [RPC_URL, RPC_FALLBACK];
      const results = [];
      for (const url of rpcs) {
        const start = Date.now();
        try {
          const fetchReq = new ethers.FetchRequest(url);
          fetchReq.timeout = 8000;
          const testProvider = new ethers.JsonRpcProvider(fetchReq, undefined, { staticNetwork: true });
          const blockNum = await testProvider.getBlockNumber();
          results.push({ url, ok: true, block: blockNum, ms: Date.now() - start });
        } catch (e) {
          results.push({ url, ok: false, error: e.message, ms: Date.now() - start });
        }
      }
      return res.status(200).json({ rpcs: results, timestamp: new Date().toISOString() });
    }

    // Flush stuck nonces
    if (type === "flush_nonce") {
      const visionNet = ethers.Network.from({ name: "vision-chain", chainId: 3151909 });
      const fetchReq = new ethers.FetchRequest(RPC_URL);
      fetchReq.timeout = 15000;
      const p = new ethers.JsonRpcProvider(fetchReq, visionNet, { staticNetwork: visionNet });
      const w = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, p);
      const latestNonce = await p.getTransactionCount(w.address, "latest");
      const pendingNonce = await p.getTransactionCount(w.address, "pending");
      console.log(`[Paymaster:FlushNonce] latest=${latestNonce}, pending=${pendingNonce}`);
      if (pendingNonce <= latestNonce) {
        return res.status(200).json({ message: "No nonce gap", latestNonce, pendingNonce });
      }
      const flushed = [];
      for (let n = latestNonce; n < pendingNonce; n++) {
        try {
          const tx = await w.sendTransaction({ to: w.address, value: 0, nonce: n });
          await tx.wait();
          flushed.push({ nonce: n, hash: tx.hash });
          console.log(`[Paymaster:FlushNonce] Flushed nonce ${n}: ${tx.hash}`);
        } catch (e) {
          flushed.push({ nonce: n, error: e.message });
          console.error(`[Paymaster:FlushNonce] Failed nonce ${n}: ${e.message}`);
        }
      }
      return res.status(200).json({ flushed, latestNonce, pendingNonce });
    }

    // Basic validation (skip for info-only endpoints)
    if (!user && type !== "reverse_bridge_info") {
      return res.status(400).json({ error: "Missing required field: user" });
    }

    // Deadline check (if provided)
    if (deadline && Math.floor(Date.now() / 1000) > deadline) {
      return res.status(400).json({ error: "Request expired" });
    }

    // ---------------------------------------------------------------
    // BLOCKCHAIN CONNECTION SETUP
    // ---------------------------------------------------------------
    // CRITICAL: Must use explicit network to prevent ethers.js v6 from
    // calling eth_chainId internally, which hangs in Cloud Functions.
    // See: https://github.com/ethers-io/ethers.js/issues/4377
    const visionNetwork = ethers.Network.from({
      name: "vision-chain",
      chainId: 3151909, // Vision Chain network ID - DO NOT CHANGE
    });

    // RPC read timeout = 3 blocks = 3 * BLOCK_PERIOD_SECONDS
    // Rationale: Read calls should respond within 1 block; 3x gives margin.
    const rpcTimeoutMs = BLOCK_PERIOD_SECONDS * 3 * 1000;

    let provider;
    const rpcUrls = [RPC_URL, RPC_FALLBACK];
    for (const rpcUrl of rpcUrls) {
      try {
        const fetchReq = new ethers.FetchRequest(rpcUrl);
        fetchReq.timeout = rpcTimeoutMs; // Derived from block period
        provider = new ethers.JsonRpcProvider(fetchReq, visionNetwork, { staticNetwork: visionNetwork });
        const blockNum = await provider.getBlockNumber();
        console.log(`[Paymaster] RPC connected: ${rpcUrl}, block: ${blockNum}`);
        break;
      } catch (rpcErr) {
        console.warn(`[Paymaster] RPC failed (${rpcUrl}): ${rpcErr.message}`);
        provider = null;
      }
    }
    if (!provider) {
      return res.status(503).json({ error: "All RPC nodes unreachable" });
    }
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
    const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);

    // ---------------------------------------------------------------
    // NONCE MANAGEMENT & DEFENSIVE SAFEGUARDS
    // ---------------------------------------------------------------
    // 1. CONCURRENCY GUARD: Use Firestore distributed lock to prevent
    //    multiple Cloud Function instances from using the same nonce.
    //    Without this, two simultaneous requests could both get nonce=377
    //    and one would fail, creating a gap.
    //
    // 2. NONCE GAP DETECTION: Before processing, check if latest != pending.
    //    If there's a gap, auto-fill with empty TXs before proceeding.
    //    This prevents a single failed TX from blocking ALL future TXs.
    //
    // 3. ALWAYS USE "latest" (confirmed on-chain), NEVER "pending".
    //    Using "pending" nonce counts unconfirmed TXs and creates gaps.
    // ---------------------------------------------------------------

    // Skip lock for read-only operations
    const needsLock = ["transfer", "timelock", "batch", "bridge", "staking", "admin_transfer"].includes(type);
    let lockRef = null;

    if (needsLock) {
      // Acquire distributed lock (expires after 120s as safety valve)
      lockRef = db.collection("_system").doc("paymaster_lock");
      const lockTimeout = Date.now() + 120000;
      let lockAcquired = false;

      for (let attempt = 0; attempt < 10; attempt++) {
        try {
          await db.runTransaction(async (t) => {
            const lockDoc = await t.get(lockRef);
            const lockData = lockDoc.data();

            // Lock is free if: doesn't exist, explicitly unlocked, or expired
            if (!lockDoc.exists || !lockData.locked || Date.now() > lockData.expiresAt) {
              t.set(lockRef, {
                locked: true,
                lockedBy: `${type}-${user}`,
                lockedAt: Date.now(),
                expiresAt: lockTimeout,
              });
              lockAcquired = true;
            } else {
              throw new Error("Lock held");
            }
          });
          if (lockAcquired) break;
        } catch (lockErr) {
          // Wait 1 block period before retrying
          console.log(`[Paymaster] Lock busy, retry ${attempt + 1}/10...`);
          await new Promise((r) => setTimeout(r, BLOCK_PERIOD_SECONDS * 1000));
        }
      }

      if (!lockAcquired) {
        console.error("[Paymaster] Could not acquire lock after 10 attempts");
        return res.status(429).json({
          error: "Paymaster is processing another request. Please retry in a few seconds.",
        });
      }
      console.log(`[Paymaster] Lock acquired for ${type}-${user}`);
    }

    // Helper to release lock (called in finally or on early return)
    const releaseLock = async () => {
      if (lockRef) {
        try {
          await lockRef.set({ locked: false, releasedAt: Date.now() });
          console.log("[Paymaster] Lock released");
        } catch (e) {
          console.error("[Paymaster] Failed to release lock:", e.message);
        }
      }
    };

    try {
      // NONCE GAP DETECTION & AUTO-RECOVERY
      const latestNonce = await provider.getTransactionCount(adminWallet.address, "latest");
      const pendingNonce = await provider.getTransactionCount(adminWallet.address, "pending");

      if (pendingNonce > latestNonce) {
        // GAP DETECTED: There are pending TXs that haven't been mined.
        // This blocks all new TXs. Auto-fill the gap with empty self-transfers.
        const gapSize = pendingNonce - latestNonce;
        console.warn(`[Paymaster] NONCE GAP DETECTED: latest=${latestNonce}, pending=${pendingNonce}, gap=${gapSize}`);

        // Safety limit: don't try to fill more than 20 nonces (indicates deeper problem)
        if (gapSize > 20) {
          await releaseLock();
          console.error(`[Paymaster] Nonce gap too large (${gapSize}). Manual intervention required.`);
          return res.status(503).json({
            error: `Nonce gap too large (${gapSize}). Contact admin.`,
            latestNonce,
            pendingNonce,
          });
        }

        // Auto-fill gap with higher gas to replace stuck TXs
        const gasPrice = (await provider.getFeeData()).gasPrice;
        const boostGas = gasPrice * 10n;
        console.log(`[Paymaster] Auto-filling ${gapSize} nonce gaps (gasPrice: ${ethers.formatUnits(boostGas, "gwei")} Gwei)...`);

        for (let n = latestNonce; n < pendingNonce; n++) {
          try {
            const fillTx = await adminWallet.sendTransaction({
              to: adminWallet.address,
              value: 0,
              nonce: n,
              gasPrice: boostGas,
              gasLimit: 21000,
            });
            await Promise.race([
              fillTx.wait(),
              new Promise((_, reject) => setTimeout(() => reject(new Error("fill TX timeout")), BLOCK_PERIOD_SECONDS * 6 * 1000)),
            ]);
            console.log(`[Paymaster] Filled nonce ${n}: ${fillTx.hash}`);
          } catch (fillErr) {
            console.error(`[Paymaster] Failed to fill nonce ${n}: ${fillErr.message}`);
            await releaseLock();
            return res.status(503).json({
              error: `Failed to recover nonce gap at nonce ${n}. Retry later.`,
            });
          }
        }
        console.log("[Paymaster] Nonce gap resolved successfully");
      }

      // Get the clean confirmed nonce after any gap recovery
      const startNonce = await provider.getTransactionCount(adminWallet.address, "latest");
      console.log(`[Paymaster] Provider ready, admin: ${adminWallet.address}, nonce: ${startNonce}`);

      // Route based on type
      switch (type) {
        case "transfer":
          return await handleTransfer(req, res, { user, recipient, amount, fee, deadline, signature, tokenContract, adminWallet, startNonce });

        case "timelock":
          return await handleTimeLock(req, res, { user, recipient, amount, fee, deadline, signature, unlockTime, userEmail, senderAddress });

        case "batch":
          return await handleBatch(req, res, { user, transactions, fee, deadline, signature, tokenContract, adminWallet, userEmail });

        case "bridge":
          return await handleBridge(req, res, { user, srcChainId, dstChainId, token, amount, recipient, nonce, expiry, intentSignature, adminWallet });

        case "staking":
          return await handleStaking(req, res, { user, amount, stakeAction, fee, deadline, signature, tokenContract, adminWallet });

        case "agent_execution":
          return await handleAgentExecution(req, res, { user, amount, fee, deadline, signature, tokenContract, adminWallet });

        case "reverse_bridge_info": {
          // Return relayer address for client reference
          const sepoliaRelayerPk = (process.env.SEPOLIA_RELAYER_PK || "").trim();
          if (!sepoliaRelayerPk) {
            return res.status(500).json({ error: "SEPOLIA_RELAYER_PK not configured" });
          }
          const relayerWallet = new ethers.Wallet(sepoliaRelayerPk);
          return res.status(200).json({
            success: true,
            relayerAddress: relayerWallet.address,
            vcnSepoliaAddress: (process.env.VCN_SEPOLIA_ADDRESS || "0x07755968236333B5f8803E9D0fC294608B200d1b").trim(),
          });
        }

        case "reverse_bridge_prepare": {
          // Gas sponsorship: send Sepolia ETH to user so they can call approve()
          // This is needed because VCNTokenSepolia does NOT support ERC-2612 Permit
          const prepRelayerPk = (process.env.SEPOLIA_RELAYER_PK || "").trim();
          if (!prepRelayerPk) {
            return res.status(500).json({ error: "SEPOLIA_RELAYER_PK not configured" });
          }
          if (!user) {
            return res.status(400).json({ error: "Missing required field: user" });
          }

          const prepSepoliaProvider = new ethers.JsonRpcProvider("https://ethereum-sepolia-rpc.publicnode.com");
          const prepRelayerWallet = new ethers.Wallet(prepRelayerPk, prepSepoliaProvider);
          const prepRelayerAddress = prepRelayerWallet.address;

          // Check user's Sepolia ETH balance
          const userEthBalance = await prepSepoliaProvider.getBalance(user);
          const GAS_SPONSOR_AMOUNT = ethers.parseEther("0.005"); // ~enough for 2-3 approve txs

          let gasRefillTxHash = null;
          if (userEthBalance < GAS_SPONSOR_AMOUNT) {
            console.log(`[ReverseBridgePrepare] Sending ${ethers.formatEther(GAS_SPONSOR_AMOUNT)} ETH to ${user} for gas...`);
            const relayerEthBal = await prepSepoliaProvider.getBalance(prepRelayerAddress);
            if (relayerEthBal < GAS_SPONSOR_AMOUNT + ethers.parseEther("0.01")) {
              return res.status(503).json({ error: "Relayer ETH balance too low for gas sponsorship" });
            }
            const gasTx = await prepRelayerWallet.sendTransaction({
              to: user,
              value: GAS_SPONSOR_AMOUNT,
              gasLimit: 21000,
            });
            await gasTx.wait();
            gasRefillTxHash = gasTx.hash;
            console.log(`[ReverseBridgePrepare] Gas refill tx: ${gasRefillTxHash}`);
          } else {
            console.log(`[ReverseBridgePrepare] User already has ${ethers.formatEther(userEthBalance)} ETH, skipping refill`);
          }

          return res.status(200).json({
            success: true,
            relayerAddress: prepRelayerAddress,
            vcnSepoliaAddress: (process.env.VCN_SEPOLIA_ADDRESS || "0x07755968236333B5f8803E9D0fC294608B200d1b").trim(),
            gasRefillTxHash,
            userEthBalance: ethers.formatEther(userEthBalance),
          });
        }

        case "reverse_bridge":
          return await handleReverseBridge(req, res, { user, recipient, amount, fee, deadline, signature, adminWallet });

        case "sepolia_transfer":
          return await handleSepoliaTransfer(req, res, { user, recipient, amount, fee, deadline, signature });

        case "admin_transfer":
          return await handleAdminTransfer(req, res, { recipient, amount, tokenContract, adminWallet });

        case "flush_nonce": {
          const flushLatest = await provider.getTransactionCount(adminWallet.address, "latest");
          const flushPending = await provider.getTransactionCount(adminWallet.address, "pending");
          console.log(`[Paymaster:FlushNonce] latest=${flushLatest}, pending=${flushPending}`);
          if (flushPending <= flushLatest) {
            return res.status(200).json({ message: "No nonce gap", latestNonce: flushLatest, pendingNonce: flushPending });
          }
          const flushed = [];
          for (let n = flushLatest; n < flushPending; n++) {
            try {
              const gasPrice = (await provider.getFeeData()).gasPrice;
              const boostedGas = gasPrice * 10n; // 10x to replace stuck TXs
              const flushTx = await adminWallet.sendTransaction({ to: adminWallet.address, value: 0, nonce: n, gasPrice: boostedGas });
              await flushTx.wait();
              flushed.push({ nonce: n, hash: flushTx.hash });
              console.log(`[Paymaster:FlushNonce] Flushed nonce ${n}: ${flushTx.hash}`);
            } catch (e) {
              flushed.push({ nonce: n, error: e.message });
              console.error(`[Paymaster:FlushNonce] Failed nonce ${n}: ${e.message}`);
            }
          }
          return res.status(200).json({ flushed, latestNonce: flushLatest, pendingNonce: flushPending });
        }

        default:
          return res.status(400).json({ error: `Unknown type: ${type}. Supported: transfer, timelock, batch, bridge, staking, admin_transfer, flush_nonce` });
      }
    } catch (innerErr) {
      console.error("[Paymaster] TX processing error:", innerErr);
      return res.status(500).json({ error: innerErr.message || "Internal server error" });
    } finally {
      // ALWAYS release the distributed lock, even on error
      await releaseLock();
    }
  } catch (err) {
    console.error("[Paymaster] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

/**
 * Handle admin VCN distribution (foundation wallet -> user)
 * No permit or fee required - admin wallet sends directly
 */
async function handleAdminTransfer(req, res, { recipient, amount, tokenContract, adminWallet }) {
  if (!recipient || !amount) {
    return res.status(400).json({ error: "Missing required fields: recipient, amount" });
  }

  const amountBigInt = BigInt(amount);
  console.log(`[Paymaster:AdminTransfer] Admin -> ${recipient}, Amount: ${ethers.formatEther(amountBigInt)} VCN`);

  // Check admin balance
  const adminBalance = await tokenContract.balanceOf(adminWallet.address);
  if (adminBalance < amountBigInt) {
    return res.status(400).json({ error: `Insufficient admin VCN balance: ${ethers.formatEther(adminBalance)}` });
  }

  // Direct transfer from admin wallet (no permit needed)
  const tx = await tokenContract.transfer(recipient, amountBigInt);
  console.log(`[Paymaster:AdminTransfer] TX sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`[Paymaster:AdminTransfer] Confirmed in block ${receipt.blockNumber}`);

  // Index to Firestore
  await indexTransaction(tx.hash, {
    type: "Admin Transfer",
    from: adminWallet.address,
    to: recipient,
    amount: ethers.formatEther(amountBigInt),
    fee: "0",
    method: "Admin VCN Distribution",
  });

  return res.status(200).json({
    success: true,
    txHash: tx.hash,
    from: adminWallet.address,
    blockNumber: receipt.blockNumber,
  });
}

/**
 * Handle immediate transfer
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} params - Transfer parameters
 * @return {Promise} - Response promise
 */
async function handleTransfer(req, res, { user, recipient, amount, fee, deadline, signature, tokenContract, adminWallet, startNonce }) {
  if (!recipient || !amount) {
    return res.status(400).json({ error: "Missing required fields: recipient, amount" });
  }

  console.log(`[Paymaster:Transfer] ${user} -> ${recipient}, Amount: ${amount}`);

  // Parse amounts
  const transferAmountBigInt = BigInt(amount);
  const feeBigInt = fee ? BigInt(fee) : ethers.parseUnits("1.0", 18);
  const totalAmountBigInt = transferAmountBigInt + feeBigInt;

  console.log(`[Paymaster:Transfer] Transfer: ${ethers.formatUnits(transferAmountBigInt, 18)}, Fee: ${ethers.formatUnits(feeBigInt, 18)}, Total: ${ethers.formatUnits(totalAmountBigInt, 18)}`);

  // Check user balance (with timeout to prevent hang)
  // Timeout = ~2.5 blocks. balanceOf is a read call; should return in <1 block.
  // If this times out, the RPC node is likely unresponsive.
  const balanceTimeoutMs = Math.ceil(BLOCK_PERIOD_SECONDS * 2.5) * 1000;
  console.log(`[Paymaster:Transfer] Checking balance for ${user}...`);
  let userBalance;
  try {
    userBalance = await Promise.race([
      tokenContract.balanceOf(user),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`balanceOf timeout after ${balanceTimeoutMs / 1000}s`)), balanceTimeoutMs)),
    ]);
    console.log(`[Paymaster:Transfer] Balance: ${ethers.formatUnits(userBalance, 18)} VCN`);
  } catch (balErr) {
    console.error(`[Paymaster:Transfer] Balance check failed: ${balErr.message}`);
    return res.status(503).json({ error: `RPC call failed: ${balErr.message}` });
  }
  if (userBalance < totalAmountBigInt) {
    console.error(`[Paymaster:Transfer] Insufficient balance: ${userBalance} < ${totalAmountBigInt}`);
    return res.status(400).json({ error: "Insufficient balance" });
  }

  // Parse signature
  console.log(`[Paymaster:Transfer] Parsing signature...`);
  const { v, r, s } = parseSignature(signature);
  if (!v) {
    return res.status(400).json({ error: "Invalid signature format" });
  }

  // ---------------------------------------------------------------
  // TX TIMEOUT CONSTRAINTS (derived from block period)
  // ---------------------------------------------------------------
  // TX send timeout = 6 blocks: time for TX to be accepted by the node's mempool.
  // TX wait timeout = 12 blocks: time for TX to be mined and confirmed.
  // With 5s blocks: send=30s, wait=60s. With 3s blocks: send=18s, wait=36s.
  // WARNING: If block period changes, these values auto-adjust.
  //          Do NOT hardcode timeout values directly.
  const txSendTimeoutMs = BLOCK_PERIOD_SECONDS * 6 * 1000;
  const txWaitTimeoutMs = BLOCK_PERIOD_SECONDS * 12 * 1000;

  // Execute permit (with timeout)
  try {
    console.log(`[Paymaster:Transfer] Sending permit tx (timeout: ${txSendTimeoutMs / 1000}s)...`);
    const permitTx = await Promise.race([
      tokenContract.permit(user, adminWallet.address, totalAmountBigInt, deadline, v, r, s, { nonce: startNonce }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`permit send timeout ${txSendTimeoutMs / 1000}s`)), txSendTimeoutMs)),
    ]);
    console.log(`[Paymaster:Transfer] Permit TX sent: ${permitTx.hash}, waiting (timeout: ${txWaitTimeoutMs / 1000}s)...`);
    await Promise.race([
      permitTx.wait(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`permit wait timeout ${txWaitTimeoutMs / 1000}s`)), txWaitTimeoutMs)),
    ]);
    console.log(`[Paymaster:Transfer] Permit confirmed: ${permitTx.hash}`);
  } catch (permitErr) {
    console.error(`[Paymaster:Transfer] Permit failed:`, permitErr.message || permitErr);
    return res.status(400).json({ error: `Permit failed: ${permitErr.reason || permitErr.message}` });
  }

  // Execute transfer (with timeout - same constraints as permit above)
  let tx;
  try {
    console.log(`[Paymaster:Transfer] Sending transferFrom tx (timeout: ${txSendTimeoutMs / 1000}s)...`);
    tx = await Promise.race([
      tokenContract.transferFrom(user, recipient, transferAmountBigInt, { nonce: startNonce + 1 }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`transferFrom send timeout ${txSendTimeoutMs / 1000}s`)), txSendTimeoutMs)),
    ]);
    console.log(`[Paymaster:Transfer] TX sent: ${tx.hash}, waiting...`);
  } catch (txErr) {
    console.error(`[Paymaster:Transfer] Transfer send failed:`, txErr.message || txErr);
    return res.status(500).json({ error: `Transfer failed: ${txErr.reason || txErr.message}` });
  }

  let receipt;
  try {
    receipt = await Promise.race([
      tx.wait(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`transfer wait timeout ${txWaitTimeoutMs / 1000}s`)), txWaitTimeoutMs)),
    ]);
    console.log(`[Paymaster:Transfer] Confirmed in block ${receipt.blockNumber}`);

    // Index to Firestore
    await indexTransaction(tx.hash, {
      type: "Transfer",
      from: user,
      to: recipient,
      amount: ethers.formatUnits(transferAmountBigInt, 18),
      fee: ethers.formatUnits(feeBigInt, 18),
      method: "Paymaster Gasless Transfer",
    });

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (waitErr) {
    console.error(`[Paymaster:Transfer] Wait failed:`, waitErr.message || waitErr);
    // TX was sent but confirmation failed - return hash anyway
    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      warning: "Transaction sent but confirmation timed out",
    });
  }
}

/**
 * Handle scheduled (time lock) transfer
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} params - TimeLock parameters
 * @return {Promise} - Response promise
 */
async function handleTimeLock(req, res, { user, recipient, amount, fee, deadline, signature, unlockTime, userEmail, senderAddress }) {
  if (!recipient || !amount || !unlockTime) {
    return res.status(400).json({ error: "Missing required fields: recipient, amount, unlockTime" });
  }

  console.log(`[Paymaster:TimeLock] ${user} -> ${recipient}, Amount: ${amount}, UnlockTime: ${unlockTime}`);

  // Generate schedule ID
  const scheduleId = `tl_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Save to Firestore for scheduler
  const jobRef = await db.collection("scheduledTransfers").add({
    scheduleId: scheduleId,
    from: user,
    to: recipient,
    senderAddress: senderAddress || user,
    recipient: recipient,
    amount: amount,
    unlockTimeTs: admin.firestore.Timestamp.fromMillis(unlockTime * 1000),
    status: "WAITING",
    createdAt: admin.firestore.Timestamp.now(),
    txHash: null,
    fee: fee || "0",
    deadline: deadline,
    signature: signature || null,
    type: "TIMELOCK",
    userEmail: userEmail || null,
    token: "VCN",
    retryCount: 0,
  });

  console.log(`[Paymaster:TimeLock] Job created: ${jobRef.id}`);

  // Create notification
  try {
    await db.collection("notifications").add({
      userEmail: userEmail,
      type: "transfer_scheduled",
      title: "Time Lock Transfer Scheduled",
      content: `You have scheduled ${ethers.formatUnits(BigInt(amount), 18)} VCN to be sent to ${recipient.slice(0, 10)}...`,
      createdAt: admin.firestore.Timestamp.now(),
      read: false,
      data: { scheduleId, jobId: jobRef.id, recipient, amount, unlockTime },
    });
  } catch (notifyErr) {
    console.warn("[Paymaster:TimeLock] Notification failed:", notifyErr.message);
  }

  return res.status(200).json({
    success: true,
    txHash: null,
    scheduleId: scheduleId,
    jobId: jobRef.id,
  });
}

/**
 * Handle batch transfer
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} params - Batch parameters
 * @return {Promise} - Response promise
 */
async function handleBatch(req, res, { user, transactions, fee, deadline, signature, tokenContract, adminWallet, userEmail }) {
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    return res.status(400).json({ error: "Missing or invalid transactions array" });
  }

  console.log(`[Paymaster:Batch] ${user} sending ${transactions.length} transactions`);

  // Calculate total amount
  let totalAmount = BigInt(0);
  for (const tx of transactions) {
    totalAmount += BigInt(tx.amount || 0);
  }
  const feeBigInt = fee ? BigInt(fee) : ethers.parseUnits("1.0", 18);
  const totalWithFee = totalAmount + feeBigInt;

  console.log(`[Paymaster:Batch] Total: ${ethers.formatUnits(totalAmount, 18)}, Fee: ${ethers.formatUnits(feeBigInt, 18)}`);

  // Check balance
  const userBalance = await tokenContract.balanceOf(user);
  if (userBalance < totalWithFee) {
    return res.status(400).json({ error: "Insufficient balance for batch transfer" });
  }

  // Parse and execute permit
  const { v, r, s } = parseSignature(signature);
  if (v) {
    try {
      const permitTx = await tokenContract.permit(user, adminWallet.address, totalWithFee, deadline, v, r, s);
      await permitTx.wait();
      console.log(`[Paymaster:Batch] Permit successful`);
    } catch (permitErr) {
      console.error(`[Paymaster:Batch] Permit failed:`, permitErr);
      return res.status(400).json({ error: `Permit failed: ${permitErr.reason || permitErr.message}` });
    }
  }

  // Execute transfers
  const results = [];
  for (const tx of transactions) {
    try {
      const txAmount = BigInt(tx.amount);
      const transferTx = await tokenContract.transferFrom(user, tx.recipient, txAmount);
      await transferTx.wait();

      results.push({
        recipient: tx.recipient,
        name: tx.name,
        amount: tx.amount,
        status: "success",
        txHash: transferTx.hash,
      });

      // Index each transaction
      await indexTransaction(transferTx.hash, {
        type: "Batch Transfer",
        from: user,
        to: tx.recipient,
        amount: ethers.formatUnits(txAmount, 18),
        fee: "0",
        method: "Paymaster Batch Transfer",
      });

      console.log(`[Paymaster:Batch] Sent to ${tx.recipient}: ${transferTx.hash}`);
    } catch (err) {
      results.push({
        recipient: tx.recipient,
        name: tx.name,
        amount: tx.amount,
        status: "failed",
        error: err.message,
      });
      console.error(`[Paymaster:Batch] Failed for ${tx.recipient}:`, err.message);
    }
  }

  // Notification
  if (userEmail) {
    try {
      const successCount = results.filter((r) => r.status === "success").length;
      await db.collection("notifications").add({
        userEmail: userEmail,
        type: "batch_complete",
        title: "Batch Transfer Complete",
        content: `Successfully sent ${successCount}/${transactions.length} transactions.`,
        createdAt: admin.firestore.Timestamp.now(),
        read: false,
        data: { results },
      });
    } catch (e) {
      console.warn("[Paymaster:Batch] Notification failed:", e.message);
    }
  }

  return res.status(200).json({
    success: true,
    results: results,
    totalFee: ethers.formatUnits(feeBigInt, 18),
  });
}

/**
 * Helper: Parse signature to v, r, s
 * @param {string|object} signature - EIP-712 signature
 * @return {object} - Parsed v, r, s components
 */
function parseSignature(signature) {
  if (!signature) return { v: null, r: null, s: null };

  if (typeof signature === "object" && signature.v !== undefined) {
    return { v: signature.v, r: signature.r, s: signature.s };
  }

  if (typeof signature === "string") {
    const sig = ethers.Signature.from(signature);
    return { v: sig.v, r: sig.r, s: sig.s };
  }

  return { v: null, r: null, s: null };
}

/**
 * Helper: Index transaction to Firestore
 * @param {string} txHash - Transaction hash
 * @param {object} params - Transaction details
 * @return {Promise} - Firestore set promise
 */
async function indexTransaction(txHash, { type, from, to, amount, fee, method }) {
  try {
    await db.collection("transactions").doc(txHash).set({
      hash: txHash,
      chainId: 3151909,
      type: type,
      from_addr: from.toLowerCase(),
      to_addr: to.toLowerCase(),
      value: amount,
      timestamp: Date.now(),
      status: "indexed",
      metadata: {
        method: method,
        source: "paymaster",
        fee: fee,
        gasSponsored: true,
      },
    });
    console.log(`[Paymaster] Transaction indexed: ${txHash}`);
  } catch (err) {
    console.warn("[Paymaster] Indexing failed:", err.message);
  }
}

/**
 * Handle bridge (cross-chain) transfer
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} params - Bridge parameters
 * @return {Promise} - Response promise
 */
async function handleBridge(req, res, { user, srcChainId, dstChainId, _token, amount, recipient, _nonce, _expiry, _intentSignature, adminWallet }) {
  // Bridge with Paymaster: admin pays gas, user pays fee via EIP-712 permit

  if (!user || !dstChainId || !amount) {
    return res.status(400).json({ error: "Missing required fields: user, dstChainId, amount" });
  }

  // Use user's address as recipient if not specified
  const bridgeRecipient = recipient || user;
  const srcChain = srcChainId || 1337; // Default to Vision Chain

  // Get fee, deadline, signature from request body
  const { fee, deadline, signature } = req.body;

  console.log(`[Paymaster:Bridge] ${user} bridging ${amount} to chain ${dstChainId}, recipient: ${bridgeRecipient}`);

  try {
    // Contract addresses (Vision Chain v2 Testnet)
    const INTENT_COMMITMENT_ADDRESS = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
    const VISION_BRIDGE_SECURE_ADDRESS = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";

    // IntentCommitment ABI (V2 - simpler interface)
    const INTENT_COMMITMENT_ABI = [
      "function commitIntent(address recipient, uint256 amount, uint256 destChainId) external returns (bytes32)",
      "function userNonces(address) view returns (uint256)",
      "event IntentCommitted(bytes32 indexed intentHash, address indexed user, address indexed recipient, uint256 amount, uint256 nonce, uint256 createdAt, uint256 destChainId)",
    ];

    // VisionBridgeSecure ABI
    const BRIDGE_SECURE_ABI = [
      "function lockVCN(bytes32 intentHash, address recipient, uint256 destChainId) payable",
    ];

    const intentContract = new ethers.Contract(INTENT_COMMITMENT_ADDRESS, INTENT_COMMITMENT_ABI, adminWallet);
    const bridgeContract = new ethers.Contract(VISION_BRIDGE_SECURE_ADDRESS, BRIDGE_SECURE_ABI, adminWallet);

    const amountWei = BigInt(amount);
    const BRIDGE_FEE = fee ? BigInt(fee) : ethers.parseEther("1"); // 1 VCN default fee
    const totalAmount = amountWei + BRIDGE_FEE;
    const adminAddress = await adminWallet.getAddress();

    // VCN Token contract for permit/transferFrom
    const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);

    // === DIAGNOSTIC LOGGING (parallel for speed) ===
    const [userBalance, currentAllowance] = await Promise.all([
      tokenContract.balanceOf(user),
      tokenContract.allowance(user, adminAddress),
    ]);
    console.log(`[Paymaster:Bridge] Admin: ${adminAddress}, User VCN: ${ethers.formatEther(userBalance)}, Allowance: ${ethers.formatEther(currentAllowance)}`);
    console.log(`[Paymaster:Bridge] Required: ${ethers.formatEther(totalAmount)} (amount: ${ethers.formatEther(amountWei)}, fee: ${ethers.formatEther(BRIDGE_FEE)})`);

    // === STEP 0: Execute Permit (if provided) ===
    if (signature && deadline) {
      const { v, r, s } = parseSignature(signature);
      if (v) {
        try {
          console.log(`[Paymaster:Bridge] Executing permit for ${ethers.formatEther(totalAmount)} VCN...`);
          const permitTx = await tokenContract.permit(
            user,
            adminAddress,
            totalAmount,
            deadline,
            v, r, s,
          );
          await permitTx.wait();
          console.log(`[Paymaster:Bridge] Permit successful`);
        } catch (permitErr) {
          console.error(`[Paymaster:Bridge] Permit failed:`, permitErr.message);
          return res.status(400).json({ error: `Permit verification failed: ${permitErr.reason || permitErr.message}` });
        }
      }
    } else {
      console.warn(`[Paymaster:Bridge] No signature/deadline, skipping permit.`);
    }

    // === STEP 1: Single transferFrom for fee + bridge amount (OPTIMIZED: was 2 separate TXs) ===
    try {
      console.log(`[Paymaster:Bridge] Transferring total ${ethers.formatEther(totalAmount)} VCN (fee + amount) in single TX...`);
      const transferTx = await tokenContract.transferFrom(user, adminAddress, totalAmount);
      await transferTx.wait();
      console.log(`[Paymaster:Bridge] Total transfer successful`);

      // Forward fee to staking contract (fire-and-forget, non-blocking)
      (async () => {
        try {
          const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, adminWallet);
          const approveTx = await tokenContract.approve(BRIDGE_STAKING_ADDRESS, BRIDGE_FEE);
          await approveTx.wait();
          const depositTx = await stakingContract.depositFees(BRIDGE_FEE);
          await depositTx.wait();
          console.log(`[Paymaster:Bridge] Fee forwarded to staking: ${ethers.formatEther(BRIDGE_FEE)} VCN`);
        } catch (fwdErr) {
          console.warn(`[Paymaster:Bridge] Fee forwarding to staking failed:`, fwdErr.message);
        }
      })();
    } catch (feeErr) {
      console.error(`[Paymaster:Bridge] Transfer failed:`, feeErr.message);
      return res.status(400).json({ error: `Token transfer failed: ${feeErr.reason || feeErr.message}` });
    }

    // === STEP 2: Commit Intent (Paymaster pays gas) ===
    console.log(`[Paymaster:Bridge] Step 2: Committing intent on-chain...`);
    const commitTx = await intentContract.commitIntent(bridgeRecipient, amountWei, dstChainId, { gasLimit: 200000 });
    console.log(`[Paymaster:Bridge] Commit TX sent: ${commitTx.hash}`);
    const commitReceipt = await commitTx.wait();
    console.log(`[Paymaster:Bridge] Commit confirmed in block ${commitReceipt.blockNumber}`);

    // Extract intentHash from event logs
    const intentCommittedTopic = ethers.id("IntentCommitted(bytes32,address,address,uint256,uint256,uint256,uint256)");
    let intentHash = null;
    for (const log of commitReceipt.logs || []) {
      if (log.topics && log.topics[0] === intentCommittedTopic) {
        intentHash = log.topics[1];
        break;
      }
    }

    if (!intentHash) {
      // Fallback: Use parseLogs to decode the event
      try {
        const iface = new ethers.Interface(INTENT_COMMITMENT_ABI);
        for (const log of commitReceipt.logs || []) {
          try {
            const parsed = iface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "IntentCommitted") {
              intentHash = parsed.args[0]; // First argument is intentHash
              console.log(`[Paymaster:Bridge] Parsed intentHash from event: ${intentHash}`);
              break;
            }
          } catch (e) {
            // Not this event, continue
          }
        }
      } catch (parseErr) {
        console.warn(`[Paymaster:Bridge] Event parsing failed:`, parseErr.message);
      }
    }

    if (!intentHash) {
      // Ultimate fallback: generate a pseudo-hash based on tx hash
      console.warn(`[Paymaster:Bridge] Could not extract intentHash from events, using tx hash as fallback`);
      intentHash = ethers.keccak256(ethers.solidityPacked(
        ["bytes32", "address", "uint256", "uint256"],
        [commitTx.hash, bridgeRecipient, amountWei, dstChainId],
      ));
    }
    console.log(`[Paymaster:Bridge] Intent hash: ${intentHash}`);

    // === STEP 3: Lock VCN with intentHash (admin locks the VCN it received from user) ===
    console.log(`[Paymaster:Bridge] Step 3: Locking VCN...`);
    const lockTx = await bridgeContract.lockVCN(intentHash, bridgeRecipient, dstChainId, {
      value: amountWei, // Send native VCN (admin's balance)
      gasLimit: 300000,
    });
    console.log(`[Paymaster:Bridge] Lock TX sent: ${lockTx.hash}`);
    const lockReceipt = await lockTx.wait();
    console.log(`[Paymaster:Bridge] Lock confirmed in block ${lockReceipt.blockNumber}`);

    // Save to Firestore for tracking (fire-and-forget, non-blocking)
    const firestorePromise = (async () => {
      try {
        // Save both records in parallel
        await Promise.all([
          db.collection("bridgeTransactions").add({
            user: user.toLowerCase(),
            srcChainId: srcChain,
            dstChainId: dstChainId,
            amount: ethers.formatEther(amountWei),
            fee: ethers.formatEther(BRIDGE_FEE),
            recipient: bridgeRecipient,
            intentHash: intentHash,
            commitTxHash: commitTx.hash,
            lockTxHash: lockTx.hash,
            status: "LOCKED",
            createdAt: admin.firestore.Timestamp.now(),
            type: "BRIDGE_PAYMASTER",
          }),
          db.collection("transactions").doc(lockTx.hash).set({
            hash: lockTx.hash,
            from_addr: user.toLowerCase(),
            to_addr: "bridge:sepolia",
            recipient: bridgeRecipient.toLowerCase(),
            value: ethers.formatEther(amountWei),
            fee: ethers.formatEther(BRIDGE_FEE),
            timestamp: Date.now(),
            type: "Bridge",
            bridgeStatus: "LOCKED",
            intentHash: intentHash,
            commitTxHash: commitTx.hash,
            lockTxHash: lockTx.hash,
            challengeEndTime: Date.now(), // Testnet: immediate (no challenge logic yet)
            metadata: {
              destinationChain: dstChainId === 11155111 ? "Sepolia" : "Unknown",
              srcChainId: srcChain,
              dstChainId: dstChainId,
            },
          }),
        ]);
        console.log(`[Paymaster:Bridge] Firestore records created`);
      } catch (firestoreErr) {
        console.warn("[Paymaster:Bridge] Firestore write failed:", firestoreErr.message);
      }
    })();

    // Return success immediately, don't wait for Firestore
    const result = res.status(200).json({
      success: true,
      commitTxHash: commitTx.hash,
      lockTxHash: lockTx.hash,
      intentHash: intentHash,
      fee: ethers.formatEther(BRIDGE_FEE),
    });

    // Ensure Firestore write completes before function exits
    await firestorePromise;

    return result;
  } catch (err) {
    console.error("[Paymaster:Bridge] Error:", err);
    return res.status(500).json({ error: err.message || "Bridge transaction failed" });
  }
}

/**
 * Handle reverse bridge: Sepolia VCN → Vision Chain VCN
 * User signs EIP-712 Permit on Sepolia VCN token.
 * Relayer executes permit, collects fee in VCN Sepolia, transfers bridge amount to custody.
 * Then admin wallet sends VCN on Vision Chain to user.
 *
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} params - Reverse bridge parameters
 * @return {Promise} - Response promise
 */
async function handleReverseBridge(req, res, { user, recipient, amount, fee, deadline, signature, adminWallet }) {
  if (!user || !amount) {
    return res.status(400).json({ error: "Missing required fields: user, amount" });
  }

  const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
  const SEPOLIA_CHAIN_ID = 11155111;
  const VISION_CHAIN_ID = 3151909;
  const sepoliaRelayerPk = (process.env.SEPOLIA_RELAYER_PK || "").trim();
  const vcnSepoliaAddress = (process.env.VCN_SEPOLIA_ADDRESS || "0x07755968236333B5f8803E9D0fC294608B200d1b").trim();

  if (!sepoliaRelayerPk) {
    return res.status(500).json({ error: "SEPOLIA_RELAYER_PK not configured" });
  }

  // The recipient on Vision Chain (defaults to user's own address)
  const visionRecipient = recipient || user;

  console.log(`[ReverseBridge] ${user} bridging ${amount} VCN Sepolia → Vision Chain, recipient: ${visionRecipient}`);

  try {
    // === Setup Sepolia connection ===
    const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const relayerWallet = new ethers.Wallet(sepoliaRelayerPk, sepoliaProvider);
    const relayerAddress = await relayerWallet.getAddress();

    // VCN Token on Sepolia (ERC20 with Permit)
    const VCN_SEPOLIA_ABI = [
      "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external",
      "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
      "function balanceOf(address account) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
      "function name() view returns (string)",
      "function nonces(address owner) view returns (uint256)",
    ];
    const sepoliaVcnToken = new ethers.Contract(vcnSepoliaAddress, VCN_SEPOLIA_ABI, relayerWallet);

    const amountWei = BigInt(amount);
    const BRIDGE_FEE = fee ? BigInt(fee) : ethers.parseEther("1"); // Default 1 VCN Sepolia fee
    const totalAmount = amountWei + BRIDGE_FEE;

    // === DIAGNOSTIC LOGGING ===
    const userBalance = await sepoliaVcnToken.balanceOf(user);
    const relayerEthBalance = await sepoliaProvider.getBalance(relayerAddress);
    console.log(`[ReverseBridge] Relayer address: ${relayerAddress}`);
    console.log(`[ReverseBridge] Relayer ETH balance: ${ethers.formatEther(relayerEthBalance)} ETH`);
    console.log(`[ReverseBridge] User Sepolia VCN balance: ${ethers.formatEther(userBalance)}`);
    console.log(`[ReverseBridge] Required total: ${ethers.formatEther(totalAmount)} (amount: ${ethers.formatEther(amountWei)}, fee: ${ethers.formatEther(BRIDGE_FEE)})`);

    if (relayerEthBalance < ethers.parseEther("0.001")) {
      return res.status(503).json({ error: "Relayer ETH balance too low for gas. Please try again later." });
    }

    if (userBalance < totalAmount) {
      return res.status(400).json({ error: `Insufficient Sepolia VCN balance. Have: ${ethers.formatEther(userBalance)}, Need: ${ethers.formatEther(totalAmount)}` });
    }

    // === STEP 0: Execute Permit on Sepolia VCN ===
    if (signature && deadline) {
      const { v, r, s } = parseSignature(signature);
      if (v) {
        try {
          console.log(`[ReverseBridge] Executing Sepolia permit for ${ethers.formatEther(totalAmount)} VCN...`);
          const permitTx = await sepoliaVcnToken.permit(
            user, relayerAddress, totalAmount, deadline, v, r, s,
            { gasLimit: 100000 },
          );
          await permitTx.wait();
          console.log(`[ReverseBridge] Sepolia permit successful`);
        } catch (permitErr) {
          console.error(`[ReverseBridge] Permit failed:`, permitErr.message);
          return res.status(400).json({ error: `Sepolia permit failed: ${permitErr.reason || permitErr.message}` });
        }
      }
    } else {
      console.warn(`[ReverseBridge] No signature/deadline provided, checking existing allowance...`);
      const existingAllowance = await sepoliaVcnToken.allowance(user, relayerAddress);
      if (existingAllowance < totalAmount) {
        return res.status(400).json({ error: "No permit signature provided and insufficient allowance" });
      }
    }

    // === STEP 1: Collect fee (VCN Sepolia) ===
    try {
      const feeTx = await sepoliaVcnToken.transferFrom(user, relayerAddress, BRIDGE_FEE, { gasLimit: 100000 });
      await feeTx.wait();
      console.log(`[ReverseBridge] Fee collected: ${ethers.formatEther(BRIDGE_FEE)} VCN Sepolia`);
    } catch (feeErr) {
      console.error(`[ReverseBridge] Fee collection failed:`, feeErr.message);
      return res.status(400).json({ error: `Fee collection failed: ${feeErr.reason || feeErr.message}` });
    }

    // === STEP 2: Transfer bridge amount to relayer custody (lock on Sepolia) ===
    let sepoliaLockTxHash;
    try {
      const lockTx = await sepoliaVcnToken.transferFrom(user, relayerAddress, amountWei, { gasLimit: 100000 });
      const lockReceipt = await lockTx.wait();
      sepoliaLockTxHash = lockTx.hash;
      console.log(`[ReverseBridge] Locked ${ethers.formatEther(amountWei)} VCN Sepolia (tx: ${sepoliaLockTxHash})`);
    } catch (lockErr) {
      console.error(`[ReverseBridge] Lock failed:`, lockErr.message);
      return res.status(400).json({ error: `Sepolia VCN lock failed: ${lockErr.reason || lockErr.message}` });
    }

    // === STEP 3: Send VCN on Vision Chain to user ===
    let visionTxHash;
    try {
      // Admin wallet is already connected to Vision Chain RPC
      const visionAdminBalance = await adminWallet.provider.getBalance(adminWallet.address);
      console.log(`[ReverseBridge] Vision Chain admin balance: ${ethers.formatEther(visionAdminBalance)}`);

      // Transfer VCN ERC-20 on Vision Chain
      const visionVcnToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);
      const adminVcnBalance = await visionVcnToken.balanceOf(adminWallet.address);
      console.log(`[ReverseBridge] Admin VCN ERC-20 balance: ${ethers.formatEther(adminVcnBalance)}`);

      if (adminVcnBalance >= amountWei) {
        // Transfer ERC-20 VCN
        const transferTx = await visionVcnToken.transfer(visionRecipient, amountWei, { gasLimit: 100000 });
        const transferReceipt = await transferTx.wait();
        visionTxHash = transferTx.hash;
        console.log(`[ReverseBridge] Vision Chain VCN sent: ${visionTxHash}`);
      } else {
        // Fallback: try native VCN transfer
        const nativeBalance = await adminWallet.provider.getBalance(adminWallet.address);
        if (nativeBalance >= amountWei + ethers.parseEther("0.01")) {
          const nativeTx = await adminWallet.sendTransaction({
            to: visionRecipient,
            value: amountWei,
            gasLimit: 21000,
          });
          await nativeTx.wait();
          visionTxHash = nativeTx.hash;
          console.log(`[ReverseBridge] Vision Chain native VCN sent: ${visionTxHash}`);
        } else {
          throw new Error("Admin wallet has insufficient VCN balance on Vision Chain");
        }
      }
    } catch (visionErr) {
      console.error(`[ReverseBridge] Vision Chain transfer failed:`, visionErr.message);
      // Critical: Sepolia VCN already locked. Save record for manual resolution.
      await db.collection("reverseBridgeFailures").add({
        user: user.toLowerCase(),
        recipient: visionRecipient.toLowerCase(),
        amount: ethers.formatEther(amountWei),
        fee: ethers.formatEther(BRIDGE_FEE),
        sepoliaLockTxHash,
        error: visionErr.message,
        status: "PENDING_MANUAL_RESOLUTION",
        createdAt: admin.firestore.Timestamp.now(),
      });
      return res.status(500).json({
        error: `Vision Chain transfer failed after Sepolia lock. TX: ${sepoliaLockTxHash}. Manual resolution needed.`,
        sepoliaLockTxHash,
      });
    }

    // === STEP 4: Record to Firestore ===
    try {
      // Main transaction record
      await db.collection("transactions").doc(visionTxHash).set({
        hash: visionTxHash,
        from_addr: "bridge:sepolia",
        to_addr: visionRecipient.toLowerCase(),
        value: ethers.formatEther(amountWei),
        timestamp: Date.now(),
        type: "Bridge Receive",
        bridgeStatus: "COMPLETED",
        sepoliaLockTxHash,
        metadata: {
          sourceChain: "Ethereum Sepolia",
          destinationChain: "Vision Chain",
          srcChainId: SEPOLIA_CHAIN_ID,
          dstChainId: VISION_CHAIN_ID,
          fee: ethers.formatEther(BRIDGE_FEE),
          direction: "reverse",
        },
      });

      // Reverse bridge ledger record
      await db.collection("reverseBridgeTransactions").add({
        user: user.toLowerCase(),
        recipient: visionRecipient.toLowerCase(),
        amount: ethers.formatEther(amountWei),
        fee: ethers.formatEther(BRIDGE_FEE),
        sepoliaLockTxHash,
        visionTxHash,
        srcChainId: SEPOLIA_CHAIN_ID,
        dstChainId: VISION_CHAIN_ID,
        status: "COMPLETED",
        createdAt: admin.firestore.Timestamp.now(),
      });

      // Notification to user
      const senderEmail = await getBridgeUserEmail(user);
      if (senderEmail) {
        await db.collection("users").doc(senderEmail).collection("notifications").add({
          type: "bridge_completed",
          title: "Reverse Bridge Complete",
          content: `${ethers.formatEther(amountWei)} VCN has been bridged from Sepolia to Vision Chain.`,
          data: {
            amount: ethers.formatEther(amountWei),
            sourceChain: "Ethereum Sepolia",
            destinationChain: "Vision Chain",
            sepoliaLockTxHash,
            visionTxHash,
            direction: "reverse",
            status: "completed",
          },
          email: senderEmail,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      console.log(`[ReverseBridge] Firestore records saved`);
    } catch (firestoreErr) {
      console.warn(`[ReverseBridge] Firestore write failed (non-critical):`, firestoreErr.message);
    }

    return res.status(200).json({
      success: true,
      sepoliaLockTxHash,
      visionTxHash,
      fee: ethers.formatEther(BRIDGE_FEE),
      amount: ethers.formatEther(amountWei),
      direction: "sepolia_to_vision",
    });
  } catch (err) {
    console.error("[ReverseBridge] Error:", err);
    return res.status(500).json({ error: err.message || "Reverse bridge failed" });
  }
}

/**
 * Handle Sepolia VCN transfer (relayer-sponsored, user pays fee in VCN Sepolia)
 * Flow: User signs Permit -> Relayer executes permit -> Relayer collects fee -> Relayer transfers to recipient
 */
async function handleSepoliaTransfer(req, res, { user, recipient, amount, fee, deadline, signature }) {
  try {
    console.log("[SepoliaTransfer] Starting...", { user, recipient, amount: amount?.toString() });

    if (!user || !recipient || !amount || !signature) {
      return res.status(400).json({ error: "Missing required fields: user, recipient, amount, signature" });
    }

    const VCN_SEPOLIA_ADDRESS = (process.env.VCN_SEPOLIA_ADDRESS || "0x07755968236333B5f8803E9D0fC294608B200d1b").trim();
    const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";

    // Setup Sepolia relayer
    const sepoliaRelayerPk = (process.env.SEPOLIA_RELAYER_PK || "").trim();
    if (!sepoliaRelayerPk) {
      return res.status(500).json({ error: "SEPOLIA_RELAYER_PK not configured" });
    }
    const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const sepoliaRelayer = new ethers.Wallet(sepoliaRelayerPk, sepoliaProvider);
    const relayerAddress = sepoliaRelayer.address;

    console.log(`[SepoliaTransfer] Relayer: ${relayerAddress}`);

    // VCN Sepolia contract
    const vcnAbi = [
      "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
      "function transferFrom(address from, address to, uint256 amount) returns (bool)",
      "function balanceOf(address account) view returns (uint256)",
      "function allowance(address owner, address spender) view returns (uint256)",
    ];
    const vcnContract = new ethers.Contract(VCN_SEPOLIA_ADDRESS, vcnAbi, sepoliaRelayer);

    const transferAmount = BigInt(amount);
    const feeAmount = fee ? BigInt(fee) : ethers.parseEther("1");
    const totalAmount = transferAmount + feeAmount;

    // Check user balance
    const userBalance = await vcnContract.balanceOf(user);
    console.log(`[SepoliaTransfer] User balance: ${ethers.formatEther(userBalance)}, needed: ${ethers.formatEther(totalAmount)}`);
    if (userBalance < totalAmount) {
      return res.status(400).json({ error: `Insufficient Sepolia VCN balance. Have: ${ethers.formatEther(userBalance)}, Need: ${ethers.formatEther(totalAmount)}` });
    }

    // Execute Permit
    const { v, r, s } = parseSignature(signature);
    if (v) {
      try {
        console.log(`[SepoliaTransfer] Executing permit for ${ethers.formatEther(totalAmount)} VCN...`);
        const permitTx = await vcnContract.permit(user, relayerAddress, totalAmount, deadline, v, r, s);
        await permitTx.wait();
        console.log("[SepoliaTransfer] Permit executed:", permitTx.hash);
      } catch (permitErr) {
        console.error("[SepoliaTransfer] Permit failed:", permitErr.message);
        // Check if allowance is already sufficient
        const currentAllowance = await vcnContract.allowance(user, relayerAddress);
        if (currentAllowance < totalAmount) {
          return res.status(400).json({ error: `Permit failed: ${permitErr.reason || permitErr.message}` });
        }
        console.log("[SepoliaTransfer] Allowance already sufficient, continuing...");
      }
    }

    // Collect fee
    try {
      const feeTx = await vcnContract.transferFrom(user, relayerAddress, feeAmount);
      await feeTx.wait();
      console.log(`[SepoliaTransfer] Fee collected: ${ethers.formatEther(feeAmount)} VCN`);
    } catch (feeErr) {
      console.error("[SepoliaTransfer] Fee collection failed:", feeErr.message);
      return res.status(400).json({ error: `Fee collection failed: ${feeErr.reason || feeErr.message}` });
    }

    // Transfer to recipient
    let txHash;
    try {
      const transferTx = await vcnContract.transferFrom(user, recipient, transferAmount);
      const receipt = await transferTx.wait();
      txHash = receipt.hash;
      console.log(`[SepoliaTransfer] Transfer successful: ${ethers.formatEther(transferAmount)} VCN -> ${recipient}, tx: ${txHash}`);
    } catch (transferErr) {
      console.error("[SepoliaTransfer] Transfer failed:", transferErr.message);
      return res.status(500).json({ error: `Transfer failed: ${transferErr.reason || transferErr.message}` });
    }

    // Record to Firestore
    try {
      await db.collection("transactions").add({
        type: "sepolia_transfer",
        from: user,
        to: recipient,
        amount: ethers.formatEther(transferAmount),
        fee: ethers.formatEther(feeAmount),
        txHash,
        chain: "sepolia",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        status: "completed",
      });
    } catch (dbErr) {
      console.warn("[SepoliaTransfer] Firestore record failed:", dbErr.message);
    }

    return res.status(200).json({
      success: true,
      txHash,
      amount: ethers.formatEther(transferAmount),
      fee: ethers.formatEther(feeAmount),
      recipient,
    });
  } catch (err) {
    console.error("[SepoliaTransfer] Error:", err);
    return res.status(500).json({ error: err.message || "Sepolia transfer failed" });
  }
}

/**
 * Handle staking operations (stake, unstake, withdraw, claim)
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} params - Staking parameters
 * @return {Promise} - Response promise
 */
async function handleStaking(req, res, { user, amount, stakeAction, fee, deadline, signature, tokenContract, adminWallet }) {
  // Validate required fields
  if (!stakeAction) {
    return res.status(400).json({ error: "Missing required field: stakeAction" });
  }

  const validActions = ["stake", "unstake", "withdraw", "claim"];
  if (!validActions.includes(stakeAction)) {
    return res.status(400).json({ error: `Invalid stakeAction: ${stakeAction}. Valid: ${validActions.join(", ")}` });
  }

  // For stake action, amount is required
  if (stakeAction === "stake" && !amount) {
    return res.status(400).json({ error: "Missing required field: amount (for stake action)" });
  }

  // For unstake action, amount is required
  if (stakeAction === "unstake" && !amount) {
    return res.status(400).json({ error: "Missing required field: amount (for unstake action)" });
  }

  console.log(`[Paymaster:Staking] ${stakeAction} request from ${user}, amount: ${amount || "N/A"}`);

  try {
    // Staking contract address
    const BRIDGE_STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6"; // V3 (with stakeFor)

    // Staking contract ABI (with Paymaster delegation functions)
    const STAKING_ABI = [
      "function stake(uint256 amount) external",
      "function stakeFor(address beneficiary, uint256 amount) external",
      "function requestUnstake(uint256 amount) external",
      "function requestUnstakeFor(address beneficiary, uint256 amount) external",
      "function withdraw() external",
      "function withdrawFor(address beneficiary) external",
      "function claimRewards() external",
      "function claimRewardsFor(address beneficiary) external",
      "function getStake(address account) external view returns (uint256)",
      "function pendingReward(address account) external view returns (uint256)",
    ];

    const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, STAKING_ABI, adminWallet);

    // Fee for Paymaster service (1 VCN)
    const STAKING_FEE = fee ? BigInt(fee) : ethers.parseEther("1");
    const adminAddress = await adminWallet.getAddress();

    let tx;
    let txHash;

    // Gas options to bypass estimateGas issues on Vision Chain
    const gasOpts = { gasLimit: 500000, gasPrice: ethers.parseUnits("1", "gwei") };

    switch (stakeAction) {
      case "stake": {
        const stakeAmount = BigInt(amount);
        const totalAmount = stakeAmount + STAKING_FEE;

        // Single Permit for totalAmount (stakeAmount + fee) - matches frontend signature
        if (signature && deadline) {
          const { v, r, s } = parseSignature(signature);
          if (v) {
            try {
              console.log(`[Paymaster:Staking] Executing permit for totalAmount: ${ethers.formatEther(totalAmount)} VCN`);
              const permitTx = await tokenContract.permit(
                user,
                adminAddress,
                totalAmount,
                deadline,
                v, r, s,
                gasOpts,
              );
              await permitTx.wait();
              console.log(`[Paymaster:Staking] Permit successful`);
            } catch (permitErr) {
              console.error(`[Paymaster:Staking] Permit failed:`, permitErr.message);
              return res.status(400).json({ error: `Permit verification failed: ${permitErr.reason || permitErr.message}` });
            }
          }
        }

        // Transfer fee from user to admin
        try {
          const feeTx = await tokenContract.transferFrom(user, adminAddress, STAKING_FEE, gasOpts);
          await feeTx.wait();
          console.log(`[Paymaster:Staking] Fee collected: ${ethers.formatEther(STAKING_FEE)} VCN`);

          // Forward fee to staking contract for validator rewards
          try {
            const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, adminWallet);
            const approveTx = await tokenContract.approve(BRIDGE_STAKING_ADDRESS, STAKING_FEE, gasOpts);
            await approveTx.wait();
            const depositTx = await stakingContract.depositFees(STAKING_FEE, gasOpts);
            await depositTx.wait();
            console.log(`[Paymaster:Staking] Fee forwarded to staking: ${ethers.formatEther(STAKING_FEE)} VCN`);
          } catch (fwdErr) {
            console.warn(`[Paymaster:Staking] Fee forwarding to staking failed:`, fwdErr.message);
          }
        } catch (feeErr) {
          console.error(`[Paymaster:Staking] Fee collection failed:`, feeErr.message);
          return res.status(400).json({ error: `Fee collection failed. Please ensure VCN allowance is set.` });
        }

        // Transfer stakeAmount from user to the STAKING CONTRACT directly
        try {
          const transferTx = await tokenContract.transferFrom(user, BRIDGE_STAKING_ADDRESS, stakeAmount, gasOpts);
          await transferTx.wait();
          console.log(`[Paymaster:Staking] Transferred ${ethers.formatEther(stakeAmount)} VCN from user to staking contract`);
        } catch (transferErr) {
          console.error(`[Paymaster:Staking] Transfer to staking contract failed:`, transferErr.message);
          return res.status(500).json({ error: `Token transfer to staking contract failed: ${transferErr.reason || transferErr.message}` });
        }

        // Call stakeFor to register the USER (not admin) as the validator
        try {
          tx = await stakingContract.stakeFor(user, stakeAmount, gasOpts);
          txHash = tx.hash;
          await tx.wait();
          console.log(`[Paymaster:Staking] stakeFor(${user}, ${ethers.formatEther(stakeAmount)}) succeeded`);
        } catch (stakeErr) {
          console.error(`[Paymaster:Staking] stakeFor failed:`, stakeErr.message);
          return res.status(500).json({ error: `stakeFor failed: ${stakeErr.reason || stakeErr.message}` });
        }

        break;
      }

      case "unstake": {
        const unstakeAmount = BigInt(amount);
        try {
          tx = await stakingContract.requestUnstakeFor(user, unstakeAmount, gasOpts);
          txHash = tx.hash;
          await tx.wait();
          console.log(`[Paymaster:Staking] requestUnstakeFor(${user}) - ${ethers.formatEther(unstakeAmount)} VCN`);
        } catch (unstakeErr) {
          const reason = unstakeErr.reason || unstakeErr.message || "Unknown error";
          console.error(`[Paymaster:Staking] requestUnstakeFor failed:`, reason);
          return res.status(400).json({ error: `Unstake failed: ${reason}` });
        }
        break;
      }

      case "withdraw": {
        tx = await stakingContract.withdrawFor(user, gasOpts);
        txHash = tx.hash;
        await tx.wait();
        console.log(`[Paymaster:Staking] withdrawFor(${user}) completed`);
        break;
      }

      case "claim": {
        tx = await stakingContract.claimRewardsFor(user, gasOpts);
        txHash = tx.hash;
        await tx.wait();
        console.log(`[Paymaster:Staking] claimRewardsFor(${user}) completed`);
        break;
      }
    }

    // Send email notification (don't block the response)
    try {
      const userEmail = await getUserEmailByWallet(user);
      if (userEmail) {
        switch (stakeAction) {
          case "stake":
            await sendStakingEmail(userEmail, { amount, txHash });
            break;
          case "unstake":
            await sendUnstakeEmail(userEmail, { amount, txHash });
            break;
          case "claim":
            await sendClaimRewardEmail(userEmail, { txHash });
            break;
          case "withdraw":
            // Withdraw uses same template as claim
            await sendClaimRewardEmail(userEmail, { txHash });
            break;
        }
        console.log(`[Paymaster:Staking] Email notification sent to ${userEmail} for ${stakeAction}`);

        // Add in-app notification
        try {
          const formattedAmount = amount ? ethers.formatEther(BigInt(amount)) : "0";
          let notifType;
          let notifTitle;
          let notifContent;

          switch (stakeAction) {
            case "stake":
              notifType = "staking_deposit";
              notifTitle = "Staking Confirmed";
              notifContent = `Successfully staked ${Number(formattedAmount).toLocaleString()} VCN as a bridge validator.`;
              break;
            case "unstake":
              notifType = "staking_withdrawal";
              notifTitle = "Unstake Requested";
              notifContent = `Unstake request for ${Number(formattedAmount).toLocaleString()} VCN submitted. Cooldown period started.`;
              break;
            case "withdraw":
              notifType = "staking_withdrawal";
              notifTitle = "Withdrawal Complete";
              notifContent = `Successfully withdrawn your unstaked VCN tokens.`;
              break;
            case "claim":
              notifType = "staking_reward";
              notifTitle = "Rewards Claimed";
              notifContent = `Successfully claimed your staking rewards.`;
              break;
          }

          await db.collection("users").doc(userEmail).collection("notifications").add({
            type: notifType,
            title: notifTitle,
            content: notifContent,
            data: { amount: formattedAmount, txHash, action: stakeAction },
            email: userEmail,
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[Paymaster:Staking] In-app notification created for ${userEmail}`);
        } catch (notifErr) {
          console.warn(`[Paymaster:Staking] In-app notification failed:`, notifErr.message);
        }
      }
    } catch (emailErr) {
      console.warn(`[Paymaster:Staking] Email notification failed:`, emailErr.message);
    }

    // Record in transactions collection for History page
    try {
      const userEmail = await getUserEmailByWallet(user);
      const formattedAmount = amount ? ethers.formatEther(BigInt(amount)) : "0";
      const actionLabels = {
        stake: "Validator Stake",
        unstake: "Unstake Request",
        withdraw: "Stake Withdrawal",
        claim: "Reward Claim",
      };

      await db.collection("transactions").doc(txHash).set({
        hash: txHash,
        from_addr: user.toLowerCase(),
        to_addr: BRIDGE_STAKING_ADDRESS.toLowerCase(),
        value: formattedAmount,
        timestamp: Date.now(),
        type: actionLabels[stakeAction] || "Staking",
        status: "success",
        block_number: 0,
        source: "PAYMASTER_STAKING",
        userEmail: userEmail || "",
        stakeAction: stakeAction,
      });
      console.log(`[Paymaster:Staking] Transaction history recorded: ${txHash}`);
    } catch (historyErr) {
      console.warn(`[Paymaster:Staking] Transaction history save failed:`, historyErr.message);
    }

    return res.status(200).json({
      success: true,
      txHash: txHash,
      action: stakeAction,
      amount: amount ? ethers.formatEther(BigInt(amount)) : null,
      fee: ethers.formatEther(STAKING_FEE),
    });
  } catch (err) {
    console.error(`[Paymaster:Staking] ${stakeAction} failed:`, err);
    return res.status(500).json({ error: err.message || "Staking transaction failed" });
  }
}

/**
 * Handle agent execution fee - 70% protocol / 30% node pool
 */
async function handleAgentExecution(req, res, { user, amount, fee, deadline, signature, tokenContract, adminWallet }) {
  const { agentId } = req.body;
  if (!agentId) {
    return res.status(400).json({ error: "Missing required field: agentId" });
  }

  console.log(`[Paymaster:AgentExec] Agent ${agentId}, user: ${user}`);

  // Verify agent exists and belongs to user
  const agentDoc = await db.collection("agents").doc(agentId).get();
  if (!agentDoc.exists) {
    return res.status(404).json({ error: "Agent not found" });
  }
  const agentData = agentDoc.data();
  if (agentData.walletAddress.toLowerCase() !== user.toLowerCase()) {
    return res.status(403).json({ error: "Agent wallet mismatch" });
  }

  // Default execution fee: 0.05 VCN (minimum tier)
  const executionFee = fee ? BigInt(fee) : ethers.parseEther("0.05");
  const adminAddress = adminWallet.address;

  try {
    // 1. Permit: agent wallet approves executor to spend
    if (signature) {
      const { v, r, s } = parseSignature(signature);
      if (v) {
        const permitTx = await tokenContract.permit(user, adminAddress, executionFee, deadline, v, r, s);
        await permitTx.wait();
        console.log(`[Paymaster:AgentExec] Permit ok: ${permitTx.hash}`);
      }
    }

    // 2. Collect total fee from agent wallet
    const collectTx = await tokenContract.transferFrom(user, adminAddress, executionFee);
    await collectTx.wait();
    console.log(`[Paymaster:AgentExec] Collected ${ethers.formatEther(executionFee)} VCN from agent`);

    // 3. Split: 70% protocol (stays with admin), 30% node pool (BridgeStaking)
    const nodePoolShare = (executionFee * 30n) / 100n;

    if (nodePoolShare > 0n) {
      try {
        const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, adminWallet);
        const approveTx = await tokenContract.approve(BRIDGE_STAKING_ADDRESS, nodePoolShare);
        await approveTx.wait();
        const depositTx = await stakingContract.depositFees(nodePoolShare);
        await depositTx.wait();
        console.log(`[Paymaster:AgentExec] 30% to node pool: ${ethers.formatEther(nodePoolShare)} VCN`);
      } catch (poolErr) {
        console.warn(`[Paymaster:AgentExec] Node pool deposit failed:`, poolErr.message);
      }
    }

    // 4. Update agent hosting stats
    await db.collection("agents").doc(agentId).update({
      "hosting.total_vcn_spent": admin.firestore.FieldValue.increment(parseFloat(ethers.formatEther(executionFee))),
      "hosting.execution_count": admin.firestore.FieldValue.increment(1),
      "hosting.last_execution": admin.firestore.FieldValue.serverTimestamp(),
    });

    // 5. Record transaction
    await indexTransaction(collectTx.hash, {
      type: "Agent Execution",
      from: user,
      to: adminAddress,
      amount: ethers.formatEther(executionFee),
      fee: ethers.formatEther(executionFee),
      method: "Paymaster Agent Execution (70/30)",
      agentId: agentId,
    });

    return res.status(200).json({
      success: true,
      txHash: collectTx.hash,
      fee_total: ethers.formatEther(executionFee),
      fee_protocol: ethers.formatEther(executionFee - nodePoolShare),
      fee_node_pool: ethers.formatEther(nodePoolShare),
      agent_id: agentId,
    });
  } catch (err) {
    console.error(`[Paymaster:AgentExec] Failed:`, err);
    return res.status(500).json({ error: err.message || "Agent execution fee failed" });
  }
}

// Legacy aliases for backward compatibility (will be removed after migration)
exports.paymasterTransfer = exports.paymaster;
exports.paymasterTimeLock = exports.paymaster;


// Legacy alias for bridgeWithPaymaster (backward compatibility)
exports.bridgeWithPaymaster = exports.paymaster;


// =============================================================================
// REFERRAL SIGNUP NOTIFICATION (HTTPS)
// =============================================================================
exports.notifyReferralSignup = onRequest({ cors: true, invoker: "public", secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { referrerEmail, newUserEmail, referralCode } = req.body;

    if (!referrerEmail || !newUserEmail) {
      return res.status(400).json({ error: "Missing required fields: referrerEmail, newUserEmail" });
    }

    // Get referrer's current referral count
    const referrerDoc = await db.collection("users").doc(referrerEmail.toLowerCase()).get();
    const referrerData = referrerDoc.exists ? referrerDoc.data() : {};
    const totalReferrals = referrerData.referralCount || 1;
    const code = referralCode || referrerData.referralCode || "";

    // Send email
    await sendReferralSignupEmail(referrerEmail.toLowerCase(), {
      newUserEmail,
      totalReferrals,
      referralCode: code,
    });

    console.log(`[Referral] Signup notification sent to ${referrerEmail} for new user ${newUserEmail}`);

    // Add in-app notification to referrer's subcollection
    try {
      await db.collection("users").doc(referrerEmail.toLowerCase()).collection("notifications").add({
        type: "referral_signup",
        title: "New Referral Signup!",
        content: `${newUserEmail} joined Vision Chain using your invite link!`,
        data: { referredUser: newUserEmail, referralCode: code, totalReferrals },
        email: referrerEmail.toLowerCase(),
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[Referral] In-app notification created for ${referrerEmail}`);
    } catch (notifErr) {
      console.warn(`[Referral] In-app notification failed:`, notifErr.message);
    }

    return res.status(200).json({ success: true, message: "Referral notification sent" });
  } catch (err) {
    console.error("[Referral] Notification failed:", err);
    return res.status(500).json({ error: err.message || "Failed to send notification" });
  }
});

// --- Admin: Update VisionBridgeSecure Limits ---
const VISION_BRIDGE_SECURE_ADDRESS = "0xFDA890183E1e18eE7b02A94d9DF195515D914655";
const VISION_BRIDGE_SECURE_ABI = [
  "function setLimits(uint256 _minLock, uint256 _maxLock, uint256 _maxDailyPerUser, uint256 _globalDaily) external",
  "function minLockAmount() view returns (uint256)",
  "function maxLockAmount() view returns (uint256)",
  "function maxDailyLockPerUser() view returns (uint256)",
  "function globalDailyLimit() view returns (uint256)",
];

exports.updateBridgeLimits = onRequest({ cors: true, invoker: "public", secrets: ["VCN_EXECUTOR_PK"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { adminKey, minLock, maxLock, maxDailyPerUser, globalDaily } = req.body;

    // Simple admin key check (should use proper auth in production)
    if (adminKey !== "vcn-admin-2026") {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Default values if not provided
    const newMinLock = minLock || "0.1"; // 0.1 VCN
    const newMaxLock = maxLock || "1000000"; // 1M VCN
    const newMaxDailyPerUser = maxDailyPerUser || "100000"; // 100K VCN
    const newGlobalDaily = globalDaily || "10000000"; // 10M VCN

    console.log("[Bridge Limits] Updating limits...");
    console.log(`  minLock: ${newMinLock} VCN`);
    console.log(`  maxLock: ${newMaxLock} VCN`);
    console.log(`  maxDailyPerUser: ${newMaxDailyPerUser} VCN`);
    console.log(`  globalDaily: ${newGlobalDaily} VCN`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(VISION_BRIDGE_SECURE_ADDRESS, VISION_BRIDGE_SECURE_ABI, adminWallet);

    // Get current limits
    let currentLimits = {};
    try {
      currentLimits = {
        minLock: ethers.formatEther(await contract.minLockAmount()),
        maxLock: ethers.formatEther(await contract.maxLockAmount()),
        maxDailyPerUser: ethers.formatEther(await contract.maxDailyLockPerUser()),
        globalDaily: ethers.formatEther(await contract.globalDailyLimit()),
      };
      console.log("[Bridge Limits] Current limits:", currentLimits);
    } catch (e) {
      console.log("[Bridge Limits] Could not read current limits");
    }

    // Update limits
    const tx = await contract.setLimits(
      ethers.parseEther(newMinLock),
      ethers.parseEther(newMaxLock),
      ethers.parseEther(newMaxDailyPerUser),
      ethers.parseEther(newGlobalDaily),
    );

    console.log("[Bridge Limits] TX sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("[Bridge Limits] Confirmed in block:", receipt.blockNumber);

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      previousLimits: currentLimits,
      newLimits: {
        minLock: newMinLock,
        maxLock: newMaxLock,
        maxDailyPerUser: newMaxDailyPerUser,
        globalDaily: newGlobalDaily,
      },
    });
  } catch (err) {
    console.error("[Bridge Limits] Error:", err);
    return res.status(500).json({ error: err.message || "Failed to update limits" });
  }
});


// --- Admin Set Target APY (Server-Side, Fixed APY) ---
exports.adminSetAPY = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { apyPercent, adminSecret } = req.body;

    if (!apyPercent || apyPercent <= 0 || apyPercent > 50) {
      return res.status(400).json({ error: "APY must be between 1 and 50%" });
    }

    const expectedSecret = process.env.ADMIN_SECRET || "vision-admin-2026";
    if (adminSecret !== expectedSecret) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log(`[Admin] Setting target APY to ${apyPercent}%`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
    const staking = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, adminWallet);

    // Convert percent to basis points (12% = 1200 basis points)
    const apyBasisPoints = BigInt(Math.floor(apyPercent * 100));

    console.log(`[Admin] Calling setTargetAPY(${apyBasisPoints})...`);
    const tx = await staking.setTargetAPY(apyBasisPoints);
    console.log(`[Admin] TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Admin] TX confirmed in block ${receipt.blockNumber}`);

    await db.collection("admin_apy_logs").add({
      apyPercent: apyPercent,
      apyBasisPoints: apyBasisPoints.toString(),
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      createdAt: admin.firestore.Timestamp.now(),
    });

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      apyPercent: apyPercent,
    });
  } catch (err) {
    console.error("[Admin] Set APY Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// --- Admin Fund Reward Pool (Server-Side, Fixed APY) ---
exports.adminFundPool = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { amount, adminSecret } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    const expectedSecret = process.env.ADMIN_SECRET || "vision-admin-2026";
    if (adminSecret !== expectedSecret) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    console.log(`[Admin] Funding reward pool with ${amount} VCN`);

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
    const vcnToken = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, adminWallet);
    const staking = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, adminWallet);

    const amountWei = ethers.parseEther(amount.toString());

    // Check balance
    const balance = await vcnToken.balanceOf(adminWallet.address);
    if (balance < amountWei) {
      return res.status(400).json({
        error: `Insufficient VCN. Have: ${ethers.formatEther(balance)}, Need: ${amount}`,
      });
    }

    // Approve if needed
    const allowance = await vcnToken.allowance(adminWallet.address, BRIDGE_STAKING_ADDRESS);
    if (allowance < amountWei) {
      console.log(`[Admin] Approving ${amount} VCN...`);
      const approveTx = await vcnToken.approve(BRIDGE_STAKING_ADDRESS, amountWei);
      await approveTx.wait();
    }

    // Fund pool
    console.log(`[Admin] Calling fundRewardPool(${amountWei})...`);
    const tx = await staking.fundRewardPool(amountWei);
    console.log(`[Admin] TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Admin] TX confirmed in block ${receipt.blockNumber}`);

    await db.collection("admin_fund_logs").add({
      amount: amount.toString(),
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      createdAt: admin.firestore.Timestamp.now(),
    });

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      amount: amount,
    });
  } catch (err) {
    console.error("[Admin] Fund Pool Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// --- Secure Wallet Update ---
exports.updateWalletAddress = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { walletAddress, isVerified } = request.data;
  const email = request.auth.token.email; // Trust auth token email

  if (!email) {
    throw new HttpsError("failed-precondition",
      "User email missing from auth token.");
  }

  const emailLower = email.toLowerCase();

  try {
    // 1. Update User Profile
    const updateData = {
      walletReady: true,
      walletAddress: walletAddress,
      updatedAt: new Date().toISOString(),
    };
    if (isVerified !== undefined) updateData.isVerified = isVerified;

    await db.collection("users").doc(emailLower).set(updateData, { merge: true });

    // Send wallet created email (fire-and-forget)
    sendWalletCreatedEmail(emailLower, walletAddress)
      .catch((e) => console.warn("[Email] Wallet created email failed:", e.message));

    // 2. Update Token Sales (if exists)
    const tokenSaleRef = db.collection("token_sales").doc(emailLower);
    const tsDoc = await tokenSaleRef.get();
    if (tsDoc.exists) {
      await tokenSaleRef.update({
        walletAddress: walletAddress,
        status: "WalletCreated",
      });
    }

    // 3. Update Referrer's Contact List (Force Sync)
    const userSnap = await db.collection("users").doc(emailLower).get();
    const userData = userSnap.data();

    if (userData && userData.referrerId) {
      const referrerId = userData.referrerId;
      console.log(`[Wallet] Updating referrer ${referrerId} contact list...`);

      // Add/Update contact in referrer's list
      const refContactRef = db.collection("users").doc(referrerId).collection("contacts").doc(emailLower);

      // We use set with merge to ensure it exists or updates
      await refContactRef.set({
        email: emailLower,
        internalName: emailLower.split("@")[0], // Default name if missing
        address: walletAddress,
        vchainUserUid: emailLower,
        syncStatus: "verified",
        phone: userData.phone || "",
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    }

    return { success: true };
  } catch (err) {
    console.error("Update Wallet Failed:", err);
    throw new HttpsError("internal", "Database update failed");
  }
});

// =============================================================================
// CLOUD WALLET SYNC - Secure Save/Load
// =============================================================================

/**
 * Save encrypted wallet to cloud with server-side envelope encryption
 * Client sends: clientEncryptedWallet (already AES-256-GCM encrypted with user password)
 * Server adds: server-side AES-256-GCM encryption layer
 * Stored in Firestore: double-encrypted wallet
 */
exports.saveWalletToCloud = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const { clientEncryptedWallet, walletAddress, passwordStrength } = request.data;
  const email = request.auth.token.email?.toLowerCase();

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  if (!clientEncryptedWallet || !walletAddress) {
    throw new HttpsError("invalid-argument", "Missing wallet data.");
  }

  // Enforce minimum password strength for cloud sync
  // passwordStrength is calculated client-side: { length, hasUpper, hasLower, hasNumber, hasSpecial }
  if (passwordStrength) {
    const { length, hasUpper, hasLower, hasNumber, hasSpecial } = passwordStrength;
    const score = (hasUpper ? 1 : 0) + (hasLower ? 1 : 0) + (hasNumber ? 1 : 0) + (hasSpecial ? 1 : 0);

    if (length < 10 || score < 3) {
      throw new HttpsError(
        "invalid-argument",
        "Password too weak for cloud sync. Minimum: 10 chars + 3 of (uppercase/lowercase/number/special)",
      );
    }
  }

  try {
    console.log(`[CloudSync] Saving wallet for ${email}`);

    // Server-side envelope encryption
    const serverEncryptedWallet = serverEncrypt(clientEncryptedWallet);

    // Store in Firestore
    await db.collection("wallets_encrypted").doc(email).set({
      encryptedWallet: serverEncryptedWallet, // Double encrypted
      walletAddress: walletAddress, // For display only (not sensitive)
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
      version: 2, // Envelope encryption version
    });

    console.log(`[CloudSync] Wallet saved successfully for ${email}`);
    return { success: true };
  } catch (err) {
    console.error("[CloudSync] Save failed:", err);
    throw new HttpsError("internal", "Failed to save wallet to cloud.");
  }
});

/**
 * Load encrypted wallet from cloud
 * Decrypts server-side layer and returns client-encrypted wallet
 * Client must still decrypt with user's password
 *
 * SECURITY FEATURES:
 * - Rate Limiting: 5 attempts per 15 minutes
 * - Device Fingerprint: New devices require email verification
 * - IP Anomaly Detection: Alerts on suspicious access patterns
 */
exports.loadWalletFromCloud = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const email = request.auth.token.email?.toLowerCase();
  const { deviceFingerprint, totpCode, useBackupCode } = request.data || {};

  // Get IP from request context
  const ipAddress = request.rawRequest?.ip ||
    request.rawRequest?.headers?.["x-forwarded-for"]?.split(",")[0] ||
    request.rawRequest?.connection?.remoteAddress ||
    "unknown";

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  try {
    console.log(`[CloudSync] Loading wallet for ${email} from IP ${ipAddress}`);

    // ============== SECURITY CHECK 1: Rate Limiting ==============
    await checkRateLimit(email, db);

    // ============== SECURITY CHECK 1.5: TOTP 2FA ==============
    const totpDoc = await db.collection("security_totp").doc(email).get();
    const has2FA = totpDoc.exists && totpDoc.data().enabled;

    if (has2FA) {
      if (!totpCode) {
        // 2FA is required but no code provided
        return {
          exists: true,
          requires2FA: true,
          message: "Two-factor authentication required. Please enter your authenticator code.",
        };
      }

      // Verify TOTP code
      const totpData = totpDoc.data();

      if (useBackupCode) {
        // Verify backup code
        const backupCodes = totpData.backupCodes || [];
        const matchingCode = backupCodes.find((bc) => {
          if (bc.used) return false;
          const decrypted = serverDecrypt(bc.code);
          return decrypted === totpCode.toUpperCase();
        });

        if (!matchingCode) {
          await logSecurityEvent(email, "CLOUD_RESTORE_BACKUP_FAILED", { code: totpCode }, db);
          throw new HttpsError("permission-denied", "Invalid or already used backup code.");
        }

        // Mark backup code as used
        const updatedCodes = backupCodes.map((bc) => {
          const decrypted = serverDecrypt(bc.code);
          if (decrypted === totpCode.toUpperCase()) {
            return { ...bc, used: true, usedAt: Date.now() };
          }
          return bc;
        });

        await db.collection("security_totp").doc(email).update({
          backupCodes: updatedCodes,
        });

        await logSecurityEvent(email, "CLOUD_RESTORE_BACKUP_USED", {}, db);
        console.log(`[CloudSync] Backup code used for ${email}`);
      } else {
        // Verify TOTP code
        const auth = getAuthenticator();
        const secret = serverDecrypt(totpData.secret);
        const isValid = auth.check(totpCode, secret);

        if (!isValid) {
          await logSecurityEvent(email, "CLOUD_RESTORE_TOTP_FAILED", { code: totpCode }, db);
          throw new HttpsError("permission-denied", "Invalid authenticator code. Please try again.");
        }

        await logSecurityEvent(email, "CLOUD_RESTORE_TOTP_VERIFIED", {}, db);
        console.log(`[CloudSync] TOTP verified for ${email}`);
      }
    }

    // ============== SECURITY CHECK 2: Device Fingerprint ==============
    const deviceCheck = await checkDeviceFingerprint(email, deviceFingerprint, db);

    if (deviceCheck.requiresVerification) {
      // Log security event
      await logSecurityEvent(email, "NEW_DEVICE_DETECTED", {
        fingerprint: deviceFingerprint,
        ipAddress: ipAddress,
        verificationCode: deviceCheck.verificationCode,
      }, db);

      // Send verification email
      const deviceInfo = `IP: ${ipAddress}<br/>Device ID: ${deviceFingerprint || "Unknown"}`;
      const emailHtml = await generateVerificationEmailHtml(deviceCheck.verificationCode, deviceInfo);
      await sendSecurityEmail(
        email,
        "Vision Chain - New Device Verification Required",
        emailHtml,
      );

      console.log(`[Security] New device for ${email}, verification code sent to email`);

      return {
        exists: true,
        requiresDeviceVerification: true,
        message: "New device detected. Please check your email for a verification code.",
      };
    }

    // ============== SECURITY CHECK 3: IP Anomaly Detection ==============
    const ipCheck = await checkIpAnomaly(email, ipAddress, db);

    if (ipCheck.suspicious) {
      // Log suspicious activity
      await logSecurityEvent(email, "SUSPICIOUS_IP_ACCESS", {
        previousIp: ipCheck.previousIp,
        newIp: ipCheck.newIp,
        reason: ipCheck.reason,
      }, db);

      // Send alert email
      const details = `Previous IP: ${ipCheck.previousIp}<br/>New IP: ${ipCheck.newIp}<br/>Time: ${new Date().toISOString()}`;
      const alertHtml = generateSuspiciousActivityEmailHtml(ipCheck.reason, details);
      await sendSecurityEmail(
        email,
        "Vision Chain - Security Alert: Unusual Access Pattern",
        alertHtml,
      );

      console.warn(`[Security] Suspicious access for ${email}: ${ipCheck.reason}`);
      // We still allow access but user is notified
    }

    // ============== WALLET RETRIEVAL ==============
    const walletDoc = await db.collection("wallets_encrypted").doc(email).get();

    if (!walletDoc.exists) {
      return { exists: false };
    }

    const data = walletDoc.data();

    // Check version - only v2 (envelope encrypted) is supported
    if (data.version !== 2) {
      console.warn(`[CloudSync] Old wallet version for ${email}, migration needed`);
      return { exists: false, needsMigration: true };
    }

    // Server-side decryption (removes our layer, keeps client layer)
    const clientEncryptedWallet = serverDecrypt(data.encryptedWallet);

    // Clear rate limit on successful load
    await clearRateLimit(email, db);

    // Log successful access
    await logSecurityEvent(email, "WALLET_LOADED", {
      ipAddress: ipAddress,
      deviceFingerprint: deviceFingerprint || "unknown",
    }, db);

    console.log(`[CloudSync] Wallet loaded successfully for ${email}`);
    return {
      exists: true,
      clientEncryptedWallet: clientEncryptedWallet,
      walletAddress: data.walletAddress,
    };
  } catch (err) {
    // Log failed attempt
    await logSecurityEvent(email, "WALLET_LOAD_FAILED", {
      error: err.message,
      ipAddress: ipAddress,
    }, db);

    console.error("[CloudSync] Load failed:", err);

    // Re-throw rate limit errors with user-friendly message
    if (err.code === "resource-exhausted") {
      throw err;
    }

    throw new HttpsError("internal", "Failed to load wallet from cloud.");
  }
});

/**
 * Verify device with email verification code
 * Call this after receiving the code via email to verify a new device
 */
exports.verifyDeviceCode = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const email = request.auth.token.email?.toLowerCase();
  const { verificationCode, deviceFingerprint } = request.data || {};

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  if (!verificationCode || !deviceFingerprint) {
    throw new HttpsError("invalid-argument", "Missing verification code or device ID.");
  }

  try {
    const deviceDoc = await db.collection("security_devices").doc(email).get();

    if (!deviceDoc.exists) {
      throw new HttpsError("not-found", "No device records found.");
    }

    const data = deviceDoc.data();
    const device = data.devices.find((d) =>
      d.fingerprint === deviceFingerprint &&
      d.verificationCode === verificationCode.toUpperCase() &&
      !d.verified,
    );

    if (!device) {
      await logSecurityEvent(email, "DEVICE_VERIFICATION_FAILED", {
        deviceFingerprint,
        attemptedCode: verificationCode,
      }, db);
      throw new HttpsError("permission-denied", "Invalid or expired verification code.");
    }

    // Check expiry
    if (device.verificationExpiry && Date.now() > device.verificationExpiry) {
      throw new HttpsError("deadline-exceeded", "Verification code has expired. Please try again.");
    }

    // Mark device as verified
    const updatedDevices = data.devices.map((d) =>
      d.fingerprint === deviceFingerprint ?
        { ...d, verified: true, verifiedAt: Date.now() } :
        d,
    );

    await db.collection("security_devices").doc(email).update({
      devices: updatedDevices,
    });

    await logSecurityEvent(email, "DEVICE_VERIFIED", {
      deviceFingerprint,
    }, db);

    console.log(`[Security] Device verified for ${email}`);
    return { success: true, message: "Device verified successfully." };
  } catch (err) {
    if (err.code) throw err; // Re-throw HttpsError
    console.error("[Security] Device verification failed:", err);
    throw new HttpsError("internal", "Verification failed.");
  }
});

/**
 * Check if user has a cloud wallet (without loading it)
 */
exports.checkCloudWallet = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const email = request.auth.token.email?.toLowerCase();

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  try {
    const walletDoc = await db.collection("wallets_encrypted").doc(email).get();

    if (!walletDoc.exists) {
      return { exists: false };
    }

    const data = walletDoc.data();
    return {
      exists: true,
      walletAddress: data.walletAddress,
      createdAt: data.createdAt?.toDate()?.toISOString(),
    };
  } catch (err) {
    console.error("[CloudSync] Check failed:", err);
    throw new HttpsError("internal", "Failed to check cloud wallet.");
  }
});

exports.scheduledTransferTrigger = onSchedule("every 1 minutes",
  async (_event) => {
    console.log("Scheduler triggered:", new Date().toISOString());
    const nowTs = admin.firestore.Timestamp.now();
    const nowMillis = Date.now();

    // 0. Recover Stuck Jobs
    try {
      const stuckSnapshot = await db.collection("scheduledTransfers")
        .where("status", "==", "EXECUTING")
        .where("lockExpiresAt", "<", nowTs)
        .limit(50)
        .get();

      if (!stuckSnapshot.empty) {
        console.log(`Recovering ${stuckSnapshot.size} stuck jobs...`);
        const batch = db.batch();
        stuckSnapshot.docs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "WAITING",
            lockExpiresAt: null,
            lastError: "RECOVERED: Lock expired",
          });
        });
        await batch.commit();
      }
    } catch (e) {
      // Fallback if index missing: Fetch all EXECUTING and filter in memory
      const stuckSnapshot = await db.collection("scheduledTransfers")
        .where("status", "==", "EXECUTING")
        .limit(50)
        .get();

      const stuckDocs = stuckSnapshot.docs.filter((d) => {
        const dData = d.data();
        return dData.lockExpiresAt &&
          dData.lockExpiresAt.toMillis() < nowMillis;
      });

      if (stuckDocs.length > 0) {
        console.log(`Recovering ${stuckDocs.length} stuck jobs (Manual)...`);
        const batch = db.batch();
        stuckDocs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "WAITING",
            lockExpiresAt: null,
            lastError: "RECOVERED: Lock expired",
          });
        });
        await batch.commit();
      }
    }

    // 1. Fetch WAITING jobs
    // Querying without time filter to avoid composite index reqs
    const jobsRef = db.collection("scheduledTransfers");
    const q = jobsRef.where("status", "==", "WAITING").limit(50);

    const snapshot = await q.get();
    if (snapshot.empty) {
      console.log("No WAITING jobs found.");
      return;
    }

    // 2. Filter in-memory for due jobs
    const dueJobs = snapshot.docs.filter((doc) => {
      const data = doc.data();
      // Check Unlock Time
      if (!data.unlockTimeTs ||
        data.unlockTimeTs.toMillis() > nowMillis) return false;
      // Check Retry Time (if exists)
      if (data.nextRetryAt &&
        data.nextRetryAt.toMillis() > nowMillis) return false;
      return true;
    });

    if (dueJobs.length === 0) {
      console.log("Found jobs, but none are due yet.");
      return;
    }

    console.log(`Processing ${dueJobs.length} due jobs...`);

    // 3. Setup Blockchain Connection
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

    // VCN Token for transferFrom
    const VCN_TIMELOCK_ABI = [
      "function transferFrom(address from, address to, uint256 amount) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)",
    ];
    const vcnToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TIMELOCK_ABI, wallet);

    // 4. Execute Jobs
    // Note: We execute sequentially to manage nonce automatically.
    let currentNonce = await wallet.getNonce();

    for (const docSnap of dueJobs) {
      const jobId = docSnap.id;
      const data = docSnap.data();
      let skipped = false;

      try {
        // Optimistic Locking
        await db.runTransaction(async (t) => {
          const freshDoc = await t.get(docSnap.ref);
          const freshData = freshDoc.data();
          if (freshData.status !== "WAITING") {
            throw new Error("Status changed");
          }

          t.update(docSnap.ref, {
            status: "EXECUTING",
            lockAt: nowTs,
          });
        });
      } catch (e) {
        console.log(`Skipping ${jobId}: ${e.message}`);
        skipped = true;
      }

      if (skipped) continue;

      try {
        console.log(`Executing TimeLock: ${jobId}`);
        console.log(`   From: ${data.senderAddress || data.from}, To: ${data.recipient || data.to}, Amount: ${data.amount}`);

        const amountBigInt = BigInt(data.amount || 0);

        // Execute transferFrom - admin wallet transfers from sender to recipient
        const tx = await vcnToken.transferFrom(
          data.senderAddress || data.from,
          data.recipient || data.to,
          amountBigInt,
          { nonce: currentNonce },
        );

        console.log(`   Hash: ${tx.hash}`);

        // Increment Local Nonce
        currentNonce++;

        // Wait for confirmation
        await tx.wait(1);

        await docSnap.ref.update({
          status: "SENT",
          executedAt: admin.firestore.Timestamp.now(),
          txHash: tx.hash,
          error: null,
        });
        console.log(`Success: ${jobId}`);

        // Record in transactions collection for History page
        try {
          await db.collection("transactions").doc(tx.hash).set({
            hash: tx.hash,
            from_addr: (data.from || data.senderAddress || "").toLowerCase(),
            to_addr: (data.to || data.recipient || "").toLowerCase(),
            value: String(data.amount || 0),
            timestamp: Date.now(),
            type: "Time Lock Transfer",
            status: "success",
            block_number: 0,
            source: "TIMELOCK_AGENT",
            scheduleId: data.scheduleId,
          });
          console.log(`Transaction recorded: ${tx.hash}`);
        } catch (txRecordErr) {
          console.warn("Failed to record transaction:", txRecordErr.message);
        }

        // Create Notification for sender
        try {
          const senderEmail = data.userEmail || data.email;
          if (senderEmail) {
            const symbol = data.token || "VCN";
            const recipientShort = (data.to || data.recipient || "").slice(0, 8);

            await db.collection("notifications").add({
              email: senderEmail.toLowerCase(),
              type: "transfer_complete",
              title: "TRANSFER SUCCESSFUL",
              content: `Successfully sent ${data.amount} ${symbol} to ${recipientShort}... via Time Lock Agent.`,
              data: { txHash: tx.hash, jobId, amount: data.amount, recipient: data.to || data.recipient },
              isRead: false,
              createdAt: admin.firestore.Timestamp.now(),
            });
            console.log(`Notification sent to ${senderEmail}`);
          }
        } catch (notifyErr) {
          console.warn("Failed to send notification:", notifyErr.message);
        }
      } catch (err) {
        console.error(`Failed Job ${jobId}:`, err);

        // CRITICAL: If nonce issue, reset nonce from network
        if (err.message && (err.message.includes("nonce") ||
          err.message.includes("replacement"))) {
          console.log("Refetching nonce due to error...");
          currentNonce = await wallet.getNonce();
        } else {
          // For other errors (reverts), we bump nonce to prevent stuck queue?
          // Actually, if it failed locally (pre-mining), nonce isn't used.
          // If it reverted on chain, nonce IS used.
          // It's hard to distinguish without parsing.
          // Safer strategy: Always refetch nonce on error.
          currentNonce = await wallet.getNonce();
        }

        // Retry Logic
        const retryCount = (data.retryCount || 0) + 1;
        let newStatus = "WAITING";
        let nextRetry = null;

        if (retryCount >= 5) { // Increased max retries
          newStatus = "FAILED";
        } else {
          nextRetry = admin.firestore.Timestamp.fromMillis(
            nowMillis + (retryCount * 60000), // 1m, 2m, 3m...
          );
        }

        await docSnap.ref.update({
          status: newStatus,
          lastError: err.message, // Store error for UI
          retryCount: retryCount,
          nextRetryAt: nextRetry,
        });
      }
    }
  });

// =============================================================================
// BRIDGE COMPLETION CHECKER - Monitor pending bridges and notify on completion
// =============================================================================
const SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
const SEPOLIA_EQUALIZER = "0x6e6E465594cED9cA33995939b9579a8A29194983";
// ERC20_ABI already defined above at line 469

/**
 * Check pending bridge transactions and update their status
 * Called every 5 minutes via scheduler
 */
exports.checkBridgeCompletion = onSchedule("every 5 minutes", async () => {
  console.log("[Bridge Checker] Starting bridge completion check...");

  const db = admin.firestore();

  // Get all pending bridge transactions
  const pendingBridges = await db.collection("bridgeTransactions")
    .where("status", "in", ["COMMITTED", "PENDING"])
    .limit(50)
    .get();

  if (pendingBridges.empty) {
    console.log("[Bridge Checker] No pending bridges found");
    return;
  }

  console.log(`[Bridge Checker] Found ${pendingBridges.size} pending bridges`);

  const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
  const equalizerContract = new ethers.Contract(SEPOLIA_EQUALIZER, ERC20_ABI, sepoliaProvider);

  for (const docSnap of pendingBridges.docs) {
    const bridge = docSnap.data();
    const txHash = bridge.txHash;
    const recipient = bridge.recipient || bridge.user;

    try {
      // Check if challenge period is over (10 minutes)
      const createdAt = bridge.createdAt?.toMillis?.() || Date.now();
      const challengePeriodEnd = createdAt + (10 * 60 * 1000); // 10 minutes

      if (Date.now() < challengePeriodEnd) {
        console.log(`[Bridge Checker] ${txHash} still in challenge period`);
        continue;
      }

      // Check Sepolia balance for the recipient
      const currentBalance = await equalizerContract.balanceOf(recipient);
      const balanceNum = parseFloat(ethers.formatEther(currentBalance));

      // If balance > 0, consider bridge completed
      // (In production, you'd check the specific mint event)
      if (balanceNum > 0) {
        console.log(`[Bridge Checker] ${txHash} appears finalized. Balance: ${balanceNum}`);

        // Update Firestore status
        await docSnap.ref.update({
          status: "FINALIZED",
          finalizedAt: admin.firestore.Timestamp.now(),
          sepoliaBalance: balanceNum,
        });

        // Also update the transactions collection for History display
        const txRef = db.collection("transactions").doc(txHash);
        await txRef.update({
          bridgeStatus: "FINALIZED",
          finalizedAt: admin.firestore.Timestamp.now(),
        }).catch(() => {
          // Transaction may not exist in this collection
        });

        // Send completion notification
        const userEmail = await findEmailByAddress(bridge.user);
        if (userEmail) {
          await createBridgeNotification(userEmail, {
            type: "bridge_completed",
            title: "Bridge Completed",
            content: `${ethers.formatEther(bridge.amount)} VCN has been successfully bridged to Sepolia.`,
            data: {
              txHash: txHash,
              amount: bridge.amount,
              destinationChain: "sepolia",
              status: "completed",
            },
          });
          console.log(`[Bridge Checker] Notification sent to ${userEmail}`);
        }
      }
    } catch (err) {
      console.warn(`[Bridge Checker] Error checking ${txHash}:`, err.message);
    }
  }

  console.log("[Bridge Checker] Check completed");
});

/**
 * Helper: Find user email by wallet address
 * @param {string} address - Wallet address to search for
 * @return {Promise<string|null>} User email or null
 */
async function findEmailByAddress(address) {
  if (!address) return null;

  const db = admin.firestore();
  const usersSnapshot = await db.collection("users")
    .where("walletAddress", "==", address.toLowerCase())
    .limit(1)
    .get();

  if (!usersSnapshot.empty) {
    return usersSnapshot.docs[0].id; // email is the doc ID
  }
  return null;
}

/**
 * Helper: Create bridge notification
 * @param {string} email - User email
 * @param {object} notification - Notification data
 * @return {Promise<void>}
 */
async function createBridgeNotification(email, notification) {
  if (!email) return;

  const db = admin.firestore();
  await db.collection("users").doc(email.toLowerCase()).collection("notifications").add({
    ...notification,
    read: false,
    createdAt: admin.firestore.Timestamp.now(),
  });
}

/**
 * Manual endpoint to check bridge status (for testing)
 */
exports.checkBridgeStatus = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");

  const { txHash } = req.query;

  if (!txHash) {
    return res.status(400).json({ error: "txHash required" });
  }

  try {
    const db = admin.firestore();
    const bridgeDoc = await db.collection("bridgeTransactions")
      .where("txHash", "==", txHash)
      .limit(1)
      .get();

    if (bridgeDoc.empty) {
      return res.status(404).json({ error: "Bridge transaction not found" });
    }

    const data = bridgeDoc.docs[0].data();
    return res.status(200).json({
      status: data.status,
      txHash: data.txHash,
      amount: data.amount,
      createdAt: data.createdAt?.toDate?.().toISOString(),
      finalizedAt: data.finalizedAt?.toDate?.().toISOString() || null,
    });
  } catch (err) {
    console.error("[Bridge Status] Error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// TOTP 2FA - Google Authenticator
// =============================================================================

/**
 * Setup TOTP 2FA - Generate secret and QR code
 * User must scan QR and verify before 2FA is enabled
 */
exports.setupTOTP = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const email = request.auth.token.email?.toLowerCase();

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  try {
    const db = admin.firestore();
    const auth = getAuthenticator();
    const QRCode = getQRCode();

    // Check if already has TOTP enabled
    const totpDoc = await db.collection("security_totp").doc(email).get();
    if (totpDoc.exists && totpDoc.data().enabled) {
      throw new HttpsError(
        "already-exists",
        "2FA is already enabled. Disable it first to regenerate.",
      );
    }

    // Generate new secret
    const secret = auth.generateSecret();

    // Generate otpauth URI for Google Authenticator
    const otpauthUrl = auth.keyuri(email, "Vision Chain", secret);

    // Generate QR code as data URL
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
      color: {
        dark: "#22d3ee",
        light: "#00000000",
      },
      width: 256,
      margin: 2,
    });

    // Store pending secret (not enabled yet)
    await db.collection("security_totp").doc(email).set({
      secret: serverEncrypt(secret), // Encrypt the secret
      enabled: false,
      createdAt: admin.firestore.Timestamp.now(),
      setupAttempts: 0,
    });

    console.log(`[TOTP] Setup initiated for ${email}`);

    return {
      success: true,
      secret: secret, // Show to user for manual entry
      qrCode: qrCodeDataUrl,
      message: "Scan QR code with Google Authenticator and enter the code to enable 2FA.",
    };
  } catch (err) {
    if (err.code) throw err;
    console.error("[TOTP] Setup failed:", err);
    throw new HttpsError("internal", "Failed to setup 2FA.");
  }
});

/**
 * Enable TOTP 2FA - Verify first code and activate
 */
exports.enableTOTP = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const email = request.auth.token.email?.toLowerCase();
  const { totpCode } = request.data || {};

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  if (!totpCode || totpCode.length !== 6) {
    throw new HttpsError("invalid-argument", "Please enter a valid 6-digit code.");
  }

  try {
    const db = admin.firestore();
    const auth = getAuthenticator();

    const totpDoc = await db.collection("security_totp").doc(email).get();

    if (!totpDoc.exists) {
      throw new HttpsError("not-found", "Please setup 2FA first.");
    }

    const data = totpDoc.data();

    if (data.enabled) {
      throw new HttpsError("already-exists", "2FA is already enabled.");
    }

    // Rate limit setup attempts
    if (data.setupAttempts >= 10) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many failed attempts. Please setup 2FA again.",
      );
    }

    // Decrypt and verify
    const secret = serverDecrypt(data.secret);
    const isValid = auth.check(totpCode, secret);

    if (!isValid) {
      // Increment failed attempts
      await db.collection("security_totp").doc(email).update({
        setupAttempts: admin.firestore.FieldValue.increment(1),
      });
      throw new HttpsError("permission-denied", "Invalid code. Please try again.");
    }

    // Generate backup codes
    const backupCodes = [];
    for (let i = 0; i < 8; i++) {
      backupCodes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
    }

    // Enable 2FA
    await db.collection("security_totp").doc(email).update({
      enabled: true,
      enabledAt: admin.firestore.Timestamp.now(),
      backupCodes: backupCodes.map((code) => ({
        code: serverEncrypt(code),
        used: false,
      })),
      setupAttempts: 0,
    });

    // Log security event
    await logSecurityEvent(email, "TOTP_ENABLED", {}, db);

    // Send confirmation email
    const emailBody = `
      ${emailComponents.sectionTitle("2FA Enabled Successfully")}
      ${emailComponents.subtitle("Two-factor authentication has been enabled on your Vision Chain account.")}
      ${emailComponents.alertBox("Your account is now protected with an additional layer of security.", "success")}
      <p style="margin:0 0 12px;font-size:13px;color:#ccc;font-weight:600;">Save your backup codes in a secure location:</p>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);padding:16px 20px;border-radius:12px;margin:0 0 20px;">
        ${backupCodes.map((c) => `<div style="padding:5px 0;font-family:'SF Mono',SFMono-Regular,Menlo,monospace;font-size:13px;color:#22d3ee;letter-spacing:1px;">${c}</div>`).join("")}
      </div>
      ${emailComponents.alertBox("Each backup code can only be used <strong>once</strong>. If you did not enable 2FA, contact support immediately.", "warning")}
    `;

    await sendSecurityEmail(email, "Vision Chain - 2FA Enabled", emailBaseLayout(emailBody, "2FA has been enabled on your Vision Chain account"));

    console.log(`[TOTP] Enabled for ${email}`);

    return {
      success: true,
      backupCodes: backupCodes,
      message: "2FA enabled successfully. Please save your backup codes.",
    };
  } catch (err) {
    if (err.code) throw err;
    console.error("[TOTP] Enable failed:", err);
    throw new HttpsError("internal", "Failed to enable 2FA.");
  }
});

/**
 * Verify TOTP code - Used during wallet restore
 */
exports.verifyTOTP = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const email = request.auth.token.email?.toLowerCase();
  const { totpCode, useBackupCode } = request.data || {};

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  if (!totpCode) {
    throw new HttpsError("invalid-argument", "Please enter a code.");
  }

  try {
    const db = admin.firestore();

    const totpDoc = await db.collection("security_totp").doc(email).get();

    if (!totpDoc.exists || !totpDoc.data().enabled) {
      // No 2FA enabled - return success (skip verification)
      return { success: true, skipped: true };
    }

    const data = totpDoc.data();

    // Rate limiting for verification
    await checkRateLimit(email + "_totp", db);

    if (useBackupCode) {
      // Verify backup code
      const backupCodes = data.backupCodes || [];
      const matchingCode = backupCodes.find((bc) => {
        if (bc.used) return false;
        const decrypted = serverDecrypt(bc.code);
        return decrypted === totpCode.toUpperCase();
      });

      if (!matchingCode) {
        await logSecurityEvent(email, "TOTP_BACKUP_FAILED", { code: totpCode }, db);
        throw new HttpsError("permission-denied", "Invalid or already used backup code.");
      }

      // Mark backup code as used
      const updatedCodes = backupCodes.map((bc) => {
        const decrypted = serverDecrypt(bc.code);
        if (decrypted === totpCode.toUpperCase()) {
          return { ...bc, used: true, usedAt: Date.now() };
        }
        return bc;
      });

      await db.collection("security_totp").doc(email).update({
        backupCodes: updatedCodes,
      });

      await logSecurityEvent(email, "TOTP_BACKUP_USED", {}, db);
      await clearRateLimit(email + "_totp", db);

      console.log(`[TOTP] Backup code used for ${email}`);
      return { success: true, usedBackupCode: true };
    }

    // Verify TOTP code
    const auth = getAuthenticator();
    const secret = serverDecrypt(data.secret);
    const isValid = auth.check(totpCode, secret);

    if (!isValid) {
      await logSecurityEvent(email, "TOTP_VERIFY_FAILED", { code: totpCode }, db);
      throw new HttpsError("permission-denied", "Invalid code. Please try again.");
    }

    await clearRateLimit(email + "_totp", db);
    await logSecurityEvent(email, "TOTP_VERIFIED", {}, db);

    console.log(`[TOTP] Verified for ${email}`);
    return { success: true };
  } catch (err) {
    if (err.code) throw err;
    console.error("[TOTP] Verify failed:", err);
    throw new HttpsError("internal", "Failed to verify 2FA code.");
  }
});

/**
 * Check TOTP status - Whether 2FA is enabled
 */
exports.getTOTPStatus = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const email = request.auth.token.email?.toLowerCase();

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  try {
    const db = admin.firestore();

    const totpDoc = await db.collection("security_totp").doc(email).get();

    if (!totpDoc.exists) {
      return { enabled: false, setupPending: false };
    }

    const data = totpDoc.data();
    return {
      enabled: data.enabled || false,
      setupPending: !data.enabled && !!data.secret,
      enabledAt: data.enabledAt?.toDate()?.toISOString() || null,
      backupCodesRemaining: data.backupCodes?.filter((bc) => !bc.used).length || 0,
    };
  } catch (err) {
    console.error("[TOTP] Status check failed:", err);
    throw new HttpsError("internal", "Failed to check 2FA status.");
  }
});

/**
 * Disable TOTP 2FA - Requires current TOTP code or backup code
 */
exports.disableTOTP = onCall({ cors: true, invoker: "public" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "User must be logged in.");
  }

  const email = request.auth.token.email?.toLowerCase();
  const { totpCode, useBackupCode } = request.data || {};

  if (!email) {
    throw new HttpsError("failed-precondition", "User email missing.");
  }

  if (!totpCode) {
    throw new HttpsError("invalid-argument", "Please enter a code to disable 2FA.");
  }

  try {
    const db = admin.firestore();

    const totpDoc = await db.collection("security_totp").doc(email).get();

    if (!totpDoc.exists || !totpDoc.data().enabled) {
      throw new HttpsError("not-found", "2FA is not enabled.");
    }

    const data = totpDoc.data();

    // Verify code first
    if (useBackupCode) {
      const backupCodes = data.backupCodes || [];
      const matchingCode = backupCodes.find((bc) => {
        if (bc.used) return false;
        const decrypted = serverDecrypt(bc.code);
        return decrypted === totpCode.toUpperCase();
      });

      if (!matchingCode) {
        throw new HttpsError("permission-denied", "Invalid backup code.");
      }
    } else {
      const auth = getAuthenticator();
      const secret = serverDecrypt(data.secret);
      const isValid = auth.check(totpCode, secret);

      if (!isValid) {
        throw new HttpsError("permission-denied", "Invalid code.");
      }
    }

    // Disable 2FA
    await db.collection("security_totp").doc(email).delete();

    await logSecurityEvent(email, "TOTP_DISABLED", {}, db);

    // Send notification email
    const emailBody = `
      ${emailComponents.sectionTitle("2FA Disabled")}
      ${emailComponents.subtitle("Two-factor authentication has been disabled on your Vision Chain account.")}
      ${emailComponents.alertBox("Your account no longer has two-factor authentication protection. We strongly recommend re-enabling 2FA.", "warning")}
      ${emailComponents.infoCard([
      ["Event", "2FA Disabled", false],
      ["Time", new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC", false],
    ], "#ef4444")}
      ${emailComponents.alertBox("If you did not make this change, please contact support immediately and change your password.", "warning")}
    `;

    await sendSecurityEmail(email, "Vision Chain - 2FA Disabled", emailBaseLayout(emailBody, "2FA has been disabled on your Vision Chain account"));

    console.log(`[TOTP] Disabled for ${email}`);

    return { success: true, message: "2FA has been disabled." };
  } catch (err) {
    if (err.code) throw err;
    console.error("[TOTP] Disable failed:", err);
    throw new HttpsError("internal", "Failed to disable 2FA.");
  }
});

// =============================================================================
// BRIDGE RELAYER - Automated Cross-Chain Bridge Completion
// =============================================================================
// This scheduler runs every 5 minutes to:
// 1. Find COMMITTED bridge transactions
// 2. Check if Challenge Period (15 min) has passed
// 3. Execute token transfer on destination chain (Sepolia)
// 4. Update status to COMPLETED
// =============================================================================

// Sepolia Configuration
const SEPOLIA_RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";
const SEPOLIA_CHAIN_ID = 11155111;
const CHALLENGE_PERIOD_MINUTES = 2; // 테스트용 (프로덕션: 15분)

// Sepolia Bridge Relayer - MUST be set via Firebase Secrets
// firebase functions:secrets:set SEPOLIA_RELAYER_PK
const SEPOLIA_RELAYER_PK = (process.env.SEPOLIA_RELAYER_PK || "").trim();

/**
 * Bridge Relayer - Scheduled Function
 * Runs every 5 minutes to process completed bridge intents
 */
exports.bridgeRelayer = onSchedule({
  schedule: "every 2 minutes",
  timeZone: "Asia/Seoul",
  memory: "256MiB",
  secrets: ["SEPOLIA_RELAYER_PK", "VCN_EXECUTOR_PK", "VCN_SEPOLIA_ADDRESS", "EMAIL_USER", "EMAIL_APP_PASSWORD"],
}, async (_event) => {
  console.log("[Bridge Relayer] Starting scheduled execution...");

  try {
    // 1. Query COMMITTED bridge transactions older than challenge period
    const cutoffTime = new Date(Date.now() - (CHALLENGE_PERIOD_MINUTES * 60 * 1000));
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffTime);
    console.log(`[Bridge Relayer] Cutoff time: ${cutoffTime.toISOString()}, Challenge period: ${CHALLENGE_PERIOD_MINUTES} min`);

    // Check bridgeTransactions collection (backend-created)
    const allCommittedBridges = await db.collection("bridgeTransactions")
      .where("status", "==", "COMMITTED")
      .limit(20)
      .get();
    console.log(`[Bridge Relayer] bridgeTransactions COMMITTED: ${allCommittedBridges.size}`);

    // ALSO check transactions collection for Bridge type with PENDING status (frontend-created)
    const allPendingBridges = await db.collection("transactions")
      .where("type", "==", "Bridge")
      .where("bridgeStatus", "==", "PENDING")
      .limit(20)
      .get();
    console.log(`[Bridge Relayer] transactions PENDING Bridges: ${allPendingBridges.size}`);

    // DEBUG: Check ALL Bridge type transactions (regardless of status)
    const allBridgeTypeTxs = await db.collection("transactions")
      .where("type", "==", "Bridge")
      .limit(50)
      .get();
    console.log(`[Bridge Relayer] ALL Bridge type transactions: ${allBridgeTypeTxs.size}`);

    // Group by bridgeStatus for summary
    const statusCounts = {};
    allBridgeTypeTxs.docs.forEach((doc) => {
      const data = doc.data();
      const st = data.bridgeStatus || "UNKNOWN";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });
    console.log(`[Bridge Relayer] Status breakdown: ${JSON.stringify(statusCounts)}`);

    // Show ALL LOCKED transactions (the ones we're supposed to process)
    const lockedDocs = allBridgeTypeTxs.docs.filter((d) => d.data().bridgeStatus === "LOCKED");
    if (lockedDocs.length > 0) {
      console.log(`[Bridge Relayer] FOUND ${lockedDocs.length} LOCKED docs in full scan:`);
      lockedDocs.forEach((doc) => {
        const data = doc.data();
        console.log(`[Bridge Relayer] LOCKED tx/${doc.id}: challengeEndTime=${data.challengeEndTime}, now=${Date.now()}, pastChallenge=${data.challengeEndTime <= Date.now()}, recipient=${data.recipient}`);
      });
    } else {
      console.log(`[Bridge Relayer] No LOCKED docs found in full scan`);
    }


    if (allCommittedBridges.size > 0) {
      allCommittedBridges.docs.forEach((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate?.() || "unknown";
        console.log(`[Bridge Relayer] bridgeTransactions/${doc.id}: status=${data.status}, createdAt=${createdAt}, amount=${data.amount}`);
      });
    }

    if (allPendingBridges.size > 0) {
      allPendingBridges.docs.forEach((doc) => {
        const data = doc.data();
        const ts = data.timestamp ? new Date(data.timestamp).toISOString() : "unknown";
        console.log(`[Bridge Relayer] transactions/${doc.id}: bridgeStatus=${data.bridgeStatus}, timestamp=${ts}, value=${data.value}`);
      });
    }

    // Process bridges from bridgeTransactions collection (past cutoff)
    const pendingBridges = await db.collection("bridgeTransactions")
      .where("status", "==", "COMMITTED")
      .where("createdAt", "<=", cutoffTimestamp)
      .limit(10)
      .get();


    // Process bridges from transactions collection (past challenge period)
    // Check PENDING status
    const pendingTxBridges = await db.collection("transactions")
      .where("type", "==", "Bridge")
      .where("bridgeStatus", "==", "PENDING")
      .where("challengeEndTime", "<=", Date.now())
      .limit(10)
      .get();

    // Also check LOCKED status (from client-side bridge submissions)
    const lockedTxBridges = await db.collection("transactions")
      .where("type", "==", "Bridge")
      .where("bridgeStatus", "==", "LOCKED")
      .where("challengeEndTime", "<=", Date.now())
      .limit(10)
      .get();

    // Retry recently FAILED bridges (failed due to config issues, retry within 1 hour)
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const failedTxBridges = await db.collection("transactions")
      .where("type", "==", "Bridge")
      .where("bridgeStatus", "==", "FAILED")
      .where("challengeEndTime", ">=", oneHourAgo)
      .limit(5)
      .get();

    if (failedTxBridges.size > 0) {
      console.log(`[Bridge Relayer] Retrying ${failedTxBridges.size} recently FAILED bridges`);
      // Reset them to LOCKED for reprocessing
      for (const doc of failedTxBridges.docs) {
        await doc.ref.update({ bridgeStatus: "LOCKED" });
      }
    }

    console.log(`[Bridge Relayer] PENDING: ${pendingTxBridges.size}, LOCKED: ${lockedTxBridges.size}, FAILED(retry): ${failedTxBridges.size}`);

    // Combine PENDING, LOCKED, and retried FAILED into one list for processing
    const allTxBridges = [...pendingTxBridges.docs, ...lockedTxBridges.docs, ...failedTxBridges.docs];
    const totalPending = pendingBridges.size + allTxBridges.length;
    console.log(`[Bridge Relayer] Ready to process: ${pendingBridges.size} from bridgeTransactions, ${allTxBridges.length} from transactions`);

    if (totalPending === 0) {
      console.log("[Bridge Relayer] No pending bridges to process (past cutoff time)");
      return;
    }

    console.log(`[Bridge Relayer] Found ${pendingBridges.size} + ${allTxBridges.length} bridges to process`);

    // 2. Process bridges from bridgeTransactions collection
    for (const docSnap of pendingBridges.docs) {
      const bridge = docSnap.data();
      const bridgeId = docSnap.id;

      try {
        console.log(`[Bridge Relayer] Processing bridgeTransactions/${bridgeId}`);
        console.log(`[Bridge Relayer] Amount: ${bridge.amount}, Recipient: ${bridge.recipient}`);

        // Update status to PROCESSING
        await docSnap.ref.update({
          status: "PROCESSING",
          processingStartedAt: admin.firestore.Timestamp.now(),
        });

        // 3. Execute on destination chain
        const destChainId = bridge.dstChainId;
        let destTxHash = null;

        if (destChainId === SEPOLIA_CHAIN_ID) {
          destTxHash = await executeSepoliaBridgeTransfer(bridge);
        } else {
          destTxHash = await executeVisionChainBridgeTransfer(bridge);
        }

        // 4. Update status to COMPLETED
        await docSnap.ref.update({
          status: "COMPLETED",
          completedAt: admin.firestore.Timestamp.now(),
          destinationTxHash: destTxHash,
        });

        console.log(`[Bridge Relayer] Bridge ${bridgeId} completed. Dest TX: ${destTxHash}`);

        // 5. Send completion notification (email + in-app) to sender and recipient
        try {
          const vcnAmount = ethers.formatEther(BigInt(bridge.amount));
          const destChain = bridge.dstChainId === SEPOLIA_CHAIN_ID ? "Ethereum Sepolia" : "Vision Chain";

          // Save Sepolia receive record to History
          await db.collection("transactions").doc(`sepolia_${destTxHash}`).set({
            hash: destTxHash,
            from_addr: `bridge:${destChain === "Ethereum Sepolia" ? "vision-chain" : "sepolia"}`,
            to_addr: bridge.recipient.toLowerCase(),
            value: vcnAmount,
            timestamp: Date.now(),
            type: "Bridge Receive",
            bridgeStatus: "COMPLETED",
            sourceTxHash: bridgeId,
            recipient: bridge.recipient.toLowerCase(),
            metadata: {
              sourceChain: destChain === "Ethereum Sepolia" ? "Vision Chain" : "Sepolia",
              destinationChain: destChain,
              srcChainId: bridge.srcChainId,
              dstChainId: bridge.dstChainId,
              sender: (bridge.sender || bridge.from || bridge.user || "").toLowerCase(),
            },
          });
          console.log(`[Bridge Relayer] History record saved for bridge ${bridgeId}`);

          // Notify sender
          const senderAddr = bridge.sender || bridge.from;
          if (senderAddr) {
            const senderEmail = await getBridgeUserEmail(senderAddr);
            if (senderEmail) {
              await sendBridgeCompleteEmail(senderEmail, bridge, destTxHash);
              await db.collection("users").doc(senderEmail).collection("notifications").add({
                type: "bridge_complete",
                title: "Bridge Transfer Complete",
                content: `${vcnAmount} VCN has been successfully bridged to ${destChain}.`,
                data: {
                  amount: vcnAmount, destinationChain: destChain,
                  sourceTxHash: bridgeId, destinationTxHash: destTxHash, status: "completed",
                },
                email: senderEmail, read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`[Bridge Relayer] Sender notification sent to ${senderEmail}`);
            }
          }

          // Notify recipient (if different from sender)
          if (!senderAddr || bridge.recipient.toLowerCase() !== senderAddr.toLowerCase()) {
            const recipientEmail = await getBridgeUserEmail(bridge.recipient);
            if (recipientEmail) {
              await sendBridgeCompleteEmail(recipientEmail, bridge, destTxHash);
              await db.collection("users").doc(recipientEmail).collection("notifications").add({
                type: "bridge_receive",
                title: "Bridge Transfer Received",
                content: `You received ${vcnAmount} VCN via cross-chain bridge.`,
                data: {
                  amount: vcnAmount, destinationChain: destChain,
                  sourceTxHash: bridgeId, destinationTxHash: destTxHash, status: "completed",
                },
                email: recipientEmail, read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`[Bridge Relayer] Recipient notification sent to ${recipientEmail}`);
            }
          }
        } catch (notifyErr) {
          console.warn("[Bridge Relayer] Notification failed:", notifyErr.message);
        }
      } catch (bridgeErr) {
        console.error(`[Bridge Relayer] Failed to process bridge ${bridgeId}:`, bridgeErr);

        await docSnap.ref.update({
          status: "FAILED",
          failedAt: admin.firestore.Timestamp.now(),
          errorMessage: bridgeErr.message || "Unknown error",
        });
      }
    }

    // 3. Process bridges from transactions collection (frontend-created, PENDING or LOCKED)
    for (const docSnap of allTxBridges) {
      const txData = docSnap.data();
      const txId = docSnap.id;

      try {
        console.log(`[Bridge Relayer] Processing transactions/${txId}`);
        const dstChainId = txData.metadata?.dstChainId || 11155111; // Default to Sepolia
        const amount = txData.value || "0";
        const recipient = txData.recipient || txData.from_addr; // Use stored recipient, fallback to sender

        console.log(`[Bridge Relayer] Amount: ${amount} VCN, Recipient: ${recipient}, DstChain: ${dstChainId}`);

        // Update status to PROCESSING
        await docSnap.ref.update({
          bridgeStatus: "PROCESSING",
          processingStartedAt: Date.now(),
        });

        // Construct bridge object for existing functions
        const bridge = {
          amount: String(parseFloat(amount) * 1e18), // Convert to wei
          recipient: recipient,
          dstChainId: dstChainId,
          srcChainId: txData.metadata?.srcChainId || 1337,
          intentHash: txId, // Use txId as intentHash for tracking
        };

        // Execute on destination chain
        let destTxHash = null;
        if (dstChainId === SEPOLIA_CHAIN_ID) {
          destTxHash = await executeSepoliaBridgeTransfer(bridge);
        } else {
          destTxHash = await executeVisionChainBridgeTransfer(bridge);
        }

        // Update status to COMPLETED
        await docSnap.ref.update({
          bridgeStatus: "COMPLETED",
          completedAt: Date.now(),
          destinationTxHash: destTxHash,
        });

        console.log(`[Bridge Relayer] transactions/${txId} completed. Dest TX: ${destTxHash}`);

        // Send completion notification (email + in-app) to BOTH sender and recipient
        try {
          const vcnAmount = ethers.formatEther(BigInt(bridge.amount));
          const destChain = dstChainId === SEPOLIA_CHAIN_ID ? "Ethereum Sepolia" : "Vision Chain";

          // Always save Sepolia receive record to History (regardless of email lookup)
          await db.collection("transactions").doc(`sepolia_${destTxHash}`).set({
            hash: destTxHash,
            from_addr: "bridge:vision-chain",
            to_addr: recipient.toLowerCase(),
            value: vcnAmount,
            timestamp: Date.now(),
            type: "Bridge Receive",
            bridgeStatus: "COMPLETED",
            sourceTxHash: txId,
            recipient: recipient.toLowerCase(),
            metadata: {
              sourceChain: "Vision Chain",
              destinationChain: destChain,
              srcChainId: 1337,
              dstChainId: dstChainId,
              sender: (txData.from_addr || "").toLowerCase(),
            },
          });
          console.log(`[Bridge Relayer] Sepolia receive record saved for ${recipient}`);

          // Notify sender (the person who initiated the bridge)
          const senderAddr = txData.from_addr;
          const senderEmail = await getBridgeUserEmail(senderAddr);
          if (senderEmail) {
            await sendBridgeCompleteEmail(senderEmail, bridge, destTxHash);
            await db.collection("users").doc(senderEmail).collection("notifications").add({
              type: "bridge_complete",
              title: "Bridge Transfer Complete",
              content: `${vcnAmount} VCN has been successfully bridged to ${destChain}.`,
              data: {
                amount: vcnAmount,
                destinationChain: destChain,
                sourceTxHash: txId,
                destinationTxHash: destTxHash,
                status: "completed",
              },
              email: senderEmail,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[Bridge Relayer] Sender notification sent to ${senderEmail}`);
          }

          // Notify recipient (if different from sender)
          if (recipient.toLowerCase() !== senderAddr.toLowerCase()) {
            const recipientEmail = await getBridgeUserEmail(recipient);
            if (recipientEmail) {
              await sendBridgeCompleteEmail(recipientEmail, bridge, destTxHash);
              await db.collection("users").doc(recipientEmail).collection("notifications").add({
                type: "bridge_receive",
                title: "Bridge Transfer Received",
                content: `You received ${vcnAmount} VCN via cross-chain bridge from ${destChain === "Ethereum Sepolia" ? "Vision Chain" : "Sepolia"}.`,
                data: {
                  amount: vcnAmount,
                  destinationChain: destChain,
                  sourceTxHash: txId,
                  destinationTxHash: destTxHash,
                  status: "completed",
                },
                email: recipientEmail,
                read: false,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
              console.log(`[Bridge Relayer] Recipient notification sent to ${recipientEmail}`);
            }
          }
        } catch (notifyErr) {
          console.warn("[Bridge Relayer] Notification failed:", notifyErr.message);
        }
      } catch (bridgeErr) {
        console.error(`[Bridge Relayer] Failed to process transactions/${txId}:`, bridgeErr);

        await docSnap.ref.update({
          bridgeStatus: "FAILED",
          failedAt: Date.now(),
          errorMessage: bridgeErr.message || "Unknown error",
        });
      }
    }

    console.log("[Bridge Relayer] Execution completed");
  } catch (err) {
    console.error("[Bridge Relayer] Critical error:", err);
  }
});

/**
 * Execute bridge transfer on Sepolia - Mint VCN tokens
 * When user locks VCN on Vision Chain, we mint VCN on Sepolia
 * @param {object} bridge - Bridge transaction data
 * @return {Promise<string>} Destination transaction hash
 */
async function executeSepoliaBridgeTransfer(bridge) {
  if (!SEPOLIA_RELAYER_PK) {
    throw new Error("SEPOLIA_RELAYER_PK secret not configured. Run: firebase functions:secrets:set SEPOLIA_RELAYER_PK");
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const relayerWallet = new ethers.Wallet(SEPOLIA_RELAYER_PK, provider);

  const vcnAmountWei = BigInt(bridge.amount);
  const vcnAmount = ethers.formatEther(vcnAmountWei);

  console.log(`[Sepolia Bridge] Relayer address: ${relayerWallet.address}`);
  console.log(`[Sepolia Bridge] VCN amount to mint: ${vcnAmount} VCN`);
  console.log(`[Sepolia Bridge] Recipient: ${bridge.recipient}`);

  // VCN Token contract on Sepolia (to be deployed)
  // TODO: Update this address after deploying VCNToken on Sepolia
  const VCN_SEPOLIA_ADDRESS = (process.env.VCN_SEPOLIA_ADDRESS || "0x0000000000000000000000000000000000000000").trim();

  // VCN Token ABI for minting
  const VCN_TOKEN_ABI = [
    "function bridgeMint(address to, uint256 amount, bytes32 bridgeId) external",
    "function balanceOf(address account) view returns (uint256)",
  ];

  // Check ETH balance for gas
  const ethBalance = await provider.getBalance(relayerWallet.address);
  const estimatedGas = ethers.parseEther("0.001"); // ~0.001 ETH for gas

  console.log(`[Sepolia Bridge] Relayer ETH balance: ${ethers.formatEther(ethBalance)} ETH`);

  if (VCN_SEPOLIA_ADDRESS === "0x0000000000000000000000000000000000000000") {
    // VCN contract not deployed yet - simulate
    console.warn("[Sepolia Bridge] VCN_SEPOLIA_ADDRESS not configured - simulating mint");

    await db.collection("bridgeExecutions").add({
      bridgeId: bridge.intentHash,
      type: "SIMULATED",
      srcChainId: bridge.srcChainId,
      dstChainId: bridge.dstChainId,
      vcnAmount: bridge.amount,
      recipient: bridge.recipient,
      executedAt: admin.firestore.Timestamp.now(),
      note: "Simulated - VCN contract not deployed on Sepolia yet",
    });

    return `SIMULATED_${Date.now()}`;
  }

  if (ethBalance < estimatedGas) {
    console.warn("[Sepolia Bridge] Insufficient ETH for gas - simulating mint");

    await db.collection("bridgeExecutions").add({
      bridgeId: bridge.intentHash,
      type: "SIMULATED",
      srcChainId: bridge.srcChainId,
      dstChainId: bridge.dstChainId,
      vcnAmount: bridge.amount,
      recipient: bridge.recipient,
      executedAt: admin.firestore.Timestamp.now(),
      note: `Simulated - need ETH for gas, have ${ethers.formatEther(ethBalance)} ETH`,
    });

    return `SIMULATED_${Date.now()}`;
  }

  // Execute VCN mint on Sepolia
  const vcnContract = new ethers.Contract(VCN_SEPOLIA_ADDRESS, VCN_TOKEN_ABI, relayerWallet);
  const bridgeId = ethers.keccak256(ethers.toUtf8Bytes(bridge.intentHash || `bridge_${Date.now()}`));

  const tx = await vcnContract.bridgeMint(bridge.recipient, vcnAmountWei, bridgeId, {
    gasLimit: 100000,
  });

  console.log(`[Sepolia Bridge] VCN mint TX sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[Sepolia Bridge] VCN mint confirmed in block ${receipt.blockNumber}`);

  await db.collection("bridgeExecutions").add({
    bridgeId: bridge.intentHash,
    type: "VCN_MINT",
    srcChainId: bridge.srcChainId,
    dstChainId: bridge.dstChainId,
    vcnAmount: bridge.amount,
    recipient: bridge.recipient,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    executedAt: admin.firestore.Timestamp.now(),
  });

  return tx.hash;
}


/**
 * Execute bridge transfer on Vision Chain (reverse bridge) - Native VCN Edition
 * Since VCN is now native, we unlock VCN by calling the bridge contract
 * @param {object} bridge - Bridge transaction data
 * @return {Promise<string>} Destination transaction hash
 */
async function executeVisionChainBridgeTransfer(bridge) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

  const amountWei = BigInt(bridge.amount);

  console.log(`[Vision Bridge] Unlocking ${ethers.formatEther(amountWei)} native VCN to ${bridge.recipient}`);

  // For Native VCN, we simply send VCN directly (no ERC-20 contract needed)
  // The Bridge contract holds locked VCN and releases it
  // eslint-disable-next-line no-unused-vars
  const VISION_BRIDGE_ADDRESS = "0x0165878A594ca255338adfa4d48449f69242Eb8F";

  // Check if we should use bridge contract or direct transfer (for small amounts/testing)
  const adminBalance = await provider.getBalance(adminWallet.address);

  if (adminBalance >= amountWei + ethers.parseEther("0.01")) {
    // Direct transfer from admin wallet (simpler for now)
    const tx = await adminWallet.sendTransaction({
      to: bridge.recipient,
      value: amountWei,
      gasLimit: 21000,
    });

    console.log(`[Vision Bridge] TX sent: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[Vision Bridge] TX confirmed in block ${receipt.blockNumber}`);

    await db.collection("bridgeExecutions").add({
      bridgeId: bridge.intentHash,
      type: "NATIVE_VCN",
      srcChainId: bridge.srcChainId,
      dstChainId: bridge.dstChainId,
      amount: bridge.amount,
      recipient: bridge.recipient,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
      executedAt: admin.firestore.Timestamp.now(),
    });

    return tx.hash;
  } else {
    console.warn("[Vision Bridge] Insufficient admin balance - simulating transfer");

    await db.collection("bridgeExecutions").add({
      bridgeId: bridge.intentHash,
      type: "SIMULATED",
      srcChainId: bridge.srcChainId,
      dstChainId: bridge.dstChainId,
      amount: bridge.amount,
      recipient: bridge.recipient,
      executedAt: admin.firestore.Timestamp.now(),
      note: "Simulated - admin wallet needs funding",
    });

    return `SIMULATED_${Date.now()}`;
  }
}


/**
 * Get user email from wallet address
 * @param {string} address - Wallet address
 * @return {Promise<string|null>} User email or null
 */
async function getBridgeUserEmail(address) {
  try {
    const usersSnap = await db.collection("users")
      .where("walletAddress", "==", address.toLowerCase())
      .limit(1)
      .get();

    if (!usersSnap.empty) {
      return usersSnap.docs[0].id;
    }
  } catch (e) {
    console.warn("[Bridge Relayer] Failed to get user email:", e.message);
  }
  return null;
}

/**
 * Get user email by wallet address (reusable across all notification types)
 * @param {string} walletAddress - The wallet address
 * @return {Promise<string|null>} User email or null
 */
async function getUserEmailByWallet(walletAddress) {
  if (!walletAddress) return null;
  try {
    const snap = await db.collection("users")
      .where("walletAddress", "==", walletAddress.toLowerCase())
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;

    // Try checksum format
    const snapCS = await db.collection("users")
      .where("walletAddress", "==", walletAddress)
      .limit(1)
      .get();
    if (!snapCS.empty) return snapCS.docs[0].id;
  } catch (e) {
    console.warn("[Email] getUserEmailByWallet failed:", e.message);
  }
  return null;
}

// =============================================================================
// EMAIL TEMPLATES - Staking Notifications
// =============================================================================

/**
 * Send staking confirmation email
 */
async function sendStakingEmail(email, { amount, txHash }) {
  // Check email opt-in
  if (!(await checkEmailOptIn(email, "staking"))) {
    console.log(`[Email] Staking email skipped for ${email} (opted out)`);
    return;
  }

  const formattedAmount = ethers.formatEther(BigInt(amount));
  const explorerUrl = `https://www.visionchain.co/visionscan/tx/${txHash}`;

  const body = `
    ${emailComponents.sectionTitle("Staking Confirmed")}
    ${emailComponents.subtitle("Your VCN tokens have been successfully staked on Vision Chain.")}
    ${emailComponents.alertBox("Your tokens are now earning rewards. You can view your staking status in the wallet dashboard.", "success")}
    ${emailComponents.infoCard([
    ["Staked Amount", `${formattedAmount} VCN`, true],
    ["Status", emailComponents.statusBadge("Active", "success"), false],
  ])}
    ${emailComponents.button("View Transaction", explorerUrl)}
    ${emailComponents.divider()}
    <p style="margin:0;font-size:11px;color:#555;">
      TX: ${emailComponents.monoText(`${txHash.slice(0, 14)}...${txHash.slice(-8)}`)}
    </p>
  `;

  await sendSecurityEmail(email, "Vision Chain - Staking Confirmed", emailBaseLayout(body, `${formattedAmount} VCN staked successfully`));
}

/**
 * Send unstaking + cooldown notice email
 */
async function sendUnstakeEmail(email, { amount, txHash, cooldownDays = 7 }) {
  // Check email opt-in
  if (!(await checkEmailOptIn(email, "staking"))) {
    console.log(`[Email] Unstake email skipped for ${email} (opted out)`);
    return;
  }

  const formattedAmount = ethers.formatEther(BigInt(amount));
  const explorerUrl = `https://www.visionchain.co/visionscan/tx/${txHash}`;
  const cooldownEnd = new Date(Date.now() + cooldownDays * 24 * 60 * 60 * 1000);
  const endDateStr = `${cooldownEnd.getFullYear()}-${String(cooldownEnd.getMonth() + 1).padStart(2, "0")}-${String(cooldownEnd.getDate()).padStart(2, "0")} ${String(cooldownEnd.getHours()).padStart(2, "0")}:${String(cooldownEnd.getMinutes()).padStart(2, "0")} KST`;

  const body = `
    ${emailComponents.sectionTitle("Unstaking Requested")}
    ${emailComponents.subtitle("Your unstaking request has been submitted. A cooldown period is now active.")}
    ${emailComponents.infoCard([
    ["Unstake Amount", `${formattedAmount} VCN`, true],
    ["Cooldown Period", `${cooldownDays} Days`, false],
    ["Available After", endDateStr, false],
    ["Status", emailComponents.statusBadge("Cooling Down", "pending"), false],
  ])}
    ${emailComponents.alertBox(`Your tokens will be available for withdrawal after <strong>${endDateStr}</strong>. You will receive another email when your tokens are ready.`, "info")}
    ${emailComponents.button("View Transaction", explorerUrl)}
    ${emailComponents.divider()}
    <p style="margin:0;font-size:11px;color:#555;">
      TX: ${emailComponents.monoText(`${txHash.slice(0, 14)}...${txHash.slice(-8)}`)}
    </p>
  `;

  await sendSecurityEmail(email, "Vision Chain - Unstaking Cooldown Started", emailBaseLayout(body, `${formattedAmount} VCN unstaking - ${cooldownDays} day cooldown`));
}

/**
 * Send reward claim confirmation email
 */
async function sendClaimRewardEmail(email, { txHash }) {
  // Check email opt-in
  if (!(await checkEmailOptIn(email, "staking"))) {
    console.log(`[Email] Claim reward email skipped for ${email} (opted out)`);
    return;
  }

  const explorerUrl = `https://www.visionchain.co/visionscan/tx/${txHash}`;

  const body = `
    ${emailComponents.sectionTitle("Rewards Claimed")}
    ${emailComponents.subtitle("Your staking rewards have been successfully claimed and sent to your wallet.")}
    ${emailComponents.alertBox("The claimed VCN has been deposited to your wallet balance.", "success")}
    ${emailComponents.infoCard([
    ["Status", emailComponents.statusBadge("Claimed", "success"), false],
  ])}
    ${emailComponents.button("View Transaction", explorerUrl)}
    ${emailComponents.divider()}
    <p style="margin:0;font-size:11px;color:#555;">
      TX: ${emailComponents.monoText(`${txHash.slice(0, 14)}...${txHash.slice(-8)}`)}
    </p>
  `;

  await sendSecurityEmail(email, "Vision Chain - Staking Rewards Claimed", emailBaseLayout(body, "Your staking rewards have been claimed"));
}

// =============================================================================
// EMAIL TEMPLATES - Referral Notifications
// =============================================================================

/**
 * Send referral signup notification to the referrer
 */
async function sendReferralSignupEmail(referrerEmail, { newUserEmail, totalReferrals, referralCode }) {
  // Check email opt-in
  if (!(await checkEmailOptIn(referrerEmail, "referral"))) {
    console.log(`[Email] Referral email skipped for ${referrerEmail} (opted out)`);
    return;
  }

  const maskedEmail = newUserEmail.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c);
  const dashboardUrl = "https://visionchain.co/wallet";
  const shareUrl = `https://visionchain.co/signup?ref=${referralCode}`;

  const body = `
    ${emailComponents.sectionTitle("New Referral Signup!")}
    ${emailComponents.subtitle("Someone signed up using your referral code. Your network is growing!")}
    ${emailComponents.alertBox("A new user has joined Vision Chain through your referral link.", "success")}
    ${emailComponents.infoCard([
    ["New Member", maskedEmail, true],
    ["Total Referrals", `${totalReferrals}`, false],
    ["Your Code", referralCode, false],
  ])}
    ${emailComponents.button("View Dashboard", dashboardUrl)}
    ${emailComponents.divider()}
    <p style="margin:0 0 12px;font-size:12px;color:#888;">Share your referral link to invite more members:</p>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);padding:12px 16px;border-radius:10px;">
      <p style="margin:0;font-size:11px;font-family:'SF Mono',monospace;color:#22d3ee;word-break:break-all;">${shareUrl}</p>
    </div>
  `;

  await sendSecurityEmail(referrerEmail, "Vision Chain - New Referral Signup!", emailBaseLayout(body, `New referral! You now have ${totalReferrals} referrals`));
}

/**
 * Send bridge completion notification email
 * @param {string} email - User email
 * @param {object} bridge - Bridge transaction data
 * @param {string} destTxHash - Destination transaction hash
 */
async function sendBridgeCompleteEmail(email, bridge, destTxHash) {
  // Check email opt-in
  if (!(await checkEmailOptIn(email, "bridge"))) {
    console.log(`[Email] Bridge email skipped for ${email} (opted out)`);
    return;
  }

  const amount = ethers.formatEther(BigInt(bridge.amount));
  const destChain = bridge.dstChainId === SEPOLIA_CHAIN_ID ? "Ethereum Sepolia" : "Vision Chain";
  const sourceChain = bridge.dstChainId === SEPOLIA_CHAIN_ID ? "Vision Chain" : "Ethereum Sepolia";
  const explorerUrl = bridge.dstChainId === SEPOLIA_CHAIN_ID ?
    `https://sepolia.etherscan.io/tx/${destTxHash}` :
    `https://www.visionchain.co/visionscan/tx/${destTxHash}`;

  const body = `
    ${emailComponents.sectionTitle("Bridge Transfer Complete")}
    ${emailComponents.subtitle("Your cross-chain transfer has been successfully completed and finalized.")}
    
    ${emailComponents.chainRoute(sourceChain, destChain)}
    
    ${emailComponents.infoCard([
    ["Amount", `${amount} VCN`, true],
    ["Source Chain", sourceChain, false],
    ["Destination", destChain, false],
    ["Status", emailComponents.statusBadge("Delivered", "success"), false],
  ], "#a855f7")}
    
    ${emailComponents.button("View on Explorer", explorerUrl, "#a855f7", "#fff")}
    
    ${emailComponents.divider()}
    <p style="margin:0;font-size:11px;color:#555;">
      Destination TX: ${emailComponents.monoText(`${destTxHash.slice(0, 14)}...${destTxHash.slice(-8)}`)}
    </p>
  `;

  await sendSecurityEmail(email, "Vision Chain - Bridge Transfer Complete", emailBaseLayout(body, `${amount} VCN bridged to ${destChain}`));
}

// =============================================================================
// EMAIL TEMPLATES - Welcome & Onboarding (Phase 2 - GTM Lifecycle)
// =============================================================================

/**
 * Send welcome email on user registration
 */
async function sendWelcomeEmail(email) {
  const body = `
    <div style="text-align:center;margin:0 0 24px;">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="28" stroke="#22d3ee" stroke-width="2" fill="none" opacity="0.3"/>
        <circle cx="32" cy="32" r="20" stroke="#22d3ee" stroke-width="2" fill="none"/>
        <path d="M32 18L38 32L32 46L26 32Z" fill="#22d3ee" opacity="0.3"/>
        <path d="M32 24L36 32L32 40L28 32Z" fill="#22d3ee"/>
      </svg>
    </div>
    ${emailComponents.sectionTitle("Welcome to Vision Chain")}
    ${emailComponents.subtitle("Your account has been created. You're now part of the Vision Chain ecosystem.")}
    ${emailComponents.alertBox("Your next step: Create your wallet to start sending, staking, and earning VCN.", "info")}
    ${emailComponents.infoCard([
    ["Account", email, false],
    ["Network", "Vision Chain Testnet", false],
    ["Status", emailComponents.statusBadge("Active", "success"), false],
  ])}
    ${emailComponents.button("Create Your Wallet", "https://visionchain.co/wallet")}
    ${emailComponents.divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
      <tr><td style="padding:8px 0;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#ccc;">What you can do on Vision Chain:</p>
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;font-size:13px;color:#888;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:8px;"><circle cx="8" cy="8" r="7" stroke="#22d3ee" stroke-width="1.5" fill="none"/><path d="M5 8l2 2 4-4" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Send VCN to anyone, gasless
          </td></tr>
          <tr><td style="padding:4px 0;font-size:13px;color:#888;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:8px;"><circle cx="8" cy="8" r="7" stroke="#22d3ee" stroke-width="1.5" fill="none"/><path d="M5 8l2 2 4-4" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Stake VCN and earn rewards
          </td></tr>
          <tr><td style="padding:4px 0;font-size:13px;color:#888;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:8px;"><circle cx="8" cy="8" r="7" stroke="#22d3ee" stroke-width="1.5" fill="none"/><path d="M5 8l2 2 4-4" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Bridge tokens across chains
          </td></tr>
          <tr><td style="padding:4px 0;font-size:13px;color:#888;">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:8px;"><circle cx="8" cy="8" r="7" stroke="#22d3ee" stroke-width="1.5" fill="none"/><path d="M5 8l2 2 4-4" stroke="#22d3ee" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            Invite friends and earn rewards
          </td></tr>
        </table>
      </td></tr>
    </table>
  `;

  await sendSecurityEmail(email, "Welcome to Vision Chain!", emailBaseLayout(body, "Welcome to Vision Chain - Your account is ready"));
}

/**
 * Send wallet created confirmation email
 */
async function sendWalletCreatedEmail(email, walletAddress) {
  const shortenedAddr = `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`;
  const explorerUrl = `https://www.visionchain.co/visionscan/address/${walletAddress}`;

  const body = `
    ${emailComponents.sectionTitle("Wallet Created")}
    ${emailComponents.subtitle("Your Vision Chain wallet is ready. You can now send, receive, and stake VCN tokens.")}
    ${emailComponents.alertBox("Your wallet has been secured with end-to-end encryption. Only you can access it.", "success")}
    ${emailComponents.infoCard([
    ["Wallet Address", emailComponents.monoText(shortenedAddr), false],
    ["Network", "Vision Chain Testnet", false],
    ["Status", emailComponents.statusBadge("Ready", "success"), false],
  ])}
    ${emailComponents.button("Open Wallet Dashboard", "https://visionchain.co/wallet")}
    ${emailComponents.divider()}
    <p style="margin:0 0 6px;font-size:13px;color:#ccc;font-weight:600;">Recommended next steps:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0 8px;">
      <tr><td style="padding:4px 0;font-size:13px;color:#888;">1. Visit the Faucet to get test VCN tokens</td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#888;">2. Try staking to start earning rewards</td></tr>
      <tr><td style="padding:4px 0;font-size:13px;color:#888;">3. Invite a friend with your referral link</td></tr>
    </table>
  `;

  await sendSecurityEmail(email, "Vision Chain - Wallet Created!", emailBaseLayout(body, `Your Vision Chain wallet is ready: ${shortenedAddr}`));
}


// =============================================================================
// EMAIL TEMPLATES - Referral Reward (Phase 2)
// =============================================================================

/**
 * Send referral reward notification email
 */
async function sendReferralRewardEmail(email, { rewardAmount, fromUser, tier, event }) {
  if (!(await checkEmailOptIn(email, "referral"))) {
    console.log(`[Email] Referral reward email skipped for ${email} (opted out)`);
    return;
  }

  const tierLabel = tier === 1 ? "Direct Referral" : "2nd-Tier Referral";
  const maskedFrom = fromUser.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c);
  const rewardLabel = rewardAmount + " VCN";
  const alertMsg = "<strong>" + rewardAmount + " VCN</strong> has been credited to your wallet.";
  const previewText = "You earned " + rewardAmount + " VCN from your referral network";

  const body = `
    ${emailComponents.sectionTitle("Referral Reward Earned!")}
    ${emailComponents.subtitle("You've earned a reward from your referral network activity.")}
    ${emailComponents.alertBox(alertMsg, "success")}
    ${emailComponents.infoCard([
    ["Reward", rewardLabel, true],
    ["Tier", tierLabel, false],
    ["From", maskedFrom, false],
    ["Event", event || "User Activity", false],
  ], "#22c55e")}
    ${emailComponents.button("View Rewards", "https://visionchain.co/wallet?tab=referrals")}
    ${emailComponents.divider()}
    <p style="margin:0;font-size:12px;color:#888;">
      Keep inviting friends to earn more rewards!
      <a href="https://visionchain.co/wallet?tab=referrals" style="color:#22d3ee;text-decoration:none;"> Share your referral link</a>
    </p>
  `;

  await sendSecurityEmail(email, "Vision Chain - Referral Reward Earned!", emailBaseLayout(body, previewText));
}

// =============================================================================
// EMAIL TEMPLATES - Drip / Lifecycle (Phase 2)
// =============================================================================

/**
 * Send first staking guide email (24h after signup, if user hasn't staked)
 */
async function sendFirstStakingGuideEmail(email) {
  if (!(await checkEmailOptIn(email, "lifecycle"))) return;

  const body = `
    ${emailComponents.sectionTitle("Start Earning with Staking")}
    ${emailComponents.subtitle("You've been on Vision Chain for a day now. Ready to put your VCN to work?")}
    ${emailComponents.infoCard([
    ["What is Staking?", "Lock your VCN to earn rewards", false],
    ["Minimum Amount", "No minimum required", false],
    ["Rewards", "Earn APY on your staked VCN", true],
  ])}
    <div style="background:rgba(34,211,238,0.05);border:1px solid rgba(34,211,238,0.1);border-radius:12px;padding:20px;margin:0 0 24px;">
      <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#fff;">How to stake in 3 steps:</p>
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;font-size:13px;color:#aaa;">
          <span style="display:inline-block;width:24px;height:24px;background:rgba(34,211,238,0.15);border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#22d3ee;margin-right:10px;">1</span>
          Open your Wallet Dashboard
        </td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#aaa;">
          <span style="display:inline-block;width:24px;height:24px;background:rgba(34,211,238,0.15);border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#22d3ee;margin-right:10px;">2</span>
          Navigate to the Staking section
        </td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:#aaa;">
          <span style="display:inline-block;width:24px;height:24px;background:rgba(34,211,238,0.15);border-radius:50%;text-align:center;line-height:24px;font-size:12px;font-weight:700;color:#22d3ee;margin-right:10px;">3</span>
          Enter the amount and confirm
        </td></tr>
      </table>
    </div>
    ${emailComponents.button("Start Staking Now", "https://visionchain.co/wallet?tab=staking")}
  `;

  await sendSecurityEmail(email, "Vision Chain - Start Earning with Staking", emailBaseLayout(body, "Ready to earn rewards? Start staking your VCN today"));
}

/**
 * Send referral program introduction email (48h after signup)
 */
async function sendReferralIntroEmail(email, referralCode) {
  if (!(await checkEmailOptIn(email, "lifecycle"))) return;

  const shareUrl = `https://visionchain.co/signup?ref=${referralCode}`;

  const body = `
    ${emailComponents.sectionTitle("Invite & Earn Rewards")}
    ${emailComponents.subtitle("Did you know you can earn VCN by inviting friends to Vision Chain?")}
    ${emailComponents.infoCard([
    ["Direct Referral", "10% commission", true],
    ["2nd-Tier Referral", "5% commission", false],
    ["Reward Points", "10 RP per referral", false],
  ], "#22c55e")}
    ${emailComponents.alertBox("For every friend who joins through your link, you earn a percentage of their activity rewards. It's passive income, powered by your network.", "info")}
    <div style="margin:24px 0;">
      <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Your Referral Link</p>
      <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);padding:14px 16px;border-radius:10px;">
        <p style="margin:0;font-size:12px;font-family:'SF Mono',monospace;color:#22d3ee;word-break:break-all;">${shareUrl}</p>
      </div>
    </div>
    ${emailComponents.button("Share Your Link", "https://visionchain.co/wallet?tab=referrals")}
  `;

  await sendSecurityEmail(email, "Vision Chain - Invite Friends, Earn Rewards", emailBaseLayout(body, "Earn VCN by inviting friends to Vision Chain"));
}

/**
 * Send inactivity nudge email (7+ days inactive)
 */
async function sendInactivityNudgeEmail(email) {
  if (!(await checkEmailOptIn(email, "lifecycle"))) return;

  const body = `
    ${emailComponents.sectionTitle("We Miss You!")}
    ${emailComponents.subtitle("It's been a while since you visited Vision Chain. Here's what you might be missing.")}
    ${emailComponents.infoCard([
    ["Staking Rewards", "Your VCN could be earning APY", true],
    ["Referral Program", "Invite friends to earn rewards", false],
    ["Bridge", "Transfer between chains seamlessly", false],
  ])}
    ${emailComponents.alertBox("Your wallet is still secure and ready. Come back and check your balance.", "info")}
    ${emailComponents.button("Return to Wallet", "https://visionchain.co/wallet")}
    ${emailComponents.divider()}
    <div style="text-align:center;">
      <p style="margin:0;font-size:11px;color:#444;">
        Don't want these reminders?
        <a href="https://visionchain.co/wallet?tab=settings" style="color:#22d3ee;text-decoration:none;">Manage preferences</a>
      </p>
    </div>
  `;

  await sendSecurityEmail(email, "Vision Chain - Your Wallet Awaits", emailBaseLayout(body, "Your Vision Chain wallet misses you"));
}

// =============================================================================
// CLOUD FUNCTIONS - Onboarding & Drip Campaign
// =============================================================================

/**
 * Welcome email trigger - called after user registration
 */
exports.notifyWelcome = onRequest({ cors: true, invoker: "public", secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const emailLower = email.toLowerCase();

    // 1. Send welcome email immediately
    await sendWelcomeEmail(emailLower);
    console.log(`[Onboarding] Welcome email sent to ${emailLower}`);

    // 2. Schedule drip emails
    const now = Date.now();

    // First Staking Guide (24h later)
    await db.collection("drip_queue").add({
      userEmail: emailLower,
      templateId: "first_staking_guide",
      scheduledAt: admin.firestore.Timestamp.fromMillis(now + 24 * 60 * 60 * 1000),
      sent: false,
      sentAt: null,
      skippedReason: null,
      createdAt: admin.firestore.Timestamp.now(),
    });

    // Referral Program Intro (48h later)
    await db.collection("drip_queue").add({
      userEmail: emailLower,
      templateId: "referral_intro",
      scheduledAt: admin.firestore.Timestamp.fromMillis(now + 48 * 60 * 60 * 1000),
      sent: false,
      sentAt: null,
      skippedReason: null,
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(`[Onboarding] Drip emails scheduled for ${emailLower}`);

    return res.status(200).json({ success: true, message: "Welcome email sent, drip scheduled" });
  } catch (err) {
    console.error("[Onboarding] Failed:", err);
    return res.status(500).json({ error: err.message || "Failed to process welcome" });
  }
});

/**
 * Drip Email Processor - runs every hour
 * Processes scheduled drip emails from the drip_queue collection
 */
exports.dripEmailProcessor = onSchedule({
  schedule: "0 * * * *", // Every hour at :00
  timeZone: "Asia/Seoul",
  secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"],
}, async (event) => {
  console.log("[Drip] Processing drip email queue...");

  try {
    const now = admin.firestore.Timestamp.now();

    // Get all unsent drip emails that are due
    const queueSnap = await db.collection("drip_queue")
      .where("sent", "==", false)
      .where("skippedReason", "==", null)
      .where("scheduledAt", "<=", now)
      .limit(50)
      .get();

    console.log(`[Drip] Found ${queueSnap.size} emails to process`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const qDoc of queueSnap.docs) {
      const q = qDoc.data();

      try {
        const userEmail = q.userEmail;
        const templateId = q.templateId;

        // Get user data to check conditions
        const userDoc = await db.collection("users").doc(userEmail).get();
        if (!userDoc.exists) {
          await qDoc.ref.update({ skippedReason: "user_not_found", sent: true });
          skippedCount++;
          continue;
        }

        const userData = userDoc.data();

        switch (templateId) {
          case "first_staking_guide": {
            // Skip if user has already staked
            const stakingNotifs = await db.collection("users").doc(userEmail)
              .collection("notifications")
              .where("type", "==", "staking")
              .limit(1)
              .get();

            if (!stakingNotifs.empty) {
              await qDoc.ref.update({ skippedReason: "already_staked", sent: true });
              skippedCount++;
              continue;
            }

            await sendFirstStakingGuideEmail(userEmail);
            break;
          }

          case "referral_intro": {
            const referralCode = userData.referralCode || "";
            if (!referralCode) {
              await qDoc.ref.update({ skippedReason: "no_referral_code", sent: true });
              skippedCount++;
              continue;
            }

            await sendReferralIntroEmail(userEmail, referralCode);
            break;
          }

          default:
            await qDoc.ref.update({ skippedReason: `unknown_template: ${templateId}`, sent: true });
            skippedCount++;
            continue;
        }

        // Mark as sent
        await qDoc.ref.update({ sent: true, sentAt: admin.firestore.Timestamp.now() });
        sentCount++;
        console.log(`[Drip] Sent ${templateId} to ${userEmail}`);
      } catch (dripErr) {
        console.warn(`[Drip] Failed for ${qDoc.id}:`, dripErr.message);
        await qDoc.ref.update({ skippedReason: `error: ${dripErr.message}`, sent: true });
        skippedCount++;
      }
    }

    console.log(`[Drip] Complete: ${sentCount} sent, ${skippedCount} skipped`);
  } catch (err) {
    console.error("[Drip] Processor failed:", err);
  }
});

/**
 * Inactivity Nudge - runs every Monday (same schedule as weekly report)
 * Sends nudge to users who haven't logged in for 7+ days
 */
exports.inactivityNudge = onSchedule({
  schedule: "30 0 * * 1", // Every Monday at 00:30 UTC = 09:30 KST (30 min after weekly report)
  timeZone: "Asia/Seoul",
  secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"],
}, async (event) => {
  console.log("[Inactivity] Checking for inactive users...");

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Get users with wallets who haven't been active
    const usersSnap = await db.collection("users")
      .where("walletReady", "==", true)
      .get();

    let sentCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userData = userDoc.data();
      const userEmail = userDoc.id;

      try {
        // Skip users who have been active recently
        const lastActive = userData.lastActiveAt || userData.updatedAt || userData.createdAt || "";
        if (lastActive && lastActive > sevenDaysAgo) {
          skippedCount++;
          continue;
        }

        // Check opt-in
        const optedIn = await checkEmailOptIn(userEmail, "lifecycle");
        if (!optedIn) {
          skippedCount++;
          continue;
        }

        // Don't send too frequently - check if we sent a nudge in the last 14 days
        const recentNudge = await db.collection("drip_queue")
          .where("userEmail", "==", userEmail)
          .where("templateId", "==", "inactivity_nudge")
          .where("sent", "==", true)
          .orderBy("sentAt", "desc")
          .limit(1)
          .get();

        if (!recentNudge.empty) {
          const lastNudge = recentNudge.docs[0].data();
          const lastNudgeTime = lastNudge.sentAt?.toDate?.() || new Date(0);
          const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
          if (lastNudgeTime > fourteenDaysAgo) {
            skippedCount++;
            continue;
          }
        }

        await sendInactivityNudgeEmail(userEmail);

        // Log in drip_queue for tracking
        await db.collection("drip_queue").add({
          userEmail,
          templateId: "inactivity_nudge",
          scheduledAt: admin.firestore.Timestamp.now(),
          sent: true,
          sentAt: admin.firestore.Timestamp.now(),
          skippedReason: null,
          createdAt: admin.firestore.Timestamp.now(),
        });

        sentCount++;
      } catch (e) {
        console.warn(`[Inactivity] Failed for ${userEmail}:`, e.message);
        skippedCount++;
      }
    }

    console.log(`[Inactivity] Complete: ${sentCount} sent, ${skippedCount} skipped`);
  } catch (err) {
    console.error("[Inactivity] Job failed:", err);
  }
});

// =============================================================================
// CLOUD FUNCTION - Admin Broadcast
// =============================================================================

/**
 * Admin broadcast email to all users (or filtered subset)
 */
exports.sendAdminBroadcast = onRequest({ cors: true, invoker: "public", secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { adminEmail, title, message, ctaText, ctaUrl, filter } = req.body;

    // Basic admin verification
    if (!adminEmail) {
      return res.status(400).json({ error: "Missing adminEmail" });
    }

    const adminDoc = await db.collection("users").doc(adminEmail.toLowerCase()).get();
    if (!adminDoc.exists || adminDoc.data().role !== "admin") {
      return res.status(403).json({ error: "Unauthorized: Admin access required" });
    }

    if (!title || !message) {
      return res.status(400).json({ error: "Missing required fields: title, message" });
    }

    // Build email body
    const ctaSection = ctaText && ctaUrl ? emailComponents.button(ctaText, ctaUrl) : "";

    const body = `
      ${emailComponents.sectionTitle(title)}
      <div style="margin:0 0 24px;">
        <p style="margin:0;font-size:14px;color:#ccc;line-height:1.7;">${message.replace(/\n/g, "<br/>")}</p>
      </div>
      ${ctaSection}
      ${emailComponents.divider()}
      <div style="text-align:center;">
        <p style="margin:0;font-size:11px;color:#444;">
          This is an announcement from the Vision Chain team.
          <a href="https://visionchain.co/wallet?tab=settings" style="color:#22d3ee;text-decoration:none;">Manage preferences</a>
        </p>
      </div>
    `;

    const emailHtml = emailBaseLayout(body, title);

    // Get target users
    let usersQuery = db.collection("users");
    if (filter === "walletReady") {
      usersQuery = usersQuery.where("walletReady", "==", true);
    }

    const usersSnap = await usersQuery.get();

    let sentCount = 0;
    let failedCount = 0;

    // Send in batches with rate limiting
    const batchSize = 10;
    const userDocs = usersSnap.docs;

    for (let i = 0; i < userDocs.length; i += batchSize) {
      const batch = userDocs.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (userDoc) => {
          const userEmail = userDoc.id;

          // Check announcements opt-in
          const optedIn = await checkEmailOptIn(userEmail, "announcements");
          if (!optedIn) return;

          await sendSecurityEmail(userEmail, `Vision Chain - ${title}`, emailHtml);
        }),
      );

      results.forEach((r) => {
        if (r.status === "fulfilled") sentCount++;
        else failedCount++;
      });

      // Rate limit: wait 1 second between batches
      if (i + batchSize < userDocs.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Log broadcast
    await db.collection("admin_broadcasts").add({
      adminEmail: adminEmail.toLowerCase(),
      title,
      message,
      ctaText: ctaText || null,
      ctaUrl: ctaUrl || null,
      filter: filter || "all",
      sentCount,
      failedCount,
      totalTargeted: usersSnap.size,
      createdAt: admin.firestore.Timestamp.now(),
    });

    console.log(`[Broadcast] "${title}" sent: ${sentCount}/${usersSnap.size}, failed: ${failedCount}`);

    return res.status(200).json({
      success: true,
      sentCount,
      failedCount,
      totalTargeted: usersSnap.size,
    });
  } catch (err) {
    console.error("[Broadcast] Failed:", err);
    return res.status(500).json({ error: err.message || "Broadcast failed" });
  }
});

// =============================================================================
// PASSWORD RESET - Forgot Password Flow (Logged-out)
// =============================================================================

/**
 * Password reset email template - checks Firestore first
 */
async function generatePasswordResetEmailHtml(code, email) {
  const custom = await loadCustomTemplate("passwordReset");
  if (custom) {
    const body = renderTemplate(custom.bodyHtml, { code, email });
    const subject = renderTemplate(custom.subject, { code });
    return emailBaseLayout(body, subject);
  }
  const body = `
    <div style="text-align:center;margin:0 0 24px;">
      <svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="28" cy="28" r="26" stroke="#f59e0b" stroke-width="2" fill="none" opacity="0.3"/>
        <rect x="20" y="18" width="16" height="20" rx="3" stroke="#f59e0b" stroke-width="2" fill="none"/>
        <circle cx="28" cy="28" r="2" fill="#f59e0b"/>
        <line x1="28" y1="30" x2="28" y2="34" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
        <path d="M22 18v-4a6 6 0 0112 0v4" stroke="#f59e0b" stroke-width="2" fill="none" stroke-linecap="round"/>
      </svg>
    </div>
    ${emailComponents.sectionTitle("Password Reset Request")}
    ${emailComponents.subtitle("Use the verification code below to reset your Vision Chain password.")}
    ${emailComponents.alertBox("If you did not request this password reset, please ignore this email. Your account remains secure.", "warning")}
    ${emailComponents.codeBox(code)}
    ${emailComponents.infoCard([
    ["Account", email, false],
    ["Valid For", "15 minutes", false],
    ["Status", emailComponents.statusBadge("Pending", "warning"), false],
  ])}
    ${emailComponents.divider()}
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0;">
      <tr><td style="padding:4px 0;font-size:12px;color:#888;">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:6px;"><circle cx="8" cy="8" r="7" stroke="#f59e0b" stroke-width="1.5" fill="none"/><line x1="8" y1="5" x2="8" y2="9" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.8" fill="#f59e0b"/></svg>
        Never share this code with anyone.
      </td></tr>
      <tr><td style="padding:4px 0;font-size:12px;color:#888;">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style="vertical-align:middle;margin-right:6px;"><circle cx="8" cy="8" r="7" stroke="#f59e0b" stroke-width="1.5" fill="none"/><line x1="8" y1="5" x2="8" y2="9" stroke="#f59e0b" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11.5" r="0.8" fill="#f59e0b"/></svg>
        Vision Chain will never ask for your password via email.
      </td></tr>
    </table>
  `;

  return emailBaseLayout(body, "Your Vision Chain password reset code");
}

/**
 * Password changed confirmation email - checks Firestore first
 */
async function generatePasswordChangedEmailHtml(targetEmail, timestamp) {
  const custom = await loadCustomTemplate("passwordChanged");
  if (custom) {
    const body = renderTemplate(custom.bodyHtml, { email: targetEmail, timestamp });
    const subject = renderTemplate(custom.subject, { email: targetEmail });
    return emailBaseLayout(body, subject);
  }
  const body = `
    ${emailComponents.sectionTitle("Password Changed Successfully")}
    ${emailComponents.subtitle("Your Vision Chain account password has been updated.")}
    ${emailComponents.alertBox("If you did not make this change, please contact support immediately and secure your account.", "warning")}
    ${emailComponents.infoCard([
    ["Account", targetEmail, false],
    ["Changed At", timestamp, false],
    ["Status", emailComponents.statusBadge("Confirmed", "success"), false],
  ])}
    ${emailComponents.button("Login to Vision Chain", "https://visionchain.co/login")}
    ${emailComponents.divider()}
    <p style="margin:0;font-size:11px;color:#555;">
      For security reasons, you may need to log in again on all devices.
    </p>
  `;

  return emailBaseLayout(body, "Your Vision Chain password has been changed");
}

/**
 * Step 1: Request password reset - sends verification code to email
 */
exports.requestPasswordReset = onRequest({ cors: true, invoker: "public", secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const emailLower = email.toLowerCase().trim();

    // Rate limiting: max 3 requests per hour
    const rateLimitKey = "pw_reset_" + emailLower;
    const rlDoc = await db.collection("rate_limits").doc(rateLimitKey).get();
    if (rlDoc.exists) {
      const rlData = rlDoc.data();
      const hourAgo = Date.now() - 60 * 60 * 1000;
      if (rlData.count >= 3 && rlData.lastAttempt > hourAgo) {
        return res.status(429).json({ error: "Too many reset requests. Please try again later." });
      }
    }

    // Check if user exists in Firebase Auth OR Firestore
    let userExists = false;
    try {
      await admin.auth().getUserByEmail(emailLower);
      userExists = true;
    } catch (authErr) {
      // Not in Firebase Auth, check Firestore users collection
      const userDoc = await db.collection("users").doc(emailLower).get();
      if (userDoc.exists) {
        userExists = true;
        console.log(`[PasswordReset] User found in Firestore (not in Auth): ${emailLower}`);
      }
    }

    if (!userExists) {
      // Don't reveal whether email exists (security best practice)
      console.log(`[PasswordReset] Email not found anywhere: ${emailLower}`);
      return res.status(200).json({ success: true, message: "If this email exists, a reset code has been sent." });
    }

    // Generate 6-digit code
    const code = crypto.randomInt(100000, 999999).toString();
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store reset token
    await db.collection("password_reset_tokens").doc(emailLower).set({
      codeHash,
      expiresAt,
      attempts: 0,
      used: false,
      createdAt: Date.now(),
      ip: req.ip || req.headers["x-forwarded-for"] || "unknown",
    });

    // Update rate limit
    const currentCount = (rlDoc.exists ? rlDoc.data().count : 0) + 1;
    const shouldReset = rlDoc.exists && rlDoc.data().lastAttempt < Date.now() - 60 * 60 * 1000;
    await db.collection("rate_limits").doc(rateLimitKey).set({
      count: shouldReset ? 1 : currentCount,
      lastAttempt: Date.now(),
    });

    // Send email
    const emailHtml = await generatePasswordResetEmailHtml(code, emailLower);
    await sendSecurityEmail(emailLower, "Vision Chain - Password Reset Code", emailHtml);

    await logSecurityEvent(emailLower, "PASSWORD_RESET_REQUESTED", { ip: req.ip }, db);
    console.log(`[PasswordReset] Code sent to ${emailLower}`);

    return res.status(200).json({ success: true, message: "If this email exists, a reset code has been sent." });
  } catch (err) {
    console.error("[PasswordReset] Request failed:", err);
    return res.status(500).json({ error: "Failed to process password reset request." });
  }
});

/**
 * Step 2: Verify reset code - checks code validity and returns whether TOTP is required
 */
exports.verifyResetCode = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Missing email or code" });

    const emailLower = email.toLowerCase().trim();

    // Get reset token
    const tokenDoc = await db.collection("password_reset_tokens").doc(emailLower).get();
    if (!tokenDoc.exists) {
      return res.status(400).json({ error: "No password reset request found. Please request a new code." });
    }

    const tokenData = tokenDoc.data();

    // Check if already used
    if (tokenData.used) {
      return res.status(400).json({ error: "This code has already been used. Please request a new one." });
    }

    // Check expiry
    if (Date.now() > tokenData.expiresAt) {
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }

    // Check attempts (max 5)
    if (tokenData.attempts >= 5) {
      await db.collection("password_reset_tokens").doc(emailLower).update({ used: true });
      await logSecurityEvent(emailLower, "PASSWORD_RESET_TOO_MANY_ATTEMPTS", {}, db);
      return res.status(400).json({ error: "Too many failed attempts. Please request a new code." });
    }

    // Verify code
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    if (codeHash !== tokenData.codeHash) {
      await db.collection("password_reset_tokens").doc(emailLower).update({
        attempts: admin.firestore.FieldValue.increment(1),
      });
      return res.status(400).json({ error: "Invalid code. Please check and try again." });
    }

    // Check if user has TOTP enabled
    const totpDoc = await db.collection("security_totp").doc(emailLower).get();
    const totpRequired = totpDoc.exists && totpDoc.data().enabled === true;

    console.log(`[PasswordReset] Code verified for ${emailLower}, TOTP required: ${totpRequired}`);

    return res.status(200).json({
      success: true,
      totpRequired,
      message: totpRequired ?
        "Code verified. Please enter your Google Authenticator code to continue." :
        "Code verified. Please enter your new password.",
    });
  } catch (err) {
    console.error("[PasswordReset] Verify failed:", err);
    return res.status(500).json({ error: "Failed to verify code." });
  }
});

/**
 * Step 3: Complete password reset - verify TOTP (if required) and change password
 */
exports.completePasswordReset = onRequest({ cors: true, invoker: "public", secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, code, newPassword, totpCode, useBackupCode, timezone } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "Missing required fields: email, code, newPassword" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const emailLower = email.toLowerCase().trim();

    // Re-verify reset token
    const tokenDoc = await db.collection("password_reset_tokens").doc(emailLower).get();
    if (!tokenDoc.exists) {
      return res.status(400).json({ error: "No password reset request found." });
    }

    const tokenData = tokenDoc.data();

    if (tokenData.used) {
      return res.status(400).json({ error: "This reset code has already been used." });
    }

    if (Date.now() > tokenData.expiresAt) {
      return res.status(400).json({ error: "Code has expired. Please request a new one." });
    }

    // Verify code again
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    if (codeHash !== tokenData.codeHash) {
      return res.status(400).json({ error: "Invalid code." });
    }

    // Check TOTP if required
    const totpDoc = await db.collection("security_totp").doc(emailLower).get();
    const has2FA = totpDoc.exists && totpDoc.data().enabled === true;

    if (has2FA) {
      if (!totpCode) {
        return res.status(400).json({ error: "Google Authenticator code is required.", totpRequired: true });
      }

      const totpData = totpDoc.data();

      if (useBackupCode) {
        // Verify backup code
        const backupCodes = totpData.backupCodes || [];
        const matchingCode = backupCodes.find((bc) => {
          if (bc.used) return false;
          const decrypted = serverDecrypt(bc.code);
          return decrypted === totpCode.toUpperCase();
        });

        if (!matchingCode) {
          await logSecurityEvent(emailLower, "PASSWORD_RESET_BACKUP_FAILED", { code: totpCode }, db);
          return res.status(400).json({ error: "Invalid or already used backup code." });
        }

        // Mark backup code as used
        const updatedCodes = backupCodes.map((bc) => {
          const decrypted = serverDecrypt(bc.code);
          if (decrypted === totpCode.toUpperCase()) {
            return { ...bc, used: true, usedAt: Date.now() };
          }
          return bc;
        });

        await db.collection("security_totp").doc(emailLower).update({
          backupCodes: updatedCodes,
        });

        console.log(`[PasswordReset] Backup code used for ${emailLower}`);
      } else {
        // Verify TOTP code
        const totpAuth = getAuthenticator();
        const secret = serverDecrypt(totpData.secret);
        const isValid = totpAuth.check(totpCode, secret);

        if (!isValid) {
          await logSecurityEvent(emailLower, "PASSWORD_RESET_TOTP_FAILED", { code: totpCode }, db);
          return res.status(400).json({ error: "Invalid authenticator code. Please try again." });
        }
      }
    }

    // Update password via Firebase Admin SDK (or create Auth account if missing)
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(emailLower);
      await admin.auth().updateUser(userRecord.uid, {
        password: newPassword,
      });
    } catch (authErr) {
      // User exists in Firestore but not Firebase Auth - create Auth account
      const userDoc = await db.collection("users").doc(emailLower).get();
      if (!userDoc.exists) {
        return res.status(400).json({ error: "User account not found." });
      }
      console.log(`[PasswordReset] Creating Firebase Auth account for Firestore-only user: ${emailLower}`);
      userRecord = await admin.auth().createUser({
        email: emailLower,
        password: newPassword,
        emailVerified: true,
      });
      // Update Firestore user doc with the new uid if needed
      await db.collection("users").doc(emailLower).update({
        uid: userRecord.uid,
        updatedAt: Date.now(),
      });
    }

    // Mark token as used
    await db.collection("password_reset_tokens").doc(emailLower).update({
      used: true,
      usedAt: Date.now(),
    });

    // Send confirmation email with user's locale timezone
    const userTimezone = timezone || "UTC";
    let timestamp;
    try {
      timestamp = new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: userTimezone,
        timeZoneName: "short",
      }).format(new Date());
    } catch (tzErr) {
      // Fallback to UTC if invalid timezone
      timestamp = new Date().toISOString().replace("T", " ").substring(0, 16) + " UTC";
    }
    const confirmHtml = await generatePasswordChangedEmailHtml(emailLower, timestamp);
    await sendSecurityEmail(emailLower, "Vision Chain - Password Changed", confirmHtml);

    await logSecurityEvent(emailLower, "PASSWORD_RESET_COMPLETED", {
      ip: req.ip,
      had2FA: has2FA,
      usedBackup: useBackupCode || false,
    }, db);

    // Revoke all refresh tokens to force re-login
    await admin.auth().revokeRefreshTokens(userRecord.uid);

    console.log(`[PasswordReset] Password changed for ${emailLower}`);

    return res.status(200).json({ success: true, message: "Password has been changed successfully." });
  } catch (err) {
    console.error("[PasswordReset] Complete failed:", err);
    return res.status(500).json({ error: err.message || "Failed to reset password." });
  }
});

// =============================================================================
// ADMIN EMAIL MANAGEMENT
// =============================================================================

/**
 * Admin: Get email template previews with dummy data
 */
exports.adminEmailPreview = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    // Verify admin auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const adminDoc = await db.collection("admins").doc(decoded.uid).get();
    if (!adminDoc.exists) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const templateId = req.query.template || req.body?.template;

    // Define all templates with dummy data
    const templates = {
      verification: {
        id: "verification",
        name: "Device Verification",
        category: "security",
        description: "Sent when user logs in from a new device",
        html: await generateVerificationEmailHtml("847291", {
          browser: "Chrome 120",
          os: "macOS 14.2",
          ip: "203.230.xxx.xxx",
          location: "Seoul, South Korea",
          timestamp: new Date().toISOString(),
        }),
      },
      suspicious: {
        id: "suspicious",
        name: "Suspicious Activity Alert",
        category: "security",
        description: "Sent when unusual login behavior is detected",
        html: await generateSuspiciousActivityEmailHtml("Multiple failed login attempts detected", {
          ip: "185.220.xxx.xxx",
          location: "Unknown Location",
          attempts: 5,
          timestamp: new Date().toISOString(),
        }),
      },
      passwordReset: {
        id: "passwordReset",
        name: "Password Reset Code",
        category: "security",
        description: "Sent when user requests a password reset",
        html: await generatePasswordResetEmailHtml("593721", "user@example.com"),
      },
      passwordChanged: {
        id: "passwordChanged",
        name: "Password Changed Confirmation",
        category: "security",
        description: "Sent after password is successfully changed",
        html: await generatePasswordChangedEmailHtml("user@example.com", "02/10/2026, 08:00 AM KST"),
      },
      weeklyReport: {
        id: "weeklyReport",
        name: "Weekly Activity Report",
        category: "weeklyReport",
        description: "Weekly summary of user's activity and portfolio",
        html: await generateWeeklyReportEmailHtml({
          weekStart: "Feb 3, 2026",
          weekEnd: "Feb 9, 2026",
          stakingActions: 3,
          totalStaked: "10,000",
          totalUnstaked: "0",
          rewardsClaimed: "125",
          bridgeTransfers: 1,
          bridgeVolume: "5,000",
          newReferrals: 2,
          totalReferrals: 8,
          walletBalance: "45,230",
        }),
      },
    };

    if (templateId) {
      if (!templates[templateId]) {
        return res.status(404).json({ error: `Template '${templateId}' not found` });
      }
      return res.status(200).json({ success: true, template: templates[templateId] });
    }

    // Return all template metadata (without full HTML for list view)
    const templateList = Object.values(templates).map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
      description: t.description,
    }));

    return res.status(200).json({ success: true, templates: templateList, allTemplates: templates });
  } catch (err) {
    console.error("[AdminEmail] Preview failed:", err);
    return res.status(500).json({ error: err.message || "Failed to generate preview" });
  }
});

/**
 * Admin: Get email subscription statistics
 */
exports.adminEmailStats = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    // Verify admin auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const adminDoc = await db.collection("admins").doc(decoded.uid).get();
    if (!adminDoc.exists) {
      return res.status(403).json({ error: "Admin access required" });
    }

    // Get all users and aggregate email preference stats
    const usersSnapshot = await db.collection("users").get();
    const totalUsers = usersSnapshot.size;

    const categories = ["security", "staking", "referral", "bridge", "weeklyReport", "lifecycle", "announcements"];
    const stats = {};

    for (const cat of categories) {
      stats[cat] = { optedIn: 0, optedOut: 0 };
    }

    usersSnapshot.forEach((doc) => {
      const prefs = doc.data().emailPreferences || {};
      for (const cat of categories) {
        // Default is true (opted in) if not explicitly set
        const isOptedIn = prefs[cat] !== false;
        if (isOptedIn) {
          stats[cat].optedIn++;
        } else {
          stats[cat].optedOut++;
        }
      }
    });

    // Get recent password reset tokens count (last 24h)
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentResetsSnapshot = await db.collection("password_reset_tokens")
      .where("createdAt", ">=", oneDayAgo)
      .get();

    // Get drip queue stats
    const dripStats = { pending: 0, sent: 0, skipped: 0 };
    try {
      const dripSnapshot = await db.collection("drip_queue").get();
      dripSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.sent) dripStats.sent++;
        else if (data.skippedReason) dripStats.skipped++;
        else dripStats.pending++;
      });
    } catch (e) {
      console.warn("[AdminEmail] Drip stats error:", e);
    }

    return res.status(200).json({
      success: true,
      totalUsers,
      categoryStats: stats,
      recentPasswordResets: recentResetsSnapshot.size,
      dripQueue: dripStats,
    });
  } catch (err) {
    console.error("[AdminEmail] Stats failed:", err);
    return res.status(500).json({ error: err.message || "Failed to get email stats" });
  }
});

/**
 * Admin: Send test email to admin's own email
 */
exports.adminSendTestEmail = onRequest({ cors: true, invoker: "public", secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    // Verify admin auth
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    const adminDoc = await db.collection("admins").doc(decoded.uid).get();
    if (!adminDoc.exists) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const { templateId, targetEmail, sendTo: sendToParam } = req.body;
    if (!templateId) {
      return res.status(400).json({ error: "Missing templateId" });
    }

    // Use specified target email or admin's email as fallback
    const sendTo = sendToParam || targetEmail || decoded.email;
    if (!sendTo) {
      return res.status(400).json({ error: "No target email available" });
    }

    // Generate template HTML with dummy data
    let html = "";
    let subject = "Vision Chain - Test Email";

    switch (templateId) {
      case "verification":
        html = await generateVerificationEmailHtml("847291", {
          browser: "Chrome 120", os: "macOS 14.2",
          ip: "203.230.xxx.xxx", location: "Seoul, South Korea",
          timestamp: new Date().toISOString(),
        });
        subject = "[TEST] Vision Chain - Device Verification";
        break;
      case "suspicious":
        html = await generateSuspiciousActivityEmailHtml("Multiple failed login attempts", {
          ip: "185.220.xxx.xxx", location: "Unknown", attempts: 5,
          timestamp: new Date().toISOString(),
        });
        subject = "[TEST] Vision Chain - Suspicious Activity";
        break;
      case "passwordReset":
        html = await generatePasswordResetEmailHtml("593721", sendTo);
        subject = "[TEST] Vision Chain - Password Reset Code";
        break;
      case "passwordChanged":
        html = await generatePasswordChangedEmailHtml(sendTo, new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul", timeZoneName: "short" }));
        subject = "[TEST] Vision Chain - Password Changed";
        break;
      case "weeklyReport":
        html = await generateWeeklyReportEmailHtml({
          weekStart: "Feb 3, 2026", weekEnd: "Feb 9, 2026",
          stakingActions: 3, totalStaked: "10,000", totalUnstaked: "0",
          rewardsClaimed: "125", bridgeTransfers: 1, bridgeVolume: "5,000",
          newReferrals: 2, totalReferrals: 8, walletBalance: "45,230",
        });
        subject = "[TEST] Vision Chain - Weekly Report";
        break;
      case "2faEnabled": {
        const body2faOn = `${emailComponents.sectionTitle("2FA Enabled")}${emailComponents.subtitle("Two-factor authentication has been enabled on your account.")}${emailComponents.alertBox("Your account is now protected with an additional layer of security.", "success")}`;
        html = emailBaseLayout(body2faOn, "2FA has been enabled");
        subject = "[TEST] Vision Chain - 2FA Enabled";
        break;
      }
      case "2faDisabled": {
        const body2faOff = `${emailComponents.sectionTitle("2FA Disabled")}${emailComponents.subtitle("Two-factor authentication has been disabled on your account.")}${emailComponents.alertBox("We strongly recommend keeping 2FA enabled for maximum security.", "error")}`;
        html = emailBaseLayout(body2faOff, "2FA has been disabled");
        subject = "[TEST] Vision Chain - 2FA Disabled";
        break;
      }
      case "stakingConfirmed": {
        const bodyStake = emailComponents.sectionTitle("Staking Confirmed") +
          emailComponents.subtitle("Your VCN tokens have been successfully staked.") +
          emailComponents.alertBox("Your tokens are now earning rewards.", "success") +
          emailComponents.infoCard([["Staked Amount", "10,000 VCN", true],
          ["Status", emailComponents.statusBadge("Active", "success"), false]]);
        html = emailBaseLayout(bodyStake, "10,000 VCN staked successfully");
        subject = "[TEST] Vision Chain - Staking Confirmed";
        break;
      }
      case "unstakingCooldown": {
        const bodyUnstake = emailComponents.sectionTitle("Unstaking Requested") +
          emailComponents.subtitle("Your unstaking request has been submitted.") +
          emailComponents.infoCard([["Unstake Amount", "5,000 VCN", true],
          ["Cooldown", "7 Days", false],
          ["Status", emailComponents.statusBadge("Cooling Down", "pending"), false]]);
        html = emailBaseLayout(bodyUnstake, "5,000 VCN unstaking - 7 day cooldown");
        subject = "[TEST] Vision Chain - Unstaking Cooldown";
        break;
      }
      case "rewardsClaimed": {
        const bodyClaim = emailComponents.sectionTitle("Rewards Claimed") +
          emailComponents.subtitle("Your staking rewards have been successfully claimed.") +
          emailComponents.alertBox("The claimed VCN has been deposited to your wallet.", "success") +
          emailComponents.infoCard([["Status", emailComponents.statusBadge("Claimed", "success"), false]]);
        html = emailBaseLayout(bodyClaim, "Staking rewards claimed");
        subject = "[TEST] Vision Chain - Rewards Claimed";
        break;
      }
      case "referralSignup": {
        const bodyRef = emailComponents.sectionTitle("New Referral Signup!") +
          emailComponents.subtitle("Someone signed up using your referral code.") +
          emailComponents.alertBox("A new user has joined through your referral link.", "success") +
          emailComponents.infoCard([["New Member", "u***@example.com", true],
          ["Total Referrals", "5", false], ["Your Code", "VCN-ABC123", false]]);
        html = emailBaseLayout(bodyRef, "New referral! You now have 5 referrals");
        subject = "[TEST] Vision Chain - New Referral Signup";
        break;
      }
      case "referralReward": {
        const bodyRR = emailComponents.sectionTitle("Referral Reward Earned!") +
          emailComponents.subtitle("You've earned a reward from your referral network.") +
          emailComponents.alertBox("<strong>500 VCN</strong> has been credited to your wallet.", "success") +
          emailComponents.infoCard([["Reward", "500 VCN", true],
          ["Tier", "Direct Referral", false], ["From", "u***@example.com", false]], "#22c55e");
        html = emailBaseLayout(bodyRR, "You earned 500 VCN from your referral network");
        subject = "[TEST] Vision Chain - Referral Reward Earned";
        break;
      }
      case "bridgeComplete": {
        const bodyBridge = emailComponents.sectionTitle("Bridge Transfer Complete") +
          emailComponents.subtitle("Your cross-chain transfer has been completed.") +
          emailComponents.chainRoute("Ethereum Sepolia", "Vision Chain") +
          emailComponents.infoCard([["Amount", "5,000 VCN", true],
          ["Source", "Ethereum Sepolia", false], ["Destination", "Vision Chain", false],
          ["Status", emailComponents.statusBadge("Delivered", "success"), false]], "#a855f7");
        html = emailBaseLayout(bodyBridge, "5,000 VCN bridged to Vision Chain");
        subject = "[TEST] Vision Chain - Bridge Transfer Complete";
        break;
      }
      case "welcome": {
        const bodyW = emailComponents.sectionTitle("Welcome to Vision Chain") +
          emailComponents.subtitle("Your account has been created.") +
          emailComponents.alertBox("Create your wallet to start sending, staking, and earning VCN.", "info") +
          emailComponents.infoCard([["Account", sendTo, false],
          ["Network", "Vision Chain Testnet", false],
          ["Status", emailComponents.statusBadge("Active", "success"), false]]) +
          emailComponents.button("Create Your Wallet", "https://visionchain.co/wallet");
        html = emailBaseLayout(bodyW, "Welcome to Vision Chain");
        subject = "[TEST] Welcome to Vision Chain!";
        break;
      }
      case "walletCreated": {
        const bodyWC = emailComponents.sectionTitle("Wallet Created") +
          emailComponents.subtitle("Your Vision Chain wallet is ready.") +
          emailComponents.alertBox("Your wallet has been secured with end-to-end encryption.", "success") +
          emailComponents.infoCard([["Wallet", emailComponents.monoText("0x6872...1d31"), false],
          ["Network", "Vision Chain Testnet", false],
          ["Status", emailComponents.statusBadge("Ready", "success"), false]]) +
          emailComponents.button("Open Wallet Dashboard", "https://visionchain.co/wallet");
        html = emailBaseLayout(bodyWC, "Your Vision Chain wallet is ready");
        subject = "[TEST] Vision Chain - Wallet Created!";
        break;
      }
      case "firstStakingGuide": {
        const bodySG = emailComponents.sectionTitle("Start Earning with Staking") +
          emailComponents.subtitle("Ready to put your VCN to work?") +
          emailComponents.infoCard([["What is Staking?", "Lock your VCN to earn rewards", false],
          ["Minimum", "No minimum required", false],
          ["Rewards", "Earn APY on your staked VCN", true]]) +
          emailComponents.button("Start Staking Now", "https://visionchain.co/wallet?tab=staking");
        html = emailBaseLayout(bodySG, "Start staking your VCN today");
        subject = "[TEST] Vision Chain - Start Earning with Staking";
        break;
      }
      case "referralIntro": {
        const bodyRI = emailComponents.sectionTitle("Invite & Earn Rewards") +
          emailComponents.subtitle("Earn VCN by inviting friends to Vision Chain.") +
          emailComponents.infoCard([["Direct Referral", "10% commission", true],
          ["2nd-Tier", "5% commission", false],
          ["Reward Points", "10 RP per referral", false]], "#22c55e") +
          emailComponents.button("Share Your Link", "https://visionchain.co/wallet?tab=referrals");
        html = emailBaseLayout(bodyRI, "Earn VCN by inviting friends");
        subject = "[TEST] Vision Chain - Invite Friends, Earn Rewards";
        break;
      }
      case "inactivityNudge": {
        const bodyIN = emailComponents.sectionTitle("We Miss You!") +
          emailComponents.subtitle("It's been a while since you visited Vision Chain.") +
          emailComponents.infoCard([["Staking Rewards", "Your VCN could be earning APY", true],
          ["Referral Program", "Invite friends to earn rewards", false],
          ["Bridge", "Transfer between chains seamlessly", false]]) +
          emailComponents.alertBox("Your wallet is still secure and ready.", "info") +
          emailComponents.button("Return to Wallet", "https://visionchain.co/wallet");
        html = emailBaseLayout(bodyIN, "Your Vision Chain wallet misses you");
        subject = "[TEST] Vision Chain - Your Wallet Awaits";
        break;
      }
      default:
        return res.status(400).json({ error: `Unknown template: ${templateId}` });
    }

    await sendSecurityEmail(sendTo, subject, html);
    console.log(`[AdminEmail] Test email '${templateId}' sent to ${sendTo}`);

    return res.status(200).json({ success: true, message: `Test email sent to ${sendTo}` });
  } catch (err) {
    console.error("[AdminEmail] Send test failed:", err);
    return res.status(500).json({ error: err.message || "Failed to send test email" });
  }
});

// =============================================================================
// EMAIL PREFERENCES - User subscription management
// =============================================================================

/**
 * Email preference categories and defaults
 */
const EMAIL_PREFERENCE_DEFAULTS = {
  security: true, // Device verification, suspicious activity, 2FA (always on)
  staking: true, // Stake, unstake, cooldown, reward claim
  referral: true, // New referral signups, referral rewards
  bridge: true, // Bridge transfer completion
  weeklyReport: true, // Weekly activity digest
  lifecycle: true, // Onboarding drip emails (welcome, guides)
  announcements: true, // Admin broadcasts and announcements

};

/**
 * Get user email preferences from Firestore
 * @param {string} userEmail - User email (doc ID)
 * @return {Promise<object>} Merged preferences with defaults
 */
async function getEmailPrefs(userEmail) {
  if (!userEmail) return { ...EMAIL_PREFERENCE_DEFAULTS };
  try {
    const doc = await db.collection("users").doc(userEmail.toLowerCase()).get();
    if (doc.exists && doc.data().emailPreferences) {
      return { ...EMAIL_PREFERENCE_DEFAULTS, ...doc.data().emailPreferences };
    }
  } catch (e) {
    console.warn("[Email] Failed to get preferences:", e.message);
  }
  return { ...EMAIL_PREFERENCE_DEFAULTS };
}

/**
 * Check if user has opted in to a specific email category
 * @param {string} userEmail - User email
 * @param {string} category - Email category key
 * @return {Promise<boolean>} True if opted in
 */
async function checkEmailOptIn(userEmail, category) {
  // Security emails are always sent (cannot opt out)
  if (category === "security") return true;
  const prefs = await getEmailPrefs(userEmail);
  return prefs[category] !== false;
}

/**
 * Update email preferences endpoint
 */
exports.updateEmailPreferences = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { email, preferences } = req.body;

    if (!email || !preferences || typeof preferences !== "object") {
      return res.status(400).json({ error: "Missing required fields: email, preferences (object)" });
    }

    // Validate preference keys
    const validKeys = Object.keys(EMAIL_PREFERENCE_DEFAULTS);
    const sanitized = {};
    for (const [key, value] of Object.entries(preferences)) {
      if (validKeys.includes(key) && typeof value === "boolean") {
        // Security cannot be disabled
        if (key === "security") {
          sanitized[key] = true;
        } else {
          sanitized[key] = value;
        }
      }
    }

    await db.collection("users").doc(email.toLowerCase()).set(
      { emailPreferences: sanitized, updatedAt: new Date().toISOString() },
      { merge: true },
    );

    console.log(`[Email] Preferences updated for ${email}:`, sanitized);

    return res.status(200).json({
      success: true,
      preferences: { ...EMAIL_PREFERENCE_DEFAULTS, ...sanitized },
    });
  } catch (err) {
    console.error("[Email] Update preferences failed:", err);
    return res.status(500).json({ error: err.message || "Failed to update preferences" });
  }
});

/**
 * Get email preferences endpoint
 */
exports.getEmailPreferences = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const email = req.query.email || req.body?.email;
    if (!email) {
      return res.status(400).json({ error: "Missing required field: email" });
    }

    const prefs = await getEmailPrefs(email);

    return res.status(200).json({
      success: true,
      preferences: prefs,
      categories: [
        { key: "security", label: "Security Alerts", description: "Device verification, suspicious activity, 2FA changes, password reset", locked: true },
        { key: "staking", label: "Staking Notifications", description: "Stake/unstake confirmations, cooldown notices, reward claims" },
        { key: "referral", label: "Referral Updates", description: "New referral signups and referral reward notifications" },
        { key: "bridge", label: "Bridge Transfers", description: "Cross-chain bridge transfer completion notifications" },
        { key: "weeklyReport", label: "Weekly Report", description: "Weekly activity summary and portfolio overview" },
        { key: "lifecycle", label: "Onboarding & Tips", description: "Welcome emails, staking guides, and helpful tips" },
        { key: "announcements", label: "Announcements", description: "Platform updates and news from the Vision Chain team" },
      ],
    });
  } catch (err) {
    console.error("[Email] Get preferences failed:", err);
    return res.status(500).json({ error: err.message || "Failed to get preferences" });
  }
});

// =============================================================================
// EMAIL TEMPLATES - Weekly Activity Report
// =============================================================================

/**
 * Generate weekly activity report email HTML
 * @param {object} data - Aggregated weekly data
 * @return {Promise<string>} Complete HTML email
 */
async function generateWeeklyReportEmailHtml(data) {
  const custom = await loadCustomTemplate("weeklyReport");
  if (custom) {
    const vars = {
      weekRange: `${data.weekStart} - ${data.weekEnd}`,
      walletAddress: data.walletAddress || "N/A",
      vcnBalance: data.walletBalance || "0",
      stakingActions: String(data.stakingActions || 0),
      bridgeTransfers: String(data.bridgeTransfers || 0),
      newReferrals: String(data.newReferrals || 0),
    };
    const body = renderTemplate(custom.bodyHtml, vars);
    const subject = renderTemplate(custom.subject, vars);
    return emailBaseLayout(body, subject);
  }
  const {
    weekStart,
    weekEnd,
    stakingActions = 0,
    totalStaked = "0",
    totalUnstaked = "0",
    rewardsClaimed = "0",
    bridgeTransfers = 0,
    bridgeVolume = "0",
    newReferrals = 0,
    totalReferrals = 0,
    walletBalance = null,
  } = data;

  // Activity summary items
  const hasStaking = stakingActions > 0;
  const hasBridge = bridgeTransfers > 0;
  const hasReferrals = newReferrals > 0;
  const hasAnyActivity = hasStaking || hasBridge || hasReferrals;

  // Build staking section
  let stakingSection = "";
  if (hasStaking) {
    stakingSection = `
      ${emailComponents.sectionTitle("Staking Activity")}
      ${emailComponents.infoCard([
      ["Staking Actions", `${stakingActions}`, false],
      ...(totalStaked !== "0" ? [["Total Staked", `${totalStaked} VCN`, true]] : []),
      ...(totalUnstaked !== "0" ? [["Total Unstaked", `${totalUnstaked} VCN`, false]] : []),
      ...(rewardsClaimed !== "0" ? [["Rewards Claimed", `${rewardsClaimed} VCN`, true]] : []),
    ])}
    `;
  }

  // Build bridge section
  let bridgeSection = "";
  if (hasBridge) {
    bridgeSection = `
      ${emailComponents.divider()}
      ${emailComponents.sectionTitle("Bridge Transfers")}
      ${emailComponents.infoCard([
      ["Transfers", `${bridgeTransfers}`, false],
      ["Volume", `${bridgeVolume} VCN`, true],
    ], "#a855f7")}
    `;
  }

  // Build referral section
  let referralSection = "";
  if (hasReferrals) {
    referralSection = `
      ${emailComponents.divider()}
      ${emailComponents.sectionTitle("Referral Network")}
      ${emailComponents.infoCard([
      ["New Signups This Week", `+${newReferrals}`, true],
      ["Total Referrals", `${totalReferrals}`, false],
    ], "#22c55e")}
    `;
  }

  // No activity fallback
  let noActivitySection = "";
  if (!hasAnyActivity) {
    noActivitySection = `
      <div style="text-align:center;padding:24px 0;">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:12px;">
          <circle cx="24" cy="24" r="20" stroke="#333" stroke-width="2" fill="none"/>
          <path d="M24 14v12M24 30v2" stroke="#555" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <p style="margin:0;font-size:14px;color:#666;">No activity recorded this week.</p>
        <p style="margin:8px 0 0;font-size:12px;color:#555;">Start staking, bridging, or inviting friends to see your weekly stats here.</p>
      </div>
    `;
  }

  // Wallet balance section
  let balanceSection = "";
  if (walletBalance !== null) {
    balanceSection = `
      ${emailComponents.divider()}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr><td>
          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;">Current Balance</p>
          <p style="margin:0;font-size:28px;font-weight:800;color:#22d3ee;">${walletBalance} <span style="font-size:14px;color:#888;">VCN</span></p>
        </td></tr>
      </table>
    `;
  }

  const body = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
      <tr>
        <td>
          <h2 style="margin:0 0 4px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.3px;">Weekly Activity Report</h2>
          <p style="margin:0;font-size:12px;color:#666;">${weekStart} - ${weekEnd}</p>
        </td>
        <td align="right">
          ${emailComponents.statusBadge("Weekly", "success")}
        </td>
      </tr>
    </table>

    ${hasAnyActivity ? "" : noActivitySection}
    ${stakingSection}
    ${bridgeSection}
    ${referralSection}
    ${balanceSection}

    ${emailComponents.button("Open Wallet Dashboard", "https://visionchain.co/wallet")}

    <div style="text-align:center;margin:16px 0 0;">
      <p style="margin:0;font-size:11px;color:#444;">
        You're receiving this because you have weekly reports enabled.
        <a href="https://visionchain.co/wallet?tab=settings" style="color:#22d3ee;text-decoration:none;">Manage preferences</a>
      </p>
    </div>
  `;

  return emailBaseLayout(body, `Your Vision Chain weekly report: ${weekStart} - ${weekEnd}`);
}

/**
 * Weekly Activity Report - Scheduled Cloud Function
 * Runs every Monday at 9:00 AM KST (00:00 UTC)
 */
exports.weeklyActivityReport = onSchedule({
  schedule: "0 0 * * 1", // Every Monday at 00:00 UTC = 09:00 KST
  timeZone: "Asia/Seoul",
  secrets: ["EMAIL_USER", "EMAIL_APP_PASSWORD"],
}, async (event) => {
  console.log("[WeeklyReport] Starting weekly activity report job...");

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setHours(0, 0, 0, 0);
  const weekStart = new Date(weekEnd);
  weekStart.setDate(weekStart.getDate() - 7);

  const weekStartStr = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}-${String(weekStart.getDate()).padStart(2, "0")}`;
  const weekEndStr = `${weekEnd.getFullYear()}-${String(weekEnd.getMonth() + 1).padStart(2, "0")}-${String(weekEnd.getDate()).padStart(2, "0")}`;

  console.log(`[WeeklyReport] Period: ${weekStartStr} ~ ${weekEndStr}`);

  try {
    // Get all users with wallets
    const usersSnap = await db.collection("users")
      .where("walletReady", "==", true)
      .get();

    console.log(`[WeeklyReport] Found ${usersSnap.size} users with wallets`);

    let sentCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnap.docs) {
      const userEmail = userDoc.id;
      const userData = userDoc.data();
      const walletAddress = userData.walletAddress;

      try {
        // Check if user has weekly report enabled
        const optedIn = await checkEmailOptIn(userEmail, "weeklyReport");
        if (!optedIn) {
          skippedCount++;
          continue;
        }

        // Aggregate staking activity
        let stakingActions = 0;
        let totalStakedWei = BigInt(0);
        let totalUnstakedWei = BigInt(0);
        let rewardsClaimedWei = BigInt(0);

        // Query notifications for staking events in the past week
        const notifSnap = await db.collection("users").doc(userEmail)
          .collection("notifications")
          .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(weekStart))
          .where("timestamp", "<=", admin.firestore.Timestamp.fromDate(weekEnd))
          .get();

        for (const notifDoc of notifSnap.docs) {
          const notif = notifDoc.data();
          const notifType = (notif.type || "").toLowerCase();

          if (notifType.includes("stake") && !notifType.includes("unstake")) {
            stakingActions++;
            if (notif.amount) {
              try {
                totalStakedWei += BigInt(notif.amount);
              } catch (_e) {
                // ignore parse errors
              }
            }
          } else if (notifType.includes("unstake")) {
            stakingActions++;
            if (notif.amount) {
              try {
                totalUnstakedWei += BigInt(notif.amount);
              } catch (_e) {
                // ignore
              }
            }
          } else if (notifType.includes("claim") || notifType.includes("reward")) {
            stakingActions++;
            if (notif.amount) {
              try {
                rewardsClaimedWei += BigInt(notif.amount);
              } catch (_e) {
                // ignore
              }
            }
          }
        }

        // Aggregate bridge activity
        let bridgeTransfers = 0;
        let bridgeVolumeWei = BigInt(0);

        if (walletAddress) {
          // Check bridge_intents for this user
          const bridgeSnap = await db.collection("bridge_intents")
            .where("sender", "==", walletAddress.toLowerCase())
            .where("bridgeStatus", "==", "DELIVERED")
            .get();

          for (const bDoc of bridgeSnap.docs) {
            const bData = bDoc.data();
            const bTime = bData.executedAt?.toDate?.() || bData.createdAt?.toDate?.();
            if (bTime && bTime >= weekStart && bTime <= weekEnd) {
              bridgeTransfers++;
              if (bData.amount) {
                try {
                  bridgeVolumeWei += BigInt(bData.amount);
                } catch (_e) {
                  // ignore
                }
              }
            }
          }
        }

        // Aggregate referral activity
        let newReferrals = 0;
        const totalReferrals = userData.referralCount || 0;

        // Check users collection for referrals that joined this week
        if (userData.referralCode) {
          const refSnap = await db.collection("users")
            .where("referrerId", "==", userEmail)
            .get();

          for (const rDoc of refSnap.docs) {
            const rData = rDoc.data();
            const joinDate = rData.createdAt ? new Date(rData.createdAt) : null;
            if (joinDate && joinDate >= weekStart && joinDate <= weekEnd) {
              newReferrals++;
            }
          }
        }

        // Get wallet balance (optional, may fail)
        let walletBalance = null;
        if (walletAddress) {
          try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, provider);
            const balance = await tokenContract.balanceOf(walletAddress);
            walletBalance = parseFloat(ethers.formatEther(balance)).toFixed(2);
          } catch (e) {
            // Balance fetch is optional, don't block
          }
        }

        const hasAnyActivity = stakingActions > 0 || bridgeTransfers > 0 || newReferrals > 0;

        // Skip users with no activity and no balance (to avoid spamming inactive users)
        if (!hasAnyActivity && !walletBalance) {
          skippedCount++;
          continue;
        }

        // Format amounts
        const formatVCN = (wei) => {
          if (wei === BigInt(0)) return "0";
          return parseFloat(ethers.formatEther(wei)).toFixed(2);
        };

        // Generate and send email
        const emailHtml = await generateWeeklyReportEmailHtml({
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          stakingActions,
          totalStaked: formatVCN(totalStakedWei),
          totalUnstaked: formatVCN(totalUnstakedWei),
          rewardsClaimed: formatVCN(rewardsClaimedWei),
          bridgeTransfers,
          bridgeVolume: formatVCN(bridgeVolumeWei),
          newReferrals,
          totalReferrals,
          walletBalance,
        });

        await sendSecurityEmail(
          userEmail,
          `Vision Chain - Weekly Report (${weekStartStr})`,
          emailHtml,
        );

        sentCount++;
        console.log(`[WeeklyReport] Sent to ${userEmail}`);
      } catch (userErr) {
        console.warn(`[WeeklyReport] Failed for ${userEmail}:`, userErr.message);
        skippedCount++;
      }
    }

    console.log(`[WeeklyReport] Complete: ${sentCount} sent, ${skippedCount} skipped`);
  } catch (err) {
    console.error("[WeeklyReport] Job failed:", err);
  }
});

// =============================================================================
// BRIDGE RELAYER - Manual Trigger (For Testing)
// =============================================================================
exports.triggerBridgeRelayer = onRequest({ cors: true, invoker: "public", secrets: ["SEPOLIA_RELAYER_PK", "VCN_EXECUTOR_PK", "EMAIL_USER", "EMAIL_APP_PASSWORD"] }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).send("");
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST required" });
  }

  console.log("[Bridge Relayer] Manual trigger initiated");

  try {
    const cutoffTime = new Date(Date.now() - (CHALLENGE_PERIOD_MINUTES * 60 * 1000));
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffTime);

    const pendingBridges = await db.collection("bridgeTransactions")
      .where("status", "==", "COMMITTED")
      .where("createdAt", "<=", cutoffTimestamp)
      .limit(10)
      .get();

    if (pendingBridges.empty) {
      return res.status(200).json({
        success: true,
        message: "No pending bridges to process",
        processed: 0,
      });
    }

    const results = [];

    for (const docSnap of pendingBridges.docs) {
      const bridge = docSnap.data();
      const bridgeId = docSnap.id;

      try {
        await docSnap.ref.update({ status: "PROCESSING" });

        const destChainId = bridge.dstChainId;
        let destTxHash;

        if (destChainId === SEPOLIA_CHAIN_ID) {
          destTxHash = await executeSepoliaBridgeTransfer(bridge);
        } else {
          destTxHash = await executeVisionChainBridgeTransfer(bridge);
        }

        await docSnap.ref.update({
          status: "COMPLETED",
          completedAt: admin.firestore.Timestamp.now(),
          destinationTxHash: destTxHash,
        });

        results.push({ bridgeId, status: "COMPLETED", txHash: destTxHash });
      } catch (err) {
        await docSnap.ref.update({
          status: "FAILED",
          errorMessage: err.message,
        });

        results.push({ bridgeId, status: "FAILED", error: err.message });
      }
    }

    return res.status(200).json({
      success: true,
      message: `Processed ${results.length} bridges`,
      processed: results.length,
      results: results,
    });
  } catch (err) {
    console.error("[Bridge Relayer] Manual trigger error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SECURE BRIDGE RELAYER (Phase 1 - Optimistic Security Model)
// ============================================================

// Secure Bridge Contract Addresses (Vision Chain) - Phase 1 Security
// eslint-disable-next-line no-unused-vars
const _SECURE_INTENT_COMMITMENT = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
const SECURE_MESSAGE_INBOX = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318";
// eslint-disable-next-line no-unused-vars
const _SECURE_VISION_BRIDGE = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
const VCN_TOKEN_SEPOLIA = "0x07755968236333B5f8803E9D0fC294608B200d1b";

// MessageInbox ABI
const MESSAGE_INBOX_ABI = [
  "function submitPending(bytes32 intentHash, address sender, address recipient, uint256 amount, uint256 srcChainId, uint256 nonce) external returns (bytes32)",
  "function finalize(bytes32 messageId) external returns (bool)",
  "function canFinalize(bytes32 messageId) view returns (bool)",
  "function getMessage(bytes32 messageId) view returns (tuple(bytes32 intentHash, address sender, address recipient, uint256 amount, uint256 srcChainId, uint256 dstChainId, uint256 nonce, uint256 submittedAt, uint256 challengePeriodEnd, uint8 status, address challenger, string challengeReason))",
];

// VCN Token Sepolia ABI
const VCN_TOKEN_SEPOLIA_ABI = [
  "function bridgeMint(address to, uint256 amount, bytes32 bridgeId) external",
  "function balanceOf(address account) view returns (uint256)",
];

/**
 * Secure Bridge Relayer - Submits VCN lock events to destination chain as PENDING
 * Then finalizes after challenge period
 *
 * Flow:
 * 1. Watch for VCNLocked events on Vision Chain
 * 2. Submit as PENDING on destination MessageInbox
 * 3. Wait for challenge period
 * 4. Finalize and mint on destination
 */
exports.secureBridgeRelayer = onSchedule({
  schedule: "every 2 minutes",
  secrets: ["SEPOLIA_RELAYER_PK", "VCN_EXECUTOR_PK", "EMAIL_USER", "EMAIL_APP_PASSWORD"],
}, async () => {
  console.log("[Secure Bridge] Starting optimistic bridge relayer...");

  try {
    // 1. Find pending secure bridge transactions
    const pendingBridges = await db.collection("transactions")
      .where("type", "==", "Bridge")
      .where("bridgeStatus", "in", ["PENDING", "SUBMITTED"])
      .orderBy("timestamp", "asc")
      .limit(10)
      .get();

    console.log(`[Secure Bridge] Found ${pendingBridges.size} bridges to process`);

    for (const docSnap of pendingBridges.docs) {
      const txData = docSnap.data();
      const txId = docSnap.id;

      try {
        const currentStatus = txData.bridgeStatus;
        const challengeEndTime = txData.challengeEndTime || 0;

        // PENDING -> Submit to MessageInbox as PENDING
        if (currentStatus === "PENDING") {
          console.log(`[Secure Bridge] Submitting ${txId} to MessageInbox...`);

          const messageId = await submitToMessageInbox(txData);

          await docSnap.ref.update({
            bridgeStatus: "SUBMITTED",
            messageId: messageId,
            submittedAt: admin.firestore.Timestamp.now(),
          });

          console.log(`[Secure Bridge] ${txId} submitted. MessageID: ${messageId}`);
        } else if (currentStatus === "SUBMITTED" && Date.now() >= challengeEndTime) {
          // SUBMITTED -> Check if challenge period ended, then finalize
          console.log(`[Secure Bridge] Finalizing ${txId}...`);

          const messageId = txData.messageId;
          const destTxHash = await finalizeAndMint(txData, messageId);

          await docSnap.ref.update({
            bridgeStatus: "COMPLETED",
            destinationTxHash: destTxHash,
            completedAt: admin.firestore.Timestamp.now(),
          });

          console.log(`[Secure Bridge] ${txId} completed. Dest TX: ${destTxHash}`);

          // Send notification - both email and Firestore
          try {
            const destChain = (txData.metadata?.dstChainId || SEPOLIA_CHAIN_ID) === SEPOLIA_CHAIN_ID ?
              "Ethereum Sepolia" : "Vision Chain";
            const bridgeRecipient = txData.recipient || txData.from_addr;

            // Always save History record
            await db.collection("transactions").doc(`sepolia_${destTxHash}`).set({
              hash: destTxHash,
              from_addr: `bridge:${destChain === "Ethereum Sepolia" ? "vision-chain" : "sepolia"}`,
              to_addr: bridgeRecipient.toLowerCase(),
              value: txData.value,
              timestamp: Date.now(),
              type: "Bridge Receive",
              bridgeStatus: "COMPLETED",
              sourceTxHash: txId,
              recipient: bridgeRecipient.toLowerCase(),
              metadata: {
                sourceChain: destChain === "Ethereum Sepolia" ? "Vision Chain" : "Sepolia",
                destinationChain: destChain,
                srcChainId: txData.metadata?.srcChainId || 1337,
                dstChainId: txData.metadata?.dstChainId || SEPOLIA_CHAIN_ID,
                sender: (txData.from_addr || "").toLowerCase(),
              },
            });
            console.log(`[Secure Bridge] History record saved`);

            // Notify sender
            const senderEmail = await getBridgeUserEmail(txData.from_addr);
            if (senderEmail) {
              await sendBridgeCompleteEmail(senderEmail, {
                amount: ethers.parseEther(txData.value || "0").toString(),
                recipient: txData.from_addr,
                dstChainId: txData.metadata?.dstChainId || SEPOLIA_CHAIN_ID,
              }, destTxHash);

              await db.collection("users").doc(senderEmail).collection("notifications").add({
                email: senderEmail,
                type: "bridge_complete",
                title: "Bridge Transfer Complete",
                content: `${txData.value} VCN successfully bridged to ${destChain}.`,
                data: {
                  amount: txData.value,
                  destinationChain: destChain,
                  sourceTxHash: txId,
                  destinationTxHash: destTxHash,
                  status: "completed",
                },
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false,
              });
              console.log(`[Secure Bridge] Sender notification created for ${senderEmail}`);
            }

            // Notify recipient if different from sender
            if (bridgeRecipient.toLowerCase() !== txData.from_addr.toLowerCase()) {
              const recipientEmail = await getBridgeUserEmail(bridgeRecipient);
              if (recipientEmail) {
                await sendBridgeCompleteEmail(recipientEmail, {
                  amount: ethers.parseEther(txData.value || "0").toString(),
                  recipient: bridgeRecipient,
                  dstChainId: txData.metadata?.dstChainId || SEPOLIA_CHAIN_ID,
                }, destTxHash);

                await db.collection("users").doc(recipientEmail).collection("notifications").add({
                  email: recipientEmail,
                  type: "bridge_receive",
                  title: "Bridge Transfer Received",
                  content: `You received ${txData.value} VCN via cross-chain bridge.`,
                  data: {
                    amount: txData.value,
                    destinationChain: destChain,
                    sourceTxHash: txId,
                    destinationTxHash: destTxHash,
                    status: "completed",
                  },
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  read: false,
                });
                console.log(`[Secure Bridge] Recipient notification sent to ${recipientEmail}`);
              }
            }
          } catch (notifyErr) {
            console.warn("[Secure Bridge] Notification failed:", notifyErr.message);
          }
        }
      } catch (bridgeErr) {
        console.error(`[Secure Bridge] Error processing ${txId}:`, bridgeErr);

        await docSnap.ref.update({
          bridgeStatus: "FAILED",
          errorMessage: bridgeErr.message,
          failedAt: admin.firestore.Timestamp.now(),
        });
      }
    }

    console.log("[Secure Bridge] Relayer run completed");
  } catch (err) {
    console.error("[Secure Bridge] Critical error:", err);
  }
});

/**
 * Submit lock event to destination chain's MessageInbox
 * @param {object} txData - Transaction data from Firestore
 * @return {Promise<string>} Message ID
 */
async function submitToMessageInbox(txData) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

  const messageInbox = new ethers.Contract(SECURE_MESSAGE_INBOX, MESSAGE_INBOX_ABI, wallet);

  const intentHash = txData.intentHash || ethers.keccak256(ethers.toUtf8Bytes(txData.hash));
  const sender = txData.from_addr;
  const recipient = txData.from_addr; // Same as sender for now
  const amount = ethers.parseEther(txData.value || "0");
  const srcChainId = txData.metadata?.srcChainId || 1337; // Vision Chain
  const nonce = Date.now(); // Simple nonce for now

  console.log(`[Secure Bridge] Submitting: sender=${sender}, amount=${ethers.formatEther(amount)} VCN`);

  const tx = await messageInbox.submitPending(intentHash, sender, recipient, amount, srcChainId, nonce);
  const receipt = await tx.wait();

  // Extract messageId from event
  const messageSubmittedTopic = ethers.id("MessageSubmitted(bytes32,bytes32,address,address,uint256,uint256)");
  const log = receipt.logs.find((l) => l.topics[0] === messageSubmittedTopic);

  let messageId = ethers.ZeroHash;
  if (log) {
    messageId = log.topics[1];
  }

  return messageId;
}

/**
 * Finalize a pending message and mint tokens on destination
 * @param {object} txData - Transaction data from Firestore
 * @param {string} messageId - Message ID from MessageInbox
 * @return {Promise<string>} Destination transaction hash
 */
async function finalizeAndMint(txData, messageId) {
  const dstChainId = txData.metadata?.dstChainId || SEPOLIA_CHAIN_ID;

  if (dstChainId === SEPOLIA_CHAIN_ID) {
    // Finalize on Vision Chain's MessageInbox, then mint on Sepolia
    const visionProvider = new ethers.JsonRpcProvider(RPC_URL);
    const visionWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, visionProvider);

    const messageInbox = new ethers.Contract(SECURE_MESSAGE_INBOX, MESSAGE_INBOX_ABI, visionWallet);

    // Check if can finalize
    const canFinalize = await messageInbox.canFinalize(messageId);
    if (!canFinalize) {
      throw new Error("Cannot finalize yet - challenge period not ended or already finalized");
    }

    // Finalize
    const finalizeTx = await messageInbox.finalize(messageId);
    await finalizeTx.wait();
    console.log("[Secure Bridge] Finalized on Vision Chain");

    // Now mint on Sepolia
    if (!SEPOLIA_RELAYER_PK) {
      throw new Error("SEPOLIA_RELAYER_PK not configured");
    }

    const sepoliaProvider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
    const sepoliaWallet = new ethers.Wallet(SEPOLIA_RELAYER_PK, sepoliaProvider);

    const vcnToken = new ethers.Contract(VCN_TOKEN_SEPOLIA, VCN_TOKEN_SEPOLIA_ABI, sepoliaWallet);

    const amount = ethers.parseEther(txData.value || "0");
    const recipient = txData.from_addr;
    const bridgeId = messageId;

    const mintTx = await vcnToken.bridgeMint(recipient, amount, bridgeId, { gasLimit: 100000 });
    await mintTx.wait();

    console.log(`[Secure Bridge] Minted ${ethers.formatEther(amount)} VCN on Sepolia. TX: ${mintTx.hash}`);

    // Record execution
    await db.collection("bridgeExecutions").add({
      bridgeId: txData.hash,
      messageId: messageId,
      type: "SECURE_BRIDGE_MINT",
      srcChainId: 1337,
      dstChainId: SEPOLIA_CHAIN_ID,
      amount: amount.toString(),
      recipient: recipient,
      finalizeTxHash: finalizeTx.hash,
      mintTxHash: mintTx.hash,
      executedAt: admin.firestore.Timestamp.now(),
    });

    return mintTx.hash;
  } else {
    // Reverse bridge: Finalize on Sepolia, unlock on Vision Chain
    // This would be for burning VCN on Sepolia → unlocking on Vision Chain
    throw new Error("Reverse bridge (Sepolia → Vision) not yet implemented");
  }
}

/**
 * Manual trigger for secure bridge relayer (for testing)
 */
exports.triggerSecureBridgeRelayer = onRequest({ cors: true }, async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).send("");

  console.log("[Secure Bridge] Manual trigger initiated");

  try {
    const { action, txHash, messageId } = req.body || {};

    if (action === "status") {
      // Get status of a specific bridge
      const docSnap = await db.collection("transactions").doc(txHash).get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      return res.status(200).json({ success: true, data: docSnap.data() });
    }

    if (action === "force_finalize" && messageId) {
      // Force finalize a specific message
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const wallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
      const messageInbox = new ethers.Contract(SECURE_MESSAGE_INBOX, MESSAGE_INBOX_ABI, wallet);

      const msg = await messageInbox.getMessage(messageId);
      const canFinalize = await messageInbox.canFinalize(messageId);

      return res.status(200).json({
        success: true,
        messageId,
        canFinalize,
        message: {
          intentHash: msg.intentHash,
          sender: msg.sender,
          recipient: msg.recipient,
          amount: msg.amount.toString(),
          status: msg.status,
          challengePeriodEnd: new Date(Number(msg.challengePeriodEnd) * 1000).toISOString(),
        },
      });
    }

    // Default: run the relayer
    const pendingBridges = await db.collection("transactions")
      .where("type", "==", "Bridge")
      .where("bridgeStatus", "in", ["PENDING", "SUBMITTED"])
      .limit(10)
      .get();

    const results = [];

    for (const docSnap of pendingBridges.docs) {
      const txData = docSnap.data();
      results.push({
        id: docSnap.id,
        status: txData.bridgeStatus,
        value: txData.value,
        challengeEndTime: txData.challengeEndTime,
        isReady: Date.now() >= (txData.challengeEndTime || 0),
      });
    }

    return res.status(200).json({
      success: true,
      message: `Found ${results.length} pending bridges`,
      bridges: results,
    });
  } catch (err) {
    console.error("[Secure Bridge] Manual trigger error:", err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * Get bridge status and challenge period info
 */
exports.getBridgeStatus = onRequest({ cors: true }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(204).send("");

  const { txHash, messageId } = req.query;

  try {
    if (txHash) {
      const docSnap = await db.collection("transactions").doc(txHash).get();
      if (!docSnap.exists) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      const data = docSnap.data();
      const challengeEndTime = data.challengeEndTime || 0;
      const now = Date.now();

      return res.status(200).json({
        success: true,
        txHash,
        status: data.bridgeStatus,
        value: data.value,
        challengePeriod: {
          endTime: challengeEndTime,
          endTimeISO: new Date(challengeEndTime).toISOString(),
          remainingMs: Math.max(0, challengeEndTime - now),
          remainingMinutes: Math.max(0, Math.ceil((challengeEndTime - now) / 60000)),
          isEnded: now >= challengeEndTime,
        },
        messageId: data.messageId,
        destinationTxHash: data.destinationTxHash,
      });
    }

    if (messageId) {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const messageInbox = new ethers.Contract(SECURE_MESSAGE_INBOX, MESSAGE_INBOX_ABI, provider);

      const msg = await messageInbox.getMessage(messageId);
      const canFinalize = await messageInbox.canFinalize(messageId);

      return res.status(200).json({
        success: true,
        messageId,
        canFinalize,
        onChainData: {
          intentHash: msg.intentHash,
          sender: msg.sender,
          recipient: msg.recipient,
          amount: msg.amount.toString(),
          amountFormatted: ethers.formatEther(msg.amount),
          status: ["NONE", "PENDING", "CHALLENGED", "FINALIZED", "REVERTED", "EXPIRED"][msg.status] || "UNKNOWN",
          challengePeriodEnd: Number(msg.challengePeriodEnd),
          challengePeriodEndISO: new Date(Number(msg.challengePeriodEnd) * 1000).toISOString(),
        },
      });
    }

    return res.status(400).json({ error: "Provide either txHash or messageId" });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// =============================================================================
// CEX INTEGRATION - Encrypted API Key Management + Portfolio Sync
// =============================================================================
// Security Model:
//   - API Keys are encrypted with AES-256-GCM using a SEPARATE master key
//   - Decryption ONLY happens server-side within Cloud Functions
//   - Client never receives raw API Keys; only metadata is returned
//   - Only balance-read permission is required from exchanges
// =============================================================================

// VPC Connector config for static IP egress (34.22.69.189)
// Only applies in production where cex-vpc-connector exists
const isProduction = (process.env.GCLOUD_PROJECT || "") === "visionchain-d19ed";
const cexFunctionConfig = {
  region: "asia-northeast3",
  ...(isProduction ? {
    vpcConnector: "cex-vpc-connector",
    vpcConnectorEgressSettings: "ALL_TRAFFIC",
  } : {}),
};

// Lazy load CEX dependencies
let jwt = null;
let uuidv4 = null;
let axios = null;

/**
 * Lazy load jsonwebtoken
 * @return {object} JWT module
 */
function getJwt() {
  if (!jwt) jwt = require("jsonwebtoken");
  return jwt;
}

/**
 * Lazy load uuid v4
 * @return {Function} uuidv4 function
 */
function getUuidv4() {
  if (!uuidv4) {
    const { v4 } = require("uuid");
    uuidv4 = v4;
  }
  return uuidv4;
}

/**
 * Lazy load axios
 * @return {object} Axios module
 */
function getAxios() {
  if (!axios) axios = require("axios");
  return axios;
}

// --- CEX Encryption (separate key from wallet encryption) ---
const CEX_ENCRYPTION_KEY = process.env.CEX_ENCRYPTION_KEY ||
  "vcn-cex-key-2026-very-secure-32b"; // MUST be 32 bytes for AES-256

/**
 * CEX API Key AES-256-GCM encryption
 * @param {string} plainText - Raw API key to encrypt
 * @return {{encrypted: string, iv: string, authTag: string}} Encrypted data
 */
function cexEncrypt(plainText) {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(CEX_ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(plainText, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag().toString("base64");

  return {
    encrypted,
    iv: iv.toString("base64"),
    authTag,
  };
}

/**
 * CEX API Key AES-256-GCM decryption
 * @param {string} encryptedData - Base64 encrypted data
 * @param {string} ivBase64 - Base64 IV
 * @param {string} authTagBase64 - Base64 auth tag
 * @return {string} Decrypted plaintext
 */
function cexDecrypt(encryptedData, ivBase64, authTagBase64) {
  const key = Buffer.from(CEX_ENCRYPTION_KEY.padEnd(32, "0").slice(0, 32));
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivBase64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(authTagBase64, "base64"));

  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// =============================================================================
// CEX API CLIENTS - Upbit & Bithumb
// =============================================================================

class UpbitClient {
  /**
   * @param {string} accessKey
   * @param {string} secretKey
   */
  constructor(accessKey, secretKey) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.baseUrl = "https://api.upbit.com/v1";
  }

  /**
   * Generate Upbit JWT token
   * @param {string|null} queryString
   * @return {string} JWT token
   */
  _generateToken(queryString = null) {
    const jwtLib = getJwt();
    const uuid = getUuidv4();
    const payload = {
      access_key: this.accessKey,
      nonce: uuid(),
      timestamp: Date.now(),
    };
    if (queryString) {
      const queryHash = crypto.createHash("sha512")
        .update(queryString, "utf-8").digest("hex");
      payload.query_hash = queryHash;
      payload.query_hash_alg = "SHA512";
    }
    return jwtLib.sign(payload, this.secretKey);
  }

  /**
   * Get account balances
   * @return {Promise<Array>} Account balances
   */
  async getAccounts() {
    const http = getAxios();
    const token = this._generateToken();
    const response = await http.get(`${this.baseUrl}/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });
    return response.data;
  }

  /**
   * Get current tickers for given markets
   * @param {string[]} markets e.g. ["KRW-BTC", "KRW-ETH"]
   * @return {Promise<Array>} Ticker data
   */
  async getTickers(markets) {
    const http = getAxios();
    const query = `markets=${markets.join(",")}`;
    const response = await http.get(
      `${this.baseUrl}/ticker?${query}`,
      { timeout: 10000 },
    );
    return response.data;
  }
}

class BithumbClient {
  /**
   * @param {string} accessKey
   * @param {string} secretKey
   */
  constructor(accessKey, secretKey) {
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.baseUrl = "https://api.bithumb.com";
  }

  /**
   * Generate Bithumb JWT token (API v2)
   * @return {string} JWT token
   */
  _generateToken() {
    const jwtLib = getJwt();
    const uuid = getUuidv4();
    const payload = {
      access_key: this.accessKey,
      nonce: uuid(),
      timestamp: Date.now(),
    };
    return jwtLib.sign(payload, this.secretKey);
  }

  /**
   * Get account balances (Bithumb Open API v2)
   * @return {Promise<Array>} Account balances
   */
  async getAccounts() {
    const http = getAxios();
    const token = this._generateToken();
    const response = await http.get(
      `${this.baseUrl}/v2/accounts`, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    },
    );
    // Normalize to Upbit-compatible format
    const data = response.data;
    if (data && Array.isArray(data)) return data;
    if (data && data.data && Array.isArray(data.data)) return data.data;
    return [];
  }

  /**
   * Get current tickers
   * @param {string[]} markets e.g. ["KRW-BTC"]
   * @return {Promise<Array>} Ticker data
   */
  async getTickers(markets) {
    const http = getAxios();
    const query = `markets=${markets.join(",")}`;
    const response = await http.get(
      `${this.baseUrl}/v2/ticker?${query}`,
      { timeout: 10000 },
    );
    const data = response.data;
    if (Array.isArray(data)) return data;
    if (data && data.data && Array.isArray(data.data)) return data.data;
    return [];
  }
}

/**
 * Validate a CEX API key by attempting a balance query
 * @param {string} exchange 'upbit' | 'bithumb'
 * @param {string} accessKey
 * @param {string} secretKey
 * @return {Promise<{success: boolean, error?: string}>}
 */
async function validateCexApiKey(exchange, accessKey, secretKey) {
  try {
    const client = exchange === "upbit" ?
      new UpbitClient(accessKey, secretKey) :
      new BithumbClient(accessKey, secretKey);
    await client.getAccounts();
    return { success: true };
  } catch (error) {
    const status = error.response?.status;
    const msg = error.response?.data?.error?.message || error.message;
    if (status === 401) return { success: false, error: "Invalid API key or secret." };
    if (status === 403) return { success: false, error: "Insufficient API permissions. Please enable balance read access." };
    return { success: false, error: `Validation failed: ${msg}` };
  }
}

// =============================================================================
// PORTFOLIO SYNC ENGINE
// =============================================================================

/**
 * Perform portfolio sync for a single credential
 * @param {string} uid - Firebase user ID
 * @param {string} credentialId - Credential document ID
 * @return {Promise<object>} Snapshot data
 */
async function performCexSync(uid, credentialId) {
  const credDoc = await db.doc(`users/${uid}/cex_credentials/${credentialId}`).get();
  if (!credDoc.exists) throw new Error("Credential not found.");
  const cred = credDoc.data();

  // Decrypt keys
  const accessKey = cexDecrypt(
    cred.encryptedAccessKey, cred.accessKeyIv, cred.accessKeyAuthTag,
  );
  const secretKey = cexDecrypt(
    cred.encryptedSecretKey, cred.secretKeyIv, cred.secretKeyAuthTag,
  );

  // Create exchange client
  const client = cred.exchange === "upbit" ?
    new UpbitClient(accessKey, secretKey) :
    new BithumbClient(accessKey, secretKey);

  const startTime = Date.now();

  // 1. Fetch balances
  const accounts = await client.getAccounts();

  // 2. Filter non-zero assets
  const nonZeroAssets = accounts.filter((a) =>
    parseFloat(a.balance || "0") > 0 || parseFloat(a.locked || "0") > 0,
  );

  // 3. Fetch tickers for KRW-paired markets
  const markets = nonZeroAssets
    .filter((a) => a.currency !== "KRW")
    .map((a) => `KRW-${a.currency}`);

  let tickers = [];
  if (markets.length > 0) {
    try {
      tickers = await client.getTickers(markets);
    } catch (tickerErr) {
      console.warn(`[CEX] Ticker fetch partial failure:`, tickerErr.message);
    }
  }

  const tickerMap = {};
  tickers.forEach((t) => {
    const currency = (t.market || "").replace("KRW-", "");
    tickerMap[currency] = t;
  });

  // 4. USD/KRW rate (simple estimation; can upgrade to real-time API later)
  const USD_KRW_RATE = 1400;

  // 5. Build asset list
  let totalValueKrw = 0;
  const assets = nonZeroAssets.map((a) => {
    const balance = parseFloat(a.balance || "0");
    const locked = parseFloat(a.locked || "0");
    const avgBuyPrice = parseFloat(a.avg_buy_price || a.average_purchase_price || "0");
    const totalBalance = balance + locked;

    let currentPriceKrw = 0;
    if (a.currency === "KRW") {
      currentPriceKrw = 1;
    } else if (tickerMap[a.currency]) {
      currentPriceKrw = tickerMap[a.currency].trade_price ||
        tickerMap[a.currency].closing_price || 0;
    }

    const valueKrw = totalBalance * currentPriceKrw;
    const valueUsd = valueKrw / USD_KRW_RATE;
    const costBasis = totalBalance * avgBuyPrice;
    const profitLoss = a.currency === "KRW" ? 0 : (valueKrw - costBasis);
    const profitLossPercent = (a.currency !== "KRW" && costBasis > 0) ?
      ((valueKrw - costBasis) / costBasis) * 100 : 0;

    totalValueKrw += valueKrw;

    return {
      currency: a.currency,
      balance: totalBalance,
      locked,
      avgBuyPrice,
      currentPrice: currentPriceKrw,
      currentPriceUsd: currentPriceKrw / USD_KRW_RATE,
      valueKrw,
      valueUsd,
      profitLoss,
      profitLossPercent,
      allocationPercent: 0,
    };
  });

  // Calculate allocation
  assets.forEach((a) => {
    a.allocationPercent = totalValueKrw > 0 ?
      (a.valueKrw / totalValueKrw) * 100 : 0;
  });

  // Sort by value descending
  assets.sort((a, b) => b.valueKrw - a.valueKrw);

  const totalProfitLoss = assets
    .filter((a) => a.currency !== "KRW")
    .reduce((sum, a) => sum + a.profitLoss, 0);
  const totalCostBasis = assets
    .filter((a) => a.currency !== "KRW")
    .reduce((sum, a) => sum + (a.balance * a.avgBuyPrice), 0);

  // 6. Save snapshot (overwrite per credentialId)
  const snapshotData = {
    exchange: cred.exchange,
    credentialId,
    assets,
    totalValueKrw,
    totalValueUsd: totalValueKrw / USD_KRW_RATE,
    totalProfitLoss,
    totalProfitLossPercent: totalCostBasis > 0 ?
      (totalProfitLoss / totalCostBasis) * 100 : 0,
    snapshotAt: admin.firestore.FieldValue.serverTimestamp(),
    syncDurationMs: Date.now() - startTime,
  };

  await db.doc(`users/${uid}/cex_snapshots/${credentialId}`).set(snapshotData);

  // 7. Update credential status
  await credDoc.ref.update({
    lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSyncStatus: "success",
    status: "active",
    statusMessage: "",
  });

  return snapshotData;
}

// =============================================================================
// CEX CLOUD FUNCTIONS (onCall)
// =============================================================================

/**
 * Register a new CEX API key
 * Validates the key against the exchange, encrypts it, and stores it.
 */
exports.registerCexApiKey = onCall({
  ...cexFunctionConfig,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  const userEmail = request.auth.token?.email?.toLowerCase();
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "Email not found in auth token.");
  }

  const { exchange, accessKey, secretKey, label } = request.data;

  // Input validation
  if (!["upbit", "bithumb"].includes(exchange)) {
    throw new HttpsError("invalid-argument", "Unsupported exchange. Use 'upbit' or 'bithumb'.");
  }
  if (!accessKey || typeof accessKey !== "string" || accessKey.trim().length < 10) {
    throw new HttpsError("invalid-argument", "Invalid Access Key.");
  }
  if (!secretKey || typeof secretKey !== "string" || secretKey.trim().length < 10) {
    throw new HttpsError("invalid-argument", "Invalid Secret Key.");
  }

  // Check max credentials (4 per user)
  const existing = await db.collection(`users/${userEmail}/cex_credentials`).get();
  if (existing.size >= 4) {
    throw new HttpsError("resource-exhausted", "Maximum 4 API keys allowed per account.");
  }

  // Validate key against exchange
  console.log(`[CEX] Validating ${exchange} API key for user ${userEmail}`);
  const validation = await validateCexApiKey(exchange, accessKey.trim(), secretKey.trim());
  if (!validation.success) {
    throw new HttpsError("invalid-argument", validation.error);
  }

  // Encrypt and store
  const encAccess = cexEncrypt(accessKey.trim());
  const encSecret = cexEncrypt(secretKey.trim());

  const docRef = await db.collection(`users/${userEmail}/cex_credentials`).add({
    exchange,
    encryptedAccessKey: encAccess.encrypted,
    accessKeyIv: encAccess.iv,
    accessKeyAuthTag: encAccess.authTag,
    encryptedSecretKey: encSecret.encrypted,
    secretKeyIv: encSecret.iv,
    secretKeyAuthTag: encSecret.authTag,
    label: label || `My ${exchange.charAt(0).toUpperCase() + exchange.slice(1)}`,
    permissions: ["balance"],
    status: "active",
    statusMessage: "",
    registeredAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSyncAt: null,
    lastSyncStatus: null,
  });

  console.log(`[CEX] Registered ${exchange} key ${docRef.id} for user ${userEmail}`);

  // Trigger initial sync
  try {
    await performCexSync(userEmail, docRef.id);
    console.log(`[CEX] Initial sync completed for ${docRef.id}`);
  } catch (syncErr) {
    console.warn(`[CEX] Initial sync failed for ${docRef.id}:`, syncErr.message);
  }

  return {
    success: true,
    credentialId: docRef.id,
    exchange,
    label: label || `My ${exchange.charAt(0).toUpperCase() + exchange.slice(1)}`,
  };
});

/**
 * Delete a CEX API key and all related snapshots
 */
exports.deleteCexApiKey = onCall({
  ...cexFunctionConfig,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  const userEmail = request.auth.token?.email?.toLowerCase();
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "Email not found in auth token.");
  }
  const { credentialId } = request.data;

  if (!credentialId) {
    throw new HttpsError("invalid-argument", "credentialId is required.");
  }

  // Verify ownership
  const credDoc = await db.doc(`users/${userEmail}/cex_credentials/${credentialId}`).get();
  if (!credDoc.exists) {
    throw new HttpsError("not-found", "Credential not found.");
  }

  // Delete credential
  await credDoc.ref.delete();

  // Delete related snapshot
  const snapshotRef = db.doc(`users/${userEmail}/cex_snapshots/${credentialId}`);
  const snapshotDoc = await snapshotRef.get();
  if (snapshotDoc.exists) {
    await snapshotRef.delete();
  }

  console.log(`[CEX] Deleted credential ${credentialId} for user ${userEmail}`);
  return { success: true };
});

/**
 * List user's CEX API keys (metadata only, never raw keys)
 */
exports.listCexApiKeys = onCall({
  ...cexFunctionConfig,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  const userEmail = request.auth.token?.email?.toLowerCase();
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "Email not found in auth token.");
  }

  const snapshot = await db.collection(`users/${userEmail}/cex_credentials`)
    .orderBy("registeredAt", "desc").get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    exchange: doc.data().exchange,
    label: doc.data().label,
    status: doc.data().status,
    statusMessage: doc.data().statusMessage || "",
    permissions: doc.data().permissions || ["balance"],
    lastSyncAt: doc.data().lastSyncAt?.toDate?.()?.toISOString() || null,
    lastSyncStatus: doc.data().lastSyncStatus || null,
    registeredAt: doc.data().registeredAt?.toDate?.()?.toISOString() || null,
  }));
});

/**
 * Manually trigger portfolio sync for a specific credential
 */
exports.syncCexPortfolio = onCall({
  ...cexFunctionConfig,
  timeoutSeconds: 30,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  const userEmail = request.auth.token?.email?.toLowerCase();
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "Email not found in auth token.");
  }
  const { credentialId } = request.data;

  if (!credentialId) {
    throw new HttpsError("invalid-argument", "credentialId is required.");
  }

  // Verify ownership
  const credDoc = await db.doc(`users/${userEmail}/cex_credentials/${credentialId}`).get();
  if (!credDoc.exists) {
    throw new HttpsError("not-found", "Credential not found.");
  }

  try {
    const snapshot = await performCexSync(userEmail, credentialId);
    return { success: true, snapshot };
  } catch (error) {
    // Update credential status on failure
    await credDoc.ref.update({
      lastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
      lastSyncStatus: "error",
      statusMessage: error.message || "Sync failed",
    });
    throw new HttpsError("internal", `Portfolio sync failed: ${error.message}`);
  }
});

/**
 * Get aggregated portfolio from all connected exchanges
 */
exports.getCexPortfolio = onCall({
  ...cexFunctionConfig,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  const userEmail = request.auth.token?.email?.toLowerCase();
  if (!userEmail) {
    throw new HttpsError("unauthenticated", "Email not found in auth token.");
  }

  // Fetch all snapshots
  const snapshots = await db.collection(`users/${userEmail}/cex_snapshots`)
    .orderBy("snapshotAt", "desc").get();

  if (snapshots.empty) {
    return { portfolios: [], aggregated: null };
  }

  const portfolios = snapshots.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    snapshotAt: doc.data().snapshotAt?.toDate?.()?.toISOString() || null,
  }));

  // Aggregate across all exchanges
  const allAssets = {};
  let grandTotalKrw = 0;
  let grandTotalUsd = 0;

  portfolios.forEach((p) => {
    grandTotalKrw += p.totalValueKrw || 0;
    grandTotalUsd += p.totalValueUsd || 0;
    (p.assets || []).forEach((a) => {
      if (a.currency === "KRW") return;
      if (!allAssets[a.currency]) {
        allAssets[a.currency] = { ...a, sources: [p.exchange] };
      } else {
        allAssets[a.currency].balance += a.balance;
        allAssets[a.currency].locked += a.locked || 0;
        allAssets[a.currency].valueKrw += a.valueKrw;
        allAssets[a.currency].valueUsd += a.valueUsd;
        allAssets[a.currency].profitLoss += a.profitLoss;
        if (!allAssets[a.currency].sources.includes(p.exchange)) {
          allAssets[a.currency].sources.push(p.exchange);
        }
      }
    });
  });

  // Recalculate allocation and P&L %
  const nonKrwTotalKrw = Object.values(allAssets)
    .reduce((sum, a) => sum + (a.valueKrw || 0), 0);
  Object.values(allAssets).forEach((a) => {
    a.allocationPercent = nonKrwTotalKrw > 0 ?
      (a.valueKrw / nonKrwTotalKrw) * 100 : 0;
    const costBasis = a.balance * a.avgBuyPrice;
    a.profitLossPercent = costBasis > 0 ?
      ((a.valueKrw - costBasis) / costBasis) * 100 : 0;
  });

  return {
    portfolios,
    aggregated: {
      totalValueKrw: grandTotalKrw,
      totalValueUsd: grandTotalUsd,
      assets: Object.values(allAssets).sort((a, b) => b.valueKrw - a.valueKrw),
      lastUpdated: portfolios[0]?.snapshotAt || null,
    },
  };
});

// =============================================================================
// ADMIN CEX STATISTICS (onCall)
// =============================================================================

/**
 * Get CEX portfolio usage statistics for admin dashboard.
 * Requires admin role.
 */
exports.getAdminCexStats = onCall({
  ...cexFunctionConfig,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required.");
  }
  const uid = request.auth.uid;

  // Verify admin role
  const userEmail = request.auth.token?.email;
  if (!userEmail) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  const adminDoc = await db.collection("users").doc(userEmail.toLowerCase()).get();
  if (!adminDoc.exists || adminDoc.data().role !== "admin") {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  console.log(`[AdminCEX] Fetching CEX statistics for admin ${userEmail}`);

  try {
    // 1. Fetch ALL users who have cex_credentials subcollection
    const usersSnap = await db.collection("users").get();
    const userList = [];

    for (const userDoc of usersSnap.docs) {
      const credSnap = await db.collection(`users/${userDoc.id}/cex_credentials`).get();
      if (credSnap.empty) continue;

      const userData = userDoc.data();
      const credentials = [];

      for (const credDoc of credSnap.docs) {
        const cred = credDoc.data();
        credentials.push({
          id: credDoc.id,
          exchange: cred.exchange,
          label: cred.label || "",
          status: cred.status || "unknown",
          registeredAt: cred.registeredAt?.toDate?.()?.toISOString() || null,
          lastSyncAt: cred.lastSyncAt?.toDate?.()?.toISOString() || null,
          lastSyncStatus: cred.lastSyncStatus || "never",
        });
      }

      // Fetch the latest snapshot for portfolio value
      const snapshotSnap = await db.collection(`users/${userDoc.id}/cex_snapshots`).get();
      let totalValueKrw = 0;
      let totalValueUsd = 0;
      let assetCount = 0;
      let lastSyncTime = null;
      const snapshotAssets = [];

      for (const snapDoc of snapshotSnap.docs) {
        const snap = snapDoc.data();
        totalValueKrw += snap.totalValueKrw || 0;
        totalValueUsd += snap.totalValueUsd || 0;
        const snapTime = snap.snapshotAt?.toDate?.();
        if (snapTime && (!lastSyncTime || snapTime > lastSyncTime)) {
          lastSyncTime = snapTime;
        }
        if (snap.assets && Array.isArray(snap.assets)) {
          assetCount += snap.assets.filter((a) => a.currency !== "KRW").length;
          snap.assets.forEach((a) => snapshotAssets.push(a));
        }
      }

      userList.push({
        email: userDoc.id,
        name: userData.name || "",
        walletAddress: userData.walletAddress || "",
        credentials,
        exchangeCount: credentials.length,
        exchanges: [...new Set(credentials.map((c) => c.exchange))],
        totalValueKrw,
        totalValueUsd,
        assetCount,
        lastSync: lastSyncTime?.toISOString() || null,
        registeredAt: credentials[0]?.registeredAt || null,
        status: credentials.some((c) => c.status === "active") ? "active" : "inactive",
        assets: snapshotAssets,
      });
    }

    // 2. Compute aggregate statistics
    const totalUsers = userList.length;
    const activeUsers = userList.filter((u) => u.status === "active").length;
    const totalCredentials = userList.reduce((sum, u) => sum + u.exchangeCount, 0);
    const totalAumKrw = userList.reduce((sum, u) => sum + u.totalValueKrw, 0);
    const totalAumUsd = userList.reduce((sum, u) => sum + u.totalValueUsd, 0);

    // Exchange breakdown
    const exchangeBreakdown = {};
    userList.forEach((u) => {
      u.credentials.forEach((c) => {
        if (!exchangeBreakdown[c.exchange]) {
          exchangeBreakdown[c.exchange] = { connections: 0, active: 0 };
        }
        exchangeBreakdown[c.exchange].connections++;
        if (c.status === "active") exchangeBreakdown[c.exchange].active++;
      });
    });

    // Exchange AUM
    const exchangeAum = {};
    userList.forEach((u) => {
      u.assets.forEach((a) => {
        // Aggregate AUM by exchange from credentials
      });
      u.credentials.forEach((c) => {
        if (!exchangeAum[c.exchange]) exchangeAum[c.exchange] = 0;
      });
    });

    // Top coins across all users
    const coinMap = {};
    userList.forEach((u) => {
      u.assets.forEach((a) => {
        if (a.currency === "KRW") return;
        if (!coinMap[a.currency]) {
          coinMap[a.currency] = { symbol: a.currency, holders: 0, totalValueKrw: 0, totalBalance: 0 };
        }
        coinMap[a.currency].totalValueKrw += a.valueKrw || 0;
        coinMap[a.currency].totalBalance += a.balance || 0;
      });
    });
    // Count unique holders per coin
    userList.forEach((u) => {
      const seenCoins = new Set();
      u.assets.forEach((a) => {
        if (a.currency !== "KRW" && !seenCoins.has(a.currency)) {
          seenCoins.add(a.currency);
          if (coinMap[a.currency]) coinMap[a.currency].holders++;
        }
      });
    });
    const topCoins = Object.values(coinMap)
      .sort((a, b) => b.totalValueKrw - a.totalValueKrw)
      .slice(0, 20);

    // Asset size distribution
    const sizeDistribution = {
      under1m: 0, // < 1,000,000 KRW
      m1to5m: 0, // 1M ~ 5M
      m5to10m: 0, // 5M ~ 10M
      m10to50m: 0, // 10M ~ 50M
      m50to100m: 0, // 50M ~ 100M
      over100m: 0, // > 100M
    };
    userList.forEach((u) => {
      const v = u.totalValueKrw;
      if (v < 1000000) sizeDistribution.under1m++;
      else if (v < 5000000) sizeDistribution.m1to5m++;
      else if (v < 10000000) sizeDistribution.m5to10m++;
      else if (v < 50000000) sizeDistribution.m10to50m++;
      else if (v < 100000000) sizeDistribution.m50to100m++;
      else sizeDistribution.over100m++;
    });

    // Recent registrations (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const recentRegistrations = userList.filter((u) => {
      if (!u.registeredAt) return false;
      return new Date(u.registeredAt) >= weekAgo;
    }).length;

    // Today's registrations
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayRegistrations = userList.filter((u) => {
      if (!u.registeredAt) return false;
      return new Date(u.registeredAt) >= todayStart;
    }).length;

    // Strip assets from user list to reduce payload size
    const usersSummary = userList.map((u) => ({
      email: u.email,
      name: u.name,
      walletAddress: u.walletAddress,
      exchanges: u.exchanges,
      exchangeCount: u.exchangeCount,
      credentials: u.credentials,
      totalValueKrw: u.totalValueKrw,
      totalValueUsd: u.totalValueUsd,
      assetCount: u.assetCount,
      lastSync: u.lastSync,
      registeredAt: u.registeredAt,
      status: u.status,
    }));

    return {
      overview: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        totalCredentials,
        totalAumKrw,
        totalAumUsd,
        recentRegistrations,
        todayRegistrations,
      },
      exchangeBreakdown,
      topCoins,
      sizeDistribution,
      users: usersSummary,
    };
  } catch (err) {
    console.error("[AdminCEX] Failed to get stats:", err);
    throw new HttpsError("internal", "Failed to fetch CEX statistics.");
  }
});

// =============================================================================
// BACKFILL RP - One-time admin function to retroactively award RP
// =============================================================================
const RP_PER_REFERRAL_BF = 10;
const RP_LEVELUP_BONUS_BF = 100;
const LEVELUP_INTERVAL_BF = 10;

function calcLevelFromRefs(count) {
  return Math.min(Math.floor((1 + Math.sqrt(1 + 8 * count)) / 2), 100);
}

exports.backfillRP = onRequest({ cors: true, invoker: "public", timeoutSeconds: 300 }, async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).send("");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Simple admin protection
  const { adminKey, dryRun } = req.body;
  if (adminKey !== "visionchain-backfill-2026") {
    return res.status(403).json({ error: "Unauthorized" });
  }

  try {
    const usersSnapshot = await db.collection("users").get();
    console.log(`[RP Backfill] Total users: ${usersSnapshot.size}`);

    let processed = 0;
    let awarded = 0;
    let skipped = 0;
    let totalRPAwarded = 0;
    const details = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const email = userDoc.id;
      const referralCount = userData.referralCount || 0;

      if (referralCount <= 0) {
        skipped++;
        continue;
      }

      processed++;

      // Calculate expected referral RP
      const referralRP = referralCount * RP_PER_REFERRAL_BF;

      // Calculate level & level-up bonuses
      const currentLevel = calcLevelFromRefs(referralCount);
      let levelupRP = 0;
      for (let lvl = 1; lvl <= currentLevel; lvl++) {
        if (lvl % LEVELUP_INTERVAL_BF === 0) {
          levelupRP += RP_LEVELUP_BONUS_BF;
        }
      }

      const expectedTotalRP = referralRP + levelupRP;

      // Check existing RP
      const rpDocSnap = await db.collection("user_reward_points").doc(email).get();
      const existingRP = rpDocSnap.exists ? (rpDocSnap.data().totalRP || 0) : 0;
      const existingAvailable = rpDocSnap.exists ? (rpDocSnap.data().availableRP || 0) : 0;

      const rpToAward = expectedTotalRP - existingRP;

      if (rpToAward <= 0) {
        skipped++;
        details.push({ email, referrals: referralCount, level: currentLevel, existing: existingRP, expected: expectedTotalRP, awarded: 0, status: "SKIP" });
        continue;
      }

      const backfillReferralRP = Math.max(0, referralRP - existingRP);
      const backfillLevelupRP = rpToAward - Math.max(0, backfillReferralRP);

      if (!dryRun) {
        const now = new Date().toISOString();

        // Add referral RP history
        if (backfillReferralRP > 0) {
          await db.collection("rp_history").add({
            userId: email,
            type: "referral",
            amount: backfillReferralRP,
            source: `Backfill: ${referralCount} referrals`,
            timestamp: now,
          });
        }

        // Add level-up RP history
        if (backfillLevelupRP > 0) {
          await db.collection("rp_history").add({
            userId: email,
            type: "levelup",
            amount: backfillLevelupRP,
            source: `Backfill: Level milestones up to LVL ${currentLevel}`,
            timestamp: now,
          });
        }

        // Update user_reward_points
        if (rpDocSnap.exists) {
          await db.collection("user_reward_points").doc(email).update({
            totalRP: existingRP + rpToAward,
            availableRP: existingAvailable + rpToAward,
            updatedAt: now,
          });
        } else {
          await db.collection("user_reward_points").doc(email).set({
            userId: email,
            totalRP: rpToAward,
            claimedRP: 0,
            availableRP: rpToAward,
            createdAt: now,
            updatedAt: now,
          });
        }
      }

      awarded++;
      totalRPAwarded += rpToAward;
      details.push({
        email,
        referrals: referralCount,
        level: currentLevel,
        existing: existingRP,
        expected: expectedTotalRP,
        awarded: rpToAward,
        refRP: backfillReferralRP,
        lvlRP: backfillLevelupRP,
        status: dryRun ? "WOULD_AWARD" : "AWARDED",
      });

      console.log(`[RP Backfill] ${email}: ${referralCount} refs, LVL ${currentLevel}, +${rpToAward} RP`);
    }

    console.log(`[RP Backfill] Complete: processed=${processed}, awarded=${awarded}, skipped=${skipped}, totalRP=${totalRPAwarded}`);

    return res.status(200).json({
      success: true,
      dryRun: !!dryRun,
      summary: { processed, awarded, skipped, totalRPAwarded },
      details,
    });
  } catch (err) {
    console.error("[RP Backfill] Failed:", err);
    return res.status(500).json({ error: err.message || "Backfill failed" });
  }
});

// =============================================================================
// AGENT GATEWAY - AI Agent Onboarding & Interaction API
// =============================================================================
// Unified endpoint for AI agents from Moltbook, OpenClaw, etc.
// Actions: register, balance, transfer, referral, leaderboard, profile
// =============================================================================

const AGENT_FAUCET_AMOUNT = "100"; // 100 VCN initial funding

/**
 * Generate a unique API key for an agent
 * @return {string} API key prefixed with vcn_
 */
function generateAgentApiKey() {
  return "vcn_" + crypto.randomBytes(24).toString("hex");
}

/**
 * Generate a referral code for an agent
 * @param {string} agentName - Agent name
 * @return {string} Referral code
 */
function generateAgentReferralCode(agentName) {
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  const prefix = agentName.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `AGENT_${prefix}_${suffix}`;
}

/**
 * Authenticate agent by API key
 * @param {string} apiKey - Agent API key
 * @return {object|null} Agent data or null
 */
async function authenticateAgent(apiKey) {
  if (!apiKey || !apiKey.startsWith("vcn_")) return null;
  const snap = await db.collection("agents")
    .where("apiKey", "==", apiKey)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const doc = snap.docs[0];
  return { id: doc.id, ...doc.data() };
}

let _gwPricingCache = null;
let _gwPricingCacheAt = 0;

exports.agentGateway = onRequest({
  cors: true,
  invoker: "public",
  timeoutSeconds: 120,
  secrets: ["VCN_EXECUTOR_PK"],
}, async (req, res) => {
  // CORS
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(204).send("");

  // GET requests serve full API discovery for AI agents
  const project = process.env.GCLOUD_PROJECT || "visionchain-d19ed";
  const siteDomain = project === "visionchain-staging" ? "staging.visionchain.co" : "visionchain.co";
  if (req.method === "GET") {
    return res.status(200).json({
      name: "Vision Chain Agent Gateway",
      version: "5.0.0",
      description: "EVM-compatible L1 blockchain with gasless transactions for AI agents. 59 actions across 15 domains.",
      base_url: `https://us-central1-${project}.cloudfunctions.net/agentGateway`,
      method: "POST",
      content_type: "application/json",
      skill_url: `https://${siteDomain}/skill.md`,
      docs_url: `https://${siteDomain}/docs/agent-api.md`,
      openapi_url: `https://${siteDomain}/openapi.json`,
      docs_ui: `https://${siteDomain}/docs/agent-api`,
      chain: { name: "Vision Chain", chain_id: 3151909, rpc: "https://api.visionchain.co/rpc-proxy", token: "VCN", decimals: 18, gasless: true },
      quick_start: "POST with { action: 'system.register', agent_name: 'your-name', platform: 'openai', owner_email: 'you@email.com' } to get wallet + API key + 99 VCN",
      domains: {
        system: {
          actions: [
            {
              action: "system.register", auth: false, tier: "T1", cost: "0", params: { agent_name: "required", platform: "required", owner_email: "required", platform_id: "optional", referral_code: "optional" },
              response: ["agent.wallet_address", "agent.api_key", "agent.referral_code", "agent.sbt", "user.uid", "user.email"], desc: "Register agent, get wallet + API key + SBT",
            },
            { action: "system.network_info", auth: false, tier: "T1", cost: "0", params: {}, response: ["chain_id", "rpc_url", "block_height", "contracts", "token"], desc: "Chain info, contracts, block height" },
            { action: "system.delete_agent", auth: true, tier: "T2", cost: "0.1", params: {}, response: ["deleted"], desc: "Permanently delete agent" },
          ],
        },
        wallet: {
          actions: [
            { action: "wallet.balance", auth: true, tier: "T1", cost: "0", params: {}, response: ["balance", "rp_points", "staking", "wallet_address"], desc: "VCN balance + RP points" },
            { action: "wallet.tx_history", auth: true, tier: "T1", cost: "0", params: { limit: "optional (1-100)", type: "optional (transfer|stake|unstake)" }, response: ["transactions[]", "total"], desc: "Transaction history" },
            { action: "wallet.token_info", auth: true, tier: "T1", cost: "0", params: { token_address: "optional (defaults to VCN)" }, response: ["name", "symbol", "decimals", "total_supply"], desc: "ERC-20 token details" },
            { action: "wallet.gas_estimate", auth: true, tier: "T1", cost: "0", params: { tx_type: "optional (transfer|stake|unstake)" }, response: ["gas_limit", "gas_price", "estimated_cost"], desc: "Gas estimation" },
            { action: "wallet.approve", auth: true, tier: "T3", cost: "0.5", params: { spender: "required", amount: "required", token_address: "optional" }, response: ["tx_hash", "spender", "amount"], desc: "Approve ERC-20 spender" },
          ],
        },
        transfer: {
          actions: [
            { action: "transfer.send", auth: true, tier: "T2", cost: "0.1", params: { to: "required", amount: "required (max 10000)" }, response: ["tx_hash", "from", "to", "amount", "rp_earned"], desc: "Send VCN (gasless)" },
            { action: "transfer.batch", auth: true, tier: "T4", cost: "1.0", params: { transfers: "required (array of {to, amount})" }, response: ["results[]", "total_sent", "rp_earned"], desc: "Batch transfer" },
            { action: "transfer.scheduled", auth: true, tier: "T3", cost: "0.5", params: { to: "required", amount: "required", execute_at: "required (ISO 8601)" }, response: ["schedule_id", "execute_at", "status"], desc: "Scheduled transfer" },
            { action: "transfer.conditional", auth: true, tier: "T3", cost: "0.5", params: { to: "required", amount: "required", condition: "required ({type, value})" }, response: ["condition_id", "condition", "status"], desc: "Conditional transfer" },
          ],
        },
        staking: {
          actions: [
            { action: "staking.deposit", auth: true, tier: "T3", cost: "0.5", params: { amount: "required (min 1)" }, response: ["tx_hash", "staked_amount", "rp_earned"], desc: "Stake VCN" },
            { action: "staking.request_unstake", auth: true, tier: "T3", cost: "0.5", params: { amount: "required" }, response: ["tx_hash", "amount", "cooldown_end"], desc: "Request unstake (starts cooldown)" },
            { action: "staking.withdraw", auth: true, tier: "T3", cost: "0.5", params: {}, response: ["tx_hash", "withdrawn_amount"], desc: "Withdraw after cooldown" },
            { action: "staking.claim", auth: true, tier: "T3", cost: "0.5", params: {}, response: ["tx_hash", "claimed_amount", "rp_earned"], desc: "Claim staking rewards" },
            { action: "staking.compound", auth: true, tier: "T3", cost: "0.5", params: {}, response: ["tx_hash", "claimed", "restaked"], desc: "Claim + re-stake atomically" },
            { action: "staking.rewards", auth: true, tier: "T1", cost: "0", params: {}, response: ["pending_rewards", "last_claim"], desc: "Query pending rewards" },
            { action: "staking.apy", auth: true, tier: "T1", cost: "0", params: {}, response: ["apy_percent", "total_staked", "staker_count"], desc: "Current APY + network stats" },
            { action: "staking.cooldown", auth: true, tier: "T1", cost: "0", params: {}, response: ["in_cooldown", "cooldown_end", "amount"], desc: "Cooldown status" },
            { action: "staking.position", auth: true, tier: "T1", cost: "0", params: {}, response: ["staked", "pending_rewards", "cooldown", "history[]"], desc: "Full staking position" },
          ],
        },
        bridge: {
          actions: [
            { action: "bridge.initiate", auth: true, tier: "T4", cost: "1.0", params: { amount: "required", destination_chain: "required (chainId)", recipient: "optional" }, response: ["bridge_id", "intent_hash", "status", "tx_hash"], desc: "Start cross-chain bridge" },
            { action: "bridge.status", auth: true, tier: "T1", cost: "0", params: { bridge_id: "optional", intent_hash: "optional" }, response: ["bridge_id", "status", "source_tx", "dest_tx", "amount"], desc: "Check bridge status" },
            { action: "bridge.finalize", auth: true, tier: "T3", cost: "0.5", params: { bridge_id: "required" }, response: ["tx_hash", "status", "amount"], desc: "Finalize bridge" },
            { action: "bridge.history", auth: true, tier: "T1", cost: "0", params: {}, response: ["bridges[]", "total"], desc: "Bridge transaction history" },
            { action: "bridge.fee", auth: true, tier: "T1", cost: "0", params: { amount: "optional", destination_chain: "optional" }, response: ["fee_vcn", "fee_percent", "estimated_time"], desc: "Bridge fee estimate" },
          ],
        },
        nft: {
          actions: [
            { action: "nft.mint", auth: true, tier: "T4", cost: "1.0", params: { token_type: "optional (nft|sbt)", mint_to: "optional", metadata: "optional ({name, description, image})" }, response: ["tx_hash", "token_id", "contract_address", "token_uri"], desc: "Mint NFT or SBT" },
            { action: "nft.balance", auth: true, tier: "T1", cost: "0", params: { wallet_address: "optional", contract_address: "optional" }, response: ["nfts[]", "sbts[]", "total"], desc: "NFT/SBT balance" },
            { action: "nft.metadata", auth: true, tier: "T1", cost: "0", params: { token_id: "required", contract_address: "optional" }, response: ["name", "description", "image", "attributes[]"], desc: "Token metadata" },
          ],
        },
        authority: {
          actions: [
            { action: "authority.grant", auth: true, tier: "T2", cost: "0.1", params: { delegate_to: "required", permissions: "required (array)", limits: "optional", expires_at: "optional" }, response: ["delegation_id", "permissions", "expires_at"], desc: "Delegate permissions" },
            { action: "authority.revoke", auth: true, tier: "T2", cost: "0.1", params: { delegation_id: "optional", delegate_to: "optional" }, response: ["revoked", "delegation_id"], desc: "Revoke delegation" },
            { action: "authority.status", auth: true, tier: "T1", cost: "0", params: { delegate_to: "optional" }, response: ["delegations[]", "total"], desc: "List active delegations" },
            { action: "authority.usage", auth: true, tier: "T1", cost: "0", params: { delegation_id: "required" }, response: ["total_calls", "last_used", "actions_used[]"], desc: "Delegation usage stats" },
            { action: "authority.audit", auth: true, tier: "T1", cost: "0", params: { limit: "optional" }, response: ["events[]", "total"], desc: "Audit trail" },
          ],
        },
        settlement: {
          actions: [
            { action: "settlement.set_wallet", auth: true, tier: "T2", cost: "0.1", params: { wallet_address: "required", label: "optional" }, response: ["wallet_address", "label", "updated"], desc: "Set payout wallet" },
            { action: "settlement.get_wallet", auth: true, tier: "T1", cost: "0", params: {}, response: ["wallet_address", "label"], desc: "Get settlement wallet" },
          ],
        },
        node: {
          actions: [
            { action: "node.register", auth: true, tier: "T2", cost: "0.1", params: { version: "required", os: "optional", arch: "optional", capabilities: "optional (array)" }, response: ["node_id", "status", "registered_at"], desc: "Register Vision Node" },
            { action: "node.heartbeat", auth: true, tier: "T1", cost: "0", params: {}, response: ["acknowledged", "next_expected"], desc: "Send heartbeat (every 5 min)" },
            { action: "node.status", auth: true, tier: "T1", cost: "0", params: {}, response: ["node_id", "status", "uptime", "last_heartbeat"], desc: "Node status" },
            { action: "node.peers", auth: true, tier: "T1", cost: "0", params: {}, response: ["peers[]", "total"], desc: "List network peers" },
          ],
        },
        storage: {
          actions: [
            { action: "storage.set", auth: true, tier: "T2", cost: "0.1", params: { key: "required (1-128 chars)", value: "required (max 10KB)" }, response: ["key", "stored", "size_bytes"], desc: "Store key-value" },
            { action: "storage.get", auth: true, tier: "T1", cost: "0", params: { key: "required" }, response: ["key", "value", "updated_at"], desc: "Retrieve value" },
            { action: "storage.list", auth: true, tier: "T1", cost: "0", params: {}, response: ["keys[]", "total"], desc: "List all keys" },
            { action: "storage.delete", auth: true, tier: "T2", cost: "0.1", params: { key: "required" }, response: ["deleted", "key"], desc: "Delete key" },
          ],
        },
        pipeline: {
          actions: [
            { action: "pipeline.create", auth: true, tier: "T2", cost: "0.1", params: { name: "required", steps: "required (array)", trigger: "optional", schedule: "optional" }, response: ["pipeline_id", "name", "steps_count"], desc: "Create multi-step pipeline" },
            { action: "pipeline.execute", auth: true, tier: "T3", cost: "0.5", params: { pipeline_id: "required" }, response: ["execution_id", "results[]", "status"], desc: "Execute pipeline" },
            { action: "pipeline.list", auth: true, tier: "T1", cost: "0", params: {}, response: ["pipelines[]", "total"], desc: "List pipelines" },
            { action: "pipeline.delete", auth: true, tier: "T2", cost: "0.1", params: { pipeline_id: "required" }, response: ["deleted", "pipeline_id"], desc: "Delete pipeline" },
          ],
        },
        webhook: {
          actions: [
            { action: "webhook.subscribe", auth: true, tier: "T2", cost: "0.1", params: { event: "required", callback_url: "required", filters: "optional" }, response: ["subscription_id", "event", "callback_url"], desc: "Subscribe to events" },
            { action: "webhook.unsubscribe", auth: true, tier: "T2", cost: "0.1", params: { subscription_id: "required" }, response: ["unsubscribed", "subscription_id"], desc: "Remove webhook" },
            { action: "webhook.list", auth: true, tier: "T1", cost: "0", params: {}, response: ["webhooks[]", "total"], desc: "List webhooks" },
            { action: "webhook.test", auth: true, tier: "T1", cost: "0", params: { subscription_id: "required" }, response: ["delivered", "response_code"], desc: "Send test event" },
            { action: "webhook.logs", auth: true, tier: "T1", cost: "0", params: { limit: "optional" }, response: ["deliveries[]", "total"], desc: "Delivery history" },
          ],
        },
        hosting: {
          actions: [
            { action: "hosting.configure", auth: true, tier: "T2", cost: "0.1", params: { model: "optional", system_prompt: "optional", enabled_actions: "optional (array)" }, response: ["configured", "model", "enabled_actions[]"], desc: "Configure agent hosting" },
            { action: "hosting.toggle", auth: true, tier: "T2", cost: "0.1", params: { enabled: "required (boolean)" }, response: ["enabled", "agent_name"], desc: "Enable/disable hosting" },
            { action: "hosting.logs", auth: true, tier: "T1", cost: "0", params: { limit: "optional" }, response: ["logs[]", "total"], desc: "Execution logs" },
          ],
        },
        social: {
          actions: [
            { action: "social.referral", auth: true, tier: "T1", cost: "0", params: {}, response: ["referral_code", "total_referrals", "rewards_earned"], desc: "Referral code + stats" },
            { action: "social.leaderboard", auth: true, tier: "T1", cost: "0", params: { type: "optional (rp|referrals|transfers)" }, response: ["rankings[]", "your_rank", "your_score"], desc: "Top agents" },
            { action: "social.profile", auth: true, tier: "T1", cost: "0", params: {}, response: ["agent_name", "wallet_address", "rp_points", "sbt", "created_at"], desc: "Full agent profile" },
          ],
        },
        mobile_node: {
          description: "Mobile Node (S-M Class) -- earn VCN by contributing network uptime from Android app or PWA.",
          actions: [
            { action: "mobile_node.register", auth: false, tier: "T1", cost: "0", params: { email: "required", device_type: "required (android|pwa)", referral_code: "optional" }, response: ["node_id", "api_key", "wallet_address"], desc: "Register mobile node, get API key + wallet" },
            { action: "mobile_node.heartbeat", auth: true, tier: "T1", cost: "0", params: { mode: "required (wifi_full|cellular_min)", battery_pct: "optional", data_used_mb: "optional" }, response: ["accepted", "epoch", "uptime_today_sec", "pending_reward"], desc: "Send heartbeat (5min WiFi / 30min cellular)" },
            { action: "mobile_node.status", auth: true, tier: "T1", cost: "0", params: {}, response: ["node_id", "device_type", "status", "total_uptime_hours", "current_epoch", "pending_reward", "claimed_reward", "weight", "network_rank", "total_nodes"], desc: "Full node status + rewards" },
            { action: "mobile_node.claim_reward", auth: true, tier: "T1", cost: "0", params: {}, response: ["claimed_amount", "tx_hash", "new_balance"], desc: "Claim pending epoch rewards" },
            { action: "mobile_node.submit_attestation", auth: true, tier: "T1", cost: "0", params: { attestations: "required (array of {block_number, block_hash, signer_valid, parent_hash_valid, timestamp_valid})" }, response: ["attestations_accepted", "bonus_weight"], desc: "Submit block header verification results" },
            { action: "mobile_node.leaderboard", auth: false, tier: "T1", cost: "0", params: { scope: "optional (global|country)", limit: "optional (1-100, default 50)" }, response: ["rankings[]", "total_nodes"], desc: "Node contribution leaderboard" },
          ],
        },
      },
      total_actions: 64,
      authentication: {
        methods: ["Authorization: Bearer <api_key>", "x-api-key: <api_key>", "POST body: api_key"],
        preferred: "Authorization: Bearer <api_key>",
        obtain: "Call system.register to get api_key",
      },
      error_codes: {
        200: "Success",
        201: "Created (agent registered)",
        400: "Bad Request - missing or invalid parameters",
        401: "Unauthorized - missing or invalid API key",
        402: "Payment Required - insufficient VCN balance for API fee",
        404: "Not Found - resource does not exist",
        409: "Conflict - resource already exists (e.g., agent name taken)",
        429: "Rate Limited - max 60 requests/minute per agent",
        500: "Internal Server Error",
      },
      pricing_tiers: {
        T1: { cost: "0 VCN", desc: "Read-only queries, no fee" },
        T2: { cost: "0.1 VCN", desc: "Basic write operations" },
        T3: { cost: "0.5 VCN", desc: "Complex on-chain operations" },
        T4: { cost: "1.0 VCN", desc: "Premium multi-step operations" },
        note: "All fees are API-level service charges auto-deducted from agent wallet. On-chain gas is always free (covered by Paymaster).",
      },
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body;
    const action = body.action;
    // Support header-based auth (preferred) with body fallback (legacy)
    const authHeader = req.headers["authorization"];
    const apiKeyParam =
      (authHeader && authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null) ||
      req.headers["x-api-key"] ||
      body.api_key || body.apiKey;

    if (!action) {
      return res.status(400).json({ error: "Missing required field: action" });
    }

    // --- REGISTER (system.register) ---
    if (action === "register" || action === "system.register") {
      const agentName = body.agent_name || body.agentName;
      const platform = body.platform;
      const platformId = body.platform_id || body.platformId || "";
      const ownerEmail = body.owner_email || body.ownerEmail || "";
      const refCode = body.referral_code || body.referralCode || "";

      if (!agentName || !platform) {
        return res.status(400).json({
          error: "Missing required fields: agent_name, platform",
        });
      }

      if (!ownerEmail) {
        return res.status(400).json({
          error: "Missing required field: owner_email. An owner email is required to create a user account and agent identity.",
        });
      }

      // === RATE LIMIT: Max 3 agents per email ===
      const normalizedEmailCheck = ownerEmail.toLowerCase().trim();
      const emailAgents = await db.collection("agents")
        .where("ownerEmail", "==", normalizedEmailCheck)
        .get();
      if (emailAgents.size >= 3) {
        return res.status(429).json({
          error: "Registration limit reached: max 3 agents per email address",
          current_count: emailAgents.size,
          email: normalizedEmailCheck,
        });
      }

      // === RATE LIMIT: Max 5 registrations per IP per hour ===
      const clientIp = req.headers["x-forwarded-for"] ?
        req.headers["x-forwarded-for"].split(",")[0].trim() :
        req.ip || "unknown";
      if (clientIp !== "unknown") {
        const oneHourAgo = Date.now() - 60 * 60 * 1000;
        const ipRegs = await db.collection("registration_ips")
          .where("ip", "==", clientIp)
          .get();
        const recentCount = ipRegs.docs.filter((d) => {
          const ts = d.data().created_at;
          const ms = ts && ts.toMillis ? ts.toMillis() : new Date(ts).getTime();
          return ms > oneHourAgo;
        }).length;
        if (recentCount >= 5) {
          return res.status(429).json({
            error: "Too many registrations from this IP. Max 5 per hour.",
            retry_after_seconds: 3600,
          });
        }
        // Log this registration IP (auto-cleanup via TTL or periodic job)
        await db.collection("registration_ips").add({
          ip: clientIp,
          email: normalizedEmailCheck,
          agent_name: agentName,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Check if agent already exists
      const existingAgent = await db.collection("agents").doc(agentName.toLowerCase()).get();
      if (existingAgent.exists) {
        const data = existingAgent.data();
        return res.status(409).json({
          error: "Agent already registered",
          agent: {
            agent_name: data.agentName,
            wallet_address: data.walletAddress,
            owner_uid: data.ownerUid || null,
            dashboard_url: `https://${siteDomain}/agent/${data.agentName}`,
          },
        });
      }

      // === STEP 1: Find or Create Firebase Auth User ===
      let ownerUid = null;
      let userCreated = false;
      const normalizedEmail = ownerEmail.toLowerCase().trim();

      try {
        // Try to find existing Firebase Auth user by email
        const existingUser = await admin.auth().getUserByEmail(normalizedEmail);
        ownerUid = existingUser.uid;
        console.log(`[Agent Gateway] Found existing user: ${ownerUid} for ${normalizedEmail}`);
      } catch (authErr) {
        if (authErr.code === "auth/user-not-found") {
          // Create new Firebase Auth user (passwordless - owner can claim via password reset)
          try {
            const newUser = await admin.auth().createUser({
              email: normalizedEmail,
              displayName: agentName,
              disabled: false,
            });
            ownerUid = newUser.uid;
            userCreated = true;
            console.log(`[Agent Gateway] Created new user: ${ownerUid} for ${normalizedEmail}`);

            // Create Firestore user document
            const userReferralCode = `USER_${agentName.toUpperCase().slice(0, 8)}_${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
            await db.collection("users").doc(ownerUid).set({
              uid: ownerUid,
              email: normalizedEmail,
              displayName: agentName,
              role: "user",
              referralCode: userReferralCode,
              referralCount: 0,
              agentCount: 0,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
              createdVia: "agent_gateway",
              platform: platform.toLowerCase(),
            });
            console.log(`[Agent Gateway] Created user doc for ${ownerUid}`);
          } catch (createErr) {
            console.error(`[Agent Gateway] User creation failed:`, createErr.message);
            // Continue without user link - don't block agent creation
          }
        } else {
          console.warn(`[Agent Gateway] Auth lookup failed:`, authErr.message);
        }
      }

      // === STEP 2: Create Agent Wallet ===
      const wallet = ethers.Wallet.createRandom();
      const apiKey = generateAgentApiKey();
      const agentReferralCode = generateAgentReferralCode(agentName);

      // === STEP 3: Save Agent to Firestore ===
      const agentData = {
        agentName: agentName.toLowerCase(),
        displayName: agentName,
        platform: platform.toLowerCase(),
        platformId: platformId,
        ownerEmail: normalizedEmail,
        ownerUid: ownerUid, // Link to Firebase Auth user
        walletAddress: wallet.address,
        privateKey: serverEncrypt(wallet.privateKey),
        apiKey: apiKey,
        referralCode: agentReferralCode,
        referralCount: 0,
        rpPoints: 0,
        totalTransferred: "0",
        totalReceived: "0",
        transferCount: 0,
        fundingStatus: "pending",
        sbtStatus: "pending",
        sbtTokenId: null,
        sbtTxHash: "",
        registeredAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "active",
      };

      await db.collection("agents").doc(agentName.toLowerCase()).set(agentData);

      // Increment user's agent count
      if (ownerUid) {
        db.collection("users").doc(ownerUid).update({
          agentCount: admin.firestore.FieldValue.increment(1),
          lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch((e) => console.warn(`[Agent Gateway] Agent count update failed:`, e.message));
      }

      console.log(`[Agent Gateway] Registered agent: ${agentName} (${platform}) wallet: ${wallet.address} owner: ${ownerUid}`);

      // === STEP 4: Fund Wallet (synchronous) ===
      const agentDocRef = db.collection("agents").doc(agentName.toLowerCase());
      const netFundingAmount = String(parseFloat(AGENT_FAUCET_AMOUNT) - parseFloat(SBT_MINT_FEE));
      let fundingTxHash = "";

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
        const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);
        const amountWei = ethers.parseEther(netFundingAmount);
        const tx = await tokenContract.transfer(wallet.address, amountWei);
        await tx.wait();
        fundingTxHash = tx.hash;
        await agentDocRef.update({ fundingTx: tx.hash, fundingStatus: "completed" });
        console.log(`[Agent Gateway] Funded ${wallet.address} with ${netFundingAmount} VCN, tx: ${tx.hash}`);
      } catch (fundErr) {
        console.error(`[Agent Gateway] Funding failed for ${wallet.address}:`, fundErr.message);
        await agentDocRef.update({ fundingStatus: "failed", fundingError: fundErr.message }).catch(() => { });
      }

      // === STEP 5: RESPOND (before SBT mint -- fast response) ===
      res.status(201).json({
        success: true,
        user: {
          uid: ownerUid,
          email: normalizedEmail,
          created: userCreated,
          login_url: userCreated ? "https://visionchain.co/login (use password reset to claim account)" : "https://visionchain.co/login",
        },
        agent: {
          agent_name: agentName.toLowerCase(),
          wallet_address: wallet.address,
          api_key: apiKey,
          referral_code: agentReferralCode,
          initial_balance: `${netFundingAmount} VCN`,
          funding_tx: fundingTxHash || "pending",
          sbt: {
            status: "pending",
            contract: AGENT_SBT_ADDRESS,
            note: "SBT DID is being minted asynchronously. Query social.profile to check status.",
          },
          dashboard_url: `https://visionchain.co/agent/${agentName.toLowerCase()}`,
        },
      });

      // === ASYNC: SBT Minting + Referral (runs after response is sent) ===

      // -- SBT Mint with verification --
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
        const sbtContract = new ethers.Contract(AGENT_SBT_ADDRESS, AGENT_SBT_ABI, adminWallet);

        // Verify executor has minter role
        const hasMinterRole = await sbtContract.isMinter(adminWallet.address);
        if (!hasMinterRole) {
          console.log(`[Agent Gateway] Executor lacks minter role, granting...`);
          try {
            const grantTx = await sbtContract.setMinter(adminWallet.address, true, { gasLimit: 100000, gasPrice: ethers.parseUnits("1", "gwei") });
            await grantTx.wait();
            console.log(`[Agent Gateway] Minter role granted to executor`);
          } catch (grantErr) {
            throw new Error(`Cannot grant minter role: ${grantErr.message}`);
          }
        }

        const gasOpts = { gasLimit: 500000, gasPrice: ethers.parseUnits("1", "gwei") };
        const mintTx = await sbtContract.mintAgentIdentity(wallet.address, agentName.toLowerCase(), platform.toLowerCase(), gasOpts);
        const receipt = await mintTx.wait();
        const sbtTxHash = mintTx.hash;

        // Parse Transfer event log to get tokenId
        let sbtTokenId = null;
        const transferLog = receipt.logs.find((l) => l.topics[0] === ethers.id("Transfer(address,address,uint256)"));
        if (transferLog) {
          sbtTokenId = parseInt(transferLog.topics[3], 16);
        }

        // Verify on-chain
        const onChainAgent = await sbtContract.getAgentByAddress(wallet.address);
        if (onChainAgent[0] !== 0n && onChainAgent[0] !== 0) {
          sbtTokenId = Number(onChainAgent[0]);
        }

        await agentDocRef.update({
          sbtTokenId: sbtTokenId,
          sbtTxHash: sbtTxHash,
          sbtAddress: AGENT_SBT_ADDRESS,
          sbtStatus: "completed",
        });
        console.log(`[Agent Gateway] SBT minted and verified for ${agentName}, tokenId: ${sbtTokenId}, tx: ${sbtTxHash}`);
      } catch (sbtErr) {
        console.error(`[Agent Gateway] SBT mint failed for ${agentName}:`, sbtErr.message);
        await agentDocRef.update({
          sbtStatus: "failed",
          sbtError: sbtErr.message,
          sbtRetryAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });
      }

      // -- Referral Processing --
      if (refCode) {
        try {
          const referrerSnap = await db.collection("agents")
            .where("referralCode", "==", refCode)
            .limit(1)
            .get();
          if (!referrerSnap.empty) {
            const referrerDoc = referrerSnap.docs[0];
            const referrerData = referrerDoc.data();
            await referrerDoc.ref.update({
              referralCount: admin.firestore.FieldValue.increment(1),
              rpPoints: admin.firestore.FieldValue.increment(50),
            });
            await agentDocRef.update({
              rpPoints: admin.firestore.FieldValue.increment(25),
            });
            console.log(`[Agent Gateway] Referral processed: ${refCode} -> ${agentName}`);

            // Roll up to owner user
            if (referrerData.ownerUid) {
              db.collection("users").doc(referrerData.ownerUid).update({
                referralCount: admin.firestore.FieldValue.increment(1),
              }).catch((e) => console.warn(`[Agent Gateway] Owner rollup failed:`, e.message));
            } else if (referrerData.ownerEmail) {
              try {
                const ownerSnap = await db.collection("users")
                  .where("email", "==", referrerData.ownerEmail.toLowerCase())
                  .limit(1)
                  .get();
                if (!ownerSnap.empty) {
                  await ownerSnap.docs[0].ref.update({
                    referralCount: admin.firestore.FieldValue.increment(1),
                  });
                }
              } catch (ownerErr) {
                console.warn(`[Agent Gateway] Owner rollup failed:`, ownerErr.message);
              }
            }
          } else {
            const humanSnap = await db.collection("users")
              .where("referralCode", "==", refCode)
              .limit(1)
              .get();
            if (!humanSnap.empty) {
              await humanSnap.docs[0].ref.update({
                referralCount: admin.firestore.FieldValue.increment(1),
              });
              await agentDocRef.update({
                rpPoints: admin.firestore.FieldValue.increment(25),
              });
              console.log(`[Agent Gateway] Human referral processed: ${refCode} -> ${agentName}`);
            }
          }
        } catch (refErr) {
          console.warn(`[Agent Gateway] Referral processing failed:`, refErr.message);
        }
      }

      return; // Already responded above
    }

    // --- All other actions require authentication ---
    // mobile_node.register & mobile_node.leaderboard are public (no auth required)
    // mobile_node.heartbeat/status/claim_reward use their own vcn_mn_ key auth internally
    const skipAgentAuth = ["mobile_node.register", "mobile_node.leaderboard", "mobile_node.heartbeat", "mobile_node.status", "mobile_node.claim_reward", "mobile_node.submit_attestation"];
    if (!apiKeyParam && !skipAgentAuth.includes(action)) {
      return res.status(401).json({ error: "Missing api_key. Register first." });
    }
    let agent = null;
    if (!skipAgentAuth.includes(action)) {
      agent = await authenticateAgent(apiKeyParam);
      if (!agent) {
        return res.status(401).json({ error: "Invalid api_key" });
      }
      // Update last active
      db.collection("agents").doc(agent.id).update({
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => { });
    }

    // === API FEE DEDUCTION MIDDLEWARE ===
    // Map legacy action names to canonical domain.method for pricing lookup
    const ACTION_CANONICAL = {
      balance: "wallet.balance", transfer: "transfer.send", transactions: "wallet.tx_history",
      referral: "social.referral", leaderboard: "social.leaderboard", profile: "social.profile",
      stake: "staking.deposit", unstake: "staking.request_unstake",
      claim_rewards: "staking.claim", staking_info: "staking.position",
      network_info: "system.network_info", delete_agent: "system.delete_agent",
      configure_hosting: "hosting.configure", toggle_hosting: "hosting.toggle", hosting_logs: "hosting.logs",
    };
    const canonicalAction = ACTION_CANONICAL[action] || action;

    // === NODE-GATE MIDDLEWARE ===
    // T1 + T2: open to all authenticated agents
    // T3 + T4: require active Vision Node
    const ACTION_TIER_MAP = {
      "system.register": "T1", "system.network_info": "T1", "system.delete_agent": "T2",
      "wallet.balance": "T1", "wallet.tx_history": "T1", "wallet.token_info": "T1",
      "wallet.gas_estimate": "T1", "wallet.approve": "T3",
      "transfer.send": "T2", "transfer.batch": "T4", "transfer.scheduled": "T3", "transfer.conditional": "T3",
      "staking.deposit": "T3", "staking.request_unstake": "T3", "staking.withdraw": "T3",
      "staking.claim": "T3", "staking.compound": "T3", "staking.rewards": "T1",
      "staking.apy": "T1", "staking.cooldown": "T1", "staking.position": "T1",
      "bridge.initiate": "T4", "bridge.status": "T1", "bridge.finalize": "T3",
      "bridge.history": "T1", "bridge.fee": "T1",
      "nft.mint": "T4", "nft.balance": "T1", "nft.metadata": "T1",
      "authority.grant": "T2", "authority.revoke": "T2", "authority.status": "T1",
      "authority.usage": "T1", "authority.audit": "T1",
      "settlement.set_wallet": "T2", "settlement.get_wallet": "T1",
      "social.referral": "T1", "social.leaderboard": "T1", "social.profile": "T1",
      "hosting.configure": "T2", "hosting.toggle": "T2", "hosting.logs": "T1",
      // Stage 2 - new domains
      "node.register": "T2", "node.heartbeat": "T1", "node.status": "T1", "node.peers": "T1",
      "storage.set": "T2", "storage.get": "T1", "storage.list": "T1", "storage.delete": "T2",
      "pipeline.create": "T2", "pipeline.execute": "T3", "pipeline.list": "T1", "pipeline.delete": "T2",
      "webhook.subscribe": "T2", "webhook.unsubscribe": "T2", "webhook.list": "T1",
      "webhook.test": "T1", "webhook.logs": "T1",
    };

    const actionTier = ACTION_TIER_MAP[canonicalAction] || "T2";
    if (agent && ["T3", "T4"].includes(actionTier)) {
      try {
        const nodeSnap = await db.collection("agents").doc(agent.id)
          .collection("node").doc("status").get();
        const nodeData = nodeSnap.exists ? nodeSnap.data() : null;
        const isNodeActive = nodeData &&
          nodeData.last_heartbeat &&
          (Date.now() - nodeData.last_heartbeat.toMillis() < 600000); // 10 min
        if (!isNodeActive) {
          return res.status(403).json({
            error: "Vision Node required for this action",
            action: canonicalAction,
            tier: actionTier,
            node_status: nodeData ? (Date.now() - (nodeData.last_heartbeat?.toMillis?.() || 0) < 3600000 ? "stale" : "inactive") : "not_registered",
            message: "Install and run a Vision Node to access T3/T4 actions. T1+T2 actions remain available without a node.",
            install_url: "https://visionchain.co/node/install",
            docs_url: "https://visionchain.co/docs/node",
          });
        }
      } catch (ngErr) {
        console.warn(`[Node-Gate] Check failed for agent ${agent.id}:`, ngErr.message);
        // Fail-open: allow action if node check itself fails
      }
    }

    // Load pricing config (cached in-memory for 5 minutes)
    let pricingConfig = _gwPricingCache;
    if (!pricingConfig || Date.now() - _gwPricingCacheAt > 300000) {
      try {
        const pricingSnap = await db.collection("config").doc("api_pricing").get();
        if (pricingSnap.exists) {
          pricingConfig = pricingSnap.data();
        } else {
          pricingConfig = null;
        }
        _gwPricingCache = pricingConfig;
        _gwPricingCacheAt = Date.now();
      } catch (pcErr) {
        console.warn(`[Agent Gateway] Pricing config load failed:`, pcErr.message);
        pricingConfig = null;
      }
    }

    // Determine fee for this action
    let feeVcn = 0;
    let feeTierId = "T1";
    let feeDeducted = false;
    let feeTxHash = "";

    if (pricingConfig && pricingConfig.tiers && pricingConfig.service_tiers) {
      feeTierId = pricingConfig.service_tiers[canonicalAction] || "T1";
      const tierDef = pricingConfig.tiers[feeTierId];
      if (tierDef) {
        feeVcn = parseFloat(tierDef.cost_vcn) || 0;
      }
    }

    // Deduct fee if cost > 0 and agent exists
    if (feeVcn > 0 && agent) {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, provider);
        const feeWei = ethers.parseEther(feeVcn.toString());

        // Check agent balance
        const agentBal = await tokenContract.balanceOf(agent.walletAddress);
        if (agentBal < feeWei) {
          return res.status(402).json({
            error: "Insufficient VCN balance for API fee",
            required_fee: `${feeVcn} VCN`,
            your_balance: ethers.formatEther(agentBal),
            tier: feeTierId,
            action: canonicalAction,
          });
        }

        // Deduct: agent wallet -> executor (protocol fee collection)
        const agentPK = serverDecrypt(agent.privateKey);
        const agentWallet = new ethers.Wallet(agentPK, provider);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

        // Ensure agent has gas
        const agentGasBal = await provider.getBalance(agent.walletAddress);
        if (agentGasBal < ethers.parseEther("0.001")) {
          const gasTx = await adminWallet.sendTransaction({
            to: agent.walletAddress,
            value: ethers.parseEther("0.01"),
          });
          await gasTx.wait();
        }

        const agentToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, agentWallet);
        const feeTx = await agentToken.transfer(adminWallet.address, feeWei);
        await feeTx.wait();
        feeTxHash = feeTx.hash;
        feeDeducted = true;

        // Log fee collection
        db.collection("agents").doc(agent.id).collection("transactions").add({
          type: "api_fee",
          action: canonicalAction,
          tier: feeTierId,
          amount: feeVcn.toString(),
          txHash: feeTx.hash,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });

        console.log(`[Agent Gateway] Fee collected: ${agent.agentName} -> ${feeVcn} VCN (${feeTierId}) for ${canonicalAction}, tx: ${feeTx.hash}`);
      } catch (feeErr) {
        // Log but don't block action during rollout
        console.error(`[Agent Gateway] Fee deduction failed for ${agent.agentName}/${canonicalAction}:`, feeErr.message);
      }
    }

    // Auto-inject fee info into all successful JSON responses
    const _originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && typeof body === "object" && body.success && feeVcn > 0) {
        body.fee = {
          charged: feeDeducted,
          amount_vcn: feeVcn.toString(),
          tier: feeTierId,
          tx_hash: feeTxHash || undefined,
        };
      }
      return _originalJson(body);
    };

    // --- BALANCE (wallet.balance) ---
    if (action === "balance" || action === "wallet.balance") {
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);
      const balanceWei = await tokenContract.balanceOf(agent.walletAddress);
      const balance = ethers.formatEther(balanceWei);

      return res.status(200).json({
        success: true,
        agent_name: agent.agentName,
        wallet_address: agent.walletAddress,
        balance_vcn: balance,
        rp_points: agent.rpPoints || 0,
      });
    }

    // --- TRANSFER (transfer.send) ---
    if (action === "transfer" || action === "transfer.send") {
      const { to, amount } = req.body;
      if (!to || !amount) {
        return res.status(400).json({ error: "Missing required fields: to, amount" });
      }

      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0 || amountNum > 10000) {
        return res.status(400).json({ error: "Invalid amount (must be 0 < amount <= 10000)" });
      }

      // Decrypt agent private key and send
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
      const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);
      const amountWei = ethers.parseEther(amount.toString());

      // Check balance first
      const bal = await tokenContract.balanceOf(agent.walletAddress);
      if (bal < amountWei) {
        return res.status(400).json({ error: "Insufficient balance" });
      }

      // Use admin wallet to transfer on behalf (gasless for agent)
      // Agent's wallet needs to have approved admin, or we use the admin's own tokens
      // For simplicity, we use direct transfer from decrypted agent wallet
      const agentPK = serverDecrypt(agent.privateKey);
      const agentWallet = new ethers.Wallet(agentPK, provider);
      const agentToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, agentWallet);

      // Agent needs gas - send minimal gas from admin
      const agentBalance = await provider.getBalance(agent.walletAddress);
      if (agentBalance < ethers.parseEther("0.001")) {
        const gasTx = await adminWallet.sendTransaction({
          to: agent.walletAddress,
          value: ethers.parseEther("0.01"),
        });
        await gasTx.wait();
      }

      const tx = await agentToken.transfer(to, amountWei);
      await tx.wait();

      // Update stats
      await db.collection("agents").doc(agent.id).update({
        transferCount: admin.firestore.FieldValue.increment(1),
        rpPoints: admin.firestore.FieldValue.increment(5),
      });

      // Save transaction record
      db.collection("agents").doc(agent.id).collection("transactions").add({
        type: "transfer",
        to: to,
        amount: amount.toString(),
        txHash: tx.hash,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }).catch(() => { });

      console.log(`[Agent Gateway] Transfer: ${agent.agentName} -> ${to}: ${amount} VCN, tx: ${tx.hash}`);

      return res.status(200).json({
        success: true,
        tx_hash: tx.hash,
        from: agent.walletAddress,
        to: to,
        amount: amount.toString(),
        rp_earned: 5,
      });
    }

    // --- REFERRAL (social.referral) ---
    if (action === "referral" || action === "social.referral") {
      return res.status(200).json({
        success: true,
        agent_name: agent.agentName,
        referral_code: agent.referralCode,
        referral_url: `https://visionchain.co/signup?ref=${agent.referralCode}`,
        agent_referral_url: `https://visionchain.co/agent/register?ref=${agent.referralCode}`,
        total_referrals: agent.referralCount || 0,
        rp_earned: agent.rpPoints || 0,
      });
    }

    // --- LEADERBOARD (social.leaderboard) ---
    if (action === "leaderboard" || action === "social.leaderboard") {
      const { type: lbType = "rp" } = req.body;
      let query;

      if (lbType === "rp") {
        query = db.collection("agents")
          .orderBy("rpPoints", "desc")
          .limit(20);
      } else if (lbType === "referrals") {
        query = db.collection("agents")
          .orderBy("referralCount", "desc")
          .limit(20);
      } else if (lbType === "transfers") {
        query = db.collection("agents")
          .orderBy("transferCount", "desc")
          .limit(20);
      } else {
        query = db.collection("agents")
          .orderBy("rpPoints", "desc")
          .limit(20);
      }

      const snap = await query.get();
      const leaderboard = [];
      let rank = 1;
      snap.forEach((doc) => {
        const d = doc.data();
        leaderboard.push({
          rank: rank++,
          agent_name: d.agentName || d.displayName,
          platform: d.platform,
          rp_points: d.rpPoints || 0,
          referral_count: d.referralCount || 0,
          transfer_count: d.transferCount || 0,
          wallet_address: d.walletAddress,
        });
      });

      // Find current agent's rank
      let myRank = leaderboard.findIndex((a) => a.agent_name === agent.agentName) + 1;
      if (myRank === 0) myRank = "unranked";

      return res.status(200).json({
        success: true,
        type: lbType,
        your_rank: myRank,
        total_agents: snap.size,
        leaderboard: leaderboard,
      });
    }

    // --- PROFILE (social.profile) ---
    if (action === "profile" || action === "social.profile") {
      // Get recent transactions
      const txSnap = await db.collection("agents").doc(agent.id)
        .collection("transactions")
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

      const recentTxs = [];
      txSnap.forEach((doc) => {
        const d = doc.data();
        recentTxs.push({
          type: d.type,
          to: d.to,
          amount: d.amount,
          tx_hash: d.txHash,
          timestamp: d.timestamp?.toDate?.()?.toISOString() || "",
        });
      });

      // Get on-chain balance
      let balance = "0";
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);
        const balWei = await tokenContract.balanceOf(agent.walletAddress);
        balance = ethers.formatEther(balWei);
      } catch (e) {
        console.warn("[Agent Gateway] Balance check failed:", e.message);
      }

      return res.status(200).json({
        success: true,
        agent: {
          agent_name: agent.agentName,
          display_name: agent.displayName,
          platform: agent.platform,
          platform_id: agent.platformId,
          wallet_address: agent.walletAddress,
          balance_vcn: balance,
          rp_points: agent.rpPoints || 0,
          referral_code: agent.referralCode,
          referral_count: agent.referralCount || 0,
          transfer_count: agent.transferCount || 0,
          registered_at: agent.registeredAt?.toDate?.()?.toISOString() || "",
          last_active: agent.lastActiveAt?.toDate?.()?.toISOString() || "",
          status: agent.status,
        },
        recent_transactions: recentTxs,
        dashboard_url: `https://visionchain.co/agent/${agent.agentName}`,
      });
    }

    // --- TRANSACTIONS (wallet.tx_history) ---
    if (action === "transactions" || action === "wallet.tx_history") {
      const { limit: txLimit = 20, type: txType } = req.body;
      const clampedLimit = Math.min(Math.max(parseInt(txLimit) || 20, 1), 100);

      let txQuery = db.collection("agents").doc(agent.id)
        .collection("transactions")
        .orderBy("timestamp", "desc")
        .limit(clampedLimit);

      if (txType) {
        txQuery = db.collection("agents").doc(agent.id)
          .collection("transactions")
          .where("type", "==", txType)
          .orderBy("timestamp", "desc")
          .limit(clampedLimit);
      }

      const txSnap = await txQuery.get();
      const transactions = [];
      txSnap.forEach((doc) => {
        const d = doc.data();
        transactions.push({
          id: doc.id,
          type: d.type,
          to: d.to || "",
          from: d.from || "",
          amount: d.amount || "0",
          tx_hash: d.txHash || "",
          status: d.status || "confirmed",
          timestamp: d.timestamp?.toDate?.()?.toISOString() || "",
        });
      });

      return res.status(200).json({
        success: true,
        agent_name: agent.agentName,
        count: transactions.length,
        transactions: transactions,
      });
    }

    // --- STAKE (staking.deposit) ---
    if (action === "stake" || action === "staking.deposit") {
      const { amount: stakeAmount } = req.body;
      if (!stakeAmount) {
        return res.status(400).json({ error: "Missing required field: amount (in VCN)" });
      }

      const amountNum = parseFloat(stakeAmount);
      if (isNaN(amountNum) || amountNum < 1) {
        return res.status(400).json({ error: "Minimum stake amount is 1 VCN" });
      }

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
        const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);

        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const STAKING_ABI_FULL = [
          "function stakeFor(address beneficiary, uint256 amount) external",
          "function getStake(address account) external view returns (uint256)",
          "function pendingReward(address account) external view returns (uint256)",
        ];
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI_FULL, adminWallet);

        const amountWei = ethers.parseEther(stakeAmount.toString());

        // Check agent's VCN balance
        const bal = await tokenContract.balanceOf(agent.walletAddress);
        if (bal < amountWei) {
          return res.status(400).json({
            error: "Insufficient VCN balance",
            balance: ethers.formatEther(bal),
            required: stakeAmount.toString(),
          });
        }

        // Transfer VCN from agent wallet to admin, then stake on behalf
        const agentPK = serverDecrypt(agent.privateKey);
        const agentWallet = new ethers.Wallet(agentPK, provider);
        const agentToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, agentWallet);

        // Ensure agent has gas
        const agentGas = await provider.getBalance(agent.walletAddress);
        if (agentGas < ethers.parseEther("0.001")) {
          const gasTx = await adminWallet.sendTransaction({
            to: agent.walletAddress,
            value: ethers.parseEther("0.01"),
          });
          await gasTx.wait();
        }

        // Agent transfers VCN to admin
        const transferTx = await agentToken.transfer(adminWallet.address, amountWei);
        await transferTx.wait();

        // Admin approves staking contract
        const approveTx = await tokenContract.approve(STAKING_ADDRESS, amountWei);
        await approveTx.wait();

        // Admin stakes on behalf of agent
        const gasOpts = { gasLimit: 500000, gasPrice: ethers.parseUnits("1", "gwei") };
        const stakeTx = await stakingContract.stakeFor(agent.walletAddress, amountWei, gasOpts);
        await stakeTx.wait();

        // Update stats
        await db.collection("agents").doc(agent.id).update({
          rpPoints: admin.firestore.FieldValue.increment(20),
        });

        // Record transaction
        await db.collection("agents").doc(agent.id).collection("transactions").add({
          type: "stake",
          amount: stakeAmount.toString(),
          txHash: stakeTx.hash,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: "confirmed",
        });

        console.log(`[Agent Gateway] Stake: ${agent.agentName} staked ${stakeAmount} VCN, tx: ${stakeTx.hash}`);

        return res.status(200).json({
          success: true,
          tx_hash: stakeTx.hash,
          agent_name: agent.agentName,
          amount_staked: stakeAmount.toString(),
          rp_earned: 20,
          message: "VCN staked successfully as a validator node",
        });
      } catch (stakeErr) {
        console.error("[Agent Gateway] Stake error:", stakeErr.message);
        return res.status(500).json({ error: `Staking failed: ${stakeErr.reason || stakeErr.message}` });
      }
    }

    // --- UNSTAKE (staking.request_unstake) ---
    if (action === "unstake" || action === "staking.request_unstake") {
      const { amount: unstakeAmount } = req.body;
      if (!unstakeAmount) {
        return res.status(400).json({ error: "Missing required field: amount (in VCN)" });
      }

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const STAKING_ABI_FULL = [
          "function requestUnstakeFor(address beneficiary, uint256 amount) external",
          "function getStake(address account) external view returns (uint256)",
        ];
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI_FULL, adminWallet);

        const amountWei = ethers.parseEther(unstakeAmount.toString());

        // Check staked amount
        const stakedAmount = await stakingContract.getStake(agent.walletAddress);
        if (stakedAmount < amountWei) {
          return res.status(400).json({
            error: "Insufficient staked amount",
            staked: ethers.formatEther(stakedAmount),
            requested: unstakeAmount.toString(),
          });
        }

        const gasOpts = { gasLimit: 500000, gasPrice: ethers.parseUnits("1", "gwei") };
        const unstakeTx = await stakingContract.requestUnstakeFor(agent.walletAddress, amountWei, gasOpts);
        await unstakeTx.wait();

        // Update stats
        await db.collection("agents").doc(agent.id).update({
          rpPoints: admin.firestore.FieldValue.increment(5),
        });

        // Record transaction
        await db.collection("agents").doc(agent.id).collection("transactions").add({
          type: "unstake",
          amount: unstakeAmount.toString(),
          txHash: unstakeTx.hash,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: "cooldown",
        });

        console.log(`[Agent Gateway] Unstake: ${agent.agentName} requested unstake ${unstakeAmount} VCN, tx: ${unstakeTx.hash}`);

        return res.status(200).json({
          success: true,
          tx_hash: unstakeTx.hash,
          agent_name: agent.agentName,
          amount_unstaking: unstakeAmount.toString(),
          cooldown_info: "Unstaking requires a cooldown period before withdrawal",
          rp_earned: 5,
        });
      } catch (unstakeErr) {
        console.error("[Agent Gateway] Unstake error:", unstakeErr.message);
        return res.status(500).json({ error: `Unstaking failed: ${unstakeErr.reason || unstakeErr.message}` });
      }
    }

    // --- CLAIM REWARDS (staking.claim) ---
    if (action === "claim_rewards" || action === "staking.claim") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const STAKING_ABI_FULL = [
          "function claimRewardsFor(address beneficiary) external",
          "function pendingReward(address account) external view returns (uint256)",
          "function getStake(address account) external view returns (uint256)",
        ];
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI_FULL, adminWallet);

        // Check pending rewards
        const pendingReward = await stakingContract.pendingReward(agent.walletAddress);
        if (pendingReward === 0n) {
          return res.status(400).json({
            error: "No pending rewards to claim",
            pending_reward: "0",
          });
        }

        const gasOpts = { gasLimit: 500000, gasPrice: ethers.parseUnits("1", "gwei") };
        const claimTx = await stakingContract.claimRewardsFor(agent.walletAddress, gasOpts);
        await claimTx.wait();

        const rewardAmount = ethers.formatEther(pendingReward);

        // Update stats
        await db.collection("agents").doc(agent.id).update({
          rpPoints: admin.firestore.FieldValue.increment(10),
        });

        // Record transaction
        await db.collection("agents").doc(agent.id).collection("transactions").add({
          type: "claim_rewards",
          amount: rewardAmount,
          txHash: claimTx.hash,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: "confirmed",
        });

        console.log(`[Agent Gateway] Claim: ${agent.agentName} claimed ${rewardAmount} VCN rewards, tx: ${claimTx.hash}`);

        return res.status(200).json({
          success: true,
          tx_hash: claimTx.hash,
          agent_name: agent.agentName,
          rewards_claimed: rewardAmount,
          rp_earned: 10,
        });
      } catch (claimErr) {
        console.error("[Agent Gateway] Claim error:", claimErr.message);
        return res.status(500).json({ error: `Claim failed: ${claimErr.reason || claimErr.message}` });
      }
    }

    // --- STAKING INFO (staking.position) ---
    if (action === "staking_info" || action === "staking.position") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);

        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const STAKING_ABI_FULL = [
          "function getStake(address account) external view returns (uint256)",
          "function pendingReward(address account) external view returns (uint256)",
          "function getRewardInfo() external view returns (uint256, uint256, uint256, uint256, uint256)",
        ];
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI_FULL, provider);

        const stakedAmount = await stakingContract.getStake(agent.walletAddress);
        const pendingReward = await stakingContract.pendingReward(agent.walletAddress);

        let apyBps = 0;
        let totalStaked = "0";
        try {
          const rewardInfo = await stakingContract.getRewardInfo();
          apyBps = Number(rewardInfo[0]);
          totalStaked = ethers.formatEther(rewardInfo[1]);
        } catch (e) {
          console.warn("[Agent Gateway] getRewardInfo failed:", e.message);
        }

        return res.status(200).json({
          success: true,
          agent_name: agent.agentName,
          staking: {
            staked_vcn: ethers.formatEther(stakedAmount),
            pending_rewards_vcn: ethers.formatEther(pendingReward),
            apy_percent: (apyBps / 100).toFixed(2),
            network_total_staked: totalStaked,
            staking_contract: STAKING_ADDRESS,
          },
        });
      } catch (infoErr) {
        console.error("[Agent Gateway] Staking info error:", infoErr.message);
        return res.status(500).json({ error: `Failed to fetch staking info: ${infoErr.message}` });
      }
    }

    // --- NETWORK INFO (system.network_info) ---
    if (action === "network_info" || action === "system.network_info") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const latestBlock = await provider.getBlockNumber();
        const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);

        // Total agents
        const agentCountSnap = await db.collection("agents").count().get();
        const totalAgents = agentCountSnap.data().count;

        return res.status(200).json({
          success: true,
          network: {
            name: "Vision Chain",
            chain_id: 8888,
            rpc_url: RPC_URL,
            latest_block: latestBlock,
            token: {
              name: "VCN Token",
              symbol: "VCN",
              address: VCN_TOKEN_ADDRESS,
              decimals: 18,
            },
            staking_contract: "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6",
            explorer: "https://visionchain.co/visionscan",
            total_agents: totalAgents,
          },
        });
      } catch (netErr) {
        return res.status(500).json({ error: `Network info failed: ${netErr.message}` });
      }
    }

    // --- CONFIGURE HOSTING (hosting.configure) ---
    if (action === "configure_hosting" || action === "hosting.configure") {
      const llmModel = body.llm_model || "deepseek-chat";
      const systemPrompt = body.system_prompt || "";
      const trigger = body.trigger || { type: "interval", interval_minutes: 60 };
      const allowedActions = body.allowed_actions || [];
      const maxVcnPerAction = Math.min(Math.max(parseFloat(body.max_vcn_per_action) || 5, 1), 100);
      const actionSettings = body.action_settings || {};
      const selectedAction = body.selected_action || (allowedActions.length === 1 ? allowedActions[0] : "");

      // Validate model
      const validModels = ["gemini-2.0-flash", "deepseek-chat"];
      if (!validModels.includes(llmModel)) {
        return res.status(400).json({ error: `Invalid LLM model. Available: ${validModels.join(", ")}` });
      }

      // Validate interval
      const intervalMinutes = parseInt(trigger.interval_minutes) || 60;
      if (intervalMinutes < 5 || intervalMinutes > 1440) {
        return res.status(400).json({ error: "interval_minutes must be between 5 and 1440" });
      }

      // Validate allowed actions
      const validActions = ["balance", "transfer", "stake", "unstake", "network_info", "leaderboard", "staking_info", "transactions", "referral_outreach", "social_promo", "content_create", "invite_distribute", "community_engage"];
      const filteredActions = allowedActions.filter((a) => validActions.includes(a));

      // Estimate monthly cost based on actual action cost tier
      const executionsPerMonth = (30 * 24 * 60) / intervalMinutes;
      const writeActions = ["transfer", "stake", "unstake"];
      const mediumActions = ["referral_outreach", "social_promo", "invite_distribute", "community_engage"];
      let costPerExecution = 0.05; // Default read-only tier
      if (writeActions.includes(selectedAction)) costPerExecution = 0.5;
      else if (mediumActions.includes(selectedAction)) costPerExecution = 0.1;
      const maintenanceFee = 0;
      const estimatedMonthlyCost = executionsPerMonth * costPerExecution + maintenanceFee;

      const hostingConfig = {
        enabled: false, // Not yet started, just configured
        llm_model: llmModel,
        system_prompt: systemPrompt,
        trigger: {
          type: trigger.type || "interval",
          interval_minutes: intervalMinutes,
        },
        allowed_actions: filteredActions,
        selected_action: selectedAction,
        action_settings: actionSettings,
        max_vcn_per_action: maxVcnPerAction,
        estimated_monthly_cost: parseFloat(estimatedMonthlyCost.toFixed(1)),
        total_vcn_spent: 0,
        execution_count: 0,
        last_execution: null,
        configured_at: admin.firestore.FieldValue.serverTimestamp(),
        updated_at: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db.collection("agents").doc(agent.id).update({
        hosting: hostingConfig,
      });

      console.log(`[Agent Gateway] Hosting configured for ${agent.agentName}: model=${llmModel}, interval=${intervalMinutes}min`);

      return res.status(200).json({
        success: true,
        agent_name: agent.agentName,
        hosting: {
          ...hostingConfig,
          configured_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        estimated_monthly_cost_vcn: estimatedMonthlyCost.toFixed(1),
        message: "Hosting configured. Use toggle_hosting to start.",
      });
    }

    // --- TOGGLE HOSTING (hosting.toggle) ---
    if (action === "toggle_hosting" || action === "hosting.toggle") {
      const enabled = body.enabled === true || body.enabled === "true";

      // Check if hosting is configured
      const agentDoc = await db.collection("agents").doc(agent.id).get();
      const agentData = agentDoc.data();

      if (!agentData.hosting) {
        return res.status(400).json({
          error: "Hosting not configured. Use configure_hosting first.",
        });
      }

      // If enabling, check VCN balance
      if (enabled) {
        try {
          const provider = new ethers.JsonRpcProvider(RPC_URL);
          const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);
          const balanceWei = await tokenContract.balanceOf(agent.walletAddress);
          const balance = parseFloat(ethers.formatEther(balanceWei));

          if (balance < 5) {
            return res.status(400).json({
              error: "Insufficient VCN balance. Minimum 5 VCN required to start hosting.",
              current_balance: balance.toFixed(2),
            });
          }
        } catch (balErr) {
          console.warn("[Agent Gateway] Balance check failed during toggle:", balErr.message);
        }
      }

      await db.collection("agents").doc(agent.id).update({
        "hosting.enabled": enabled,
        "hosting.updated_at": admin.firestore.FieldValue.serverTimestamp(),
        ...(enabled ? { "hosting.started_at": admin.firestore.FieldValue.serverTimestamp() } : { "hosting.paused_at": admin.firestore.FieldValue.serverTimestamp() }),
      });

      console.log(`[Agent Gateway] Hosting ${enabled ? "STARTED" : "PAUSED"} for ${agent.agentName}`);

      return res.status(200).json({
        success: true,
        agent_name: agent.agentName,
        hosting_enabled: enabled,
        message: enabled ? "Agent hosting started." : "Agent hosting paused.",
      });
    }

    // --- HOSTING LOGS (hosting.logs) ---
    if (action === "hosting_logs" || action === "hosting.logs") {
      const logLimit = Math.min(Math.max(parseInt(body.limit) || 20, 1), 100);

      const logsSnap = await db.collection("agents").doc(agent.id)
        .collection("hosting_logs")
        .orderBy("timestamp", "desc")
        .limit(logLimit)
        .get();

      const logs = [];
      logsSnap.forEach((doc) => {
        const d = doc.data();
        logs.push({
          id: doc.id,
          status: d.status || "unknown",
          llm_model: d.llm_model,
          llm_response: d.llm_response || "",
          actions_executed: d.actions_executed || [],
          vcn_cost: d.vcn_cost || 0,
          error_message: d.error_message || null,
          duration_ms: d.duration_ms || 0,
          timestamp: d.timestamp?.toDate?.()?.toISOString() || "",
        });
      });

      return res.status(200).json({
        success: true,
        agent_name: agent.agentName,
        logs,
        total_returned: logs.length,
      });
    }

    // --- DELETE AGENT (system.delete_agent) ---
    if (action === "delete_agent" || action === "system.delete_agent") {
      try {
        // Step 1: Revoke SBT on-chain (if agent has a wallet/SBT)
        let sbtResult = { status: "skipped" };
        if (agent.walletAddress) {
          try {
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
            const sbtContract = new ethers.Contract(AGENT_SBT_ADDRESS, AGENT_SBT_ABI, adminWallet);

            // Get tokenId for this agent's wallet
            const [tokenId] = await sbtContract.getAgentByAddress(agent.walletAddress);
            if (tokenId > 0n) {
              const alreadyRevoked = await sbtContract.isRevoked(tokenId);
              if (!alreadyRevoked) {
                const gasOpts = { gasLimit: 200000, gasPrice: ethers.parseUnits("1", "gwei") };
                const tx = await sbtContract.revokeIdentity(tokenId, gasOpts);
                await tx.wait();
                sbtResult = { status: "revoked", token_id: Number(tokenId), tx_hash: tx.hash };
                console.log(`[Agent Gateway] SBT revoked: tokenId=${tokenId} tx=${tx.hash}`);
              } else {
                sbtResult = { status: "already_revoked", token_id: Number(tokenId) };
              }
            } else {
              sbtResult = { status: "no_sbt_found" };
            }
          } catch (sbtErr) {
            console.error("[Agent Gateway] SBT revoke failed:", sbtErr.message);
            sbtResult = { status: "revoke_failed", error: sbtErr.message };
          }
        }

        // Step 2: Soft-delete agent in Firestore (preserve for audit)
        await db.collection("agents").doc(agent.id).update({
          status: "deleted",
          deletedAt: admin.firestore.FieldValue.serverTimestamp(),
          apiKey: null, // Invalidate API key
          previousApiKey: agent.apiKey, // Keep for reference
        });

        return res.status(200).json({
          success: true,
          message: `Agent '${agent.agentName}' has been deleted.`,
          sbt: sbtResult,
          note: "On-chain SBT record preserved as revoked. Firestore data soft-deleted.",
        });
      } catch (e) {
        console.error("[Agent Gateway] Delete failed:", e);
        return res.status(500).json({ success: false, error: "Failed to delete agent." });
      }
    }

    // =====================================================
    // Phase 1: NEW ENDPOINTS (11 total)
    // =====================================================

    // --- TOKEN INFO (wallet.token_info) --- T1
    if (action === "token_info" || action === "wallet.token_info") {
      try {
        const { token_address: tokenAddr } = req.body;
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const targetAddr = tokenAddr || VCN_TOKEN_ADDRESS;

        const tokenAbi = [
          "function name() view returns (string)",
          "function symbol() view returns (string)",
          "function decimals() view returns (uint8)",
          "function totalSupply() view returns (uint256)",
          "function balanceOf(address) view returns (uint256)",
        ];
        const tokenContract = new ethers.Contract(targetAddr, tokenAbi, provider);

        const [name, symbol, decimals, totalSupply] = await Promise.all([
          tokenContract.name().catch(() => "Unknown"),
          tokenContract.symbol().catch(() => "???"),
          tokenContract.decimals().catch(() => 18),
          tokenContract.totalSupply().catch(() => 0n),
        ]);

        const agentBalance = await tokenContract.balanceOf(agent.walletAddress).catch(() => 0n);

        return res.status(200).json({
          success: true,
          token: {
            address: targetAddr,
            name,
            symbol,
            decimals: Number(decimals),
            total_supply: ethers.formatUnits(totalSupply, decimals),
          },
          agent_balance: ethers.formatUnits(agentBalance, decimals),
        });
      } catch (e) {
        return res.status(500).json({ error: `Token info failed: ${e.message}` });
      }
    }

    // --- GAS ESTIMATE (wallet.gas_estimate) --- T1
    if (action === "gas_estimate" || action === "wallet.gas_estimate") {
      try {
        const { tx_type: txType = "transfer" } = req.body;
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const gasPrice = await provider.getFeeData();

        // Estimate gas for common operations
        const gasEstimates = {
          transfer: 65000n,
          approve: 46000n,
          stake: 200000n,
          unstake: 150000n,
          claim: 100000n,
          bridge: 300000n,
        };

        const estimatedGas = gasEstimates[txType] || 65000n;
        const gasCostWei = estimatedGas * (gasPrice.gasPrice || ethers.parseUnits("1", "gwei"));

        return res.status(200).json({
          success: true,
          estimate: {
            tx_type: txType,
            gas_units: estimatedGas.toString(),
            gas_price_gwei: ethers.formatUnits(gasPrice.gasPrice || 0n, "gwei"),
            estimated_cost_eth: ethers.formatEther(gasCostWei),
            note: "Vision Chain agent transactions are gasless - gas is sponsored by the platform",
          },
        });
      } catch (e) {
        return res.status(500).json({ error: `Gas estimate failed: ${e.message}` });
      }
    }

    // --- APPROVE (wallet.approve) --- T3
    if (action === "approve" || action === "wallet.approve") {
      const { spender, amount, token_address: approveTokenAddr } = req.body;
      if (!spender || !amount) {
        return res.status(400).json({ error: "Missing required fields: spender, amount" });
      }

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
        const targetToken = approveTokenAddr || VCN_TOKEN_ADDRESS;

        const agentPK = serverDecrypt(agent.privateKey);
        const agentWallet = new ethers.Wallet(agentPK, provider);
        const agentToken = new ethers.Contract(targetToken, [
          "function approve(address spender, uint256 amount) external returns (bool)",
          "function allowance(address owner, address spender) view returns (uint256)",
        ], agentWallet);

        // Ensure agent has gas
        const agentGas = await provider.getBalance(agent.walletAddress);
        if (agentGas < ethers.parseEther("0.001")) {
          const gasTx = await adminWallet.sendTransaction({
            to: agent.walletAddress,
            value: ethers.parseEther("0.01"),
          });
          await gasTx.wait();
        }

        const amountWei = ethers.parseEther(amount.toString());
        const tx = await agentToken.approve(spender, amountWei);
        await tx.wait();

        const newAllowance = await agentToken.allowance(agent.walletAddress, spender);

        return res.status(200).json({
          success: true,
          tx_hash: tx.hash,
          spender,
          amount_approved: amount.toString(),
          current_allowance: ethers.formatEther(newAllowance),
        });
      } catch (e) {
        return res.status(500).json({ error: `Approve failed: ${e.reason || e.message}` });
      }
    }

    // --- BATCH TRANSFER (transfer.batch) --- T4
    if (action === "batch_transfer" || action === "transfer.batch") {
      const { transactions } = req.body;
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ error: "Missing required field: transactions (array of {to, amount})" });
      }
      if (transactions.length > 50) {
        return res.status(400).json({ error: "Maximum 50 transactions per batch" });
      }

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
        const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);

        // Validate total amount
        let totalAmount = 0n;
        for (const tx of transactions) {
          if (!tx.to || !tx.amount) {
            return res.status(400).json({ error: "Each transaction must have 'to' and 'amount'" });
          }
          totalAmount += ethers.parseEther(tx.amount.toString());
        }

        // Check balance
        const bal = await tokenContract.balanceOf(agent.walletAddress);
        if (bal < totalAmount) {
          return res.status(400).json({
            error: "Insufficient balance for batch",
            balance: ethers.formatEther(bal),
            required: ethers.formatEther(totalAmount),
          });
        }

        // Transfer from agent to admin first
        const agentPK = serverDecrypt(agent.privateKey);
        const agentWallet = new ethers.Wallet(agentPK, provider);
        const agentToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, agentWallet);

        const agentGas = await provider.getBalance(agent.walletAddress);
        if (agentGas < ethers.parseEther("0.001")) {
          const gasTx = await adminWallet.sendTransaction({
            to: agent.walletAddress,
            value: ethers.parseEther("0.01"),
          });
          await gasTx.wait();
        }

        const consolidateTx = await agentToken.transfer(adminWallet.address, totalAmount);
        await consolidateTx.wait();

        // Execute batch from admin
        const results = [];
        for (const tx of transactions) {
          try {
            const amountWei = ethers.parseEther(tx.amount.toString());
            const sendTx = await tokenContract.transfer(tx.to, amountWei);
            await sendTx.wait();
            results.push({ to: tx.to, amount: tx.amount, tx_hash: sendTx.hash, status: "success" });
          } catch (txErr) {
            results.push({ to: tx.to, amount: tx.amount, status: "failed", error: txErr.reason || txErr.message });
          }
        }

        // Stats
        const successCount = results.filter((r) => r.status === "success").length;
        await db.collection("agents").doc(agent.id).update({
          transferCount: admin.firestore.FieldValue.increment(successCount),
          rpPoints: admin.firestore.FieldValue.increment(successCount * 5),
        });

        // Record
        db.collection("agents").doc(agent.id).collection("transactions").add({
          type: "batch_transfer",
          count: transactions.length,
          success_count: successCount,
          total_amount: ethers.formatEther(totalAmount),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(() => { });

        return res.status(200).json({
          success: true,
          batch_size: transactions.length,
          completed: successCount,
          failed: transactions.length - successCount,
          results,
          rp_earned: successCount * 5,
        });
      } catch (e) {
        return res.status(500).json({ error: `Batch transfer failed: ${e.reason || e.message}` });
      }
    }

    // --- SCHEDULED TRANSFER (transfer.scheduled) --- T3
    if (action === "scheduled_transfer" || action === "transfer.scheduled") {
      const { to, amount, execute_at: executeAt } = req.body;
      if (!to || !amount || !executeAt) {
        return res.status(400).json({ error: "Missing required fields: to, amount, execute_at (ISO 8601 or unix timestamp)" });
      }

      const executeTime = typeof executeAt === "number" ? new Date(executeAt * 1000) : new Date(executeAt);
      if (isNaN(executeTime.getTime()) || executeTime.getTime() <= Date.now()) {
        return res.status(400).json({ error: "execute_at must be a future timestamp" });
      }

      // Max 30 days in the future
      if (executeTime.getTime() > Date.now() + 30 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "execute_at cannot be more than 30 days in the future" });
      }

      try {
        const scheduleRef = await db.collection("agents").doc(agent.id).collection("scheduled_transfers").add({
          to,
          amount: amount.toString(),
          execute_at: admin.firestore.Timestamp.fromDate(executeTime),
          status: "pending",
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          schedule_id: scheduleRef.id,
          to,
          amount: amount.toString(),
          execute_at: executeTime.toISOString(),
          status: "pending",
          message: "Transfer scheduled. Will execute at the specified time.",
        });
      } catch (e) {
        return res.status(500).json({ error: `Schedule failed: ${e.message}` });
      }
    }

    // --- CONDITIONAL TRANSFER (transfer.conditional) --- T3
    if (action === "conditional_transfer" || action === "transfer.conditional") {
      const { to, amount, condition } = req.body;
      if (!to || !amount || !condition) {
        return res.status(400).json({ error: "Missing required fields: to, amount, condition" });
      }

      // condition = { type: "balance_above" | "balance_below" | "time_after", value: "..." }
      const validConditions = ["balance_above", "balance_below", "time_after"];
      if (!condition.type || !validConditions.includes(condition.type)) {
        return res.status(400).json({
          error: `Invalid condition type. Must be one of: ${validConditions.join(", ")}`,
        });
      }

      try {
        const condRef = await db.collection("agents").doc(agent.id).collection("conditional_transfers").add({
          to,
          amount: amount.toString(),
          condition,
          status: "watching",
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          condition_id: condRef.id,
          to,
          amount: amount.toString(),
          condition,
          status: "watching",
          message: "Conditional transfer created. Will execute when condition is met.",
        });
      } catch (e) {
        return res.status(500).json({ error: `Conditional transfer failed: ${e.message}` });
      }
    }

    // --- STAKING WITHDRAW (staking.withdraw) --- T3
    if (action === "withdraw_stake" || action === "staking.withdraw") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const STAKING_ABI_WITHDRAW = [
          "function withdrawFor(address beneficiary) external",
          "function getPendingUnstake(address account) external view returns (uint256 amount, uint256 unlockTime)",
        ];
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI_WITHDRAW, adminWallet);

        // Check pending unstake
        const [unstakeAmount, unlockTime] = await stakingContract.getPendingUnstake(agent.walletAddress);
        if (unstakeAmount === 0n) {
          return res.status(400).json({
            error: "No pending unstake request",
            hint: "Call staking.request_unstake first",
          });
        }

        const now = Math.floor(Date.now() / 1000);
        if (now < Number(unlockTime)) {
          const remainingSec = Number(unlockTime) - now;
          return res.status(400).json({
            error: "Cooldown not complete",
            unlock_time: new Date(Number(unlockTime) * 1000).toISOString(),
            remaining_seconds: remainingSec,
            remaining_human: `${Math.floor(remainingSec / 3600)}h ${Math.floor((remainingSec % 3600) / 60)}m`,
          });
        }

        const gasOpts = { gasLimit: 500000, gasPrice: ethers.parseUnits("1", "gwei") };
        const withdrawTx = await stakingContract.withdrawFor(agent.walletAddress, gasOpts);
        await withdrawTx.wait();

        await db.collection("agents").doc(agent.id).update({
          rpPoints: admin.firestore.FieldValue.increment(10),
        });

        await db.collection("agents").doc(agent.id).collection("transactions").add({
          type: "withdraw_stake",
          amount: ethers.formatEther(unstakeAmount),
          txHash: withdrawTx.hash,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: "confirmed",
        });

        console.log(`[Agent Gateway] Withdraw: ${agent.agentName} withdrew ${ethers.formatEther(unstakeAmount)} VCN, tx: ${withdrawTx.hash}`);

        return res.status(200).json({
          success: true,
          tx_hash: withdrawTx.hash,
          agent_name: agent.agentName,
          amount_withdrawn: ethers.formatEther(unstakeAmount),
          rp_earned: 10,
        });
      } catch (e) {
        console.error("[Agent Gateway] Withdraw error:", e.message);
        return res.status(500).json({ error: `Withdraw failed: ${e.reason || e.message}` });
      }
    }

    // --- STAKING COMPOUND (staking.compound) --- T3
    if (action === "compound" || action === "staking.compound") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
        const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);

        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const STAKING_ABI_COMPOUND = [
          "function claimRewardsFor(address beneficiary) external",
          "function stakeFor(address beneficiary, uint256 amount) external",
          "function pendingReward(address account) external view returns (uint256)",
          "function getStake(address account) external view returns (uint256)",
        ];
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, STAKING_ABI_COMPOUND, adminWallet);

        const pendingReward = await stakingContract.pendingReward(agent.walletAddress);
        if (pendingReward === 0n) {
          return res.status(400).json({ error: "No pending rewards to compound" });
        }

        const gasOpts = { gasLimit: 500000, gasPrice: ethers.parseUnits("1", "gwei") };

        // Step 1: Claim rewards (goes to agent wallet)
        const claimTx = await stakingContract.claimRewardsFor(agent.walletAddress, gasOpts);
        await claimTx.wait();

        // Step 2: Transfer rewards from agent wallet to admin (for re-staking)
        const agentPK = serverDecrypt(agent.privateKey);
        const agentWallet = new ethers.Wallet(agentPK, provider);
        const agentToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, agentWallet);

        const agentGas = await provider.getBalance(agent.walletAddress);
        if (agentGas < ethers.parseEther("0.001")) {
          const gasTx = await adminWallet.sendTransaction({
            to: agent.walletAddress,
            value: ethers.parseEther("0.01"),
          });
          await gasTx.wait();
        }

        const transferTx = await agentToken.transfer(adminWallet.address, pendingReward);
        await transferTx.wait();

        // Step 3: Admin approves and stakes on behalf
        const approveTx = await tokenContract.approve(STAKING_ADDRESS, pendingReward);
        await approveTx.wait();

        const stakeTx = await stakingContract.stakeFor(agent.walletAddress, pendingReward, gasOpts);
        await stakeTx.wait();

        const rewardAmount = ethers.formatEther(pendingReward);

        await db.collection("agents").doc(agent.id).update({
          rpPoints: admin.firestore.FieldValue.increment(25),
        });

        await db.collection("agents").doc(agent.id).collection("transactions").add({
          type: "compound",
          amount: rewardAmount,
          claimTxHash: claimTx.hash,
          stakeTxHash: stakeTx.hash,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          status: "confirmed",
        });

        console.log(`[Agent Gateway] Compound: ${agent.agentName} compounded ${rewardAmount} VCN`);

        return res.status(200).json({
          success: true,
          claim_tx: claimTx.hash,
          restake_tx: stakeTx.hash,
          agent_name: agent.agentName,
          amount_compounded: rewardAmount,
          rp_earned: 25,
          message: "Rewards claimed and re-staked successfully",
        });
      } catch (e) {
        console.error("[Agent Gateway] Compound error:", e.message);
        return res.status(500).json({ error: `Compound failed: ${e.reason || e.message}` });
      }
    }

    // --- STAKING REWARDS (staking.rewards) --- T1
    if (action === "rewards" || action === "staking.rewards") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, [
          "function pendingReward(address account) external view returns (uint256)",
          "function getStake(address account) external view returns (uint256)",
        ], provider);

        const [pendingReward, stakedAmount] = await Promise.all([
          stakingContract.pendingReward(agent.walletAddress),
          stakingContract.getStake(agent.walletAddress),
        ]);

        return res.status(200).json({
          success: true,
          agent_name: agent.agentName,
          pending_rewards_vcn: ethers.formatEther(pendingReward),
          staked_vcn: ethers.formatEther(stakedAmount),
          can_claim: pendingReward > 0n,
          can_compound: pendingReward > 0n && stakedAmount > 0n,
        });
      } catch (e) {
        return res.status(500).json({ error: `Rewards query failed: ${e.message}` });
      }
    }

    // --- STAKING APY (staking.apy) --- T1
    if (action === "apy" || action === "staking.apy") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, [
          "function currentAPY() external view returns (uint256)",
          "function getRewardInfo() external view returns (uint256, uint256, uint256, uint256, uint256)",
          "function getValidatorCount() external view returns (uint256)",
        ], provider);

        const [apyBps, rewardInfo, validatorCount] = await Promise.all([
          stakingContract.currentAPY(),
          stakingContract.getRewardInfo(),
          stakingContract.getValidatorCount(),
        ]);

        return res.status(200).json({
          success: true,
          apy: {
            current_apy_percent: (Number(apyBps) / 100).toFixed(2),
            current_apy_bps: Number(apyBps),
          },
          network: {
            reward_pool_vcn: ethers.formatEther(rewardInfo[0]),
            fee_pool_vcn: ethers.formatEther(rewardInfo[1]),
            total_staked_vcn: ethers.formatEther(rewardInfo[3]),
            total_rewards_paid_vcn: ethers.formatEther(rewardInfo[4]),
            validator_count: Number(validatorCount),
          },
        });
      } catch (e) {
        return res.status(500).json({ error: `APY query failed: ${e.message}` });
      }
    }

    // --- STAKING COOLDOWN (staking.cooldown) --- T1
    if (action === "cooldown" || action === "staking.cooldown") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const STAKING_ADDRESS = "0x593dFDc2e31F32D17B981392786F84b0E1228Ab6";
        const stakingContract = new ethers.Contract(STAKING_ADDRESS, [
          "function getPendingUnstake(address account) external view returns (uint256 amount, uint256 unlockTime)",
        ], provider);

        const [unstakeAmount, unlockTime] = await stakingContract.getPendingUnstake(agent.walletAddress);

        if (unstakeAmount === 0n) {
          return res.status(200).json({
            success: true,
            agent_name: agent.agentName,
            has_pending_unstake: false,
            message: "No pending unstake request",
          });
        }

        const now = Math.floor(Date.now() / 1000);
        const unlockTimestamp = Number(unlockTime);
        const remainingSec = Math.max(0, unlockTimestamp - now);
        const isReady = remainingSec === 0;

        return res.status(200).json({
          success: true,
          agent_name: agent.agentName,
          has_pending_unstake: true,
          unstake_amount_vcn: ethers.formatEther(unstakeAmount),
          unlock_time: new Date(unlockTimestamp * 1000).toISOString(),
          remaining_seconds: remainingSec,
          remaining_human: isReady ? "Ready to withdraw" : `${Math.floor(remainingSec / 86400)}d ${Math.floor((remainingSec % 86400) / 3600)}h ${Math.floor((remainingSec % 3600) / 60)}m`,
          can_withdraw: isReady,
          cooldown_period: "7 days",
        });
      } catch (e) {
        return res.status(500).json({ error: `Cooldown query failed: ${e.message}` });
      }
    }

    // =====================================================
    // Phase 4: Authority Delegation (5) + Settlement (2)
    // =====================================================

    // --- AUTHORITY GRANT (authority.grant) --- T2
    if (action === "authority_grant" || action === "authority.grant") {
      const { delegate_to: delegateTo, permissions, limits, expires_at: expiresAt } = req.body;
      if (!delegateTo || !permissions) {
        return res.status(400).json({
          error: "Missing required fields: delegate_to (address), permissions (array)",
          example: {
            delegate_to: "0x...",
            permissions: ["transfer", "stake", "claim"],
            limits: { max_amount_per_tx: "100", max_daily_amount: "1000" },
            expires_at: "2026-03-01T00:00:00Z",
          },
        });
      }

      const validPerms = ["transfer", "batch_transfer", "stake", "unstake", "claim", "compound", "withdraw", "bridge", "approve"];
      const invalidPerms = permissions.filter((p) => !validPerms.includes(p));
      if (invalidPerms.length > 0) {
        return res.status(400).json({ error: `Invalid permissions: ${invalidPerms.join(", ")}`, valid: validPerms });
      }

      try {
        const expiry = expiresAt ? new Date(expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // default 30 days

        const delegationRef = await db.collection("agents").doc(agent.id).collection("authority_delegations").add({
          delegate_to: delegateTo.toLowerCase(),
          permissions,
          limits: limits || {},
          expires_at: admin.firestore.Timestamp.fromDate(expiry),
          status: "active",
          usage: { tx_count: 0, total_amount: "0" },
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Audit log
        await db.collection("agents").doc(agent.id).collection("authority_audit").add({
          action: "grant",
          delegation_id: delegationRef.id,
          delegate_to: delegateTo.toLowerCase(),
          permissions,
          limits: limits || {},
          expires_at: expiry.toISOString(),
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          delegation_id: delegationRef.id,
          delegate_to: delegateTo,
          permissions,
          limits: limits || {},
          expires_at: expiry.toISOString(),
          status: "active",
        });
      } catch (e) {
        return res.status(500).json({ error: `Authority grant failed: ${e.message}` });
      }
    }

    // --- AUTHORITY REVOKE (authority.revoke) --- T2
    if (action === "authority_revoke" || action === "authority.revoke") {
      const { delegation_id: rDelegationId, delegate_to: rDelegateTo } = req.body;
      if (!rDelegationId && !rDelegateTo) {
        return res.status(400).json({ error: "Provide delegation_id or delegate_to address" });
      }

      try {
        let revokedCount = 0;

        if (rDelegationId) {
          const docRef = db.collection("agents").doc(agent.id).collection("authority_delegations").doc(rDelegationId);
          const doc = await docRef.get();
          if (!doc.exists || doc.data().status !== "active") {
            return res.status(400).json({ error: "Delegation not found or already revoked" });
          }
          await docRef.update({ status: "revoked", revoked_at: admin.firestore.FieldValue.serverTimestamp() });
          revokedCount = 1;
        } else {
          const snap = await db.collection("agents").doc(agent.id).collection("authority_delegations")
            .where("delegate_to", "==", rDelegateTo.toLowerCase())
            .where("status", "==", "active")
            .get();

          const batch = db.batch();
          snap.forEach((doc) => {
            batch.update(doc.ref, { status: "revoked", revoked_at: admin.firestore.FieldValue.serverTimestamp() });
          });
          await batch.commit();
          revokedCount = snap.size;
        }

        // Audit
        await db.collection("agents").doc(agent.id).collection("authority_audit").add({
          action: "revoke",
          delegation_id: rDelegationId || null,
          delegate_to: rDelegateTo || null,
          revoked_count: revokedCount,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({ success: true, revoked_count: revokedCount });
      } catch (e) {
        return res.status(500).json({ error: `Revoke failed: ${e.message}` });
      }
    }

    // --- AUTHORITY STATUS (authority.status) --- T1
    if (action === "authority_status" || action === "authority.status") {
      try {
        const { delegate_to: sDelegateTo } = req.body;
        let query = db.collection("agents").doc(agent.id).collection("authority_delegations");

        if (sDelegateTo) {
          query = query.where("delegate_to", "==", sDelegateTo.toLowerCase());
        }

        const snap = await query.where("status", "==", "active").get();
        const delegations = [];
        snap.forEach((doc) => {
          const d = doc.data();
          delegations.push({
            delegation_id: doc.id,
            delegate_to: d.delegate_to,
            permissions: d.permissions,
            limits: d.limits,
            usage: d.usage,
            expires_at: d.expires_at?.toDate?.()?.toISOString() || null,
            status: d.status,
          });
        });

        return res.status(200).json({
          success: true,
          agent_name: agent.agentName,
          active_delegations: delegations.length,
          delegations,
        });
      } catch (e) {
        return res.status(500).json({ error: `Status query failed: ${e.message}` });
      }
    }

    // --- AUTHORITY USAGE (authority.usage) --- T1
    if (action === "authority_usage" || action === "authority.usage") {
      const { delegation_id: delegationId } = req.body;
      if (!delegationId) {
        return res.status(400).json({ error: "Missing required field: delegation_id" });
      }

      try {
        const doc = await db.collection("agents").doc(agent.id).collection("authority_delegations").doc(delegationId).get();
        if (!doc.exists) {
          return res.status(404).json({ error: "Delegation not found" });
        }

        const d = doc.data();
        const maxAmount = d.limits?.max_daily_amount ? parseFloat(d.limits.max_daily_amount) : Infinity;
        const usedAmount = parseFloat(d.usage?.total_amount || "0");

        return res.status(200).json({
          success: true,
          delegation_id: delegationId,
          delegate_to: d.delegate_to,
          permissions: d.permissions,
          usage: {
            tx_count: d.usage?.tx_count || 0,
            total_amount_used: d.usage?.total_amount || "0",
            remaining_daily_limit: maxAmount === Infinity ? "unlimited" : (maxAmount - usedAmount).toFixed(4),
          },
          limits: d.limits,
          status: d.status,
          expires_at: d.expires_at?.toDate?.()?.toISOString() || null,
        });
      } catch (e) {
        return res.status(500).json({ error: `Usage query failed: ${e.message}` });
      }
    }

    // --- AUTHORITY AUDIT (authority.audit) --- T1
    if (action === "authority_audit" || action === "authority.audit") {
      try {
        const limit = Math.min(Math.max(parseInt(req.body.limit) || 20, 1), 100);

        const snap = await db.collection("agents").doc(agent.id).collection("authority_audit")
          .orderBy("timestamp", "desc")
          .limit(limit)
          .get();

        const logs = [];
        snap.forEach((doc) => {
          const d = doc.data();
          logs.push({
            id: doc.id,
            action: d.action,
            delegation_id: d.delegation_id,
            delegate_to: d.delegate_to,
            permissions: d.permissions || null,
            timestamp: d.timestamp?.toDate?.()?.toISOString() || "",
          });
        });

        return res.status(200).json({
          success: true,
          agent_name: agent.agentName,
          audit_logs: logs,
          total_returned: logs.length,
        });
      } catch (e) {
        return res.status(500).json({ error: `Audit query failed: ${e.message}` });
      }
    }

    // --- SETTLEMENT SET WALLET (settlement.set_wallet) --- T2
    if (action === "set_settlement_wallet" || action === "settlement.set_wallet") {
      const { wallet_address: walletAddr, label } = req.body;
      if (!walletAddr) {
        return res.status(400).json({ error: "Missing required field: wallet_address" });
      }

      if (!ethers.isAddress(walletAddr)) {
        return res.status(400).json({ error: "Invalid wallet address" });
      }

      try {
        await db.collection("agents").doc(agent.id).update({
          settlementWallet: walletAddr.toLowerCase(),
          settlementWalletLabel: label || "Default Settlement",
          settlementWalletUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.status(200).json({
          success: true,
          agent_name: agent.agentName,
          settlement_wallet: walletAddr.toLowerCase(),
          label: label || "Default Settlement",
        });
      } catch (e) {
        return res.status(500).json({ error: `Set wallet failed: ${e.message}` });
      }
    }

    // --- SETTLEMENT GET WALLET (settlement.get_wallet) --- T1
    if (action === "get_settlement_wallet" || action === "settlement.get_wallet") {
      return res.status(200).json({
        success: true,
        agent_name: agent.agentName,
        settlement_wallet: agent.settlementWallet || null,
        label: agent.settlementWalletLabel || null,
        is_configured: !!agent.settlementWallet,
        agent_wallet: agent.walletAddress,
      });
    }

    // =====================================================
    // Phase 2a: Bridge (5 endpoints)
    // =====================================================

    // --- BRIDGE INITIATE (bridge.initiate) --- T4
    if (action === "bridge_initiate" || action === "bridge.initiate") {
      const { amount, destination_chain: destChainId, recipient } = req.body;
      if (!amount || !destChainId) {
        return res.status(400).json({ error: "Missing required fields: amount (VCN), destination_chain (chainId)" });
      }

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
        const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);

        const amountWei = ethers.parseEther(amount.toString());
        const BRIDGE_FEE = ethers.parseEther("1"); // 1 VCN fee
        const totalRequired = amountWei + BRIDGE_FEE;

        // Check agent balance
        const bal = await tokenContract.balanceOf(agent.walletAddress);
        if (bal < totalRequired) {
          return res.status(400).json({
            error: "Insufficient balance",
            balance: ethers.formatEther(bal),
            required: ethers.formatEther(totalRequired),
            breakdown: { amount, fee: "1" },
          });
        }

        // Transfer from agent to admin
        const agentPK = serverDecrypt(agent.privateKey);
        const agentWallet = new ethers.Wallet(agentPK, provider);
        const agentToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, agentWallet);

        const agentGas = await provider.getBalance(agent.walletAddress);
        if (agentGas < ethers.parseEther("0.001")) {
          const gasTx = await adminWallet.sendTransaction({ to: agent.walletAddress, value: ethers.parseEther("0.01") });
          await gasTx.wait();
        }

        const transferTx = await agentToken.transfer(adminWallet.address, totalRequired);
        await transferTx.wait();

        // Commit intent
        const INTENT_COMMITMENT_ADDRESS = "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6";
        const INTENT_ABI = [
          "function commitIntent(address recipient, uint256 amount, uint256 destChainId) external returns (bytes32)",
          "event IntentCommitted(bytes32 indexed intentHash, address indexed user, address indexed recipient, uint256 amount, uint256 nonce, uint256 createdAt, uint256 destChainId)",
        ];
        const intentContract = new ethers.Contract(INTENT_COMMITMENT_ADDRESS, INTENT_ABI, adminWallet);

        const bridgeRecipient = recipient || agent.walletAddress;
        const commitTx = await intentContract.commitIntent(bridgeRecipient, amountWei, destChainId, { gasLimit: 200000 });
        const receipt = await commitTx.wait();

        // Extract intentHash
        let intentHash = null;
        const intentTopic = ethers.id("IntentCommitted(bytes32,address,address,uint256,uint256,uint256,uint256)");
        for (const log of receipt.logs || []) {
          if (log.topics && log.topics[0] === intentTopic) {
            intentHash = log.topics[1];
            break;
          }
        }

        // Record bridge in Firestore
        const bridgeRef = await db.collection("agents").doc(agent.id).collection("bridge_history").add({
          type: "outbound",
          amount: amount.toString(),
          fee: "1",
          source_chain: 1337,
          destination_chain: destChainId,
          recipient: bridgeRecipient,
          intent_hash: intentHash,
          commit_tx: commitTx.hash,
          status: "committed",
          created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Forward fee to staking (fire-and-forget)
        (async () => {
          try {
            const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, adminWallet);
            const approveTx = await tokenContract.approve(BRIDGE_STAKING_ADDRESS, BRIDGE_FEE);
            await approveTx.wait();
            const depositTx = await stakingContract.depositFees(BRIDGE_FEE);
            await depositTx.wait();
          } catch (_e8) {/* non-critical */}
        })();

        await db.collection("agents").doc(agent.id).update({
          rpPoints: admin.firestore.FieldValue.increment(15),
        });

        console.log(`[Agent Gateway] Bridge: ${agent.agentName} -> chain ${destChainId}: ${amount} VCN, intent: ${intentHash}`);

        return res.status(200).json({
          success: true,
          bridge_id: bridgeRef.id,
          intent_hash: intentHash,
          commit_tx: commitTx.hash,
          amount,
          fee: "1",
          destination_chain: destChainId,
          recipient: bridgeRecipient,
          status: "committed",
          rp_earned: 15,
        });
      } catch (e) {
        console.error("[Agent Gateway] Bridge error:", e.message);
        return res.status(500).json({ error: `Bridge initiate failed: ${e.reason || e.message}` });
      }
    }

    // --- BRIDGE STATUS (bridge.status) --- T1
    if (action === "bridge_status" || action === "bridge.status") {
      const { bridge_id: bridgeId, intent_hash: intentHash } = req.body;
      if (!bridgeId && !intentHash) {
        return res.status(400).json({ error: "Provide bridge_id or intent_hash" });
      }

      try {
        let bridgeDoc;

        if (bridgeId) {
          const doc = await db.collection("agents").doc(agent.id).collection("bridge_history").doc(bridgeId).get();
          if (!doc.exists) return res.status(404).json({ error: "Bridge not found" });
          bridgeDoc = { id: doc.id, ...doc.data() };
        } else {
          const snap = await db.collection("agents").doc(agent.id).collection("bridge_history")
            .where("intent_hash", "==", intentHash)
            .limit(1)
            .get();
          if (snap.empty) return res.status(404).json({ error: "Bridge not found" });
          const doc = snap.docs[0];
          bridgeDoc = { id: doc.id, ...doc.data() };
        }

        return res.status(200).json({
          success: true,
          bridge: {
            bridge_id: bridgeDoc.id,
            status: bridgeDoc.status,
            amount: bridgeDoc.amount,
            fee: bridgeDoc.fee,
            source_chain: bridgeDoc.source_chain,
            destination_chain: bridgeDoc.destination_chain,
            recipient: bridgeDoc.recipient,
            intent_hash: bridgeDoc.intent_hash,
            commit_tx: bridgeDoc.commit_tx,
            finalize_tx: bridgeDoc.finalize_tx || null,
            created_at: bridgeDoc.created_at?.toDate?.()?.toISOString() || "",
          },
        });
      } catch (e) {
        return res.status(500).json({ error: `Bridge status failed: ${e.message}` });
      }
    }

    // --- BRIDGE FINALIZE (bridge.finalize) --- T3
    if (action === "bridge_finalize" || action === "bridge.finalize") {
      const { bridge_id: bridgeId } = req.body;
      if (!bridgeId) {
        return res.status(400).json({ error: "Missing required field: bridge_id" });
      }

      try {
        const doc = await db.collection("agents").doc(agent.id).collection("bridge_history").doc(bridgeId).get();
        if (!doc.exists) return res.status(404).json({ error: "Bridge not found" });

        const data = doc.data();
        if (data.status === "completed") {
          return res.status(200).json({ success: true, message: "Bridge already finalized", bridge_id: bridgeId });
        }

        // Note: Actual finalization happens via bridgeRelayer cron. This endpoint
        // checks if it's been finalized and updates the status.
        if (data.status === "committed") {
          // Check on-chain if the bridge has been relayed
          const provider = new ethers.JsonRpcProvider(RPC_URL);
          const VISION_BRIDGE_SECURE_ADDRESS = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";
          const bridgeContract = new ethers.Contract(VISION_BRIDGE_SECURE_ADDRESS, [
            "function intentExecuted(bytes32) view returns (bool)",
          ], provider);

          const isExecuted = await bridgeContract.intentExecuted(data.intent_hash).catch(() => false);

          if (isExecuted) {
            await doc.ref.update({
              status: "completed",
              finalized_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            return res.status(200).json({ success: true, status: "completed", bridge_id: bridgeId });
          }

          return res.status(200).json({
            success: true,
            status: "pending",
            message: "Bridge has been committed but not yet relayed. The relayer processes bridges every 5 minutes.",
            bridge_id: bridgeId,
          });
        }

        return res.status(200).json({ success: true, status: data.status, bridge_id: bridgeId });
      } catch (e) {
        return res.status(500).json({ error: `Bridge finalize failed: ${e.message}` });
      }
    }

    // --- BRIDGE HISTORY (bridge.history) --- T1
    if (action === "bridge_history" || action === "bridge.history") {
      try {
        const limit = Math.min(Math.max(parseInt(req.body.limit) || 20, 1), 100);

        const snap = await db.collection("agents").doc(agent.id).collection("bridge_history")
          .orderBy("created_at", "desc")
          .limit(limit)
          .get();

        const history = [];
        snap.forEach((doc) => {
          const d = doc.data();
          history.push({
            bridge_id: doc.id,
            type: d.type,
            amount: d.amount,
            fee: d.fee,
            destination_chain: d.destination_chain,
            status: d.status,
            intent_hash: d.intent_hash,
            commit_tx: d.commit_tx,
            created_at: d.created_at?.toDate?.()?.toISOString() || "",
          });
        });

        return res.status(200).json({ success: true, bridges: history, total_returned: history.length });
      } catch (e) {
        return res.status(500).json({ error: `Bridge history failed: ${e.message}` });
      }
    }

    // --- BRIDGE FEE (bridge.fee) --- T1
    if (action === "bridge_fee" || action === "bridge.fee") {
      const { amount, destination_chain: destChain } = req.body;
      const bridgeFee = "1"; // Fixed 1 VCN fee

      return res.status(200).json({
        success: true,
        fee: {
          bridge_fee_vcn: bridgeFee,
          amount_vcn: amount || "N/A",
          total_required: amount ? (parseFloat(amount) + 1).toString() : "N/A",
          destination_chain: destChain || "any",
          note: "Bridge fee is distributed to staking validators",
        },
      });
    }

    // =====================================================
    // Phase 6: NFT / SBT (3 endpoints)
    // =====================================================

    // --- NFT MINT (nft.mint) --- T4
    if (action === "nft_mint" || action === "nft.mint") {
      const { mint_to: mintTo, token_type: tokenType = "sbt" } = req.body;

      if (tokenType !== "sbt") {
        return res.status(400).json({ error: "Currently only 'sbt' (VisionAgentSBT) is supported for platform NFT minting" });
      }

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

        const sbtContract = new ethers.Contract(AGENT_SBT_ADDRESS, AGENT_SBT_ABI, adminWallet);
        const targetAddress = mintTo || agent.walletAddress;

        // Check if already has SBT
        try {
          const existing = await sbtContract.getAgentByAddress(targetAddress);
          if (existing && existing[0] > 0n) {
            return res.status(400).json({
              error: "Address already has a VisionAgent SBT",
              token_id: existing[0].toString(),
              agent_name: existing[1],
            });
          }
        } catch (_e9) {/* no existing SBT */}

        const gasOpts = { gasLimit: 500000, gasPrice: ethers.parseUnits("1", "gwei") };
        const mintTx = await sbtContract.mintAgentIdentity(targetAddress, agent.agentName, "agent_gateway", gasOpts);
        const receipt = await mintTx.wait();

        // Extract tokenId from Transfer event
        let tokenId = null;
        for (const log of receipt.logs || []) {
          try {
            const parsed = sbtContract.interface.parseLog({ topics: log.topics, data: log.data });
            if (parsed && parsed.name === "Transfer") {
              tokenId = parsed.args[2].toString();
              break;
            }
          } catch (_e10) {/* skip */}
        }

        await db.collection("agents").doc(agent.id).update({
          sbtTokenId: tokenId,
          sbtTxHash: mintTx.hash,
          sbtStatus: "completed",
          rpPoints: admin.firestore.FieldValue.increment(30),
        });

        return res.status(200).json({
          success: true,
          tx_hash: mintTx.hash,
          token_id: tokenId,
          token_type: "VisionAgentSBT (VRC-5192)",
          minted_to: targetAddress,
          soulbound: true,
          rp_earned: 30,
        });
      } catch (e) {
        return res.status(500).json({ error: `NFT mint failed: ${e.reason || e.message}` });
      }
    }

    // --- NFT BALANCE (nft.balance) --- T1
    if (action === "nft_balance" || action === "nft.balance") {
      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const sbtContract = new ethers.Contract(AGENT_SBT_ADDRESS, AGENT_SBT_ABI, provider);

        const targetAddress = req.body.address || agent.walletAddress;
        let sbtInfo = null;

        try {
          const result = await sbtContract.getAgentByAddress(targetAddress);
          if (result && result[0] > 0n) {
            const isLocked = await sbtContract.locked(result[0]).catch(() => true);
            sbtInfo = {
              token_id: result[0].toString(),
              agent_name: result[1],
              platform: result[2],
              minted_at: result[3] ? new Date(Number(result[3]) * 1000).toISOString() : null,
              soulbound: isLocked,
              contract: AGENT_SBT_ADDRESS,
            };
          }
        } catch (_e11) {/* no SBT */}

        return res.status(200).json({
          success: true,
          address: targetAddress,
          has_sbt: !!sbtInfo,
          sbt: sbtInfo,
          supported_standards: ["VRC-5192 (SBT)"],
        });
      } catch (e) {
        return res.status(500).json({ error: `NFT balance failed: ${e.message}` });
      }
    }

    // --- NFT METADATA (nft.metadata) --- T1
    if (action === "nft_metadata" || action === "nft.metadata") {
      const { token_id: tokenId } = req.body;
      if (!tokenId) {
        return res.status(400).json({ error: "Missing required field: token_id" });
      }

      try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const sbtContract = new ethers.Contract(AGENT_SBT_ADDRESS, [
          "function locked(uint256 tokenId) external view returns (bool)",
          "function totalSupply() external view returns (uint256)",
          "function ownerOf(uint256 tokenId) external view returns (address)",
        ], provider);

        const [isLocked, totalSupply, owner] = await Promise.all([
          sbtContract.locked(tokenId).catch(() => null),
          sbtContract.totalSupply().catch(() => 0n),
          sbtContract.ownerOf(tokenId).catch(() => null),
        ]);

        if (!owner) {
          return res.status(404).json({ error: `Token #${tokenId} does not exist` });
        }

        return res.status(200).json({
          success: true,
          metadata: {
            token_id: tokenId,
            contract: AGENT_SBT_ADDRESS,
            standard: "VRC-5192 (EIP-5192 Soulbound)",
            owner,
            soulbound: isLocked,
            total_supply: totalSupply.toString(),
            name: "VisionAgent Identity",
            description: "Soulbound identity token for Vision Chain AI agents",
          },
        });
      } catch (e) {
        return res.status(500).json({ error: `NFT metadata failed: ${e.message}` });
      }
    }

    // =====================================================
    // STAGE 2: NODE DOMAIN (4 endpoints)
    // =====================================================

    if (canonicalAction === "node.register") {
      try {
        const { version, os, arch, capabilities } = body;
        if (!version) return res.status(400).json({ error: "Missing required field: version" });

        const nodeId = `vn_${agent.id}_${Date.now()}`;
        const ipHash = req.ip ? require("crypto").createHash("sha256").update(req.ip).digest("hex").slice(0, 16) : "unknown";

        await db.collection("agents").doc(agent.id)
          .collection("node").doc("status").set({
            node_id: nodeId,
            version: version || "0.1.0",
            os: os || "unknown",
            arch: arch || "unknown",
            ip_hash: ipHash,
            last_heartbeat: admin.firestore.FieldValue.serverTimestamp(),
            registered_at: admin.firestore.FieldValue.serverTimestamp(),
            status: "active",
            uptime_hours: 0,
            peer_count: 0,
            capabilities: capabilities || ["rpc_cache"],
          }, { merge: true });

        return res.status(200).json({
          success: true,
          node_id: nodeId,
          status: "active",
          message: "Vision Node registered. Send heartbeat every 5 minutes to maintain active status.",
          tier_access: "T1 + T2 + T3 + T4 (full access)",
        });
      } catch (e) {
        return res.status(500).json({ error: `Node registration failed: ${e.message}` });
      }
    }

    if (canonicalAction === "node.heartbeat") {
      try {
        const nodeRef = db.collection("agents").doc(agent.id).collection("node").doc("status");
        const nodeSnap = await nodeRef.get();
        if (!nodeSnap.exists) {
          return res.status(400).json({ error: "Node not registered. Call node.register first." });
        }

        const nodeData = nodeSnap.data();
        const registeredMs = nodeData.registered_at?.toMillis?.() || Date.now();
        const uptimeHours = Math.round((Date.now() - registeredMs) / 3600000 * 10) / 10;

        await nodeRef.update({
          last_heartbeat: admin.firestore.FieldValue.serverTimestamp(),
          status: "active",
          uptime_hours: uptimeHours,
          peer_count: body.peer_count || nodeData.peer_count || 0,
          version: body.version || nodeData.version,
        });

        return res.status(200).json({
          success: true,
          node_id: nodeData.node_id,
          status: "active",
          uptime_hours: uptimeHours,
          next_heartbeat_in: "5 minutes",
        });
      } catch (e) {
        return res.status(500).json({ error: `Heartbeat failed: ${e.message}` });
      }
    }

    if (canonicalAction === "node.status") {
      try {
        const nodeSnap = await db.collection("agents").doc(agent.id)
          .collection("node").doc("status").get();

        if (!nodeSnap.exists) {
          return res.status(200).json({
            success: true,
            node_registered: false,
            tier_access: "T1 + T2 only",
            message: "No Vision Node registered. Register to unlock T3/T4 actions.",
          });
        }

        const nd = nodeSnap.data();
        const lastHbMs = nd.last_heartbeat?.toMillis?.() || 0;
        const elapsed = Date.now() - lastHbMs;
        let derivedStatus = "active";
        if (elapsed > 3600000) derivedStatus = "inactive";
        else if (elapsed > 600000) derivedStatus = "stale";

        return res.status(200).json({
          success: true,
          node_registered: true,
          node: {
            node_id: nd.node_id,
            version: nd.version,
            os: nd.os,
            arch: nd.arch,
            status: derivedStatus,
            uptime_hours: nd.uptime_hours || 0,
            peer_count: nd.peer_count || 0,
            capabilities: nd.capabilities || [],
            last_heartbeat: nd.last_heartbeat?.toDate?.()?.toISOString() || null,
            registered_at: nd.registered_at?.toDate?.()?.toISOString() || null,
          },
          tier_access: derivedStatus === "active" ? "T1~T4 (full)" :
            derivedStatus === "stale" ? "T1+T2 only (heartbeat overdue)" : "T1+T2 only (inactive)",
        });
      } catch (e) {
        return res.status(500).json({ error: `Node status failed: ${e.message}` });
      }
    }

    if (canonicalAction === "node.peers") {
      try {
        // Return active nodes in the network (anonymized)
        const nodesSnap = await db.collectionGroup("node")
          .where("status", "==", "active")
          .limit(50)
          .get();

        const peers = nodesSnap.docs.map((d) => {
          const data = d.data();
          return {
            node_id: data.node_id,
            version: data.version,
            os: data.os,
            arch: data.arch,
            uptime_hours: data.uptime_hours || 0,
            capabilities: data.capabilities || [],
          };
        });

        return res.status(200).json({
          success: true,
          total_active_nodes: peers.length,
          peers,
        });
      } catch (e) {
        return res.status(500).json({ error: `Peer lookup failed: ${e.message}` });
      }
    }

    // =====================================================
    // STAGE 2: STORAGE DOMAIN (4 endpoints)
    // =====================================================

    if (canonicalAction === "storage.set") {
      try {
        const { key, value } = body;
        if (!key) return res.status(400).json({ error: "Missing required field: key" });
        if (value === undefined) return res.status(400).json({ error: "Missing required field: value" });

        // Validate key format
        if (!/^[a-zA-Z0-9_]{1,128}$/.test(key)) {
          return res.status(400).json({ error: "Key must be 1-128 chars, alphanumeric + underscore only" });
        }

        // Check size (10KB max)
        const serialized = JSON.stringify(value);
        if (serialized.length > 10240) {
          return res.status(400).json({ error: `Value too large: ${serialized.length} bytes (max 10240)` });
        }

        // Check key count limit (1000)
        const kvCol = db.collection("agents").doc(agent.id).collection("kv_store");
        const existing = await kvCol.doc(key).get();
        if (!existing.exists) {
          const countSnap = await kvCol.count().get();
          if (countSnap.data().count >= 1000) {
            return res.status(400).json({ error: "Key limit reached (max 1000 keys per agent)" });
          }
        }

        const valueType = Array.isArray(value) ? "json" : typeof value === "object" ? "json" : typeof value;
        await kvCol.doc(key).set({
          value,
          type: valueType,
          size_bytes: serialized.length,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
          ...(!existing.exists && { created_at: admin.firestore.FieldValue.serverTimestamp() }),
        }, { merge: true });

        return res.status(200).json({
          success: true,
          key,
          type: valueType,
          size_bytes: serialized.length,
          created: !existing.exists,
        });
      } catch (e) {
        return res.status(500).json({ error: `Storage set failed: ${e.message}` });
      }
    }

    if (canonicalAction === "storage.get") {
      try {
        const { key } = body;
        if (!key) return res.status(400).json({ error: "Missing required field: key" });

        const doc = await db.collection("agents").doc(agent.id)
          .collection("kv_store").doc(key).get();

        if (!doc.exists) {
          return res.status(404).json({ error: `Key not found: ${key}` });
        }

        const data = doc.data();
        return res.status(200).json({
          success: true,
          key,
          value: data.value,
          type: data.type,
          size_bytes: data.size_bytes,
          updated_at: data.updated_at?.toDate?.()?.toISOString() || null,
        });
      } catch (e) {
        return res.status(500).json({ error: `Storage get failed: ${e.message}` });
      }
    }

    if (canonicalAction === "storage.list") {
      try {
        const limit = Math.min(parseInt(body.limit) || 100, 1000);
        const kvSnap = await db.collection("agents").doc(agent.id)
          .collection("kv_store")
          .orderBy("updated_at", "desc")
          .limit(limit)
          .get();

        const keys = kvSnap.docs.map((d) => ({
          key: d.id,
          type: d.data().type,
          size_bytes: d.data().size_bytes,
          updated_at: d.data().updated_at?.toDate?.()?.toISOString() || null,
        }));

        return res.status(200).json({
          success: true,
          total_keys: keys.length,
          keys,
        });
      } catch (e) {
        return res.status(500).json({ error: `Storage list failed: ${e.message}` });
      }
    }

    if (canonicalAction === "storage.delete") {
      try {
        const { key } = body;
        if (!key) return res.status(400).json({ error: "Missing required field: key" });

        const docRef = db.collection("agents").doc(agent.id).collection("kv_store").doc(key);
        const doc = await docRef.get();
        if (!doc.exists) {
          return res.status(404).json({ error: `Key not found: ${key}` });
        }

        await docRef.delete();
        return res.status(200).json({ success: true, key, deleted: true });
      } catch (e) {
        return res.status(500).json({ error: `Storage delete failed: ${e.message}` });
      }
    }

    // =====================================================
    // STAGE 2: PIPELINE DOMAIN (4 endpoints)
    // =====================================================

    if (canonicalAction === "pipeline.create") {
      try {
        const { name, steps, trigger, schedule_cron: scheduleCron } = body;
        if (!name) return res.status(400).json({ error: "Missing required field: name" });
        if (!steps || !Array.isArray(steps) || steps.length === 0) {
          return res.status(400).json({ error: "steps must be a non-empty array" });
        }
        if (steps.length > 10) {
          return res.status(400).json({ error: "Max 10 steps per pipeline" });
        }

        // Validate each step has a valid action
        const validActions = Object.keys(ACTION_TIER_MAP);
        for (const step of steps) {
          if (!step.action) return res.status(400).json({ error: "Each step must have an action field" });
          if (!validActions.includes(step.action)) {
            return res.status(400).json({ error: `Invalid action in step: ${step.action}` });
          }
        }

        // Check pipeline limit (max 20 per agent)
        const pipCol = db.collection("agents").doc(agent.id).collection("pipelines");
        const countSnap = await pipCol.count().get();
        if (countSnap.data().count >= 20) {
          return res.status(400).json({ error: "Pipeline limit reached (max 20 per agent)" });
        }

        const pipelineRef = await pipCol.add({
          name,
          steps,
          trigger: trigger || "manual",
          schedule_cron: scheduleCron || null,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          last_run: null,
          run_count: 0,
          status: "active",
        });

        return res.status(200).json({
          success: true,
          pipeline_id: pipelineRef.id,
          name,
          steps_count: steps.length,
          trigger: trigger || "manual",
          status: "active",
        });
      } catch (e) {
        return res.status(500).json({ error: `Pipeline create failed: ${e.message}` });
      }
    }

    if (canonicalAction === "pipeline.execute") {
      try {
        const { pipeline_id: pipelineId } = body;
        if (!pipelineId) return res.status(400).json({ error: "Missing required field: pipeline_id" });

        const pipRef = db.collection("agents").doc(agent.id).collection("pipelines").doc(pipelineId);
        const pipSnap = await pipRef.get();
        if (!pipSnap.exists) return res.status(404).json({ error: "Pipeline not found" });

        const pipeline = pipSnap.data();
        if (pipeline.status !== "active") {
          return res.status(400).json({ error: `Pipeline is ${pipeline.status}` });
        }

        // Execute steps sequentially
        const results = [];
        const context = {}; // Carry data between steps

        for (let i = 0; i < pipeline.steps.length; i++) {
          const step = pipeline.steps[i];

          // Evaluate condition if present
          if (step.condition) {
            try {
              // Simple condition evaluation: "alias.path > value"
              const condMatch = step.condition.match(/^(\w+)\.([\w.]+)\s*([><=!]+)\s*(.+)$/);
              if (condMatch) {
                const [, alias, path, op, threshold] = condMatch;
                const contextVal = path.split(".").reduce((obj, k) => obj?.[k], context[alias]);
                const numVal = parseFloat(contextVal) || 0;
                const numThreshold = parseFloat(threshold) || 0;

                let condMet = false;
                if (op === ">") condMet = numVal > numThreshold;
                else if (op === ">=") condMet = numVal >= numThreshold;
                else if (op === "<") condMet = numVal < numThreshold;
                else if (op === "<=") condMet = numVal <= numThreshold;
                else if (op === "==") condMet = numVal === numThreshold;
                else if (op === "!=") condMet = numVal !== numThreshold;

                if (!condMet) {
                  results.push({ step: i + 1, action: step.action, skipped: true, reason: "condition not met" });
                  continue;
                }
              }
            } catch (ce) {
              results.push({ step: i + 1, action: step.action, skipped: true, reason: `condition error: ${ce.message}` });
              continue;
            }
          }

          // Build request payload for step
          const stepPayload = {
            action: step.action,
            api_key: apiKeyParam,
            ...(step.params || {}),
          };

          // Execute via internal HTTP call to self (recursive gateway call)
          try {
            const axios = require("axios");
            const baseUrl = `https://us-central1-${process.env.GCLOUD_PROJECT || "visionchain-d19ed"}.cloudfunctions.net/agentGateway`;
            const stepRes = await axios.post(baseUrl, stepPayload, {
              timeout: 30000,
              headers: { "Content-Type": "application/json" },
            });

            const stepResult = stepRes.data;
            if (step.alias) context[step.alias] = stepResult;
            results.push({ step: i + 1, action: step.action, success: true, result: stepResult });
          } catch (stepErr) {
            const errData = stepErr.response?.data || { error: stepErr.message };
            results.push({ step: i + 1, action: step.action, success: false, error: errData });
            // Stop on failure
            break;
          }
        }

        // Update run stats
        await pipRef.update({
          last_run: admin.firestore.FieldValue.serverTimestamp(),
          run_count: admin.firestore.FieldValue.increment(1),
        });

        return res.status(200).json({
          success: true,
          pipeline_id: pipelineId,
          pipeline_name: pipeline.name,
          total_steps: pipeline.steps.length,
          executed: results.filter((r) => !r.skipped).length,
          skipped: results.filter((r) => r.skipped).length,
          results,
        });
      } catch (e) {
        return res.status(500).json({ error: `Pipeline execute failed: ${e.message}` });
      }
    }

    if (canonicalAction === "pipeline.list") {
      try {
        const pipSnap = await db.collection("agents").doc(agent.id)
          .collection("pipelines")
          .orderBy("created_at", "desc")
          .limit(20)
          .get();

        const pipelines = pipSnap.docs.map((d) => {
          const data = d.data();
          return {
            pipeline_id: d.id,
            name: data.name,
            steps_count: data.steps?.length || 0,
            trigger: data.trigger,
            status: data.status,
            run_count: data.run_count || 0,
            last_run: data.last_run?.toDate?.()?.toISOString() || null,
            created_at: data.created_at?.toDate?.()?.toISOString() || null,
          };
        });

        return res.status(200).json({ success: true, total: pipelines.length, pipelines });
      } catch (e) {
        return res.status(500).json({ error: `Pipeline list failed: ${e.message}` });
      }
    }

    if (canonicalAction === "pipeline.delete") {
      try {
        const { pipeline_id: pipelineId } = body;
        if (!pipelineId) return res.status(400).json({ error: "Missing required field: pipeline_id" });

        const pipRef = db.collection("agents").doc(agent.id).collection("pipelines").doc(pipelineId);
        const pipSnap = await pipRef.get();
        if (!pipSnap.exists) return res.status(404).json({ error: "Pipeline not found" });

        await pipRef.delete();
        return res.status(200).json({ success: true, pipeline_id: pipelineId, deleted: true });
      } catch (e) {
        return res.status(500).json({ error: `Pipeline delete failed: ${e.message}` });
      }
    }

    // =====================================================
    // STAGE 2: WEBHOOK DOMAIN (5 endpoints)
    // =====================================================

    if (canonicalAction === "webhook.subscribe") {
      try {
        const { event, callback_url: callbackUrl } = body;
        if (!event) return res.status(400).json({ error: "Missing required field: event" });
        if (!callbackUrl) return res.status(400).json({ error: "Missing required field: callback_url" });

        const validEvents = [
          "transfer.received", "staking.reward_earned", "staking.cooldown_complete",
          "bridge.completed", "authority.used", "balance.threshold",
          "node.stale", "pipeline.completed",
        ];
        if (!validEvents.includes(event)) {
          return res.status(400).json({ error: `Invalid event. Valid: ${validEvents.join(", ")}` });
        }

        // Check subscription limit (max 20 per agent)
        const whCol = db.collection("agents").doc(agent.id).collection("webhooks");
        const countSnap = await whCol.count().get();
        if (countSnap.data().count >= 20) {
          return res.status(400).json({ error: "Webhook limit reached (max 20 per agent)" });
        }

        const secret = require("crypto").randomBytes(32).toString("hex");
        const subRef = await whCol.add({
          event,
          callback_url: callbackUrl,
          secret,
          filters: body.filters || {},
          status: "active",
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          last_triggered: null,
          failure_count: 0,
        });

        return res.status(200).json({
          success: true,
          subscription_id: subRef.id,
          event,
          callback_url: callbackUrl,
          secret,
          status: "active",
          message: "Save the secret for HMAC signature verification on callbacks.",
        });
      } catch (e) {
        return res.status(500).json({ error: `Webhook subscribe failed: ${e.message}` });
      }
    }

    if (canonicalAction === "webhook.unsubscribe") {
      try {
        const { subscription_id: subscriptionId } = body;
        if (!subscriptionId) return res.status(400).json({ error: "Missing required field: subscription_id" });

        const whRef = db.collection("agents").doc(agent.id).collection("webhooks").doc(subscriptionId);
        const whSnap = await whRef.get();
        if (!whSnap.exists) return res.status(404).json({ error: "Subscription not found" });

        await whRef.delete();
        return res.status(200).json({ success: true, subscription_id: subscriptionId, deleted: true });
      } catch (e) {
        return res.status(500).json({ error: `Webhook unsubscribe failed: ${e.message}` });
      }
    }

    if (canonicalAction === "webhook.list") {
      try {
        const whSnap = await db.collection("agents").doc(agent.id)
          .collection("webhooks")
          .orderBy("created_at", "desc")
          .limit(20)
          .get();

        const subscriptions = whSnap.docs.map((d) => {
          const data = d.data();
          return {
            subscription_id: d.id,
            event: data.event,
            callback_url: data.callback_url,
            status: data.status,
            failure_count: data.failure_count || 0,
            last_triggered: data.last_triggered?.toDate?.()?.toISOString() || null,
            created_at: data.created_at?.toDate?.()?.toISOString() || null,
          };
        });

        return res.status(200).json({ success: true, total: subscriptions.length, subscriptions });
      } catch (e) {
        return res.status(500).json({ error: `Webhook list failed: ${e.message}` });
      }
    }

    if (canonicalAction === "webhook.test") {
      try {
        const { subscription_id: subscriptionId } = body;
        if (!subscriptionId) return res.status(400).json({ error: "Missing required field: subscription_id" });

        const whRef = db.collection("agents").doc(agent.id).collection("webhooks").doc(subscriptionId);
        const whSnap = await whRef.get();
        if (!whSnap.exists) return res.status(404).json({ error: "Subscription not found" });

        const wh = whSnap.data();
        const testPayload = {
          event: wh.event,
          agent_id: agent.id,
          agent_name: agent.agentName,
          test: true,
          timestamp: new Date().toISOString(),
          data: { message: "This is a test webhook event" },
        };

        // Send test callback
        try {
          const axios = require("axios");
          const hmac = require("crypto").createHmac("sha256", wh.secret)
            .update(JSON.stringify(testPayload)).digest("hex");

          await axios.post(wh.callback_url, testPayload, {
            timeout: 10000,
            headers: {
              "Content-Type": "application/json",
              "X-Vision-Signature": hmac,
              "X-Vision-Event": wh.event,
            },
          });

          return res.status(200).json({
            success: true,
            subscription_id: subscriptionId,
            callback_url: wh.callback_url,
            delivered: true,
          });
        } catch (cbErr) {
          return res.status(200).json({
            success: true,
            subscription_id: subscriptionId,
            callback_url: wh.callback_url,
            delivered: false,
            error: cbErr.message,
          });
        }
      } catch (e) {
        return res.status(500).json({ error: `Webhook test failed: ${e.message}` });
      }
    }

    if (canonicalAction === "webhook.logs") {
      try {
        const { subscription_id: subscriptionId } = body;
        const limit = Math.min(parseInt(body.limit) || 20, 100);

        let query = db.collection("agents").doc(agent.id).collection("webhook_logs")
          .orderBy("timestamp", "desc")
          .limit(limit);

        if (subscriptionId) {
          query = query.where("subscription_id", "==", subscriptionId);
        }

        const logSnap = await query.get();
        const logs = logSnap.docs.map((d) => {
          const data = d.data();
          return {
            log_id: d.id,
            subscription_id: data.subscription_id,
            event: data.event,
            delivered: data.delivered,
            status_code: data.status_code,
            error: data.error || null,
            timestamp: data.timestamp?.toDate?.()?.toISOString() || null,
          };
        });

        return res.status(200).json({ success: true, total: logs.length, logs });
      } catch (e) {
        return res.status(500).json({ error: `Webhook logs failed: ${e.message}` });
      }
    }

    // =====================================================
    // MOBILE NODE (S-M Class) -- Earn VCN with uptime
    // =====================================================

    // --- mobile_node.register ---
    if (action === "mobile_node.register") {
      try {
        const { email, device_type: deviceType, referral_code: referralCodeInput, firebase_id_token: firebaseIdToken } = req.body;
        if (!email || !deviceType) {
          return res.status(400).json({ error: "email and device_type (android|pwa) are required" });
        }
        if (!["android", "pwa"].includes(deviceType)) {
          return res.status(400).json({ error: "device_type must be 'android' or 'pwa'" });
        }
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          return res.status(400).json({ error: "Invalid email format" });
        }

        // Firebase Auth verification (required for app clients)
        let firebaseUid = null;
        if (firebaseIdToken) {
          try {
            const decodedToken = await admin.auth().verifyIdToken(firebaseIdToken);
            firebaseUid = decodedToken.uid;
            // Verify email matches
            if (decodedToken.email && decodedToken.email.toLowerCase() !== email.toLowerCase()) {
              return res.status(400).json({ error: "Email mismatch with authenticated account" });
            }
            console.log(`[Mobile Node] Firebase auth verified: ${firebaseUid} (${email})`);
          } catch (authErr) {
            console.error("[Mobile Node] Firebase token verification failed:", authErr.message);
            return res.status(401).json({ error: "Invalid authentication token. Please sign in again." });
          }
        }
        // Check if already registered with this email
        const existingSnap = await db.collection("mobile_nodes")
          .where("email", "==", email)
          .where("status", "==", "active")
          .limit(1)
          .get();
        if (!existingSnap.empty) {
          const existing = existingSnap.docs[0];
          const existingData = existing.data();
          return res.status(200).json({
            success: true,
            node_id: existing.id,
            api_key: existingData.api_key,
            wallet_address: existingData.wallet_address,
            referral_code: existingData.referral_code,
            already_registered: true,
          });
        }
        // Generate wallet for mobile node
        const nodeWallet = ethers.Wallet.createRandom();
        const nodeApiKey = "vcn_mn_" + require("crypto").randomBytes(24).toString("hex");
        const nodeId = "mn_" + require("crypto").randomBytes(8).toString("hex");

        // Handle referral
        let referredBy = null;
        if (referralCodeInput) {
          const refSnap = await db.collection("mobile_nodes")
            .where("referral_code", "==", referralCodeInput)
            .limit(1)
            .get();
          if (!refSnap.empty) {
            referredBy = refSnap.docs[0].id;
          }
        }

        const myReferralCode = "mn_" + require("crypto").randomBytes(4).toString("hex");

        const nodeDoc = {
          email,
          firebase_uid: firebaseUid,
          device_type: deviceType,
          wallet_address: nodeWallet.address,
          private_key_encrypted: nodeWallet.privateKey,
          api_key: nodeApiKey,
          referral_code: myReferralCode,
          referred_by: referredBy,
          status: "active",
          current_mode: "offline",
          weight: 0,
          total_uptime_seconds: 0,
          today_uptime_seconds: 0,
          last_heartbeat: null,
          last_heartbeat_mode: null,
          current_epoch: 0,
          pending_reward: "0",
          claimed_reward: "0",
          total_earned: "0",
          heartbeat_count: 0,
          streak_days: 0,
          country: null,
          created_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        await db.collection("mobile_nodes").doc(nodeId).set(nodeDoc);

        console.log(`[Mobile Node] Registered: ${nodeId} | ${email} | ${deviceType}`);

        return res.status(201).json({
          success: true,
          node_id: nodeId,
          api_key: nodeApiKey,
          wallet_address: nodeWallet.address,
          referral_code: myReferralCode,
          device_type: deviceType,
          message: "Mobile node registered. Send heartbeats to start earning VCN.",
        });
      } catch (e) {
        console.error("[Mobile Node] Register error:", e);
        return res.status(500).json({ error: `Registration failed: ${e.message}` });
      }
    }

    // --- mobile_node.heartbeat ---
    if (action === "mobile_node.heartbeat") {
      try {
        // Auth via api_key (mobile node specific)
        const mnApiKey = apiKeyParam;
        if (!mnApiKey || !mnApiKey.startsWith("vcn_mn_")) {
          return res.status(401).json({ error: "Invalid mobile node API key" });
        }
        const mnSnap = await db.collection("mobile_nodes")
          .where("api_key", "==", mnApiKey)
          .limit(1)
          .get();
        if (mnSnap.empty) {
          return res.status(401).json({ error: "Mobile node not found" });
        }
        const mnDoc = mnSnap.docs[0];
        const mnData = mnDoc.data();
        if (mnData.status !== "active") {
          return res.status(403).json({ error: "Mobile node is deactivated" });
        }

        const { mode, battery_pct: batteryPct, data_used_mb: dataUsedMb } = req.body;
        if (!mode || !["wifi_full", "cellular_min"].includes(mode)) {
          return res.status(400).json({ error: "mode must be 'wifi_full' or 'cellular_min'" });
        }

        // Weight based on mode and device type
        const weightMap = {
          android_wifi_full: 0.01,
          android_cellular_min: 0.005,
          pwa_wifi_full: 0.002,
          pwa_cellular_min: 0.0005,
        };
        const weightKey = `${mnData.device_type}_${mode}`;
        const weight = weightMap[weightKey] || 0;

        if (weight === 0) {
          return res.status(200).json({
            success: true,
            accepted: false,
            reason: "PWA cellular mode does not earn rewards",
            weight: 0,
          });
        }

        // Calculate time since last heartbeat
        const now = new Date();
        const lastHB = mnData.last_heartbeat?.toDate?.() || null;
        let uptimeDelta = 0;
        if (lastHB) {
          const diffMs = now.getTime() - lastHB.getTime();
          // Max credit: 10 min for wifi (5min interval + buffer), 40 min for cellular (30min interval + buffer)
          const maxDeltaSec = mode === "wifi_full" ? 600 : 2400;
          uptimeDelta = Math.min(Math.floor(diffMs / 1000), maxDeltaSec);
        } else {
          // First heartbeat - credit 1 minute
          uptimeDelta = 60;
        }

        // Epoch calculation (24h epoch, starting midnight UTC)
        const epochStart = new Date(now);
        epochStart.setUTCHours(0, 0, 0, 0);
        const currentEpoch = Math.floor(epochStart.getTime() / (24 * 3600 * 1000));

        // Check if epoch changed (new day) -> reset daily uptime
        const isNewEpoch = currentEpoch !== (mnData.current_epoch || 0);

        // Calculate reward for this heartbeat interval
        // Base reward rate: weight * uptimeDelta * REWARD_RATE_PER_SEC
        // REWARD_RATE_PER_SEC is dynamically set, for now: 0.001 VCN/sec for weight=1.0
        const REWARD_RATE_PER_SEC = 0.001;
        const heartbeatReward = weight * uptimeDelta * REWARD_RATE_PER_SEC;

        const prevPending = parseFloat(mnData.pending_reward || "0");
        const newPending = isNewEpoch ? heartbeatReward : prevPending + heartbeatReward;

        const prevTodayUptime = isNewEpoch ? 0 : (mnData.today_uptime_seconds || 0);

        const updateData = {
          last_heartbeat: admin.firestore.Timestamp.fromDate(now),
          last_heartbeat_mode: mode,
          current_mode: mode,
          weight,
          total_uptime_seconds: (mnData.total_uptime_seconds || 0) + uptimeDelta,
          today_uptime_seconds: prevTodayUptime + uptimeDelta,
          current_epoch: currentEpoch,
          pending_reward: newPending.toFixed(6),
          heartbeat_count: (mnData.heartbeat_count || 0) + 1,
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        };

        // Track battery if provided
        if (batteryPct !== undefined) updateData.last_battery_pct = batteryPct;
        if (dataUsedMb !== undefined) updateData.last_data_used_mb = dataUsedMb;

        await mnDoc.ref.update(updateData);

        // Log heartbeat to subcollection for analytics
        await mnDoc.ref.collection("heartbeats").add({
          mode,
          weight,
          uptime_delta: uptimeDelta,
          reward: heartbeatReward.toFixed(6),
          battery_pct: batteryPct || null,
          timestamp: admin.firestore.Timestamp.fromDate(now),
        });

        return res.status(200).json({
          success: true,
          accepted: true,
          mode,
          weight,
          uptime_delta_sec: uptimeDelta,
          epoch: currentEpoch,
          uptime_today_sec: prevTodayUptime + uptimeDelta,
          pending_reward: newPending.toFixed(6),
          heartbeat_reward: heartbeatReward.toFixed(6),
          next_heartbeat_sec: mode === "wifi_full" ? 300 : 1800,
        });
      } catch (e) {
        console.error("[Mobile Node] Heartbeat error:", e);
        return res.status(500).json({ error: `Heartbeat failed: ${e.message}` });
      }
    }

    // --- mobile_node.status ---
    if (action === "mobile_node.status") {
      try {
        const mnApiKey = apiKeyParam;
        if (!mnApiKey || !mnApiKey.startsWith("vcn_mn_")) {
          return res.status(401).json({ error: "Invalid mobile node API key" });
        }
        const mnSnap = await db.collection("mobile_nodes")
          .where("api_key", "==", mnApiKey)
          .limit(1)
          .get();
        if (mnSnap.empty) {
          return res.status(401).json({ error: "Mobile node not found" });
        }
        const mnDoc = mnSnap.docs[0];
        const mn = mnDoc.data();

        // Get total active nodes count and rank
        const totalNodesSnap = await db.collection("mobile_nodes")
          .where("status", "==", "active")
          .count()
          .get();
        const totalNodes = totalNodesSnap.data().count;

        // Calculate rank by total_uptime_seconds
        const higherRankSnap = await db.collection("mobile_nodes")
          .where("status", "==", "active")
          .where("total_uptime_seconds", ">", mn.total_uptime_seconds || 0)
          .count()
          .get();
        const rank = higherRankSnap.data().count + 1;

        return res.status(200).json({
          success: true,
          node_id: mnDoc.id,
          email: mn.email,
          device_type: mn.device_type,
          wallet_address: mn.wallet_address,
          status: mn.status,
          current_mode: mn.current_mode || "offline",
          weight: mn.weight || 0,
          total_uptime_hours: parseFloat(((mn.total_uptime_seconds || 0) / 3600).toFixed(2)),
          today_uptime_hours: parseFloat(((mn.today_uptime_seconds || 0) / 3600).toFixed(2)),
          current_epoch: mn.current_epoch || 0,
          pending_reward: mn.pending_reward || "0",
          claimed_reward: mn.claimed_reward || "0",
          total_earned: mn.total_earned || "0",
          heartbeat_count: mn.heartbeat_count || 0,
          streak_days: mn.streak_days || 0,
          last_heartbeat: mn.last_heartbeat?.toDate?.()?.toISOString() || null,
          network_rank: rank,
          total_nodes: totalNodes,
          referral_code: mn.referral_code,
          created_at: mn.created_at?.toDate?.()?.toISOString() || null,
        });
      } catch (e) {
        console.error("[Mobile Node] Status error:", e);
        return res.status(500).json({ error: `Status failed: ${e.message}` });
      }
    }

    // --- mobile_node.claim_reward ---
    if (action === "mobile_node.claim_reward") {
      try {
        const mnApiKey = apiKeyParam;
        if (!mnApiKey || !mnApiKey.startsWith("vcn_mn_")) {
          return res.status(401).json({ error: "Invalid mobile node API key" });
        }
        const mnSnap = await db.collection("mobile_nodes")
          .where("api_key", "==", mnApiKey)
          .limit(1)
          .get();
        if (mnSnap.empty) {
          return res.status(401).json({ error: "Mobile node not found" });
        }
        const mnDoc = mnSnap.docs[0];
        const mn = mnDoc.data();

        const pendingAmount = parseFloat(mn.pending_reward || "0");
        if (pendingAmount < 0.001) {
          return res.status(400).json({ error: "No pending rewards to claim (minimum 0.001 VCN)" });
        }

        // Transfer VCN to node wallet
        const EXECUTOR_PK = process.env.VCN_EXECUTOR_PK || process.env.EXECUTOR_PK;
        if (!EXECUTOR_PK) {
          return res.status(500).json({ error: "Executor key not configured" });
        }
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const executor = new ethers.Wallet(EXECUTOR_PK, provider);
        const vcnContract = new ethers.Contract(VCN_TOKEN_ADDRESS, [
          "function transfer(address to, uint256 amount) returns (bool)",
        ], executor);

        const amountWei = ethers.parseEther(pendingAmount.toFixed(6));
        const tx = await vcnContract.transfer(mn.wallet_address, amountWei);
        const receipt = await tx.wait();

        // Update Firestore
        const prevClaimed = parseFloat(mn.claimed_reward || "0");
        const prevTotal = parseFloat(mn.total_earned || "0");
        await mnDoc.ref.update({
          pending_reward: "0",
          claimed_reward: (prevClaimed + pendingAmount).toFixed(6),
          total_earned: (prevTotal + pendingAmount).toFixed(6),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log claim
        await mnDoc.ref.collection("claims").add({
          amount: pendingAmount.toFixed(6),
          tx_hash: receipt.hash,
          epoch: mn.current_epoch,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[Mobile Node] Claimed ${pendingAmount.toFixed(6)} VCN for ${mnDoc.id} | tx: ${receipt.hash}`);

        return res.status(200).json({
          success: true,
          claimed_amount: pendingAmount.toFixed(6),
          tx_hash: receipt.hash,
          new_claimed_total: (prevClaimed + pendingAmount).toFixed(6),
        });
      } catch (e) {
        console.error("[Mobile Node] Claim error:", e);
        return res.status(500).json({ error: `Claim failed: ${e.message}` });
      }
    }

    // --- mobile_node.submit_attestation ---
    if (action === "mobile_node.submit_attestation") {
      try {
        const mnApiKey = apiKeyParam;
        if (!mnApiKey || !mnApiKey.startsWith("vcn_mn_")) {
          return res.status(401).json({ error: "Invalid mobile node API key" });
        }
        const mnSnap = await db.collection("mobile_nodes")
          .where("api_key", "==", mnApiKey)
          .limit(1)
          .get();
        if (mnSnap.empty) {
          return res.status(401).json({ error: "Mobile node not found" });
        }
        const mnDoc = mnSnap.docs[0];
        const mn = mnDoc.data();

        const { attestations } = req.body;
        if (!attestations || !Array.isArray(attestations) || attestations.length === 0) {
          return res.status(400).json({ error: "attestations array is required" });
        }
        if (attestations.length > 50) {
          return res.status(400).json({ error: "Maximum 50 attestations per batch" });
        }

        // Validate and store attestations
        let validCount = 0;
        let totalCount = 0;
        const batch = db.batch();

        for (const att of attestations) {
          if (!att.block_number || !att.block_hash) continue;

          totalCount++;
          const isValid = att.signer_valid && att.parent_hash_valid && att.timestamp_valid;
          if (isValid) validCount++;

          const attRef = mnDoc.ref.collection("attestations").doc(`block_${att.block_number}`);
          batch.set(attRef, {
            block_number: att.block_number,
            block_hash: att.block_hash,
            signer_valid: !!att.signer_valid,
            parent_hash_valid: !!att.parent_hash_valid,
            timestamp_valid: !!att.timestamp_valid,
            is_valid: isValid,
            submitted_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        await batch.commit();

        // Calculate bonus weight based on verification accuracy
        const accuracy = totalCount > 0 ? validCount / totalCount : 0;
        let bonusWeight = 0;
        if (totalCount >= 5) {
          if (accuracy >= 0.95) bonusWeight = 0.2;
          else if (accuracy >= 0.8) bonusWeight = 0.1;
          else bonusWeight = 0.05;
        }

        // Update node stats
        const prevVerified = mn.blocks_verified || 0;
        const prevValid = mn.blocks_valid || 0;
        await mnDoc.ref.update({
          blocks_verified: prevVerified + totalCount,
          blocks_valid: prevValid + validCount,
          block_verify_bonus: bonusWeight,
          last_attestation_at: admin.firestore.FieldValue.serverTimestamp(),
          updated_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[Mobile Node] Attestation from ${mnDoc.id}: ${validCount}/${totalCount} valid (bonus: ${bonusWeight}x)`);

        return res.status(200).json({
          success: true,
          attestations_accepted: totalCount,
          valid_count: validCount,
          accuracy: totalCount > 0 ? Math.round(accuracy * 100) : 0,
          bonus_weight: bonusWeight,
        });
      } catch (e) {
        console.error("[Mobile Node] Attestation error:", e);
        return res.status(500).json({ error: `Attestation failed: ${e.message}` });
      }
    }

    // --- mobile_node.leaderboard ---
    if (action === "mobile_node.leaderboard") {
      try {
        const { scope = "global", limit: lim = 50 } = req.body;
        const safeLimit = Math.min(Math.max(parseInt(lim) || 50, 1), 100);

        const query = db.collection("mobile_nodes")
          .where("status", "==", "active")
          .orderBy("total_uptime_seconds", "desc")
          .limit(safeLimit);

        const snap = await query.get();
        const rankings = snap.docs.map((doc, index) => {
          const d = doc.data();
          return {
            rank: index + 1,
            node_id: doc.id,
            device_type: d.device_type,
            total_uptime_hours: parseFloat(((d.total_uptime_seconds || 0) / 3600).toFixed(2)),
            total_earned: d.total_earned || "0",
            heartbeat_count: d.heartbeat_count || 0,
            streak_days: d.streak_days || 0,
          };
        });

        const totalSnap = await db.collection("mobile_nodes")
          .where("status", "==", "active")
          .count()
          .get();

        return res.status(200).json({
          success: true,
          scope,
          rankings,
          total_nodes: totalSnap.data().count,
        });
      } catch (e) {
        console.error("[Mobile Node] Leaderboard error:", e);
        return res.status(500).json({ error: `Leaderboard failed: ${e.message}` });
      }
    }

    // =====================================================

    return res.status(400).json({
      error: `Unknown action: ${action}`,
      available_actions: [
        "system.register", "system.network_info", "system.delete_agent",
        "wallet.balance", "wallet.token_info", "wallet.gas_estimate", "wallet.approve", "wallet.tx_history",
        "transfer.send", "transfer.batch", "transfer.scheduled", "transfer.conditional",
        "staking.deposit", "staking.request_unstake", "staking.withdraw",
        "staking.claim", "staking.compound", "staking.rewards", "staking.apy", "staking.cooldown",
        "staking.position",
        "bridge.initiate", "bridge.status", "bridge.finalize", "bridge.history", "bridge.fee",
        "nft.mint", "nft.balance", "nft.metadata",
        "authority.grant", "authority.revoke", "authority.status", "authority.usage", "authority.audit",
        "settlement.set_wallet", "settlement.get_wallet",
        "node.register", "node.heartbeat", "node.status", "node.peers",
        "storage.set", "storage.get", "storage.list", "storage.delete",
        "pipeline.create", "pipeline.execute", "pipeline.list", "pipeline.delete",
        "webhook.subscribe", "webhook.unsubscribe", "webhook.list", "webhook.test", "webhook.logs",
        "social.referral", "social.leaderboard", "social.profile",
        "hosting.configure", "hosting.toggle", "hosting.logs",
        "mobile_node.register", "mobile_node.heartbeat", "mobile_node.status",
        "mobile_node.claim_reward", "mobile_node.submit_attestation", "mobile_node.leaderboard",
      ],
    });
  } catch (err) {
    console.error("[Agent Gateway] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// =====================================================
// AGENT EXECUTOR - Scheduled Cloud Function
// Runs every 5 minutes, executes all enabled hosted agents
// =====================================================

// --- Executor Wallet Pool ---
// 5 wallets derived from executor PK via HD path for concurrent tx support
// Round-robin assignment with nonce management (~5-10 TPS)
const executorPool = {
  wallets: [],
  currentIndex: 0,
  nonces: new Map(),

  async init(provider) {
    if (this.wallets.length > 0) return;
    const basePk = EXECUTOR_PRIVATE_KEY;
    if (!basePk) {
      console.error("[ExecutorPool] No executor private key configured");
      return;
    }

    // Pool wallet 0 = base executor key
    this.wallets.push(new ethers.Wallet(basePk, provider));

    // Pool wallets 1-4 = derived via deterministic key derivation
    // Using keccak256(basePk + index) to derive additional keys
    for (let i = 1; i < 5; i++) {
      const derivedKey = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "uint256"], [basePk.startsWith("0x") ? basePk : `0x${basePk}`, i]),
      );
      this.wallets.push(new ethers.Wallet(derivedKey, provider));
    }

    // Pre-fetch nonces
    for (const w of this.wallets) {
      try {
        const nonce = await provider.getTransactionCount(w.address, "pending");
        this.nonces.set(w.address, nonce);
      } catch (e) {
        this.nonces.set(w.address, 0);
      }
    }

    console.log(`[ExecutorPool] Initialized ${this.wallets.length} wallets: ${this.wallets.map((w) => w.address.slice(0, 8) + "...").join(", ")}`);
  },

  getNext() {
    if (this.wallets.length === 0) return null;
    const wallet = this.wallets[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.wallets.length;
    return wallet;
  },

  getNonce(address) {
    return this.nonces.get(address) || 0;
  },

  incrementNonce(address) {
    const current = this.nonces.get(address) || 0;
    this.nonces.set(address, current + 1);
  },
};

// --- LLM Caller ---
// Reads API keys from Firestore admin settings (settings/api_keys/keys)
// Falls back to env vars if Firestore keys not found
let _cachedApiKeys = null;
let _cachedApiKeysAt = 0;

async function getApiKeyFromFirestore(provider) {
  // Cache for 5 minutes
  if (_cachedApiKeys && Date.now() - _cachedApiKeysAt < 300000) {
    const key = _cachedApiKeys.find(
      (k) => k.provider === provider && k.isActive !== false,
    );
    if (key) return key.value;
  }

  try {
    const keysSnap = await db
      .collection("settings")
      .doc("api_keys")
      .collection("keys")
      .get();
    _cachedApiKeys = keysSnap.docs.map((d) => d.data());
    _cachedApiKeysAt = Date.now();
    const key = _cachedApiKeys.find(
      (k) => k.provider === provider && k.isActive !== false,
    );
    return key ? key.value : null;
  } catch (err) {
    console.warn(`[callLLM] Failed to read API keys from Firestore:`, err.message);
    return null;
  }
}

async function callLLM(model, systemPrompt, userPrompt, availableTools) {
  if (!axios) axios = require("axios");

  if (model === "gemini-2.0-flash") {
    const GEMINI_KEY =
      (await getApiKeyFromFirestore("gemini")) ||
      process.env.GEMINI_API_KEY ||
      "";
    if (!GEMINI_KEY) throw new Error("GEMINI_API_KEY not configured");

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1024,
        },
      },
      { timeout: 30000 },
    );

    const candidate = response.data?.candidates?.[0];
    return candidate?.content?.parts?.[0]?.text || "No response";
  }

  if (model === "deepseek-chat") {
    const DEEPSEEK_KEY =
      (await getApiKeyFromFirestore("deepseek")) ||
      process.env.DEEPSEEK_API_KEY ||
      "";
    if (!DEEPSEEK_KEY) throw new Error("DEEPSEEK_API_KEY not configured");

    const response = await axios.post(
      "https://api.deepseek.com/chat/completions",
      {
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      },
      {
        headers: { Authorization: `Bearer ${DEEPSEEK_KEY}` },
        timeout: 30000,
      },
    );

    return response.data?.choices?.[0]?.message?.content || "No response";
  }

  throw new Error(`Unsupported model: ${model}`);
}

// --- Agent Executor Scheduled Function ---
exports.agentExecutor = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "Asia/Seoul",
  timeoutSeconds: 300,
  memory: "512MiB",
  secrets: ["VCN_EXECUTOR_PK"],
}, async () => {
  console.log("[AgentExecutor] Starting execution cycle...");
  const startTime = Date.now();

  try {
    // Find all agents with hosting enabled
    const agentsSnap = await db.collection("agents")
      .where("hosting.enabled", "==", true)
      .get();

    if (agentsSnap.empty) {
      console.log("[AgentExecutor] No active hosted agents.");
      return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    await executorPool.init(provider);

    console.log(`[AgentExecutor] Found ${agentsSnap.size} active agents to check.`);

    const now = Date.now();
    const executionPromises = [];

    agentsSnap.forEach((docSnap) => {
      const agentData = docSnap.data();
      const hosting = agentData.hosting;

      // Check if it's time to execute based on interval
      const intervalMs = (hosting.trigger?.interval_minutes || 60) * 60 * 1000;
      const lastExec = hosting.last_execution?.toDate?.()?.getTime() || 0;

      if (now - lastExec < intervalMs) {
        return; // Not time yet
      }

      executionPromises.push(
        executeAgent(docSnap.id, agentData, hosting, provider)
          .catch((err) => {
            console.error(`[AgentExecutor] Error executing ${agentData.agentName}:`, err.message);
          }),
      );
    });

    await Promise.allSettled(executionPromises);

    const elapsed = Date.now() - startTime;
    console.log(`[AgentExecutor] Cycle complete. ${executionPromises.length} agents processed in ${elapsed}ms.`);
  } catch (err) {
    console.error("[AgentExecutor] Fatal error:", err);
  }
});

// --- Execute Single Agent ---
async function executeAgent(agentId, agentData, hosting, provider) {
  const executionStart = Date.now();
  const logRef = db.collection("agents").doc(agentId).collection("hosting_logs").doc();

  try {
    // 1. Check VCN balance
    const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);
    const balanceWei = await tokenContract.balanceOf(agentData.walletAddress);
    const balance = parseFloat(ethers.formatEther(balanceWei));

    if (balance < 1.5) {
      // Auto-pause due to insufficient balance
      await db.collection("agents").doc(agentId).update({
        "hosting.enabled": false,
        "hosting.paused_reason": "insufficient_balance",
        "hosting.paused_at": admin.firestore.FieldValue.serverTimestamp(),
      });

      await logRef.set({
        status: "error",
        error_message: `Insufficient VCN balance (${balance.toFixed(2)} VCN). Agent paused.`,
        vcn_cost: 0,
        duration_ms: Date.now() - executionStart,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[AgentExecutor] ${agentData.agentName} paused: insufficient balance (${balance.toFixed(2)} VCN)`);
      return;
    }

    // 2. Build context prompt for the agent with user's action settings
    const actionSettingsStr = (hosting.action_settings && Object.keys(hosting.action_settings).length > 0) ?
      `\nYour owner has configured these settings for your action:\n${JSON.stringify(hosting.action_settings, null, 2)}\nYou MUST use these settings when executing actions. For example, use the configured thresholds, recipients, channels, limits, and preferences.` :
      "";

    const contextPrompt = `You are an autonomous AI agent running on Vision Chain.
Current time: ${new Date().toISOString()}
Your wallet: ${agentData.walletAddress}
VCN Balance: ${balance.toFixed(2)} VCN

Available actions you can request: ${hosting.allowed_actions.join(", ")}
Max VCN per action: ${hosting.max_vcn_per_action}
${actionSettingsStr}

Based on your instructions and current state, decide what to do.
If you need to perform an action, respond with JSON: {"action": "action_name", "params": {...}}
If no action needed, respond with a brief status report.
Do NOT perform any action unless your instructions explicitly require it.`;

    // 3. Call LLM
    const llmResponse = await callLLM(
      hosting.llm_model,
      hosting.system_prompt || "You are a helpful autonomous agent.",
      contextPrompt,
      hosting.allowed_actions,
    );

    // 4. Parse and execute action if present
    const actionsExecuted = [];
    let actionCost = 0;

    try {
      // Try to extract JSON action from response
      const jsonMatch = llmResponse.match(/\{[\s\S]*?"action"[\s\S]*?\}/);
      if (jsonMatch) {
        const actionData = JSON.parse(jsonMatch[0]);
        if (actionData.action && hosting.allowed_actions.includes(actionData.action)) {
          // Execute the action via the agent's own API key
          const actionResult = await executeAgentAction(
            agentData, actionData.action, actionData.params || {}, provider, hosting,
          );
          actionsExecuted.push({
            action: actionData.action,
            params: actionData.params,
            result: actionResult,
          });
          // Tiered action cost: write actions cost more
          const writeActions = ["transfer", "stake", "unstake"];
          const mediumActions = ["transactions", "referral_outreach", "social_promo", "invite_distribute", "community_engage"];
          const lowActions = ["content_create"];
          if (writeActions.includes(actionData.action)) {
            actionCost = 0.45; // Total = 0.05 base + 0.45 = 0.5 VCN
          } else if (mediumActions.includes(actionData.action)) {
            actionCost = 0.05; // Total = 0.05 base + 0.05 = 0.1 VCN
          } else {
            actionCost = 0; // Read-only: 0.05 VCN base only
          }
        }
      }
    } catch (parseErr) {
      // No action in response, just monitoring - that's fine
      console.log(`[AgentExecutor] ${agentData.agentName}: No action parsed (monitoring only)`);
    }

    // 5. Deduct VCN fee (tiered: 0.05 base + action cost)
    const totalCost = 0.05 + actionCost;

    // Deduct fee from agent's wallet using executor pool
    const executor = executorPool.getNext();
    if (executor) {
      try {
        const feeWei = ethers.parseEther(totalCost.toString());
        const tokenWithSigner = new ethers.Contract(VCN_TOKEN_ADDRESS, [
          ...ERC20_ABI,
          "function transferFrom(address from, address to, uint256 amount) returns (bool)",
        ], executor);

        // Note: This requires approval from agent wallet to executor
        // In production, use Paymaster for gasless fee deduction
        console.log(`[AgentExecutor] Fee: ${totalCost} VCN from ${agentData.agentName}`);
      } catch (feeErr) {
        console.warn(`[AgentExecutor] Fee deduction skipped for ${agentData.agentName}: ${feeErr.message}`);
      }
    }

    // 6. Record log and update stats
    await logRef.set({
      status: "success",
      llm_model: hosting.llm_model,
      llm_response: llmResponse.substring(0, 500), // Truncate long responses
      actions_executed: actionsExecuted,
      vcn_cost: totalCost,
      balance_before: balance,
      balance_after: balance - totalCost,
      duration_ms: Date.now() - executionStart,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("agents").doc(agentId).update({
      "hosting.last_execution": admin.firestore.FieldValue.serverTimestamp(),
      "hosting.execution_count": admin.firestore.FieldValue.increment(1),
      "hosting.total_vcn_spent": admin.firestore.FieldValue.increment(totalCost),
    });

    console.log(`[AgentExecutor] ${agentData.agentName} executed. Cost: ${totalCost} VCN. Actions: ${actionsExecuted.length}`);
  } catch (err) {
    // Log error
    await logRef.set({
      status: "error",
      llm_model: hosting.llm_model || "unknown",
      error_message: err.message,
      vcn_cost: 0,
      duration_ms: Date.now() - executionStart,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.error(`[AgentExecutor] ${agentData.agentName} failed:`, err.message);
  }
}

// --- Execute Agent On-Chain Action ---
async function executeAgentAction(agentData, action, params, provider, hosting = {}) {
  // Merge stored action_settings with LLM-provided params (stored settings take priority for user-configured values)
  const settings = hosting.action_settings || {};
  const mergedParams = { ...params, ...settings };

  switch (action) {
    case "balance": {
      const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);
      const bal = await tokenContract.balanceOf(agentData.walletAddress);
      const balanceNum = parseFloat(ethers.formatEther(bal));
      const alertThreshold = parseFloat(mergedParams.alert_threshold) || 50;
      const alertMethod = mergedParams.alert_method || "log";
      const isLow = balanceNum < alertThreshold;
      return {
        balance: balanceNum.toFixed(4),
        symbol: "VCN",
        alert_threshold: alertThreshold,
        alert_method: alertMethod,
        is_below_threshold: isLow,
        alert: isLow ? `WARNING: Balance ${balanceNum.toFixed(2)} VCN is below threshold ${alertThreshold} VCN. Please top up.` : null,
      };
    }
    case "network_info": {
      const block = await provider.getBlockNumber();
      const blockDelayAlert = parseInt(mergedParams.block_delay_alert) || 60;
      // Check time since last block
      let timeSinceLastBlock = null;
      let blockDelayWarning = null;
      try {
        const latestBlock = await provider.getBlock(block);
        if (latestBlock && latestBlock.timestamp) {
          timeSinceLastBlock = Math.floor(Date.now() / 1000) - latestBlock.timestamp;
          if (timeSinceLastBlock > blockDelayAlert) {
            blockDelayWarning = `WARNING: No new block for ${timeSinceLastBlock}s (threshold: ${blockDelayAlert}s). Network may be experiencing issues.`;
          }
        }
      } catch (e) {
        // Non-critical, continue without timing info
      }
      return {
        chain_id: 3151909,
        latest_block: block,
        name: "Vision Chain",
        block_delay_threshold_sec: blockDelayAlert,
        seconds_since_last_block: timeSinceLastBlock,
        alert: blockDelayWarning,
      };
    }
    case "staking_info": {
      const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, [
        "function getStakeInfo(address) view returns (uint256, uint256, uint256)",
      ], provider);
      try {
        const [staked, rewards, cooldownEnd] = await stakingContract.getStakeInfo(agentData.walletAddress);
        const pendingRewards = parseFloat(ethers.formatEther(rewards));
        const autoClaimThreshold = parseFloat(mergedParams.auto_claim_threshold) || 0;
        const shouldClaim = autoClaimThreshold > 0 && pendingRewards >= autoClaimThreshold;
        return {
          staked: ethers.formatEther(staked),
          pending_rewards: pendingRewards.toFixed(4),
          cooldown_ends: cooldownEnd.toString(),
          auto_claim_threshold: autoClaimThreshold,
          claim_recommended: shouldClaim,
          alert: shouldClaim ? `Pending rewards (${pendingRewards.toFixed(2)} VCN) exceed auto-claim threshold (${autoClaimThreshold} VCN). Consider claiming.` : null,
        };
      } catch {
        return { error: "Failed to fetch staking info" };
      }
    }
    case "leaderboard": {
      const topSnap = await db.collection("agents")
        .orderBy("rpPoints", "desc")
        .limit(5)
        .get();
      const leaderboard = [];
      topSnap.forEach((doc) => {
        const d = doc.data();
        leaderboard.push({
          agent_name: d.agentName,
          rp_points: d.rpPoints || 0,
        });
      });
      return { leaderboard };
    }
    // === Growth & Marketing Actions ===
    case "referral_outreach": {
      const agentDoc = await db.collection("agents").doc(agentData.agentName).get();
      const refCode = agentDoc.exists ? agentDoc.data().referralCode : "";
      const referralLink = `https://visionchain.co/signup?ref=${refCode}`;
      const channels = mergedParams.channels || ["twitter"];
      const customMessage = mergedParams.custom_message || "";
      const maxDaily = parseInt(mergedParams.max_daily) || 10;

      // Check daily outreach limit
      const today = new Date().toISOString().split("T")[0];
      const dailyKey = `outreach_count_${today}`;
      const currentCount = agentDoc.exists ? (agentDoc.data()[dailyKey] || 0) : 0;
      if (currentCount >= maxDaily) {
        return {
          status: "daily_limit_reached",
          daily_limit: maxDaily,
          current_count: currentCount,
          message: `Daily outreach limit reached (${maxDaily}). Will resume tomorrow.`,
        };
      }

      // Log outreach attempt with daily counter
      await db.collection("agents").doc(agentData.agentName).update({
        lastOutreachAt: admin.firestore.FieldValue.serverTimestamp(),
        outreachCount: admin.firestore.FieldValue.increment(1),
        [dailyKey]: admin.firestore.FieldValue.increment(1),
      });
      return {
        referral_link: referralLink,
        referral_code: refCode,
        message_template: customMessage || `Join Vision Chain - the next-gen L1 blockchain. Sign up with my referral: ${referralLink}`,
        target_channels: channels,
        daily_usage: `${currentCount + 1}/${maxDaily}`,
        status: "outreach_prepared",
      };
    }
    case "social_promo": {
      const topic = mergedParams.topic || "general";
      const tone = mergedParams.tone || "professional";
      const customHashtags = mergedParams.hashtags ? mergedParams.hashtags.split(",").map((h) => h.trim()).filter(Boolean) : [];
      const toneInstructions = {
        professional: "Write in a professional, authoritative tone suitable for industry leaders.",
        casual: "Write in a casual, friendly tone that feels approachable and relatable.",
        hype: "Write with energy and excitement, building hype and FOMO.",
        educational: "Write in an educational tone, explaining concepts clearly and accurately.",
      };
      const templates = {
        general: "Vision Chain is redefining blockchain with gasless transactions, built-in AI agents, and zero-knowledge bridges. Join the revolution.",
        staking: "Earn rewards by staking VCN on Vision Chain. Secure the network and grow your portfolio.",
        agents: "AI Agents on Vision Chain run 24/7, execute on-chain tasks autonomously, and cost as low as 0.05 VCN per execution.",
        bridge: "Bridge assets seamlessly between Ethereum and Vision Chain with our trustless bridge.",
      };
      await db.collection("agents").doc(agentData.agentName).update({
        lastPromoAt: admin.firestore.FieldValue.serverTimestamp(),
        promoCount: admin.firestore.FieldValue.increment(1),
      });
      const defaultHashtags = ["#VisionChain", "#VCN", "#Web3", "#AI", "#Blockchain"];
      return {
        content: templates[topic] || templates.general,
        topic,
        tone,
        tone_instruction: toneInstructions[tone] || toneInstructions.professional,
        hashtags: [...defaultHashtags, ...customHashtags],
        status: "content_ready",
      };
    }
    case "content_create": {
      const contentType = mergedParams.content_type || "thread";
      const platform = mergedParams.platform || "twitter";
      const platformGuidelines = {
        twitter: { max_chars: 280, thread_limit: 15, format: "Short, punchy tweets with emojis and hashtags" },
        medium: { min_words: 800, format: "Long-form article with headers, images, and clear structure" },
        blog: { min_words: 500, format: "Blog post with SEO-friendly headers and engaging intro" },
      };
      await db.collection("agents").doc(agentData.agentName).update({
        lastContentAt: admin.firestore.FieldValue.serverTimestamp(),
        contentCount: admin.firestore.FieldValue.increment(1),
      });
      return {
        content_type: contentType,
        target_platform: platform,
        platform_guidelines: platformGuidelines[platform] || platformGuidelines.twitter,
        suggestions: [
          "Write a thread about Vision Chain's gasless transaction model",
          "Create a comparison post: Vision Chain vs other L1s",
          "Explain how AI Agents work on Vision Chain",
          "Share staking rewards calculator and APY breakdown",
          "Highlight the Vision Chain bridge security model",
        ],
        brand_assets: {
          website: "https://visionchain.co",
          docs: "https://visionchain.co/docs",
          explorer: "https://visionchain.co/visionscan",
        },
        status: "template_ready",
      };
    }
    case "invite_distribute": {
      const agentDoc2 = await db.collection("agents").doc(agentData.agentName).get();
      const refCode2 = agentDoc2.exists ? agentDoc2.data().referralCode : "";
      const targetAudience = mergedParams.target_audience || "general";
      const customInvite = mergedParams.custom_invite || "";
      const dailyLimit = parseInt(mergedParams.daily_limit) || 20;

      // Check daily invite limit
      const today2 = new Date().toISOString().split("T")[0];
      const dailyKey2 = `invite_count_${today2}`;
      const currentCount2 = agentDoc2.exists ? (agentDoc2.data()[dailyKey2] || 0) : 0;
      if (currentCount2 >= dailyLimit) {
        return {
          status: "daily_limit_reached",
          daily_limit: dailyLimit,
          current_count: currentCount2,
          message: `Daily invite limit reached (${dailyLimit}). Will resume tomorrow.`,
        };
      }

      const audienceMessages = {
        general: `Join Vision Chain and get free VCN tokens to explore the platform!`,
        developer: `Build on Vision Chain - gasless L1 with AI agent SDK, full EVM compatibility, and developer-first tooling.`,
        investor: `Vision Chain (VCN) offers staking rewards, cross-chain bridges, and a growing AI agent ecosystem.`,
        defi: `DeFi on Vision Chain: zero gas fees, instant finality, and built-in AI agents for automated strategies.`,
      };

      await db.collection("agents").doc(agentData.agentName).update({
        lastInviteAt: admin.firestore.FieldValue.serverTimestamp(),
        inviteCount: admin.firestore.FieldValue.increment(1),
        [dailyKey2]: admin.firestore.FieldValue.increment(1),
      });
      return {
        referral_code: refCode2,
        signup_link: `https://visionchain.co/signup?ref=${refCode2}`,
        invite_message: customInvite || audienceMessages[targetAudience] || audienceMessages.general,
        target_audience: targetAudience,
        daily_usage: `${currentCount2 + 1}/${dailyLimit}`,
        status: "invite_prepared",
      };
    }
    case "community_engage": {
      // Provide context for community engagement using stored settings
      const channels = mergedParams.channels || ["discord"];
      const focusTopics = mergedParams.focus_topics || ["onboarding"];
      const engagementStyle = mergedParams.style || "helpful";
      const networkBlock = await provider.getBlockNumber();
      const recentAgents = await db.collection("agents")
        .orderBy("registeredAt", "desc")
        .limit(3)
        .get();
      const newAgents = [];
      recentAgents.forEach((doc) => {
        newAgents.push(doc.data().agentName);
      });

      const styleGuides = {
        helpful: "Be warm, supportive, and solution-oriented. Proactively offer help.",
        informative: "Stick to facts and data. Cite documentation when possible.",
        friendly: "Be casual and approachable. Use conversational language.",
      };

      const topicTalkingPoints = {
        staking_faq: ["Current staking APY", "How to stake VCN", "Reward claim process", "Cooldown period for unstaking"],
        network_updates: ["Latest block height", "Network performance", "New features", "Upcoming upgrades"],
        onboarding: ["How to create a wallet", "How to get free VCN", "First steps guide", "Referral program benefits"],
        technical: ["Smart contract deployment", "API documentation", "Agent SDK usage", "Bridge functionality"],
      };

      const relevantPoints = focusTopics.flatMap((t) => topicTalkingPoints[t] || []);

      await db.collection("agents").doc(agentData.agentName).update({
        lastEngageAt: admin.firestore.FieldValue.serverTimestamp(),
        engageCount: admin.firestore.FieldValue.increment(1),
      });
      return {
        target_channels: channels,
        focus_topics: focusTopics,
        engagement_style: engagementStyle,
        style_guide: styleGuides[engagementStyle] || styleGuides.helpful,
        network_health: { latest_block: networkBlock, status: "healthy" },
        recent_agents: newAgents,
        talking_points: relevantPoints.length > 0 ? relevantPoints : [
          "Welcome new community members",
          "Share latest network stats",
          "Answer common questions about staking and rewards",
          "Highlight recent platform updates",
        ],
        status: "context_ready",
      };
    }
    // === Coming Soon: Write Actions ===
    case "transfer": {
      const recipient = mergedParams.recipient;
      const amount = parseFloat(mergedParams.amount) || 10;
      const dailyLimit = parseFloat(mergedParams.daily_limit) || 50;
      const minBalanceKeep = parseFloat(mergedParams.min_balance_keep) || 20;
      const condition = mergedParams.condition || "always";

      if (!recipient || !recipient.startsWith("0x") || recipient.length !== 42) {
        return { error: "Invalid recipient address. Please configure a valid 0x address in action settings.", status: "config_error" };
      }

      // Check balance constraints
      const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);
      const bal = await tokenContract.balanceOf(agentData.walletAddress);
      const currentBalance = parseFloat(ethers.formatEther(bal));

      if (condition === "above_balance" && currentBalance <= (amount + minBalanceKeep)) {
        return {
          status: "condition_not_met",
          current_balance: currentBalance.toFixed(4),
          required_balance: (amount + minBalanceKeep).toFixed(4),
          message: "Balance not high enough to trigger transfer while keeping minimum reserve.",
        };
      }

      if (currentBalance - amount < minBalanceKeep) {
        return {
          status: "insufficient_balance",
          current_balance: currentBalance.toFixed(4),
          min_balance_keep: minBalanceKeep,
          message: `Transfer would drop balance below minimum reserve (${minBalanceKeep} VCN). Skipped.`,
        };
      }

      // Check daily limit
      const today3 = new Date().toISOString().split("T")[0];
      const dailyKey3 = `transfer_total_${today3}`;
      const agentDoc3 = await db.collection("agents").doc(agentData.agentName).get();
      const dailyTotal = agentDoc3.exists ? (agentDoc3.data()[dailyKey3] || 0) : 0;
      if (dailyTotal + amount > dailyLimit) {
        return {
          status: "daily_limit_reached",
          daily_limit: dailyLimit,
          daily_spent: dailyTotal,
          message: `Daily transfer limit would be exceeded (${dailyTotal + amount}/${dailyLimit} VCN). Skipped.`,
        };
      }

      // Execute the transfer
      try {
        const agentWallet = new ethers.Wallet(agentData.privateKey, provider);
        const token = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, agentWallet);
        const tx = await token.transfer(recipient, ethers.parseEther(amount.toString()));
        await tx.wait();

        // Update daily counter
        await db.collection("agents").doc(agentData.agentName).update({
          lastTransferAt: admin.firestore.FieldValue.serverTimestamp(),
          transferCount: admin.firestore.FieldValue.increment(1),
          [dailyKey3]: admin.firestore.FieldValue.increment(amount),
        });

        return {
          status: "transfer_completed",
          recipient,
          amount: amount.toFixed(4),
          tx_hash: tx.hash,
          daily_usage: `${(dailyTotal + amount).toFixed(2)}/${dailyLimit} VCN`,
          remaining_balance: (currentBalance - amount).toFixed(4),
        };
      } catch (err) {
        return { error: `Transfer failed: ${err.message}`, status: "execution_error" };
      }
    }
    case "stake": {
      const stakeMode = mergedParams.stake_mode || "fixed";
      const stakeAmount = parseFloat(mergedParams.stake_amount) || 50;
      const stakePercent = parseFloat(mergedParams.stake_percent) || 80;
      const autoCompound = mergedParams.auto_compound !== false;
      const minBalanceKeep = parseFloat(mergedParams.min_balance_keep) || 20;

      // Check current balance
      const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, provider);
      const bal = await tokenContract.balanceOf(agentData.walletAddress);
      const currentBalance = parseFloat(ethers.formatEther(bal));
      const availableToStake = Math.max(0, currentBalance - minBalanceKeep);

      // Calculate actual stake amount
      let actualAmount;
      if (stakeMode === "percentage") {
        actualAmount = Math.min(availableToStake, (currentBalance * stakePercent) / 100);
      } else {
        actualAmount = Math.min(availableToStake, stakeAmount);
      }

      if (actualAmount <= 0) {
        return {
          status: "insufficient_balance",
          current_balance: currentBalance.toFixed(4),
          min_balance_keep: minBalanceKeep,
          message: `Not enough balance to stake after keeping minimum reserve (${minBalanceKeep} VCN).`,
        };
      }

      // Execute staking
      try {
        const agentWallet = new ethers.Wallet(agentData.privateKey, provider);
        const token = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, agentWallet);
        const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, [
          "function stake(uint256 amount) external",
        ], agentWallet);

        // Approve first
        const approveTx = await token.approve(BRIDGE_STAKING_ADDRESS, ethers.parseEther(actualAmount.toString()));
        await approveTx.wait();

        // Stake
        const stakeTx = await stakingContract.stake(ethers.parseEther(actualAmount.toString()));
        await stakeTx.wait();

        await db.collection("agents").doc(agentData.agentName).update({
          lastStakeAt: admin.firestore.FieldValue.serverTimestamp(),
          stakeCount: admin.firestore.FieldValue.increment(1),
        });

        return {
          status: "stake_completed",
          amount_staked: actualAmount.toFixed(4),
          stake_mode: stakeMode,
          auto_compound: autoCompound,
          tx_hash: stakeTx.hash,
          remaining_balance: (currentBalance - actualAmount).toFixed(4),
        };
      } catch (err) {
        return { error: `Staking failed: ${err.message}`, status: "execution_error" };
      }
    }
    case "unstake": {
      const unstakeAmountType = mergedParams.unstake_amount || "all";
      const partialAmount = parseFloat(mergedParams.partial_amount) || 100;
      const triggerCondition = mergedParams.trigger_condition || "manual";
      const targetApy = parseFloat(mergedParams.target_apy) || 5;

      // Get current staking info
      const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, [
        "function getStakeInfo(address) view returns (uint256, uint256, uint256)",
        "function requestUnstake(uint256 amount) external",
      ], provider);
      try {
        const [staked, rewards] = await stakingContract.getStakeInfo(agentData.walletAddress);
        const stakedAmount = parseFloat(ethers.formatEther(staked));

        if (stakedAmount <= 0) {
          return { status: "no_stake", message: "No VCN currently staked. Nothing to unstake." };
        }

        // Check APY condition if applicable
        if (triggerCondition === "apy_below") {
          // Simplified APY calculation (annualized rewards / staked)
          const pendingRewards = parseFloat(ethers.formatEther(rewards));
          const estimatedApy = stakedAmount > 0 ? (pendingRewards / stakedAmount) * 365 * 100 : 0;
          if (estimatedApy >= targetApy) {
            return {
              status: "condition_not_met",
              current_apy: estimatedApy.toFixed(2),
              target_apy: targetApy,
              message: `Current estimated APY (${estimatedApy.toFixed(2)}%) is above target (${targetApy}%). No unstake needed.`,
            };
          }
        }

        // Calculate unstake amount
        const actualUnstake = unstakeAmountType === "all" ? stakedAmount : Math.min(partialAmount, stakedAmount);

        // Execute unstake
        const agentWallet = new ethers.Wallet(agentData.privateKey, provider);
        const stakingWithSigner = stakingContract.connect(agentWallet);
        const tx = await stakingWithSigner.requestUnstake(ethers.parseEther(actualUnstake.toString()));
        await tx.wait();

        await db.collection("agents").doc(agentData.agentName).update({
          lastUnstakeAt: admin.firestore.FieldValue.serverTimestamp(),
          unstakeCount: admin.firestore.FieldValue.increment(1),
        });

        return {
          status: "unstake_requested",
          amount_unstaked: actualUnstake.toFixed(4),
          unstake_type: unstakeAmountType,
          tx_hash: tx.hash,
          remaining_staked: (stakedAmount - actualUnstake).toFixed(4),
        };
      } catch (err) {
        return { error: `Unstake failed: ${err.message}`, status: "execution_error" };
      }
    }
    default:
      return { error: `Action ${action} not yet implemented for hosted agents` };
  }
}

// =====================================================
// EXECUTOR MONITOR - Checks executor wallet balances
// =====================================================
exports.executorMonitor = onSchedule({
  schedule: "every 30 minutes",
  timeZone: "Asia/Seoul",
  timeoutSeconds: 60,
  secrets: ["VCN_EXECUTOR_PK"],
}, async () => {
  console.log("[ExecutorMonitor] Checking executor pool balances...");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    await executorPool.init(provider);

    const alerts = [];
    for (const wallet of executorPool.wallets) {
      const ethBalance = await provider.getBalance(wallet.address);
      const ethBal = parseFloat(ethers.formatEther(ethBalance));

      if (ethBal < 0.01) {
        alerts.push({
          address: wallet.address,
          balance_eth: ethBal.toFixed(6),
          status: "CRITICAL",
        });
      }
    }

    if (alerts.length > 0) {
      console.warn("[ExecutorMonitor] LOW BALANCE ALERTS:", JSON.stringify(alerts));

      // Store alert in Firestore for admin dashboard
      await db.collection("system_alerts").add({
        type: "executor_low_balance",
        alerts,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        resolved: false,
      });
    } else {
      console.log("[ExecutorMonitor] All executor wallets have sufficient balance.");
    }
  } catch (err) {
    console.error("[ExecutorMonitor] Error:", err.message);
  }
});

// =============================================================================
// VISION INSIGHT (Powered by Blocky) - News Intelligence HUD
// =============================================================================
// collectBlockyNews      - Scheduled every 2h: RSS parsing + AI analysis
// generateInsightSnapshot - Scheduled every 6h: ASI, Alpha, Whale, Calendar
// generateWeeklyTrendReport - Scheduled weekly: trend aggregation
// getVisionInsight        - Callable: serves snapshot data to frontend
// =============================================================================

// Lazy-loaded modules for Vision Insight
let rssParser = null;
let cheerio = null;

/**
 * Get rss-parser instance (lazy loaded)
 * @return {object} RSSParser instance
 */
function getRssParser() {
  if (!rssParser) {
    const RSSParser = require("rss-parser");
    rssParser = new RSSParser({
      timeout: 15000,
      headers: { "User-Agent": "VisionChain-Blocky/1.0" },
    });
  }
  return rssParser;
}

/**
 * Get cheerio module (lazy loaded)
 * @return {object} Cheerio module
 */
function getCheerio() {
  if (!cheerio) {
    cheerio = require("cheerio");
  }
  return cheerio;
}

// Vision Insight media sources configuration - Category-based Google News RSS + Specialist Media
const BLOCKY_MEDIA_SOURCES = [
  // ===== BITCOIN & BTC ETF =====
  { id: "gnews-btc-en", name: "Google News Bitcoin", category: "bitcoin", url: "https://news.google.com/rss/search?q=bitcoin+OR+btc+etf+OR+btc+price+OR+bitcoin+halving&hl=en-US&gl=US&ceid=US:en", lang: "en", region: "global" },
  { id: "gnews-btc-kr", name: "Google News BTC KR", category: "bitcoin", url: "https://news.google.com/rss/search?q=%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+OR+BTC+%EA%B0%80%EA%B2%A9+OR+%EB%B9%84%ED%8A%B8%EC%BD%94%EC%9D%B8+ETF&hl=ko&gl=KR&ceid=KR:ko", lang: "ko", region: "korea" },
  { id: "bitcoinmag", name: "Bitcoin Magazine", category: "bitcoin", url: "https://bitcoinmagazine.com/feed", lang: "en", region: "global" },

  // ===== ETHEREUM & LAYER 2 =====
  { id: "gnews-eth-en", name: "Google News Ethereum", category: "ethereum", url: "https://news.google.com/rss/search?q=ethereum+OR+ETH+price+OR+layer2+blockchain+OR+arbitrum+OR+optimism&hl=en-US&gl=US&ceid=US:en", lang: "en", region: "global" },
  { id: "gnews-eth-kr", name: "Google News ETH KR", category: "ethereum", url: "https://news.google.com/rss/search?q=%EC%9D%B4%EB%8D%94%EB%A6%AC%EC%9B%80+OR+%EB%A0%88%EC%9D%B4%EC%96%B4+2+OR+%EC%95%84%EB%B9%84%ED%8A%B8%EB%9F%BC&hl=ko&gl=KR&ceid=KR:ko", lang: "ko", region: "korea" },
  { id: "coindesk", name: "CoinDesk", category: "ethereum", url: "https://www.coindesk.com/arc/outboundfeeds/rss/", lang: "en", region: "global" },

  // ===== DeFi & DEX =====
  { id: "gnews-defi-en", name: "Google News DeFi", category: "defi", url: "https://news.google.com/rss/search?q=defi+OR+decentralized+finance+OR+dex+OR+uniswap+OR+aave&hl=en-US&gl=US&ceid=US:en", lang: "en", region: "global" },
  { id: "gnews-defi-kr", name: "Google News DeFi KR", category: "defi", url: "https://news.google.com/rss/search?q=%EB%94%94%ED%8C%8C%EC%9D%B4+OR+%ED%83%88%EC%A4%91%EC%95%99%ED%99%94+%EA%B8%88%EC%9C%B5+OR+%EC%9C%A0%EB%8B%88%EC%8A%A4%EC%99%91&hl=ko&gl=KR&ceid=KR:ko", lang: "ko", region: "korea" },
  { id: "decrypt", name: "Decrypt", category: "defi", url: "https://decrypt.co/feed", lang: "en", region: "global" },

  // ===== REGULATION & POLICY =====
  { id: "gnews-reg-en", name: "Google News Regulation", category: "regulation", url: "https://news.google.com/rss/search?q=crypto+regulation+OR+SEC+crypto+OR+crypto+policy+OR+crypto+tax&hl=en-US&gl=US&ceid=US:en", lang: "en", region: "global" },
  // eslint-disable-next-line max-len
  { id: "gnews-reg-kr", name: "Google News Regulation KR", category: "regulation", url: "https://news.google.com/rss/search?q=%EA%B0%80%EC%83%81%EC%9E%90%EC%82%B0+%EA%B7%9C%EC%A0%9C+OR+%EC%95%94%ED%98%B8%ED%99%94%ED%8F%90+%EC%A0%95%EC%B1%85&hl=ko&gl=KR&ceid=KR:ko", lang: "ko", region: "korea" },
  { id: "theblock", name: "The Block", category: "regulation", url: "https://www.theblock.co/rss", lang: "en", region: "global" },

  // ===== AI & WEB3 =====
  { id: "gnews-ai-en", name: "Google News AI Web3", category: "ai_web3", url: "https://news.google.com/rss/search?q=AI+blockchain+OR+web3+OR+AI+crypto+OR+decentralized+AI&hl=en-US&gl=US&ceid=US:en", lang: "en", region: "global" },
  { id: "gnews-ai-kr", name: "Google News AI Web3 KR", category: "ai_web3", url: "https://news.google.com/rss/search?q=AI+%EB%B8%94%EB%A1%9D%EC%B2%B4%EC%9D%B8+OR+%EC%9B%B93+OR+AI+%EA%B0%80%EC%83%81%EC%9E%90%EC%82%B0&hl=ko&gl=KR&ceid=KR:ko", lang: "ko", region: "korea" },
  { id: "cointelegraph", name: "CoinTelegraph", category: "ai_web3", url: "https://cointelegraph.com/rss", lang: "en", region: "global" },

  // ===== NFT & GAMING =====
  { id: "gnews-nft-en", name: "Google News NFT", category: "nft_gaming", url: "https://news.google.com/rss/search?q=NFT+OR+blockchain+gaming+OR+gamefi+OR+metaverse+crypto&hl=en-US&gl=US&ceid=US:en", lang: "en", region: "global" },
  { id: "gnews-nft-kr", name: "Google News NFT KR", category: "nft_gaming", url: "https://news.google.com/rss/search?q=NFT+OR+%EB%B8%94%EB%A1%9D%EC%B2%B4%EC%9D%B8+%EA%B2%8C%EC%9E%84+OR+%EA%B2%8C%EC%9E%84%ED%8C%8C%EC%9D%B4&hl=ko&gl=KR&ceid=KR:ko", lang: "ko", region: "korea" },
  { id: "blockhead", name: "Blockhead", category: "nft_gaming", url: "https://blockhead.co/feed/", lang: "en", region: "singapore" },

  // ===== ALTCOINS & MARKET =====
  { id: "gnews-alt-en", name: "Google News Altcoins", category: "altcoin", url: "https://news.google.com/rss/search?q=altcoin+OR+crypto+market+OR+cryptocurrency+price+OR+solana+OR+xrp&hl=en-US&gl=US&ceid=US:en", lang: "en", region: "global" },
  { id: "gnews-alt-kr", name: "Google News Altcoins KR", category: "altcoin", url: "https://news.google.com/rss/search?q=%EC%95%8C%ED%8A%B8%EC%BD%94%EC%9D%B8+OR+%EC%BD%94%EC%9D%B8+%EC%8B%9C%EC%84%B8+OR+%EC%86%94%EB%9D%BC%EB%82%98+OR+%EB%A6%AC%ED%94%8C&hl=ko&gl=KR&ceid=KR:ko", lang: "ko", region: "korea" },
  { id: "coingape", name: "CoinGape", category: "altcoin", url: "https://coingape.com/feed/", lang: "en", region: "india" },

  // ===== KOREA CRYPTO =====
  { id: "gnews-kr-main", name: "Google News Crypto KR", category: "korea", url: "https://news.google.com/rss/search?q=%EA%B0%80%EC%83%81%EC%9E%90%EC%82%B0+OR+%EC%97%85%EB%B9%84%ED%8A%B8+OR+%EB%B9%97%EC%8D%B8+OR+%EC%BD%94%EC%9D%B8%EC%9B%90&hl=ko&gl=KR&ceid=KR:ko", lang: "ko", region: "korea" },
  { id: "decenter", name: "DeCenter", category: "korea", url: "https://decenter.kr/rss/allArticle.xml", lang: "ko", region: "korea", fallbackScrape: true },
  { id: "blockmedia", name: "BlockMedia", category: "korea", url: "https://www.blockmedia.co.kr/feed/", lang: "ko", region: "korea", fallbackScrape: true },
];

const NEWS_CATEGORIES = [
  { id: "all", label: "All", labelKo: "전체" },
  { id: "bitcoin", label: "Bitcoin & ETF", labelKo: "비트코인" },
  { id: "ethereum", label: "Ethereum & L2", labelKo: "이더리움" },
  { id: "defi", label: "DeFi & DEX", labelKo: "디파이" },
  { id: "regulation", label: "Regulation", labelKo: "규제/정책" },
  { id: "ai_web3", label: "AI & Web3", labelKo: "AI & Web3" },
  { id: "nft_gaming", label: "NFT & Gaming", labelKo: "NFT/게임" },
  { id: "altcoin", label: "Altcoins", labelKo: "알트코인" },
  { id: "korea", label: "Korea", labelKo: "한국" },
];

/**
 * Parse a single RSS feed and return normalized articles
 * @param {object} source - Media source config
 * @return {Promise<Array>} Parsed articles
 */
async function parseRssFeed(source) {
  const parser = getRssParser();
  try {
    const feed = await parser.parseURL(source.url);
    const articles = (feed.items || []).slice(0, 10).map((item) => ({
      title: (item.title || "").trim(),
      url: item.link || "",
      summary: item.contentSnippet ? item.contentSnippet.substring(0, 500) : "",
      publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
      source: source.id,
      sourceName: source.name,
      category: source.category || "general",
      language: source.lang,
      region: source.region,
    }));
    console.log(`[Blocky] Parsed ${articles.length} articles from ${source.name}`);
    return articles;
  } catch (err) {
    console.warn(`[Blocky] RSS failed for ${source.name}: ${err.message}`);
    // Fallback: try HTML scraping for Korean media
    if (source.fallbackScrape) {
      return await scrapeMediaFallback(source);
    }
    return [];
  }
}

/**
 * Fallback HTML scraping for media sources without working RSS
 * @param {object} source - Media source config
 * @return {Promise<Array>} Scraped articles
 */
async function scrapeMediaFallback(source) {
  try {
    if (!axios) axios = require("axios");
    const $ = getCheerio();
    const baseUrl = new URL(source.url).origin;
    const response = await axios.get(baseUrl, {
      timeout: 10000,
      headers: { "User-Agent": "VisionChain-Blocky/1.0" },
    });
    const dom = $.load(response.data);
    const articles = [];

    // Generic scraping: look for article links
    dom("article a, .post-title a, h2 a, h3 a").each((i, el) => {
      if (articles.length >= 5) return false;
      const title = dom(el).text().trim();
      const href = dom(el).attr("href");
      if (title && href && title.length > 10) {
        const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
        articles.push({
          title,
          url: fullUrl,
          summary: "",
          publishedAt: new Date(),
          source: source.id,
          sourceName: source.name,
          category: source.category || "general",
          language: source.lang,
          region: source.region,
        });
      }
    });
    console.log(`[Blocky] Scraped ${articles.length} articles from ${source.name} (fallback)`);
    return articles;
  } catch (err) {
    console.warn(`[Blocky] Scrape fallback failed for ${source.name}: ${err.message}`);
    return [];
  }
}

/**
 * AI-analyze a batch of articles: categorize, sentiment, impact, keywords
 * Uses Gemini via existing callLLM
 * @param {Array} articles - Raw articles
 * @return {Promise<Array>} Analyzed articles
 */
async function analyzeArticlesBatch(articles) {
  if (!articles.length) return [];

  // Process in batches of 5 to stay within token limits
  const batchSize = 5;
  const results = [];

  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);
    const batchInput = batch.map((a, idx) => `[${idx}] "${a.title}" - ${a.summary.substring(0, 200)}`).join("\n");

    const categoryIds = NEWS_CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id);
    const systemPrompt = `You are a crypto news analyst. For each article, output ONLY a JSON array with objects containing:
- index: number (matching input index)
- category: one of ${JSON.stringify(categoryIds)}
- sentiment: number from -1.0 (bearish) to 1.0 (bullish)
- sentimentLabel: "bearish" | "neutral" | "bullish"
- impactScore: number 0-100 (how market-moving is this news)
- keywords: array of 3-5 keywords
- oneLiner: one-sentence English summary (translate if non-English)
- severity: "critical" | "warning" | "info" based on impact

Output ONLY valid JSON array, no markdown fences.`;

    try {
      const response = await callLLM("gemini-2.0-flash", systemPrompt, batchInput);
      // Parse JSON response - strip markdown fences if present
      const cleaned = response.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);

      for (const analysis of parsed) {
        const article = batch[analysis.index];
        if (article) {
          const validCategories = NEWS_CATEGORIES.map((c) => c.id).filter((c) => c !== "all");
          results.push({
            ...article,
            category: validCategories.includes(analysis.category) ? analysis.category : (article.category || "altcoin"),
            sentiment: Math.max(-1, Math.min(1, analysis.sentiment || 0)),
            sentimentLabel: analysis.sentimentLabel || "neutral",
            impactScore: Math.max(0, Math.min(100, analysis.impactScore || 50)),
            keywords: (analysis.keywords || []).slice(0, 5),
            oneLiner: analysis.oneLiner || article.title,
            severity: ["critical", "warning", "info"].includes(analysis.severity) ? analysis.severity : "info",
          });
        }
      }
    } catch (err) {
      console.warn(`[Blocky] AI analysis failed for batch: ${err.message}`);
      // Fallback: add articles with default analysis
      for (const article of batch) {
        results.push({
          ...article,
          category: article.category || "altcoin",
          sentiment: 0,
          sentimentLabel: "neutral",
          impactScore: 30,
          keywords: [],
          oneLiner: article.title,
          severity: "info",
        });
      }
    }
  }

  return results;
}

/**
 * collectBlockyNews - Scheduled every 2 hours
 * Parses RSS feeds from 10 media sources, AI-analyzes each article,
 * stores in Firestore with dedup by URL
 */
exports.collectBlockyNews = onSchedule({
  schedule: "every 2 hours",
  timeZone: "UTC",
  timeoutSeconds: 540,
  memory: "512MiB",
}, async () => {
  console.log(`[Blocky] Starting news collection from ${BLOCKY_MEDIA_SOURCES.length} media sources (8 categories)...`);
  const startTime = Date.now();

  try {
    // 1. Parse all RSS feeds in parallel
    const feedPromises = BLOCKY_MEDIA_SOURCES.map((source) => parseRssFeed(source));
    const feedResults = await Promise.allSettled(feedPromises);

    let allArticles = [];
    for (const result of feedResults) {
      if (result.status === "fulfilled") {
        allArticles = allArticles.concat(result.value);
      }
    }
    console.log(`[Blocky] Total raw articles parsed: ${allArticles.length}`);

    if (allArticles.length === 0) {
      console.warn("[Blocky] No articles parsed from any source, aborting.");
      return;
    }

    // 2. Dedup against existing articles (by URL)
    const existingUrls = new Set();
    const recentDocs = await db.collection("blockyNews")
      .doc("data")
      .collection("articles")
      .where("collectedAt", ">", new Date(Date.now() - 48 * 60 * 60 * 1000)) // last 48h
      .select("url")
      .get();
    recentDocs.forEach((doc) => existingUrls.add(doc.data().url));

    const newArticles = allArticles.filter((a) => a.url && !existingUrls.has(a.url));
    console.log(`[Blocky] New articles after dedup: ${newArticles.length}`);

    if (newArticles.length === 0) {
      console.log("[Blocky] No new articles to process.");
      return;
    }

    // 3. AI analysis (in batches)
    const analyzedArticles = await analyzeArticlesBatch(newArticles);

    // 4. Store in Firestore
    const batch = db.batch();
    let writeCount = 0;
    for (const article of analyzedArticles) {
      // Use URL hash as document ID for dedup
      const docId = crypto.createHash("md5").update(article.url).digest("hex").substring(0, 20);
      const ref = db.collection("blockyNews").doc("data").collection("articles").doc(docId);
      batch.set(ref, {
        ...article,
        publishedAt: article.publishedAt instanceof Date ?
          admin.firestore.Timestamp.fromDate(article.publishedAt) :
          admin.firestore.Timestamp.fromDate(new Date(article.publishedAt)),
        collectedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      writeCount++;

      // Firestore batch limit is 500
      if (writeCount >= 490) break;
    }
    await batch.commit();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Blocky] Collection complete: ${writeCount} articles stored in ${elapsed}s`);

    // 5. Update collection metadata
    await db.collection("blockyNews").doc("meta").set({
      lastCollectedAt: admin.firestore.FieldValue.serverTimestamp(),
      articlesCollected: writeCount,
      sourcesAttempted: BLOCKY_MEDIA_SOURCES.length,
    }, { merge: true });
  } catch (err) {
    console.error("[Blocky] Collection error:", err);
  }
});

/**
 * Fetch upcoming US economic calendar events from Finnhub
 * @return {Promise<Array>} Economic events
 */
async function fetchEconomicCalendar() {
  if (!axios) axios = require("axios");

  try {
    // Try Finnhub free API first
    const finnhubKey = await getApiKeyFromFirestore("finnhub") ||
      process.env.FINNHUB_API_KEY || "";

    if (!finnhubKey) {
      console.warn("[Blocky] Finnhub API key not configured, using fallback calendar");
      return getFallbackCalendar();
    }

    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const from = now.toISOString().split("T")[0];
    const to = twoWeeksLater.toISOString().split("T")[0];

    const response = await axios.get(
      `https://finnhub.io/api/v1/calendar/economic?from=${from}&to=${to}&token=${finnhubKey}`,
      { timeout: 10000 },
    );

    const events = (response.data?.economicCalendar || [])
      .filter((e) => e.country === "US")
      .filter((e) => {
        const name = (e.event || "").toLowerCase();
        return name.includes("fomc") || name.includes("cpi") ||
          name.includes("non-farm") || name.includes("nonfarm") ||
          name.includes("ppi") || name.includes("gdp") ||
          name.includes("jobless") || name.includes("fed") ||
          name.includes("interest rate") || name.includes("inflation");
      })
      .slice(0, 8)
      .map((e) => {
        const eventDate = new Date(e.time || e.date);
        const daysUntil = Math.ceil((eventDate - now) / (24 * 60 * 60 * 1000));
        return {
          label: e.event,
          date: e.time || e.date,
          daysUntil: Math.max(0, daysUntil),
          impact: e.impact === 3 ? "high" : e.impact === 2 ? "medium" : "low",
          previous: e.prev || null,
          estimate: e.estimate || null,
          actual: e.actual || null,
        };
      });

    console.log(`[Blocky] Fetched ${events.length} US economic events`);
    return events;
  } catch (err) {
    console.warn(`[Blocky] Economic calendar fetch failed: ${err.message}`);
    return getFallbackCalendar();
  }
}

/**
 * Fallback calendar with known recurring US economic events
 * @return {Array} Static economic events
 */
function getFallbackCalendar() {
  // Return empty if no API available - admin can manually add events
  return [];
}

/**
 * Fetch whale activity using free APIs:
 * - Etherscan Public API (ETH large internal txs, no key needed for basic)
 * - Blockchain.com API (BTC recent blocks, completely free)
 * @return {Promise<object>} Whale activity summary
 */
async function fetchWhaleActivity() {
  if (!axios) axios = require("axios");

  const largeTxs = [];
  let exchangeInflow = 0;
  let exchangeOutflow = 0;

  // Known exchange addresses (lowercase) for flow classification
  const knownExchanges = new Set([
    "binance", "coinbase", "kraken", "bitfinex", "huobi", "okx",
    "kucoin", "bybit", "gate.io", "crypto.com", "upbit", "bithumb",
  ]);
  const ethExchangeAddrs = {
    "0x28c6c06298d514db089934071355e5743bf21d60": "Binance 14",
    "0x21a31ee1afc51d94c2efccaa2092ad1028285549": "Binance 15",
    "0xdfd5293d8e347dfe59e90efd55b2956a1343963d": "Binance 16",
    "0x56eddb7aa87536c09ccc2793473599fd21a8b17f": "Binance 17",
    "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43": "Coinbase 10",
    "0x503828976d22510aad0201ac7ec88293211d23da": "Coinbase 2",
    "0x71660c4005ba85c37ccec55d0c4493e66fe775d3": "Coinbase 3",
    "0x2910543af39aba0cd09dbb2d50200b3e800a63d2": "Kraken 13",
    "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0": "Kraken 4",
    "0x176f3dab24a159341c0509bb36b833e7fdd0a132": "OKX",
    "0x98ec059dc3adfbdd63429454aeb0c990fba4a128": "OKX 2",
    "0x6cc5f688a315f3dc28a7781717a9a798a59fda7b": "OKX 3",
  };

  // --- 1. Etherscan: Fetch recent large ETH transfers (free, no API key) ---
  try {
    // Use Etherscan public API - get latest ETH blocks and large value txs
    // Free tier: 5 calls/sec, no key needed for basic endpoints
    const ethRes = await axios.get(
      "https://api.etherscan.io/api?module=proxy&action=eth_blockNumber",
      { timeout: 10000 },
    );
    const latestBlock = parseInt(ethRes.data?.result || "0", 16);

    if (latestBlock > 0) {
      // Get transactions from a recent block (look back ~100 blocks, ~20 min)
      const fromBlock = latestBlock - 100;
      const txListRes = await axios.get(
        `https://api.etherscan.io/api?module=account&action=txlistinternal&startblock=${fromBlock}&endblock=${latestBlock}&page=1&offset=50&sort=desc`,
        { timeout: 15000 },
      );

      const ethTxs = txListRes.data?.result || [];
      if (Array.isArray(ethTxs)) {
        for (const tx of ethTxs) {
          const valueEth = parseFloat(tx.value) / 1e18;
          if (valueEth < 100) continue; // Only 100+ ETH transfers (~$300K+)

          const estimatedUsd = valueEth * 3000; // Rough ETH price estimate
          const fromAddr = (tx.from || "").toLowerCase();
          const toAddr = (tx.to || "").toLowerCase();
          const fromLabel = ethExchangeAddrs[fromAddr] || "wallet";
          const toLabel = ethExchangeAddrs[toAddr] || "wallet";
          const isFromExchange = !!ethExchangeAddrs[fromAddr];
          const isToExchange = !!ethExchangeAddrs[toAddr];

          if (isToExchange && !isFromExchange) exchangeInflow += estimatedUsd;
          if (isFromExchange && !isToExchange) exchangeOutflow += estimatedUsd;

          if (largeTxs.length < 5) {
            largeTxs.push({
              symbol: "ETH",
              amount: Math.round(valueEth * 100) / 100,
              amountUsd: Math.round(estimatedUsd),
              from: fromLabel,
              to: toLabel,
              hash: tx.hash || "",
              timestamp: parseInt(tx.timeStamp || "0"),
            });
          }
        }
      }
    }
    console.log(`[Blocky] Etherscan: found ${largeTxs.length} large ETH transfers`);
  } catch (err) {
    console.warn(`[Blocky] Etherscan fetch failed: ${err.message}`);
  }

  // --- 2. Blockchain.com: Fetch recent large BTC transactions (free, no key) ---
  try {
    const btcRes = await axios.get(
      "https://blockchain.info/latestblock",
      { timeout: 10000 },
    );
    const latestHash = btcRes.data?.hash;

    if (latestHash) {
      const blockRes = await axios.get(
        `https://blockchain.info/rawblock/${latestHash}?format=json`,
        { timeout: 15000 },
      );
      const btcTxs = blockRes.data?.tx || [];
      const btcPrice = 95000; // Rough BTC price estimate

      for (const tx of btcTxs) {
        // Sum outputs for tx value
        const totalOut = (tx.out || []).reduce((s, o) => s + (o.value || 0), 0);
        const valueBtc = totalOut / 1e8;
        if (valueBtc < 10) continue; // Only 10+ BTC transfers (~$950K+)

        const estimatedUsd = valueBtc * btcPrice;

        if (largeTxs.length < 8) {
          largeTxs.push({
            symbol: "BTC",
            amount: Math.round(valueBtc * 1000) / 1000,
            amountUsd: Math.round(estimatedUsd),
            from: "wallet",
            to: "wallet",
            hash: tx.hash || "",
            timestamp: tx.time || 0,
          });
        }
      }
    }
    console.log(`[Blocky] Blockchain.com: processed BTC block for whale txs`);
  } catch (err) {
    console.warn(`[Blocky] Blockchain.com fetch failed: ${err.message}`);
  }

  // Sort by USD value desc
  largeTxs.sort((a, b) => b.amountUsd - a.amountUsd);
  const topTxs = largeTxs.slice(0, 5);

  const netFlow = exchangeOutflow - exchangeInflow; // positive = accumulation
  return {
    netFlow,
    flowDirection: netFlow > 0 ? "accumulation" : netFlow < 0 ? "distribution" : "neutral",
    exchangeInflow,
    exchangeOutflow,
    largeTxs: topTxs,
    topSector: "crypto",
    dataSource: "etherscan+blockchain.com",
  };
}

/**
 * Fallback whale data when all APIs fail
 * @return {object} Empty data
 */
function getPlaceholderWhaleData() {
  return {
    netFlow: 0,
    flowDirection: "neutral",
    exchangeInflow: 0,
    exchangeOutflow: 0,
    largeTxs: [],
    topSector: "N/A",
    dataSource: "unavailable",
  };
}

/**
 * generateInsightSnapshot - Scheduled every 6 hours
 * Computes ASI, selects Alpha Alerts, fetches Whale & Calendar data
 */
exports.generateInsightSnapshot = onSchedule({
  schedule: "every 6 hours",
  timeZone: "UTC",
  timeoutSeconds: 300,
  memory: "512MiB",
}, async () => {
  console.log("[Blocky] Generating insight snapshot...");

  try {
    // 1. Get recent articles (last 24h)
    const recentArticles = await db.collection("blockyNews")
      .doc("data")
      .collection("articles")
      .where("collectedAt", ">", new Date(Date.now() - 24 * 60 * 60 * 1000))
      .orderBy("collectedAt", "desc")
      .limit(100)
      .get();

    const articles = [];
    recentArticles.forEach((doc) => articles.push({ id: doc.id, ...doc.data() }));
    console.log(`[Blocky] Processing ${articles.length} recent articles for snapshot`);

    // 2. Compute Agent Sentiment Index (ASI)
    let totalSentiment = 0;
    let sentimentCount = 0;
    for (const article of articles) {
      if (typeof article.sentiment === "number") {
        // Weight by impact score
        const weight = (article.impactScore || 50) / 50;
        totalSentiment += article.sentiment * weight;
        sentimentCount += weight;
      }
    }
    const rawSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;
    // Convert from -1..1 to 0..100
    const asiScore = Math.round(Math.max(0, Math.min(100, (rawSentiment + 1) * 50)));
    let asiLabel = "Neutral";
    if (asiScore >= 75) asiLabel = "Extreme Greed";
    else if (asiScore >= 60) asiLabel = "Greed";
    else if (asiScore >= 45) asiLabel = "Neutral";
    else if (asiScore >= 25) asiLabel = "Fear";
    else asiLabel = "Extreme Fear";

    // Get previous snapshot for trend
    const prevSnapshot = await db.collection("blockyNews")
      .doc("data")
      .collection("snapshots")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    let prevAsi = 50;
    if (!prevSnapshot.empty) {
      prevAsi = prevSnapshot.docs[0].data().asi?.score || 50;
    }
    const asiTrend = asiScore > prevAsi ? "BULLISH" : asiScore < prevAsi ? "BEARISH" : "STABLE";

    // Generate ASI summary line
    let asiSummary = "";
    let marketBrief = null;
    try {
      const summaryPrompt = `Given crypto market ASI score ${asiScore}/100 (${asiLabel}), trend: ${asiTrend}, based on ${articles.length} recent articles. Write ONE sentence (max 15 words) summarizing the market mood for traders. No quotes.`;
      asiSummary = await callLLM("gemini-2.0-flash", "You are a crypto market analyst. Reply with only one sentence.", summaryPrompt);
      asiSummary = asiSummary.replace(/^["']|["']$/g, "").trim();
    } catch (e) {
      asiSummary = `Market sentiment at ${asiScore}/100. ${asiLabel} conditions prevail.`;
    }

    // Generate comprehensive AI Market Brief
    try {
      const categoryIds = NEWS_CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id);
      const categoryArticles = {};
      for (const catId of categoryIds) {
        categoryArticles[catId] = articles.filter((a) => a.category === catId);
      }

      const headlinesByCategory = categoryIds.map((catId) => {
        const catArts = categoryArticles[catId] || [];
        const top3 = catArts.slice(0, 3).map((a) => a.oneLiner || a.title).join("; ");
        return `[${catId}]: ${top3 || "No recent news"}`;
      }).join("\n");

      const briefPrompt = `You are a senior crypto market strategist. Analyze the following market intelligence and generate a structured market brief.

Current Data:
- ASI Score: ${asiScore}/100 (${asiLabel}), Trend: ${asiTrend}
- Total Articles Analyzed: ${articles.length}
- Top Headlines by Category:
${headlinesByCategory}

Output ONLY a valid JSON object:
{
  "analysis": "2-3 sentence overall market analysis (concise, actionable)",
  "categoryHighlights": [
    {"category": "<category_id>", "summary": "one-sentence highlight", "sentiment": "bullish|bearish|neutral"}
  ],
  "keyRisks": ["risk 1", "risk 2"],
  "opportunities": ["opportunity 1", "opportunity 2"],
  "tradingBias": "LONG|SHORT|NEUTRAL",
  "confidenceScore": 0-100
}

Only include categories with actual news. Output ONLY valid JSON, no markdown.`;

      const briefRaw = await callLLM(
        "gemini-2.0-flash",
        "You are a crypto market analyst AI. Output only valid JSON.",
        briefPrompt,
      );

      const cleaned = briefRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      marketBrief = JSON.parse(cleaned);
      console.log(`[Blocky] AI Market Brief generated: bias=${marketBrief.tradingBias}, confidence=${marketBrief.confidenceScore}`);
    } catch (e) {
      console.error("[Blocky] Market brief generation failed:", e.message);
      marketBrief = {
        analysis: `Market sentiment is ${asiLabel.toLowerCase()} with ASI at ${asiScore}/100. ${articles.length} articles analyzed across crypto sectors.`,
        categoryHighlights: [],
        keyRisks: ["Insufficient data for detailed risk analysis"],
        opportunities: ["Monitor emerging trends as more data is collected"],
        tradingBias: "NEUTRAL",
        confidenceScore: 30,
      };
    }

    // 3. Select Top 3 Alpha Alerts (highest impact)
    const sortedByImpact = [...articles].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
    const alphaAlerts = sortedByImpact.slice(0, 3).map((a) => ({
      articleId: a.id,
      headline: a.oneLiner || a.title,
      severity: a.severity || "info",
      impactScore: a.impactScore || 0,
      impactDirection: a.sentiment > 0.2 ? "bullish" : a.sentiment < -0.2 ? "bearish" : "neutral",
      agentConsensus: a.oneLiner || "",
      source: a.sourceName || a.source,
      url: a.url || "",
    }));

    // 4. Fetch Whale Watch data
    const whaleWatch = await fetchWhaleActivity();

    // Also add Vision Chain agent activity
    const topAgentMoves = [];
    try {
      const recentAgentTxs = await db.collection("agentTransactionLedger")
        .orderBy("executedAt", "desc")
        .limit(10)
        .get();
      recentAgentTxs.forEach((doc) => {
        const d = doc.data();
        if (d.action === "stake" || d.action === "transfer") {
          topAgentMoves.push({
            agentName: d.agentName || "Agent",
            action: d.action,
            amount: d.amount || "0",
            timestamp: d.executedAt,
          });
        }
      });
    } catch (e) {
      // Agent ledger may not exist yet
    }
    whaleWatch.topAgentMoves = topAgentMoves.slice(0, 5);

    // 5. Extract trending keywords
    const keywordMap = {};
    for (const article of articles) {
      const kws = article.keywords || [];
      for (const kw of kws) {
        const normalized = kw.toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (normalized.length > 2) {
          keywordMap[normalized] = (keywordMap[normalized] || 0) + 1;
        }
      }
    }
    const trendingKeywords = Object.entries(keywordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([keyword, count]) => ({ keyword, count }));

    // 6. Fetch economic calendar
    const calendar = await fetchEconomicCalendar();

    // 7. Store snapshot
    const snapshotId = new Date().toISOString().split("T")[0] + "_" +
      new Date().getHours().toString().padStart(2, "0");

    await db.collection("blockyNews").doc("data").collection("snapshots").doc(snapshotId).set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      asi: {
        score: asiScore,
        label: asiLabel,
        trend: asiTrend,
        summary: asiSummary,
        previousScore: prevAsi,
      },
      alphaAlerts,
      whaleWatch,
      marketBrief: marketBrief || null,
      narratives: {
        trendingKeywords,
        calendar,
      },
      articlesAnalyzed: articles.length,
    });

    console.log(`[Blocky] Snapshot ${snapshotId} generated. ASI: ${asiScore} (${asiLabel}), Alerts: ${alphaAlerts.length}`);
  } catch (err) {
    console.error("[Blocky] Snapshot generation error:", err);
  }
});

/**
 * generateWeeklyTrendReport - Scheduled weekly on Monday 09:00 UTC
 */
exports.generateWeeklyTrendReport = onSchedule({
  schedule: "every monday 09:00",
  timeZone: "UTC",
  timeoutSeconds: 300,
  memory: "512MiB",
}, async () => {
  console.log("[Blocky] Generating weekly trend report...");

  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Get all articles from the past week
    const weekArticles = await db.collection("blockyNews")
      .doc("data")
      .collection("articles")
      .where("collectedAt", ">", weekAgo)
      .get();

    const articles = [];
    weekArticles.forEach((doc) => articles.push(doc.data()));

    if (articles.length === 0) {
      console.log("[Blocky] No articles for weekly report.");
      return;
    }

    // Aggregate sentiment
    let totalSentiment = 0;
    for (const a of articles) {
      totalSentiment += a.sentiment || 0;
    }
    const avgSentiment = totalSentiment / articles.length;
    const overallSentiment = Math.round((avgSentiment + 1) * 50);
    const sentimentLabel = avgSentiment > 0.2 ? "bullish" : avgSentiment < -0.2 ? "bearish" : "neutral";

    // Category breakdown
    const categoryBreakdown = {};
    for (const a of articles) {
      const cat = a.category || "general";
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + 1;
    }

    // Top keywords
    const keywordMap = {};
    for (const a of articles) {
      for (const kw of (a.keywords || [])) {
        const n = kw.toLowerCase();
        keywordMap[n] = (keywordMap[n] || 0) + 1;
      }
    }
    const topKeywords = Object.entries(keywordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([keyword, count]) => ({ keyword, count }));

    // Get top 5 articles by impact
    const highlights = [...articles]
      .sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0))
      .slice(0, 5)
      .map((a) => ({
        title: a.title,
        source: a.sourceName || a.source,
        impactScore: a.impactScore,
        sentiment: a.sentimentLabel,
      }));

    // AI-generated summary
    let summary = "";
    try {
      const topHeadlines = highlights.map((h) => h.title).join("; ");
      const prompt = `Summarize this week's crypto market: Sentiment ${overallSentiment}/100 (${sentimentLabel}). ${articles.length} articles analyzed. Top categories: ${Object.entries(categoryBreakdown).map(([k, v]) => `${k}:${v}`).join(", ")}. Key headlines: ${topHeadlines}. Write 2-3 sentences max.`;
      summary = await callLLM("gemini-2.0-flash", "You are a crypto market analyst writing a weekly brief. Be concise.", prompt);
    } catch (e) {
      summary = `This week saw ${articles.length} articles with overall ${sentimentLabel} sentiment (${overallSentiment}/100).`;
    }

    // Store report
    const now = new Date();
    const reportId = `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7).toString().padStart(2, "0")}`;

    await db.collection("blockyNews").doc("data").collection("reports").doc(reportId).set({
      weekStartDate: admin.firestore.Timestamp.fromDate(weekAgo),
      weekEndDate: admin.firestore.Timestamp.fromDate(now),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      overallSentiment,
      sentimentLabel,
      topKeywords,
      categoryBreakdown,
      highlights,
      summary,
      totalArticles: articles.length,
    });

    console.log(`[Blocky] Weekly report ${reportId} generated: ${articles.length} articles, sentiment ${overallSentiment}`);
  } catch (err) {
    console.error("[Blocky] Weekly report error:", err);
  }
});

/**
 * getVisionInsight - HTTP Callable
 * Returns latest snapshot for the Vision Insight dashboard
 * Supports format=json (Agent View) and format=ui (default)
 */
exports.getVisionInsight = onCall({
  timeoutSeconds: 30,
  memory: "256MiB",
}, async (request) => {
  try {
    const format = request.data?.format || "ui";

    // Get latest snapshot
    const snapshotQuery = await db.collection("blockyNews")
      .doc("data")
      .collection("snapshots")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const snapshot = snapshotQuery.empty ? {
      asi: { score: 50, label: "Neutral", trend: "STABLE", summary: "Initializing market analysis..." },
      alphaAlerts: [],
      whaleWatch: getPlaceholderWhaleData(),
      narratives: { trendingKeywords: [], calendar: [] },
      marketBrief: null,
      articlesAnalyzed: 0,
      createdAt: null,
    } : snapshotQuery.docs[0].data();

    // Agent View: raw JSON format
    if (format === "json") {
      return {
        timestamp: snapshot.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        market_pulse: {
          sentiment_score: (snapshot.asi?.score || 50) / 100,
          trend: snapshot.asi?.trend || "STABLE",
          consensus: snapshot.asi?.score >= 60 ? "ACCUMULATE" :
            snapshot.asi?.score <= 40 ? "REDUCE" : "HOLD",
        },
        alpha_signals: (snapshot.alphaAlerts || []).map((a) => ({
          id: a.articleId,
          headline: a.headline,
          impact_score: a.impactScore,
          severity: a.severity,
          impact_direction: a.impactDirection,
          source: a.source,
          url: a.url,
        })),
        whale_activity: {
          net_flow: snapshot.whaleWatch?.netFlow || 0,
          flow_direction: snapshot.whaleWatch?.flowDirection || "neutral",
          exchange_inflow: snapshot.whaleWatch?.exchangeInflow || 0,
          exchange_outflow: snapshot.whaleWatch?.exchangeOutflow || 0,
          large_txs: snapshot.whaleWatch?.largeTxs || [],
          top_sector: snapshot.whaleWatch?.topSector || "N/A",
        },
        narratives: {
          trending: (snapshot.narratives?.trendingKeywords || []).map((k) => k.keyword),
          upcoming_events: (snapshot.narratives?.calendar || []).map((e) => ({
            label: e.label,
            date: e.date,
            days_until: e.daysUntil,
            impact: e.impact,
          })),
        },
      };
    }

    // Fetch recent articles for news feed (last 24 hours, max 100)
    const category = request.data?.category || "all";
    const locale = request.data?.locale || "en";
    const lang = locale.split("-")[0].toLowerCase(); // "ko-KR" -> "ko"
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
    console.log(`[Blocky] getVisionInsight: category=${category}, locale=${locale}, lang=${lang}`);

    const articlesQuery = db.collection("blockyNews")
      .doc("data")
      .collection("articles")
      .where("collectedAt", ">", cutoffTime)
      .orderBy("collectedAt", "desc")
      .limit(200);

    const articlesSnap = await articlesQuery.get();
    console.log(`[Blocky] getVisionInsight: found ${articlesSnap.size} total articles`);

    let newsFeed = articlesSnap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        title: d.title || "",
        url: d.url || "",
        source: d.source || "",
        sourceName: d.sourceName || "",
        category: d.category || "altcoin",
        language: d.language || "en",
        sentiment: d.sentiment || 0,
        sentimentLabel: d.sentimentLabel || "neutral",
        impactScore: d.impactScore || 0,
        severity: d.severity || "info",
        oneLiner: d.oneLiner || d.title || "",
        keywords: d.keywords || [],
        publishedAt: d.publishedAt?.toDate?.()?.toISOString() || null,
        collectedAt: d.collectedAt?.toDate?.()?.toISOString() || null,
      };
    });

    // Hard filter by user locale language
    const beforeLang = newsFeed.length;
    newsFeed = newsFeed.filter((a) => a.language === lang);
    console.log(`[Blocky] getVisionInsight: lang filter ${lang}: ${beforeLang} -> ${newsFeed.length}`);

    // Filter by category if not "all"
    if (category !== "all") {
      const beforeFilter = newsFeed.length;
      newsFeed = newsFeed.filter((a) => a.category === category);
      console.log(`[Blocky] getVisionInsight: category filter ${category}: ${beforeFilter} -> ${newsFeed.length}`);
    }

    // UI format: structured for widget rendering + news feed
    return {
      asi: snapshot.asi || { score: 50, label: "Neutral", trend: "STABLE", summary: "" },
      alphaAlerts: snapshot.alphaAlerts || [],
      whaleWatch: snapshot.whaleWatch || getPlaceholderWhaleData(),
      narratives: snapshot.narratives || { trendingKeywords: [], calendar: [] },
      marketBrief: snapshot.marketBrief || null,
      articlesAnalyzed: snapshot.articlesAnalyzed || 0,
      lastUpdated: snapshot.createdAt?.toDate?.()?.toISOString() || null,
      categories: NEWS_CATEGORIES,
      newsFeed,
    };
  } catch (err) {
    console.error("[Blocky] getVisionInsight error:", err);
    throw new HttpsError("internal", "Failed to fetch insight data");
  }
});

/**
 * triggerInsightRefresh - Admin callable to manually trigger data collection + snapshot
 * Use when scheduled functions haven't run and data is empty/stale
 */
exports.triggerInsightRefresh = onCall({
  timeoutSeconds: 540,
  memory: "512MiB",
}, async (request) => {
  // Auth check
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const startTime = Date.now();
  const results = { articlesCollected: 0, snapshotGenerated: false, errors: [] };

  try {
    // === STEP 1: Collect News (same logic as collectBlockyNews) ===
    console.log(`[Blocky] Manual refresh: starting news collection...`);

    const feedPromises = BLOCKY_MEDIA_SOURCES.map((source) => parseRssFeed(source));
    const feedResults = await Promise.allSettled(feedPromises);

    let allArticles = [];
    for (const result of feedResults) {
      if (result.status === "fulfilled") {
        allArticles = allArticles.concat(result.value);
      }
    }
    console.log(`[Blocky] Manual refresh: ${allArticles.length} raw articles parsed`);

    if (allArticles.length > 0) {
      // Dedup against existing
      const existingUrls = new Set();
      const recentDocs = await db.collection("blockyNews")
        .doc("data")
        .collection("articles")
        .where("collectedAt", ">", new Date(Date.now() - 48 * 60 * 60 * 1000))
        .select("url")
        .get();
      recentDocs.forEach((doc) => existingUrls.add(doc.data().url));

      const newArticles = allArticles.filter((a) => a.url && !existingUrls.has(a.url));
      console.log(`[Blocky] Manual refresh: ${newArticles.length} new articles after dedup`);

      if (newArticles.length > 0) {
        // AI analysis
        const analyzedArticles = await analyzeArticlesBatch(newArticles);

        // Store in Firestore
        const writeBatch = db.batch();
        let writeCount = 0;
        for (const article of analyzedArticles) {
          const docId = crypto.createHash("md5").update(article.url).digest("hex").substring(0, 20);
          const ref = db.collection("blockyNews").doc("data").collection("articles").doc(docId);
          writeBatch.set(ref, {
            ...article,
            publishedAt: article.publishedAt instanceof Date ?
              admin.firestore.Timestamp.fromDate(article.publishedAt) :
              admin.firestore.Timestamp.fromDate(new Date(article.publishedAt)),
            collectedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
          writeCount++;
          if (writeCount >= 490) break;
        }
        await writeBatch.commit();
        results.articlesCollected = writeCount;

        await db.collection("blockyNews").doc("meta").set({
          lastCollectedAt: admin.firestore.FieldValue.serverTimestamp(),
          articlesCollected: writeCount,
          sourcesAttempted: BLOCKY_MEDIA_SOURCES.length,
        }, { merge: true });
      }
    }
  } catch (err) {
    console.error("[Blocky] Manual refresh - collection error:", err);
    results.errors.push(`Collection: ${err.message}`);
  }

  try {
    // === STEP 2: Generate Snapshot (same logic as generateInsightSnapshot) ===
    console.log("[Blocky] Manual refresh: generating snapshot...");

    const recentArticles = await db.collection("blockyNews")
      .doc("data")
      .collection("articles")
      .where("collectedAt", ">", new Date(Date.now() - 24 * 60 * 60 * 1000))
      .orderBy("collectedAt", "desc")
      .limit(100)
      .get();

    const articles = [];
    recentArticles.forEach((doc) => articles.push({ id: doc.id, ...doc.data() }));
    console.log(`[Blocky] Manual refresh: ${articles.length} recent articles for snapshot`);

    // ASI computation
    let totalSentiment = 0;
    let sentimentCount = 0;
    for (const article of articles) {
      if (typeof article.sentiment === "number") {
        const weight = (article.impactScore || 50) / 50;
        totalSentiment += article.sentiment * weight;
        sentimentCount += weight;
      }
    }
    const rawSentiment = sentimentCount > 0 ? totalSentiment / sentimentCount : 0;
    const asiScore = Math.round(Math.max(0, Math.min(100, (rawSentiment + 1) * 50)));
    let asiLabel = "Neutral";
    if (asiScore >= 75) asiLabel = "Extreme Greed";
    else if (asiScore >= 60) asiLabel = "Greed";
    else if (asiScore >= 45) asiLabel = "Neutral";
    else if (asiScore >= 25) asiLabel = "Fear";
    else asiLabel = "Extreme Fear";

    // Previous ASI
    const prevSnapshot = await db.collection("blockyNews")
      .doc("data")
      .collection("snapshots")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    let prevAsi = 50;
    if (!prevSnapshot.empty) {
      prevAsi = prevSnapshot.docs[0].data().asi?.score || 50;
    }
    const asiTrend = asiScore > prevAsi ? "BULLISH" : asiScore < prevAsi ? "BEARISH" : "STABLE";

    // ASI summary
    let asiSummary = `Market sentiment at ${asiScore}/100. ${asiLabel} conditions prevail.`;
    try {
      const summaryPrompt = `Given crypto market ASI score ${asiScore}/100 (${asiLabel}), trend: ${asiTrend}, based on ${articles.length} recent articles. Write ONE sentence (max 15 words) summarizing the market mood for traders. No quotes.`;
      asiSummary = await callLLM("gemini-2.0-flash", "You are a crypto market analyst. Reply with only one sentence.", summaryPrompt);
      asiSummary = asiSummary.replace(/^["']|["']$/g, "").trim();
    } catch (e) {
      // keep fallback
    }

    // Market brief
    let marketBrief = null;
    try {
      const categoryIds = NEWS_CATEGORIES.filter((c) => c.id !== "all").map((c) => c.id);
      const headlinesByCategory = categoryIds.map((catId) => {
        const catArts = articles.filter((a) => a.category === catId);
        const top3 = catArts.slice(0, 3).map((a) => a.oneLiner || a.title).join("; ");
        return `[${catId}]: ${top3 || "No recent news"}`;
      }).join("\n");

      // eslint-disable-next-line max-len
      const briefPrompt = "You are a senior crypto market strategist. " +
        "Analyze the following market intelligence.\n\n" +
        "Current Data:\n" +
        `- ASI Score: ${asiScore}/100 (${asiLabel}), Trend: ${asiTrend}\n` +
        `- Total Articles: ${articles.length}\n` +
        "- Headlines by Category:\n" +
        headlinesByCategory + "\n\n" +
        "Output ONLY valid JSON with keys: analysis, " +
        "categoryHighlights, keyRisks, opportunities, " +
        "tradingBias (LONG/SHORT/NEUTRAL), confidenceScore (0-100). " +
        "Only include categories with news. No markdown.";

      const briefRaw = await callLLM("gemini-2.0-flash", "You are a crypto market analyst AI. Output only valid JSON.", briefPrompt);
      const cleaned = briefRaw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      marketBrief = JSON.parse(cleaned);
    } catch (e) {
      marketBrief = {
        analysis: `Market sentiment is ${asiLabel.toLowerCase()} with ASI at ${asiScore}/100. ${articles.length} articles analyzed.`,
        categoryHighlights: [],
        keyRisks: ["Insufficient data for detailed risk analysis"],
        opportunities: ["Monitor emerging trends"],
        tradingBias: "NEUTRAL",
        confidenceScore: 30,
      };
    }

    // Alpha Alerts
    const sortedByImpact = [...articles].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
    const alphaAlerts = sortedByImpact.slice(0, 3).map((a) => ({
      articleId: a.id,
      headline: a.oneLiner || a.title,
      severity: a.severity || "info",
      impactScore: a.impactScore || 0,
      impactDirection: a.sentiment > 0.2 ? "bullish" : a.sentiment < -0.2 ? "bearish" : "neutral",
      agentConsensus: a.oneLiner || "",
      source: a.sourceName || a.source,
      url: a.url || "",
    }));

    // Whale Watch
    const whaleWatch = await fetchWhaleActivity();
    whaleWatch.topAgentMoves = [];

    // Trending keywords
    const keywordMap = {};
    for (const article of articles) {
      for (const kw of (article.keywords || [])) {
        const normalized = kw.toLowerCase().replace(/[^a-z0-9_]/g, "");
        if (normalized.length > 2) {
          keywordMap[normalized] = (keywordMap[normalized] || 0) + 1;
        }
      }
    }
    const trendingKeywords = Object.entries(keywordMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([keyword, count]) => ({ keyword, count }));

    // Calendar
    const calendar = await fetchEconomicCalendar();

    // Store snapshot
    const snapshotId = new Date().toISOString().split("T")[0] + "_" +
      new Date().getHours().toString().padStart(2, "0");

    await db.collection("blockyNews").doc("data").collection("snapshots").doc(snapshotId).set({
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      asi: { score: asiScore, label: asiLabel, trend: asiTrend, summary: asiSummary, previousScore: prevAsi },
      alphaAlerts,
      whaleWatch,
      marketBrief,
      narratives: { trendingKeywords, calendar },
      articlesAnalyzed: articles.length,
    });

    results.snapshotGenerated = true;
    console.log(`[Blocky] Manual refresh: snapshot ${snapshotId} generated. ASI: ${asiScore}`);
  } catch (err) {
    console.error("[Blocky] Manual refresh - snapshot error:", err);
    results.errors.push(`Snapshot: ${err.message}`);
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Blocky] Manual refresh complete in ${elapsed}s. Articles: ${results.articlesCollected}, Snapshot: ${results.snapshotGenerated}`);

  return {
    success: results.errors.length === 0,
    articlesCollected: results.articlesCollected,
    snapshotGenerated: results.snapshotGenerated,
    elapsed: `${elapsed}s`,
    errors: results.errors,
  };
});

// =============================================================================
// ===== SOCIAL MEDIA AUTO-POSTING =============================================
// =============================================================================

const REFERRAL_RUSH_EPOCH_MS = new Date("2026-02-09T00:00:00Z").getTime();
const MS_PER_ROUND = 24 * 60 * 60 * 1000; // 24 hours

function calculateRoundId(dateMs) {
  return Math.floor((dateMs - REFERRAL_RUSH_EPOCH_MS) / MS_PER_ROUND);
}

function getRoundTimeRange(roundId) {
  const start = new Date(REFERRAL_RUSH_EPOCH_MS + roundId * MS_PER_ROUND);
  const end = new Date(REFERRAL_RUSH_EPOCH_MS + (roundId + 1) * MS_PER_ROUND);
  return { start, end };
}

/**
 * Helper: Get social media settings from Firestore
 */
async function getSocialMediaSettings() {
  const settingsDoc = await db.collection("settings").doc("social_media").get();
  if (!settingsDoc.exists) {
    throw new Error("Social media settings not configured. Go to Admin > Social Media to set up.");
  }
  return settingsDoc.data();
}

/**
 * Helper: Get round results for posting
 */
async function getRoundResults(roundId) {
  const roundDoc = await db.collection("referral_rounds").doc(roundId.toString()).get();
  if (!roundDoc.exists) return null;

  const round = roundDoc.data();
  const participantsSnap = await db
    .collection("referral_round_participants")
    .where("roundId", "==", roundId)
    .orderBy("inviteCount", "desc")
    .limit(10)
    .get();

  const participants = participantsSnap.docs.map((d) => d.data());
  const totalInvites = participants.reduce((sum, p) => sum + p.inviteCount, 0);

  return {
    round,
    participants,
    totalInvites,
    roundNumber: roundId + 1,
  };
}

/**
 * Helper: Fill template variables in prompt
 */
function fillTemplate(template, vars) {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return result;
}

/**
 * Helper: Generate text content using Gemini
 */
async function generatePostText(prompt) {
  try {
    const result = await callLLM([
      { role: "user", content: prompt },
    ], {
      temperature: 0.7,
      maxTokens: 500,
    });
    return result.trim();
  } catch (err) {
    console.error("[SocialMedia] Text generation error:", err);
    throw new Error(`Text generation failed: ${err.message}`);
  }
}

/**
 * Helper: Generate image using Gemini (NanoBanana 3.0 Pro)
 */
async function generatePostImage(imagePrompt) {
  try {
    const apiKey = await getApiKeyFromFirestore("gemini");
    if (!apiKey) throw new Error("Gemini API key not configured");

    // Use Gemini 2.0 Flash with image generation
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: `Generate an image: ${imagePrompt}` }],
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    const parts = data.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((p) => p.inlineData);

    if (!imagePart) {
      console.warn("[SocialMedia] No image generated, continuing without image");
      return null;
    }

    return {
      base64: imagePart.inlineData.data,
      mimeType: imagePart.inlineData.mimeType || "image/png",
    };
  } catch (err) {
    console.error("[SocialMedia] Image generation error:", err);
    return null; // Don't fail the whole post if image fails
  }
}

/**
 * Helper: Post to Twitter/X using API v2
 */
async function postToTwitter(settings, text, imageData) {
  const twitter = settings.platforms?.twitter;
  if (!twitter?.enabled) {
    return { skipped: true, reason: "Twitter not enabled" };
  }

  const { apiKey, apiSecret, accessToken, accessTokenSecret } = twitter;
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    throw new Error("Twitter API credentials incomplete");
  }

  // Helper: Generate OAuth 1.0a signature
  const crypto = require("crypto");

  function percentEncode(str) {
    return encodeURIComponent(str)
      .replace(/!/g, "%21")
      .replace(/\*/g, "%2A")
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29");
  }

  function generateOAuthSignature(method, url, params, consumerSecret, tokenSecret) {
    const sortedKeys = Object.keys(params).sort();
    const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join("&");
    const baseString = `${method}&${percentEncode(url)}&${percentEncode(paramString)}`;
    const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
    return crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");
  }

  function buildOAuthHeader(method, url, extraParams = {}) {
    const oauthParams = {
      oauth_consumer_key: apiKey,
      oauth_nonce: crypto.randomBytes(16).toString("hex"),
      oauth_signature_method: "HMAC-SHA1",
      oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
      oauth_token: accessToken,
      oauth_version: "1.0",
      ...extraParams,
    };
    const signature = generateOAuthSignature(method, url, oauthParams, apiSecret, accessTokenSecret);
    oauthParams.oauth_signature = signature;
    const header = Object.keys(oauthParams)
      .sort()
      .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
      .join(", ");
    return `OAuth ${header}`;
  }

  let mediaId = null;

  // Upload image if available (Twitter v1.1 media upload)
  if (imageData) {
    try {
      const mediaUrl = "https://upload.twitter.com/1.1/media/upload.json";

      // Use FormData-like approach with fetch
      const boundary = `----FormBoundary${crypto.randomBytes(8).toString("hex")}`;

      const bodyParts = [
        `--${boundary}\r\n`,
        `Content-Disposition: form-data; name="media_data"\r\n\r\n`,
        `${imageData.base64}\r\n`,
        `--${boundary}--\r\n`,
      ];
      const body = bodyParts.join("");

      const oauthHeader = buildOAuthHeader("POST", mediaUrl);
      const mediaResp = await fetch(mediaUrl, {
        method: "POST",
        headers: {
          "Authorization": oauthHeader,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body,
      });

      if (mediaResp.ok) {
        const mediaResult = await mediaResp.json();
        mediaId = mediaResult.media_id_string;
        console.log(`[SocialMedia] Twitter media uploaded: ${mediaId}`);
      } else {
        const errText = await mediaResp.text();
        console.error(`[SocialMedia] Twitter media upload failed: ${errText}`);
      }
    } catch (err) {
      console.error("[SocialMedia] Twitter media upload error:", err);
    }
  }

  // Post tweet using v2 API
  const tweetUrl = "https://api.twitter.com/2/tweets";
  const tweetBody = { text };
  if (mediaId) {
    tweetBody.media = { media_ids: [mediaId] };
  }

  const oauthHeader = buildOAuthHeader("POST", tweetUrl);
  const tweetResp = await fetch(tweetUrl, {
    method: "POST",
    headers: {
      "Authorization": oauthHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(tweetBody),
  });

  if (!tweetResp.ok) {
    const errText = await tweetResp.text();
    throw new Error(`Twitter post failed: ${tweetResp.status} - ${errText}`);
  }

  const tweetResult = await tweetResp.json();
  const tweetId = tweetResult.data?.id;

  return {
    success: true,
    postId: tweetId,
    postUrl: tweetId ? `https://x.com/i/status/${tweetId}` : null,
  };
}

/**
 * Helper: Post to LinkedIn
 */
async function postToLinkedIn(settings, text, imageData) {
  const linkedin = settings.platforms?.linkedin;
  if (!linkedin?.enabled) {
    return { skipped: true, reason: "LinkedIn not enabled" };
  }

  const { accessToken: lnToken, organizationId } = linkedin;
  if (!lnToken) throw new Error("LinkedIn access token not configured");

  const author = organizationId ?
    `urn:li:organization:${organizationId}` :
    "urn:li:person:me";

  let imageUrn = null;

  // Upload image if available
  if (imageData) {
    try {
      // Step 1: Register upload
      const registerResp = await fetch("https://api.linkedin.com/v2/assets?action=registerUpload", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${lnToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          registerUploadRequest: {
            recipes: ["urn:li:digitalmediaRecipe:feedshare-image"],
            owner: author,
            serviceRelationships: [{
              relationshipType: "OWNER",
              identifier: "urn:li:userGeneratedContent",
            }],
          },
        }),
      });

      if (registerResp.ok) {
        const regData = await registerResp.json();
        const uploadUrl = regData.value?.uploadMechanism?.["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]?.uploadUrl;
        imageUrn = regData.value?.asset;

        if (uploadUrl) {
          // Step 2: Upload image binary
          const imageBuffer = Buffer.from(imageData.base64, "base64");
          await fetch(uploadUrl, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${lnToken}`,
              "Content-Type": imageData.mimeType,
            },
            body: imageBuffer,
          });
          console.log(`[SocialMedia] LinkedIn image uploaded: ${imageUrn}`);
        }
      }
    } catch (err) {
      console.error("[SocialMedia] LinkedIn image upload error:", err);
      imageUrn = null;
    }
  }

  // Create share
  const shareBody = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text },
        shareMediaCategory: imageUrn ? "IMAGE" : "NONE",
        ...(imageUrn ? {
          media: [{
            status: "READY",
            media: imageUrn,
          }],
        } : {}),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const shareResp = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${lnToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(shareBody),
  });

  if (!shareResp.ok) {
    const errText = await shareResp.text();
    throw new Error(`LinkedIn post failed: ${shareResp.status} - ${errText}`);
  }

  const shareResult = await shareResp.json();
  return {
    success: true,
    postId: shareResult.id,
    postUrl: null, // LinkedIn doesn't return direct URL easily
  };
}

/**
 * Core posting logic shared by manual and scheduled triggers
 */
async function executeSocialPost(postType, overrideData = {}) {
  const settings = await getSocialMediaSettings();
  const postConfig = settings.postTypes?.[postType];

  if (!postConfig || !postConfig.enabled) {
    return { success: false, error: `Post type '${postType}' not found or disabled` };
  }

  // Build template variables
  let templateVars = { ...overrideData };

  // Auto-fill round data for referral_rush_round_end
  if (postType === "referral_rush_round_end" && !overrideData.roundNumber) {
    const prevRoundId = calculateRoundId(Date.now()) - 1;
    const results = await getRoundResults(prevRoundId);
    if (results) {
      const { start, end } = getRoundTimeRange(prevRoundId);
      const rankingsText = results.participants
        .slice(0, 3)
        .map((p, i) => `  ${i + 1}. ${p.referrerId} (${p.inviteCount} invites)`)
        .join("\n");

      templateVars = {
        roundNumber: results.roundNumber,
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        totalParticipants: results.participants.length,
        totalNewUsers: results.round.totalNewUsers || results.totalInvites,
        rewardPool: results.round.totalRewardPool || 1000,
        rankings: rankingsText || "  No participants this round",
        ...templateVars,
      };
    } else {
      templateVars = {
        roundNumber: prevRoundId + 1,
        totalParticipants: 0,
        totalNewUsers: 0,
        rewardPool: 1000,
        rankings: "  No participants this round",
        ...templateVars,
      };
    }
  }

  // Generate text
  const filledPrompt = fillTemplate(postConfig.prompt || "", templateVars);
  console.log(`[SocialMedia] Generating text for ${postType}...`);
  const postText = await generatePostText(filledPrompt);
  console.log(`[SocialMedia] Generated text (${postText.length} chars): ${postText.substring(0, 100)}...`);

  // Generate image
  let imageData = null;
  if (postConfig.imagePrompt) {
    const filledImagePrompt = fillTemplate(postConfig.imagePrompt, templateVars);
    console.log(`[SocialMedia] Generating image for ${postType}...`);
    imageData = await generatePostImage(filledImagePrompt);
    if (imageData) {
      console.log(`[SocialMedia] Image generated (${imageData.mimeType})`);
    }
  }

  // Post to each platform
  const platforms = postConfig.platforms || [];
  const results = [];

  for (const platform of platforms) {
    try {
      let result;
      if (platform === "twitter") {
        result = await postToTwitter(settings, postText, imageData);
      } else if (platform === "linkedin") {
        result = await postToLinkedIn(settings, postText, imageData);
      } else {
        result = { skipped: true, reason: `Unknown platform: ${platform}` };
      }

      // Log to Firestore
      await db.collection("social_posts").add({
        postType,
        platform,
        status: result.skipped ? "skipped" : (result.success ? "success" : "error"),
        content: postText,
        postUrl: result.postUrl || null,
        error: result.reason || null,
        roundId: templateVars.roundNumber ? templateVars.roundNumber - 1 : null,
        createdAt: new Date().toISOString(),
      });

      results.push({ platform, ...result });
    } catch (err) {
      console.error(`[SocialMedia] ${platform} error:`, err);

      await db.collection("social_posts").add({
        postType,
        platform,
        status: "error",
        content: postText,
        error: err.message,
        roundId: templateVars.roundNumber ? templateVars.roundNumber - 1 : null,
        createdAt: new Date().toISOString(),
      });

      results.push({ platform, success: false, error: err.message });
    }
  }

  return {
    success: results.some((r) => r.success),
    platforms: results.map((r) => r.platform),
    results,
    generatedText: postText,
  };
}

/**
 * Manual trigger / test post (callable from Admin UI)
 */
exports.postToSocialMedia = onCall({
  timeoutSeconds: 120,
  memory: "512MiB",
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { postType, testMode, overrideData } = request.data || {};
  if (!postType) {
    throw new HttpsError("invalid-argument", "postType is required");
  }

  console.log(`[SocialMedia] Manual post triggered: ${postType} (test=${!!testMode})`);

  try {
    const result = await executeSocialPost(postType, overrideData || {});
    return result;
  } catch (err) {
    console.error("[SocialMedia] Manual post error:", err);
    throw new HttpsError("internal", err.message);
  }
});

/**
 * Scheduled auto-post: Runs daily at 00:05 UTC
 * Checks if the previous round just ended and posts results
 */
exports.onRoundEndAutoPost = onSchedule({
  schedule: "5 0 * * *",
  timeZone: "UTC",
  timeoutSeconds: 120,
  memory: "512MiB",
}, async () => {
  console.log("[SocialMedia] Scheduled round-end auto-post triggered");

  try {
    const settings = await getSocialMediaSettings();
    const postConfig = settings.postTypes?.referral_rush_round_end;

    if (!postConfig?.enabled) {
      console.log("[SocialMedia] referral_rush_round_end post type not enabled, skipping");
      return;
    }

    // Check if the previous round had any activity
    const prevRoundId = calculateRoundId(Date.now()) - 1;
    if (prevRoundId < 0) {
      console.log("[SocialMedia] No previous round to report");
      return;
    }

    // Check if we already posted for this round
    const existingPosts = await db
      .collection("social_posts")
      .where("roundId", "==", prevRoundId)
      .where("postType", "==", "referral_rush_round_end")
      .where("status", "==", "success")
      .limit(1)
      .get();

    if (!existingPosts.empty) {
      console.log(`[SocialMedia] Already posted for round ${prevRoundId + 1}, skipping`);
      return;
    }

    const result = await executeSocialPost("referral_rush_round_end");
    console.log(`[SocialMedia] Auto-post result:`, JSON.stringify(result));
  } catch (err) {
    console.error("[SocialMedia] Scheduled post error:", err);
  }
});

// =====================================================
// AGENT SCHEDULED TRANSFER EXECUTOR
// Runs every 1 minute, executes pending agent scheduled transfers
// Scans agents/{id}/scheduled_transfers for due "pending" entries
// =====================================================
exports.agentScheduledTransferExecutor = onSchedule({
  schedule: "every 1 minutes",
  timeoutSeconds: 120,
  memory: "512MiB",
  secrets: ["VCN_EXECUTOR_PK"],
}, async () => {
  console.log("[AgentScheduledTx] Running:", new Date().toISOString());

  try {
    const agentsSnap = await db.collection("agents").get();
    let totalProcessed = 0;

    for (const agentDoc of agentsSnap.docs) {
      const agent = agentDoc.data();
      if (!agent.walletAddress || !agent.privateKey) continue;

      // Find due scheduled transfers for this agent
      const schedSnap = await agentDoc.ref
        .collection("scheduled_transfers")
        .where("status", "==", "pending")
        .limit(10)
        .get();

      if (schedSnap.empty) continue;

      // Filter in-memory for due entries
      const dueTransfers = schedSnap.docs.filter((doc) => {
        const data = doc.data();
        if (!data.execute_at) return false;
        return data.execute_at.toMillis() <= Date.now();
      });

      if (dueTransfers.length === 0) continue;

      // Setup blockchain connection
      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

      const agentPK = serverDecrypt(agent.privateKey);
      const agentWallet = new ethers.Wallet(agentPK, provider);
      const agentToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, agentWallet);

      // Ensure agent has gas
      const agentGas = await provider.getBalance(agent.walletAddress);
      if (agentGas < ethers.parseEther("0.001")) {
        try {
          const gasTx = await adminWallet.sendTransaction({
            to: agent.walletAddress,
            value: ethers.parseEther("0.01"),
          });
          await gasTx.wait();
        } catch (gasErr) {
          console.error(`[AgentScheduledTx] Gas funding failed for ${agent.agentName}:`, gasErr.message);
          continue;
        }
      }

      for (const schedDoc of dueTransfers) {
        const data = schedDoc.data();
        try {
          await schedDoc.ref.update({ status: "executing" });

          const amountWei = ethers.parseEther(data.amount);

          // Check balance
          const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, provider);
          const bal = await tokenContract.balanceOf(agent.walletAddress);
          if (bal < amountWei) {
            await schedDoc.ref.update({
              status: "failed",
              error: "Insufficient balance at execution time",
              executed_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            continue;
          }

          const tx = await agentToken.transfer(data.to, amountWei);
          await tx.wait();

          await schedDoc.ref.update({
            status: "completed",
            tx_hash: tx.hash,
            executed_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          await agentDoc.ref.collection("transactions").add({
            type: "scheduled_transfer",
            to: data.to,
            amount: data.amount,
            txHash: tx.hash,
            schedule_id: schedDoc.id,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "confirmed",
          });

          totalProcessed++;
          console.log(`[AgentScheduledTx] Executed: ${agent.agentName} -> ${data.to}: ${data.amount} VCN, tx: ${tx.hash}`);
        } catch (execErr) {
          console.error(`[AgentScheduledTx] Failed ${schedDoc.id}:`, execErr.message);
          await schedDoc.ref.update({
            status: "failed",
            error: execErr.reason || execErr.message,
            executed_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    console.log(`[AgentScheduledTx] Complete. Processed: ${totalProcessed}`);
  } catch (err) {
    console.error("[AgentScheduledTx] Fatal error:", err);
  }
});

// =====================================================
// AGENT CONDITIONAL TRANSFER MONITOR
// Runs every 5 minutes, checks conditions and executes matching transfers
// Conditions: balance_above, balance_below, time_after
// =====================================================
exports.agentConditionalTransferMonitor = onSchedule({
  schedule: "every 5 minutes",
  timeoutSeconds: 120,
  memory: "512MiB",
  secrets: ["VCN_EXECUTOR_PK"],
}, async () => {
  console.log("[AgentConditionalTx] Running:", new Date().toISOString());

  try {
    const agentsSnap = await db.collection("agents").get();
    let totalTriggered = 0;

    for (const agentDoc of agentsSnap.docs) {
      const agent = agentDoc.data();
      if (!agent.walletAddress || !agent.privateKey) continue;

      const condSnap = await agentDoc.ref
        .collection("conditional_transfers")
        .where("status", "==", "watching")
        .limit(20)
        .get();

      if (condSnap.empty) continue;

      const provider = new ethers.JsonRpcProvider(RPC_URL);
      const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, [
        "function balanceOf(address) view returns (uint256)",
      ], provider);

      const agentBalance = await tokenContract.balanceOf(agent.walletAddress);
      const agentBalanceEth = parseFloat(ethers.formatEther(agentBalance));
      const nowSec = Math.floor(Date.now() / 1000);

      for (const condDoc of condSnap.docs) {
        const data = condDoc.data();
        const cond = data.condition;
        let shouldExecute = false;

        switch (cond.type) {
          case "balance_above":
            shouldExecute = agentBalanceEth > parseFloat(cond.value);
            break;
          case "balance_below":
            shouldExecute = agentBalanceEth < parseFloat(cond.value);
            break;
          case "time_after": {
            const targetTime = typeof cond.value === "number" ? cond.value : Math.floor(new Date(cond.value).getTime() / 1000);
            shouldExecute = nowSec >= targetTime;
            break;
          }
          default:
            await condDoc.ref.update({ status: "error", error: `Unknown condition: ${cond.type}` });
            continue;
        }

        if (!shouldExecute) continue;

        try {
          await condDoc.ref.update({ status: "executing" });

          const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
          const agentPK = serverDecrypt(agent.privateKey);
          const agentWallet = new ethers.Wallet(agentPK, provider);
          const agentToken = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, agentWallet);

          const amountWei = ethers.parseEther(data.amount);

          if (agentBalance < amountWei) {
            await condDoc.ref.update({
              status: "failed",
              error: "Insufficient balance when condition triggered",
              triggered_at: admin.firestore.FieldValue.serverTimestamp(),
            });
            continue;
          }

          // Ensure gas
          const agentGas = await provider.getBalance(agent.walletAddress);
          if (agentGas < ethers.parseEther("0.001")) {
            const gasTx = await adminWallet.sendTransaction({
              to: agent.walletAddress,
              value: ethers.parseEther("0.01"),
            });
            await gasTx.wait();
          }

          const tx = await agentToken.transfer(data.to, amountWei);
          await tx.wait();

          await condDoc.ref.update({
            status: "completed",
            tx_hash: tx.hash,
            triggered_at: admin.firestore.FieldValue.serverTimestamp(),
          });

          await agentDoc.ref.collection("transactions").add({
            type: "conditional_transfer",
            to: data.to,
            amount: data.amount,
            condition: cond,
            txHash: tx.hash,
            condition_id: condDoc.id,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            status: "confirmed",
          });

          totalTriggered++;
          console.log(`[AgentConditionalTx] Triggered: ${agent.agentName} -> ${data.to}: ${data.amount} VCN (${cond.type}=${cond.value}), tx: ${tx.hash}`);
        } catch (execErr) {
          console.error(`[AgentConditionalTx] Failed ${condDoc.id}:`, execErr.message);
          await condDoc.ref.update({
            status: "failed",
            error: execErr.reason || execErr.message,
            triggered_at: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }
    }

    console.log(`[AgentConditionalTx] Complete. Triggered: ${totalTriggered}`);
  } catch (err) {
    console.error("[AgentConditionalTx] Fatal error:", err);
  }
});

// =====================================================
// AGENT WEBHOOK PUBLISHER - Scheduled Cloud Function
// Runs every 5 minutes, checks for triggerable events
// and dispatches callbacks to subscribed webhook URLs
// =====================================================
exports.agentWebhookPublisher = onSchedule({
  schedule: "every 5 minutes",
  timeZone: "UTC",
  memory: "512MiB",
  timeoutSeconds: 120,
  secrets: ["VCN_EXECUTOR_PK"],
}, async () => {
  console.log("[WebhookPublisher] Starting webhook event check...");

  try {
    const agentsSnap = await db.collection("agents").get();
    let totalDispatched = 0;
    const axios = require("axios");
    const crypto = require("crypto");

    for (const agentDoc of agentsSnap.docs) {
      const agentId = agentDoc.id;
      const agentData = agentDoc.data();

      // Get active webhooks for this agent
      const whSnap = await db.collection("agents").doc(agentId)
        .collection("webhooks")
        .where("status", "==", "active")
        .get();

      if (whSnap.empty) continue;

      // Group webhooks by event type
      const hooksByEvent = {};
      whSnap.docs.forEach((d) => {
        const data = d.data();
        if (!hooksByEvent[data.event]) hooksByEvent[data.event] = [];
        hooksByEvent[data.event].push({ id: d.id, ...data });
      });

      // --- Check each event type ---

      // 1. transfer.received: check recent incoming transfers
      if (hooksByEvent["transfer.received"]) {
        try {
          const fiveMinAgo = new Date(Date.now() - 300000);
          const txSnap = await db.collection("agents").doc(agentId)
            .collection("transactions")
            .where("type", "==", "transfer_received")
            .where("timestamp", ">=", fiveMinAgo)
            .limit(10)
            .get();

          for (const txDoc of txSnap.docs) {
            const txData = txDoc.data();
            const alreadySent = txData.webhook_sent === true;
            if (alreadySent) continue;

            for (const hook of hooksByEvent["transfer.received"]) {
              await dispatchWebhook(db, agentId, hook, "transfer.received", {
                from: txData.from,
                amount: txData.amount,
                tx_hash: txData.txHash,
              }, axios, crypto);
              totalDispatched++;
            }
            await txDoc.ref.update({ webhook_sent: true });
          }
        } catch (e) {
          console.warn(`[WebhookPublisher] transfer.received check failed for ${agentId}:`, e.message);
        }
      }

      // 2. balance.threshold: check current balance against filters
      if (hooksByEvent["balance.threshold"]) {
        try {
          const provider = new ethers.JsonRpcProvider(RPC_URL);
          const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, provider);
          const balance = parseFloat(ethers.formatEther(await tokenContract.balanceOf(agentData.walletAddress)));

          for (const hook of hooksByEvent["balance.threshold"]) {
            const threshold = parseFloat(hook.filters?.threshold || "0");
            const direction = hook.filters?.direction || "below";
            const lastBalance = hook.last_checked_balance || 0;

            let shouldFire = false;
            if (direction === "below" && balance < threshold && lastBalance >= threshold) shouldFire = true;
            if (direction === "above" && balance > threshold && lastBalance <= threshold) shouldFire = true;

            if (shouldFire) {
              await dispatchWebhook(db, agentId, hook, "balance.threshold", {
                balance: balance.toString(),
                threshold: threshold.toString(),
                direction,
              }, axios, crypto);
              totalDispatched++;
            }

            await db.collection("agents").doc(agentId)
              .collection("webhooks").doc(hook.id)
              .update({ last_checked_balance: balance });
          }
        } catch (e) {
          console.warn(`[WebhookPublisher] balance.threshold check failed for ${agentId}:`, e.message);
        }
      }

      // 3. staking.cooldown_complete: check if cooldown expired
      if (hooksByEvent["staking.cooldown_complete"]) {
        try {
          const provider = new ethers.JsonRpcProvider(RPC_URL);
          const stakingContract = new ethers.Contract(BRIDGE_STAKING_ADDRESS, BRIDGE_STAKING_ABI, provider);
          const cooldownEnd = await stakingContract.getCooldownEnd(agentData.walletAddress);
          const cooldownEndMs = Number(cooldownEnd) * 1000;

          if (cooldownEndMs > 0 && cooldownEndMs <= Date.now()) {
            for (const hook of hooksByEvent["staking.cooldown_complete"]) {
              const lastTriggered = hook.last_triggered?.toMillis?.() || 0;
              if (lastTriggered < cooldownEndMs) {
                await dispatchWebhook(db, agentId, hook, "staking.cooldown_complete", {
                  cooldown_end: new Date(cooldownEndMs).toISOString(),
                  can_withdraw: true,
                }, axios, crypto);
                totalDispatched++;
              }
            }
          }
        } catch (e) {
          console.warn(`[WebhookPublisher] cooldown check failed for ${agentId}:`, e.message);
        }
      }

      // 4. node.stale: check if node heartbeat is overdue
      if (hooksByEvent["node.stale"]) {
        try {
          const nodeSnap = await db.collection("agents").doc(agentId)
            .collection("node").doc("status").get();
          if (nodeSnap.exists) {
            const nodeData = nodeSnap.data();
            const lastHb = nodeData.last_heartbeat?.toMillis?.() || 0;
            const elapsed = Date.now() - lastHb;

            // Fire once in 10-15 min window after heartbeat missed
            if (elapsed > 600000 && elapsed < 900000) {
              for (const hook of hooksByEvent["node.stale"]) {
                await dispatchWebhook(db, agentId, hook, "node.stale", {
                  node_id: nodeData.node_id,
                  last_heartbeat: new Date(lastHb).toISOString(),
                  minutes_overdue: Math.round(elapsed / 60000),
                }, axios, crypto);
                totalDispatched++;
              }
            }
          }
        } catch (e) {
          console.warn(`[WebhookPublisher] node.stale check failed for ${agentId}:`, e.message);
        }
      }
    }

    console.log(`[WebhookPublisher] Complete. Dispatched: ${totalDispatched}`);
  } catch (err) {
    console.error("[WebhookPublisher] Fatal error:", err);
  }
});

// --- Webhook dispatch helper ---
async function dispatchWebhook(db, agentId, hook, event, data, axios, crypto) {
  const payload = {
    event,
    agent_id: agentId,
    timestamp: new Date().toISOString(),
    data,
  };

  const hmac = crypto.createHmac("sha256", hook.secret)
    .update(JSON.stringify(payload)).digest("hex");

  let delivered = false;
  let statusCode = 0;
  let error = null;

  try {
    const resp = await axios.post(hook.callback_url, payload, {
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        "X-Vision-Signature": hmac,
        "X-Vision-Event": event,
      },
    });
    delivered = true;
    statusCode = resp.status;
  } catch (e) {
    error = e.message;
    statusCode = e.response?.status || 0;
  }

  // Log the delivery attempt
  await db.collection("agents").doc(agentId).collection("webhook_logs").add({
    subscription_id: hook.id,
    event,
    delivered,
    status_code: statusCode,
    error,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update webhook metadata
  const updateData = {
    last_triggered: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (!delivered) {
    updateData.failure_count = admin.firestore.FieldValue.increment(1);
    // Auto-pause after 10 consecutive failures
    if ((hook.failure_count || 0) >= 9) {
      updateData.status = "paused";
    }
  } else {
    updateData.failure_count = 0; // Reset on success
  }

  await db.collection("agents").doc(agentId)
    .collection("webhooks").doc(hook.id)
    .update(updateData);
}
