/**
 * SmartNeb SMS OTP Provider Subsystem
 * Primary Provider: MSG91 | Alternative Provider: Twilio
 * Features: Rate limiting (60s cooldown), 5-min expiry, max 3 attempts limit
 */

const crypto = require("crypto");

// In-memory OTP storage: phone -> { otpHash, expiresAt, attempts, lastRequestedAt }
const otpStore = new Map();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes validity
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds resend cooldown
const MAX_ATTEMPTS = 3;

/**
 * Generate 6-digit OTP
 */
function generateOtpCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash OTP for secure memory/storage comparison
 */
function hashOtp(phone, otp) {
  return crypto.createHash("sha256").update(`${phone}:${otp}`).digest("hex");
}

/**
 * Send OTP via MSG91 SMS Provider
 */
async function sendViaMSG91(phone, otpCode) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID || "smartneb_otp_template";

  if (!authKey) {
    console.log(`[SMS-MOCK-MSG91] Sending OTP ${otpCode} to ${phone} (MSG91_AUTH_KEY not set)`);
    return { success: true, provider: "MSG91_MOCK", messageId: `msg91_mock_${Date.now()}` };
  }

  // Real MSG91 API call structure
  try {
    const response = await fetch("https://control.msg91.com/api/v5/otp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
      body: JSON.stringify({
        template_id: templateId,
        mobile: phone.replace("+", ""),
        otp: otpCode,
      }),
    });
    const data = await response.json();
    return { success: data.type === "success", provider: "MSG91", response: data };
  } catch (err) {
    console.error("MSG91 SMS Provider error:", err);
    return { success: false, provider: "MSG91", error: err.message };
  }
}

/**
 * Send OTP via Twilio Provider (Alternative)
 */
async function sendViaTwilio(phone, otpCode) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) {
    console.log(`[SMS-MOCK-TWILIO] Sending OTP ${otpCode} to ${phone} (TWILIO credentials not set)`);
    return { success: true, provider: "TWILIO_MOCK", messageId: `twilio_mock_${Date.now()}` };
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const params = new URLSearchParams();
    params.append("To", phone);
    params.append("From", fromPhone || "+15005550006");
    params.append("Body", `Your SmartNeb verification code is: ${otpCode}. Valid for 5 minutes.`);

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = await response.json();
    return { success: !!data.sid, provider: "TWILIO", sid: data.sid };
  } catch (err) {
    console.error("Twilio SMS Provider error:", err);
    return { success: false, provider: "TWILIO", error: err.message };
  }
}

/**
 * Request OTP Generation & Dispatch
 */
async function requestSmsOtp(phone, provider = "msg91") {
  if (!phone) throw new Error("Phone number is required");

  const existing = otpStore.get(phone);
  const now = Date.now();

  if (existing && now - existing.lastRequestedAt < RESEND_COOLDOWN_MS) {
    const remainingSec = Math.ceil((RESEND_COOLDOWN_MS - (now - existing.lastRequestedAt)) / 1000);
    throw new Error(`OTP request rate limited. Please wait ${remainingSec} seconds before requesting a new OTP.`);
  }

  const otpCode = generateOtpCode();
  const otpHash = hashOtp(phone, otpCode);

  otpStore.set(phone, {
    otpHash,
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    lastRequestedAt: now,
  });

  let sendResult;
  if (provider.toLowerCase() === "twilio") {
    sendResult = await sendViaTwilio(phone, otpCode);
  } else {
    sendResult = await sendViaMSG91(phone, otpCode);
  }

  return {
    status: "success",
    message: "OTP sent successfully.",
    phone,
    expiresInSeconds: 300,
    sendResult,
  };
}

/**
 * Verify User-Entered OTP
 */
async function verifySmsOtp(phone, userOtp) {
  if (!phone || !userOtp) throw new Error("Phone number and OTP code are required");

  const record = otpStore.get(phone);
  if (!record) {
    return { success: false, reason: "EXPIRED_OR_NOT_FOUND", message: "No active OTP request found for this phone number." };
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return { success: false, reason: "EXPIRED", message: "OTP has expired. Please request a new code." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { success: false, reason: "MAX_ATTEMPTS_EXCEEDED", message: "Maximum verification attempts exceeded. Request a new OTP." };
  }

  record.attempts += 1;
  const inputHash = hashOtp(phone, userOtp);

  if (inputHash === record.otpHash) {
    otpStore.delete(phone); // Burn OTP after successful single-use verification
    return { success: true, message: "OTP verified successfully." };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(phone);
    return { success: false, reason: "MAX_ATTEMPTS_EXCEEDED", message: "Maximum verification attempts exceeded. Request a new OTP." };
  }

  return {
    success: false,
    reason: "INVALID_CODE",
    message: `Invalid OTP code. ${MAX_ATTEMPTS - record.attempts} attempt(s) remaining.`,
  };
}

module.exports = {
  requestSmsOtp,
  verifySmsOtp,
  otpStore,
};
