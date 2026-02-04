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
const RPC_URL = "http://46.224.221.201:8545"; // Vision Chain Testnet

// Vision Chain Executor - MUST be set via Firebase Secrets
// firebase functions:secrets:set VCN_EXECUTOR_PK
const VCN_EXECUTOR_PK = process.env.VCN_EXECUTOR_PK;

// Legacy fallback for existing functions (will be removed after migration)
const EXECUTOR_PRIVATE_KEY = VCN_EXECUTOR_PK || process.env.EXECUTOR_PK;

const TIMELOCK_ADDRESS = "0x367761085BF3C12e5DA2Df99AC6E1a824612b8fb";
const TIMELOCK_ABI = [
  "function executeTransfer(uint256 scheduleId) external",
  "function scheduleTransferNative(address to, uint256 unlockTime) external payable returns (uint256)",
  "event TransferScheduled(uint256 indexed scheduleId, address indexed creator, address indexed to, uint256 amount, uint256 unlockTime)",
];

// --- BridgeStaking Contract Config ---
const BRIDGE_STAKING_ADDRESS = "0x746a48E39dC57Ff14B872B8979E20efE5E5100B1";
const VCN_TOKEN_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

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

// --- Paymaster TimeLock (Gasless Scheduled Transfers) ---
exports.paymasterTimeLock = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { user, recipient, amount, unlockTime, fee, deadline, userEmail, senderAddress } = req.body;

    // Validation
    if (!user || !recipient || !amount || !unlockTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify deadline
    if (deadline && Math.floor(Date.now() / 1000) > deadline) {
      return res.status(400).json({ error: "Request expired" });
    }

    console.log(`[Paymaster] TimeLock request from ${user}`);
    console.log(`[Paymaster] Recipient: ${recipient}, Amount: ${amount}, UnlockTime: ${unlockTime}`);

    // Setup Blockchain Connection with Admin Wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(TIMELOCK_ADDRESS, TIMELOCK_ABI, adminWallet);

    // Execute TimeLock Schedule on behalf of user
    const amountWei = BigInt(amount);
    const tx = await contract.scheduleTransferNative(recipient, unlockTime, { value: amountWei });
    console.log(`[Paymaster] TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Paymaster] TX confirmed in block ${receipt.blockNumber}`);

    // Parse scheduleId from event
    let scheduleId = null;
    for (const log of receipt.logs || []) {
      try {
        const parsed = contract.interface.parseLog(log);
        if (parsed && parsed.name === "TransferScheduled") {
          scheduleId = parsed.args.scheduleId.toString();
          break;
        }
      } catch (e) {
        // Not our event
      }
    }

    // Save to Firestore for scheduler to execute later (non-blocking)
    let jobId = null;
    try {
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
        txHash: tx.hash,
        fee: fee || "0",
        type: "TIMELOCK_PAYMASTER",
        userEmail: userEmail || null,
        token: "VCN",
      });
      jobId = jobRef.id;
      console.log(`[Paymaster] Firestore job created: ${jobId}`);
    } catch (firestoreErr) {
      // Log but don't fail - blockchain tx already succeeded
      console.warn("[Paymaster] Firestore write failed (non-critical):", firestoreErr.message);
    }

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      scheduleId: scheduleId,
      jobId: jobId,
    });
  } catch (err) {
    console.error("[Paymaster] TimeLock Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// --- Paymaster Transfer (Gasless Token Transfers) ---
exports.paymasterTransfer = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  // Handle CORS preflight
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
    // eslint-disable-next-line no-unused-vars
    const { user, token, recipient, amount, fee, deadline, signature } = req.body;

    // Validation
    if (!user || !recipient || !amount) {
      return res.status(400).json({ error: "Missing required fields: user, recipient, amount" });
    }

    // Verify deadline if provided
    if (deadline && Math.floor(Date.now() / 1000) > deadline) {
      return res.status(400).json({ error: "Request expired" });
    }

    console.log(`[PaymasterTransfer] Request from ${user}`);
    console.log(`[PaymasterTransfer] Recipient: ${recipient}, Amount: ${amount}`);

    // Setup Blockchain Connection with Admin Wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

    // VCN Token Contract
    const vcnTokenAddress = token || VCN_TOKEN_ADDRESS;
    const tokenABI = [
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)",
    ];
    const tokenContract = new ethers.Contract(vcnTokenAddress, tokenABI, adminWallet);

    // Convert amount from string (wei) to BigInt
    const amountBigInt = BigInt(amount);

    // Check admin balance
    const adminBalance = await tokenContract.balanceOf(adminWallet.address);
    if (adminBalance < amountBigInt) {
      console.error(`[PaymasterTransfer] Insufficient admin balance: ${adminBalance} < ${amountBigInt}`);
      return res.status(400).json({ error: "Paymaster has insufficient funds" });
    }

    // Execute Transfer from Admin Wallet on behalf of user
    // Note: In production, you would verify the permit signature and call transferFrom
    // For now, we use a simple admin transfer model (admin pre-funds and transfers)
    const tx = await tokenContract.transfer(recipient, amountBigInt);
    console.log(`[PaymasterTransfer] TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[PaymasterTransfer] TX confirmed in block ${receipt.blockNumber}`);

    // Index transaction to Firestore
    try {
      await db.collection("transactions").doc(tx.hash).set({
        hash: tx.hash,
        chainId: 1337,
        type: "Transfer",
        from_addr: user.toLowerCase(),
        to_addr: recipient.toLowerCase(),
        value: ethers.formatUnits(amountBigInt, 18),
        timestamp: Date.now(),
        status: "indexed",
        metadata: {
          method: "Paymaster Gasless Transfer",
          source: "paymaster",
          fee: fee ? ethers.formatUnits(BigInt(fee), 18) : "1.0",
          actualSender: adminWallet.address.toLowerCase(),
        },
      });
      console.log(`[PaymasterTransfer] Transaction indexed: ${tx.hash}`);
    } catch (indexErr) {
      console.warn("[PaymasterTransfer] Indexing failed (non-critical):", indexErr.message);
    }

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      blockNumber: receipt.blockNumber,
    });
  } catch (err) {
    console.error("[PaymasterTransfer] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
});

