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
function generateVerificationEmailHtml(code, deviceInfo) {
  /* eslint-disable max-len */
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0b; color: #fff; padding: 40px; }
        .container { max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
        .logo { font-size: 24px; font-weight: bold; color: #22d3ee; margin-bottom: 24px; }
        .code { font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #22d3ee; background: rgba(34,211,238,0.1); padding: 16px 24px; border-radius: 12px; display: inline-block; margin: 24px 0; }
        .warning { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); padding: 16px; border-radius: 12px; margin-top: 24px; }
        .footer { margin-top: 32px; font-size: 12px; color: #888; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Vision Chain</div>
        <h2>New Device Verification</h2>
        <p>A new device is trying to access your wallet. Enter this code to verify:</p>
        <div class="code">${code}</div>
        <p>This code expires in 15 minutes.</p>
        <div class="warning">
          <strong>Device Info:</strong><br/>
          ${deviceInfo || "Unknown device"}
        </div>
        <p class="footer">
          If you didn't request this, someone may be trying to access your account.
          Please secure your account immediately.
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate suspicious activity alert email HTML
 * @param {string} reason - Alert reason
 * @param {string} details - Activity details
 * @return {string} HTML content
 */
function generateSuspiciousActivityEmailHtml(reason, details) {
  /* eslint-disable max-len */
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0a0b; color: #fff; padding: 40px; }
        .container { max-width: 500px; margin: 0 auto; background: linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02)); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
        .logo { font-size: 24px; font-weight: bold; color: #22d3ee; margin-bottom: 24px; }
        .alert { background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.5); padding: 20px; border-radius: 12px; margin: 24px 0; }
        .details { background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; font-family: monospace; font-size: 12px; }
        .footer { margin-top: 32px; font-size: 12px; color: #888; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">Vision Chain</div>
        <h2>Security Alert</h2>
        <div class="alert">
          <strong>Suspicious Activity Detected</strong><br/>
          ${reason}
        </div>
        <div class="details">
          ${details}
        </div>
        <p>If this wasn't you, please:</p>
        <ul>
          <li>Change your password immediately</li>
          <li>Review your recent account activity</li>
          <li>Enable two-factor authentication</li>
        </ul>
        <p class="footer">
          This is an automated security alert from Vision Chain.
        </p>
      </div>
    </body>
    </html>
  `;
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

// Configuration
const RPC_URL = "https://api.visionchain.co/rpc-proxy"; // Vision Chain v2 (Chain ID: 3151909)

// Vision Chain Executor - MUST be set via Firebase Secrets
// firebase functions:secrets:set VCN_EXECUTOR_PK
const VCN_EXECUTOR_PK = process.env.VCN_EXECUTOR_PK;

// Legacy fallback for existing functions (will be removed after migration)
const EXECUTOR_PRIVATE_KEY = VCN_EXECUTOR_PK || process.env.EXECUTOR_PK;

// --- VCN Token Address (Vision Chain v2) ---
const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// --- BridgeStaking Contract Config ---
const BRIDGE_STAKING_ADDRESS = "0x746a48E39dC57Ff14B872B8979E20efE5E5100B1";

const BRIDGE_STAKING_ABI = [
  "function setTargetAPY(uint256 _apyBasisPoints) external",
  "function fundRewardPool(uint256 amount) external",
  "function withdrawRewardPool(uint256 amount) external",
  // eslint-disable-next-line max-len
  "function getRewardInfo() external view returns (uint256, uint256, uint256, uint256, uint256)",
  "function owner() external view returns (address)",
];

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
exports.paymaster = onRequest({ cors: true, invoker: "public", secrets: ["VCN_EXECUTOR_PK"] }, async (req, res) => {
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
    } = req.body;

    console.log(`[Paymaster] Request type: ${type} from ${user}`);

    // Basic validation
    if (!user) {
      return res.status(400).json({ error: "Missing required field: user" });
    }

    // Deadline check (if provided)
    if (deadline && Math.floor(Date.now() / 1000) > deadline) {
      return res.status(400).json({ error: "Request expired" });
    }

    // Setup blockchain connection
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
    const tokenContract = new ethers.Contract(VCN_TOKEN_ADDRESS, VCN_TOKEN_ABI, adminWallet);

    // Route based on type
    switch (type) {
      case "transfer":
        return await handleTransfer(req, res, { user, recipient, amount, fee, deadline, signature, tokenContract, adminWallet });

      case "timelock":
        return await handleTimeLock(req, res, { user, recipient, amount, fee, deadline, signature, unlockTime, userEmail, senderAddress });

      case "batch":
        return await handleBatch(req, res, { user, transactions, fee, deadline, signature, tokenContract, adminWallet, userEmail });

      case "bridge":
        return await handleBridge(req, res, { user, srcChainId, dstChainId, token, amount, recipient, nonce, expiry, intentSignature, adminWallet });

      default:
        return res.status(400).json({ error: `Unknown type: ${type}. Supported: transfer, timelock, batch, bridge` });
    }
  } catch (err) {
    console.error("[Paymaster] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

/**
 * Handle immediate transfer
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {object} params - Transfer parameters
 * @return {Promise} - Response promise
 */
async function handleTransfer(req, res, { user, recipient, amount, fee, deadline, signature, tokenContract, adminWallet }) {
  if (!recipient || !amount) {
    return res.status(400).json({ error: "Missing required fields: recipient, amount" });
  }

  console.log(`[Paymaster:Transfer] ${user} -> ${recipient}, Amount: ${amount}`);

  // Parse amounts
  const transferAmountBigInt = BigInt(amount);
  const feeBigInt = fee ? BigInt(fee) : ethers.parseUnits("1.0", 18);
  const totalAmountBigInt = transferAmountBigInt + feeBigInt;

  console.log(`[Paymaster:Transfer] Transfer: ${ethers.formatUnits(transferAmountBigInt, 18)}, Fee: ${ethers.formatUnits(feeBigInt, 18)}, Total: ${ethers.formatUnits(totalAmountBigInt, 18)}`);

  // Check user balance
  const userBalance = await tokenContract.balanceOf(user);
  if (userBalance < totalAmountBigInt) {
    console.error(`[Paymaster:Transfer] Insufficient balance: ${userBalance} < ${totalAmountBigInt}`);
    return res.status(400).json({ error: "Insufficient balance" });
  }

  // Parse signature
  const { v, r, s } = parseSignature(signature);
  if (!v) {
    return res.status(400).json({ error: "Invalid signature format" });
  }

  // Execute permit
  try {
    const permitTx = await tokenContract.permit(user, adminWallet.address, totalAmountBigInt, deadline, v, r, s);
    await permitTx.wait();
    console.log(`[Paymaster:Transfer] Permit successful: ${permitTx.hash}`);
  } catch (permitErr) {
    console.error(`[Paymaster:Transfer] Permit failed:`, permitErr);
    return res.status(400).json({ error: `Permit failed: ${permitErr.reason || permitErr.message}` });
  }

  // Execute transfer
  const tx = await tokenContract.transferFrom(user, recipient, transferAmountBigInt);
  console.log(`[Paymaster:Transfer] TX sent: ${tx.hash}`);

  const receipt = await tx.wait();
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
async function handleBridge(req, res, { user, srcChainId, dstChainId, token, amount, recipient, nonce, expiry, intentSignature, adminWallet }) {
  if (!user || !srcChainId || !dstChainId || !amount || !recipient || !intentSignature) {
    return res.status(400).json({ error: "Missing required fields for bridge" });
  }

  // Verify expiry
  if (Math.floor(Date.now() / 1000) > expiry) {
    return res.status(400).json({ error: "Intent expired" });
  }

  console.log(`[Paymaster:Bridge] ${user} bridging ${amount} to chain ${dstChainId}`);

  // Intent Commitment Contract
  const INTENT_COMMITMENT_ADDRESS = "0x47c05BCCA7d57c87083EB4e586007530eE4539e9";
  const INTENT_COMMITMENT_ABI = [
    "function commitIntent((address user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 nonce, uint256 expiry) intent, bytes signature) external returns (bytes32)",
  ];
  const contract = new ethers.Contract(INTENT_COMMITMENT_ADDRESS, INTENT_COMMITMENT_ABI, adminWallet);

  // Build intent struct
  const intent = {
    user: user,
    srcChainId: BigInt(srcChainId),
    dstChainId: BigInt(dstChainId),
    token: token || ethers.ZeroAddress,
    amount: BigInt(amount),
    recipient: recipient,
    nonce: BigInt(nonce),
    expiry: BigInt(expiry),
  };

  // Execute commitIntent on behalf of user (gas paid by admin)
  const tx = await contract.commitIntent(intent, intentSignature, { gasLimit: 300000 });
  console.log(`[Paymaster:Bridge] TX sent: ${tx.hash}`);

  const receipt = await tx.wait();
  console.log(`[Paymaster:Bridge] Confirmed in block ${receipt.blockNumber}`);

  // Parse intentHash from event
  let intentHash = null;
  for (const log of receipt.logs || []) {
    try {
      if (log.topics && log.topics.length > 1) {
        intentHash = log.topics[1];
        break;
      }
    } catch (e) {
      // Not our event
    }
  }

  // Save to Firestore for tracking
  try {
    await db.collection("bridgeTransactions").add({
      user: user.toLowerCase(),
      srcChainId: srcChainId,
      dstChainId: dstChainId,
      amount: amount,
      recipient: recipient,
      intentHash: intentHash,
      txHash: tx.hash,
      status: "COMMITTED",
      createdAt: admin.firestore.Timestamp.now(),
      type: "BRIDGE_PAYMASTER",
    });
    console.log(`[Paymaster:Bridge] Firestore record created`);
  } catch (firestoreErr) {
    console.warn("[Paymaster:Bridge] Firestore write failed:", firestoreErr.message);
  }

  return res.status(200).json({
    success: true,
    txHash: tx.hash,
    intentHash: intentHash,
  });
}

// Legacy aliases for backward compatibility (will be removed after migration)
exports.paymasterTransfer = exports.paymaster;
exports.paymasterTimeLock = exports.paymaster;


// Legacy alias for bridgeWithPaymaster (backward compatibility)
exports.bridgeWithPaymaster = exports.paymaster;


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
      const emailHtml = generateVerificationEmailHtml(deviceCheck.verificationCode, deviceInfo);
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
exports.setupTOTP = onCall({ cors: true }, async (request) => {
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
exports.enableTOTP = onCall({ cors: true }, async (request) => {
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
    const emailHtml = `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: auto; padding: 40px; background: #111; color: #fff; border-radius: 16px;">
        <h2 style="color: #22d3ee;">2FA Enabled Successfully</h2>
        <p>Two-factor authentication has been enabled on your Vision Chain account.</p>
        <p>Please save your backup codes in a secure location:</p>
        <div style="background: #1a1a1a; padding: 16px; border-radius: 8px; font-family: monospace; margin: 24px 0;">
          ${backupCodes.map((c) => `<div style="padding:4px 0;">${c}</div>`).join("")}
        </div>
        <p style="color: #888; font-size: 12px;">Each backup code can only be used once.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">If you did not enable 2FA, please contact support immediately.</p>
      </div>
    `;

    await sendSecurityEmail(email, "Vision Chain - 2FA Enabled", emailHtml);

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
exports.getTOTPStatus = onCall({ cors: true }, async (request) => {
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
exports.disableTOTP = onCall({ cors: true }, async (request) => {
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
    const emailHtml = `
      <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: auto; padding: 40px; background: #111; color: #fff; border-radius: 16px;">
        <h2 style="color: #ef4444;">2FA Disabled</h2>
        <p>Two-factor authentication has been disabled on your Vision Chain account.</p>
        <p style="color: #888; font-size: 12px;">If you did not make this change, please contact support immediately and change your password.</p>
        <p style="color: #888; font-size: 12px; margin-top: 24px;">Time: ${new Date().toISOString()}</p>
      </div>
    `;

    await sendSecurityEmail(email, "Vision Chain - 2FA Disabled", emailHtml);

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
const SEPOLIA_RELAYER_PK = process.env.SEPOLIA_RELAYER_PK;

/**
 * Bridge Relayer - Scheduled Function
 * Runs every 5 minutes to process completed bridge intents
 */
exports.bridgeRelayer = onSchedule({
  schedule: "every 2 minutes",
  timeZone: "Asia/Seoul",
  memory: "256MiB",
  secrets: ["SEPOLIA_RELAYER_PK", "VCN_EXECUTOR_PK"],
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
    const pendingTxBridges = await db.collection("transactions")
      .where("type", "==", "Bridge")
      .where("bridgeStatus", "==", "PENDING")
      .where("challengeEndTime", "<=", Date.now())
      .limit(10)
      .get();

    const totalPending = pendingBridges.size + pendingTxBridges.size;
    console.log(`[Bridge Relayer] Ready to process: ${pendingBridges.size} from bridgeTransactions, ${pendingTxBridges.size} from transactions`);

    if (totalPending === 0) {
      console.log("[Bridge Relayer] No pending bridges to process (past cutoff time)");
      return;
    }

    console.log(`[Bridge Relayer] Found ${pendingBridges.size} + ${pendingTxBridges.size} bridges to process`);

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

        // 5. Send completion notification
        try {
          const userEmail = await getBridgeUserEmail(bridge.recipient);
          if (userEmail) {
            await sendBridgeCompleteEmail(userEmail, bridge, destTxHash);
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

    // 3. Process bridges from transactions collection (frontend-created)
    for (const docSnap of pendingTxBridges.docs) {
      const txData = docSnap.data();
      const txId = docSnap.id;

      try {
        console.log(`[Bridge Relayer] Processing transactions/${txId}`);
        const dstChainId = txData.metadata?.dstChainId || 11155111; // Default to Sepolia
        const amount = txData.value || "0";
        const recipient = txData.from_addr; // Bridge back to sender

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

        // Send completion notification
        try {
          const userEmail = await getBridgeUserEmail(recipient);
          if (userEmail) {
            await sendBridgeCompleteEmail(userEmail, bridge, destTxHash);
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
  const VCN_SEPOLIA_ADDRESS = process.env.VCN_SEPOLIA_ADDRESS || "0x0000000000000000000000000000000000000000";

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
 * Send bridge completion notification email
 * @param {string} email - User email
 * @param {object} bridge - Bridge transaction data
 * @param {string} destTxHash - Destination transaction hash
 */
async function sendBridgeCompleteEmail(email, bridge, destTxHash) {
  const amount = ethers.formatEther(BigInt(bridge.amount));
  const destChain = bridge.dstChainId === SEPOLIA_CHAIN_ID ? "Ethereum Sepolia" : "Vision Chain";
  const explorerUrl = bridge.dstChainId === SEPOLIA_CHAIN_ID ?
    `https://sepolia.etherscan.io/tx/${destTxHash}` :
    `https://www.visionchain.co/visionscan/tx/${destTxHash}`;

  const emailHtml = `
    <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: auto; padding: 40px; background: #111; color: #fff; border-radius: 16px;">
      <h2 style="color: #22d3ee;">Bridge Complete!</h2>
      <p>Your cross-chain transfer has been successfully completed.</p>
      
      <div style="background: rgba(34,211,238,0.1); padding: 20px; border-radius: 12px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Amount:</strong> ${amount} VCN</p>
        <p style="margin: 8px 0 0 0;"><strong>Destination:</strong> ${destChain}</p>
      </div>
      
      <a href="${explorerUrl}" style="display: inline-block; background: #22d3ee; color: #000; font-weight: bold; padding: 12px 24px; border-radius: 8px; text-decoration: none;">
        View Transaction
      </a>
      
      <p style="color: #888; font-size: 12px; margin-top: 24px;">
        Transaction: ${destTxHash.slice(0, 10)}...${destTxHash.slice(-8)}
      </p>
    </div>
  `;

  await sendSecurityEmail(email, "Vision Chain - Bridge Transfer Complete", emailHtml);
}

// =============================================================================
// BRIDGE RELAYER - Manual Trigger (For Testing)
// =============================================================================
exports.triggerBridgeRelayer = onRequest({ cors: true, invoker: "public", secrets: ["SEPOLIA_RELAYER_PK", "VCN_EXECUTOR_PK"] }, async (req, res) => {
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
const VCN_TOKEN_SEPOLIA = "0xC068eD2b45DbD3894A72F0e4985DF8ba1299AB0f";

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
exports.secureBridgeRelayer = onSchedule("every 2 minutes", async () => {
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
            const userEmail = await getBridgeUserEmail(txData.from_addr);
            if (userEmail) {
              // 1. Send email notification
              await sendBridgeCompleteEmail(userEmail, {
                amount: ethers.parseEther(txData.value || "0").toString(),
                recipient: txData.from_addr,
                dstChainId: txData.metadata?.dstChainId || SEPOLIA_CHAIN_ID,
              }, destTxHash);

              // 2. Create in-app notification in Firestore
              const destChain = (txData.metadata?.dstChainId || SEPOLIA_CHAIN_ID) === SEPOLIA_CHAIN_ID ?
                "Ethereum Sepolia" : "Vision Chain";
              const explorerUrl = (txData.metadata?.dstChainId || SEPOLIA_CHAIN_ID) === SEPOLIA_CHAIN_ID ?
                `https://sepolia.etherscan.io/tx/${destTxHash}` :
                `https://www.visionchain.co/visionscan/tx/${destTxHash}`;

              await db.collection("notifications").add({
                email: userEmail,
                type: "bridge_completed",
                title: "Bridge Transfer Complete",
                content: `${txData.value} VCN successfully bridged to ${destChain}. View on explorer.`,
                data: {
                  amount: txData.value,
                  destinationChain: destChain,
                  sourceTxHash: txId,
                  destinationTxHash: destTxHash,
                  explorerUrl: explorerUrl,
                  status: "completed",
                },
                createdAt: admin.firestore.Timestamp.now(),
                read: false,
              });
              console.log(`[Secure Bridge] Notification created for ${userEmail}`);
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
