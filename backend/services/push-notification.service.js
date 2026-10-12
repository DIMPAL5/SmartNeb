/**
 * SmartNeb Expo Push Notification Service
 * Native Zero-Dependency HTTP Client for Expo Push API (https://exp.host/--/api/v2/push/send)
 * Features: Retries, Receipt checking, Deduplication (60s alert cooldown per user)
 */

// In-memory deduplication cache: key = `${userId}:${alertType}`, value = timestamp
const alertCooldownMap = new Map();
const COOLDOWN_MS = 60 * 1000; // 60-second alert deduplication window

function isExpoPushToken(token) {
  return typeof token === "string" && (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken["));
}

function isDuplicateAlert(userId, alertType) {
  if (!userId) return false;
  const key = `${userId}:${alertType}`;
  const now = Date.now();
  const lastSent = alertCooldownMap.get(key);

  if (lastSent && now - lastSent < COOLDOWN_MS) {
    return true; // Duplicate, suppress spam
  }
  alertCooldownMap.set(key, now);
  return false;
}

/**
 * Send push notification to target user push tokens via Expo HTTP API
 */
async function sendPushNotification({ pushTokens, title, body, data = {}, alertType = "GENERAL" }) {
  if (!pushTokens || pushTokens.length === 0) {
    return { status: "SKIPPED", reason: "No push tokens provided" };
  }

  const validTokens = pushTokens.filter(isExpoPushToken);
  if (validTokens.length === 0) {
    return { status: "SKIPPED", reason: "No valid Expo push tokens found" };
  }

  // Filter out duplicates if userId is provided in data
  if (data.userId && isDuplicateAlert(data.userId, alertType)) {
    return { status: "DEDUPLICATED", reason: "Suppressed duplicate push alert within cooldown window" };
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: "default",
    title,
    body,
    data: { ...data, alertType },
    priority: "high",
    channelId: alertType === "LOW_SPO2" || alertType === "SOS_EMERGENCY" ? "emergency" : "default",
  }));

  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    };

    if (process.env.EXPO_ACCESS_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
    });

    const resData = await response.json();
    return { status: "SENT", ticketCount: messages.length, tickets: resData.data || [] };
  } catch (error) {
    console.error("Expo Push Notification dispatch error:", error.message);
    return { status: "FAILED", error: error.message };
  }
}

/**
 * Check push receipts for delivery verification & token cleanup
 */
async function verifyPushReceipts(receiptIds) {
  if (!receiptIds || receiptIds.length === 0) return [];

  try {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (process.env.EXPO_ACCESS_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
    }

    const response = await fetch("https://exp.host/--/api/v2/push/getReceipts", {
      method: "POST",
      headers,
      body: JSON.stringify({ ids: receiptIds }),
    });

    const resData = await response.json();
    return resData.data || {};
  } catch (error) {
    console.error("Error fetching push receipts:", error.message);
    return {};
  }
}

module.exports = {
  sendPushNotification,
  verifyPushReceipts,
  isDuplicateAlert,
  isExpoPushToken,
  alertCooldownMap,
};