// --- Bridge Paymaster (Gasless Cross-Chain Bridge) ---
const INTENT_COMMITMENT_ADDRESS = "0x47c05BCCA7d57c87083EB4e586007530eE4539e9";
const INTENT_COMMITMENT_ABI = [
  // eslint-disable-next-line max-len
  "function commitIntent((address user, uint256 srcChainId, uint256 dstChainId, address token, uint256 amount, address recipient, uint256 nonce, uint256 expiry) intent, bytes signature) external returns (bytes32)",
];

exports.bridgeWithPaymaster = onRequest({ cors: true, invoker: "public" }, async (req, res) => {
  // Handle CORS preflight
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
    const {
      user, srcChainId, dstChainId, token, amount, recipient, nonce, expiry, intentSignature,
    } = req.body;

    // Validation
    if (!user || !srcChainId || !dstChainId || !amount || !recipient || !intentSignature) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Verify expiry
    if (Math.floor(Date.now() / 1000) > expiry) {
      return res.status(400).json({ error: "Intent expired" });
    }

    console.log(`[Bridge Paymaster] Request from ${user}`);
    console.log(`[Bridge Paymaster] Amount: ${amount}, Dst: ${dstChainId}, Recipient: ${recipient}`);

    // Setup Blockchain Connection with Admin Wallet
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);
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
    console.log(`[Bridge Paymaster] TX sent: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[Bridge Paymaster] TX confirmed in block ${receipt.blockNumber}`);

    // Parse intentHash from event
    let intentHash = null;
    for (const log of receipt.logs || []) {
      try {
        // IntentCommitted event topic
        if (log.topics && log.topics.length > 1) {
          intentHash = log.topics[1]; // First indexed param is intentHash
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
      console.log(`[Bridge Paymaster] Firestore record created`);
    } catch (firestoreErr) {
      console.warn("[Bridge Paymaster] Firestore write failed:", firestoreErr.message);
    }

    return res.status(200).json({
      success: true,
      txHash: tx.hash,
      intentHash: intentHash,
    });
  } catch (err) {
    console.error("[Bridge Paymaster] Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
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
    const contract = new ethers.Contract(TIMELOCK_ADDRESS,
      TIMELOCK_ABI, wallet);

    // 4. Execute Jobs
    // Note: We execute sequentially to manage nonce automatically.
    // Parallel execution would require explicit nonce management.
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
        console.log(`Executing ID: ${data.scheduleId} nonce ${currentNonce}`);

        // Execute with specific nonce to prevent race conditions
        const tx = await contract.executeTransfer(data.scheduleId, {
          nonce: currentNonce,
        });

        console.log(`   Hash: ${tx.hash}`);

        // Increment Local Nonce immediately to unblock next job
        currentNonce++;

        // Update Success (Async)
        // We don't await tx.wait() inside the loop to speed up processing
        // But valid nonce management relies on the order.
        // Since we use the same wallet, we SHOULD ideally wait or manage
        // pending nonces.
        // For stability, we wait for 1 confirmation.
        await tx.wait(1);

        await docSnap.ref.update({
          status: "SENT",
          executedAt: admin.firestore.Timestamp.now(),
          txHash: tx.hash,
          error: null, // Clear prev errors
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
    // 1. Query COMMITTED bridge transactions older than 15 minutes
    const cutoffTime = new Date(Date.now() - (CHALLENGE_PERIOD_MINUTES * 60 * 1000));
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffTime);

    const pendingBridges = await db.collection("bridgeTransactions")
      .where("status", "==", "COMMITTED")
      .where("createdAt", "<=", cutoffTimestamp)
      .limit(10) // Process max 10 per run to avoid timeout
      .get();

    if (pendingBridges.empty) {
      console.log("[Bridge Relayer] No pending bridges to process");
      return;
    }

    console.log(`[Bridge Relayer] Found ${pendingBridges.size} bridges to process`);

    // 2. Process each bridge
    for (const docSnap of pendingBridges.docs) {
      const bridge = docSnap.data();
      const bridgeId = docSnap.id;

      try {
        console.log(`[Bridge Relayer] Processing bridge ${bridgeId}`);
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

    console.log("[Bridge Relayer] Execution completed");
  } catch (err) {
    console.error("[Bridge Relayer] Critical error:", err);
  }
});

/**
 * Execute bridge transfer on Sepolia
 * @param {object} bridge - Bridge transaction data
 * @return {Promise<string>} Destination transaction hash
 */
async function executeSepoliaBridgeTransfer(bridge) {
  if (!SEPOLIA_RELAYER_PK) {
    throw new Error("SEPOLIA_RELAYER_PK secret not configured. Run: firebase functions:secrets:set SEPOLIA_RELAYER_PK");
  }

  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC_URL);
  const relayerWallet = new ethers.Wallet(SEPOLIA_RELAYER_PK, provider);

  const balance = await provider.getBalance(relayerWallet.address);
  const amountWei = BigInt(bridge.amount);

  console.log(`[Sepolia Bridge] Relayer balance: ${ethers.formatEther(balance)} ETH`);
  console.log(`[Sepolia Bridge] Transfer amount: ${ethers.formatEther(amountWei)} VCN`);

  // Check if we have enough balance
  if (balance < amountWei + ethers.parseEther("0.01")) {
    console.warn("[Sepolia Bridge] Insufficient Sepolia balance - simulating transfer");

    await db.collection("bridgeExecutions").add({
      bridgeId: bridge.intentHash,
      type: "SIMULATED",
      srcChainId: bridge.srcChainId,
      dstChainId: bridge.dstChainId,
      amount: bridge.amount,
      recipient: bridge.recipient,
      executedAt: admin.firestore.Timestamp.now(),
      note: "Simulated - insufficient Sepolia balance",
    });

    return `SIMULATED_${Date.now()}`;
  }

  // Execute real transfer
  const tx = await relayerWallet.sendTransaction({
    to: bridge.recipient,
    value: amountWei,
    gasLimit: 21000,
  });

  console.log(`[Sepolia Bridge] TX sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[Sepolia Bridge] TX confirmed in block ${receipt.blockNumber}`);

  await db.collection("bridgeExecutions").add({
    bridgeId: bridge.intentHash,
    type: "REAL",
    srcChainId: bridge.srcChainId,
    dstChainId: bridge.dstChainId,
    amount: bridge.amount,
    recipient: bridge.recipient,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    executedAt: admin.firestore.Timestamp.now(),
  });

  return tx.hash;
}

/**
 * Execute bridge transfer on Vision Chain (reverse bridge)
 * @param {object} bridge - Bridge transaction data
 * @return {Promise<string>} Destination transaction hash
 */
async function executeVisionChainBridgeTransfer(bridge) {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const adminWallet = new ethers.Wallet(EXECUTOR_PRIVATE_KEY, provider);

  const vcnContract = new ethers.Contract(VCN_TOKEN_ADDRESS, ERC20_ABI, adminWallet);
  const amountWei = BigInt(bridge.amount);

  console.log(`[Vision Bridge] Transferring ${ethers.formatEther(amountWei)} VCN to ${bridge.recipient}`);

  const tx = await vcnContract.transfer(bridge.recipient, amountWei, { gasLimit: 100000 });

  console.log(`[Vision Bridge] TX sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`[Vision Bridge] TX confirmed in block ${receipt.blockNumber}`);

  await db.collection("bridgeExecutions").add({
    bridgeId: bridge.intentHash,
    type: "REAL",
    srcChainId: bridge.srcChainId,
    dstChainId: bridge.dstChainId,
    amount: bridge.amount,
    recipient: bridge.recipient,
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    executedAt: admin.firestore.Timestamp.now(),
  });

  return tx.hash;
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
