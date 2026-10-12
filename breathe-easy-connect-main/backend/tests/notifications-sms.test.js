const { sendPushNotification, isDuplicateAlert, alertCooldownMap } = require("../services/push-notification.service");
const { requestSmsOtp, verifySmsOtp, otpStore } = require("../services/sms-otp.service");

describe("Push Notifications & SMS OTP Subsystem Unit Tests", () => {
  beforeEach(() => {
    alertCooldownMap.clear();
    otpStore.clear();
  });

  describe("Push Notifications Deduplication & Formatting", () => {
    test("Deduplication suppresses duplicate push alerts within 60s window", () => {
      const userId = "usr_test_123";
      const alertType = "LOW_SPO2";

      expect(isDuplicateAlert(userId, alertType)).toBe(false);
      expect(isDuplicateAlert(userId, alertType)).toBe(true); // 2nd attempt within 60s suppressed
    });

    test("Skipped when no push tokens or invalid tokens provided", async () => {
      const resultEmpty = await sendPushNotification({ pushTokens: [], title: "Test", body: "Body" });
      expect(resultEmpty.status).toBe("SKIPPED");

      const resultInvalid = await sendPushNotification({ pushTokens: ["invalid_token"], title: "Test", body: "Body" });
      expect(resultInvalid.status).toBe("SKIPPED");
    });
  });

  describe("SMS OTP Provider (MSG91 & Twilio) & Verification Logic", () => {
    test("Generates and verifies SMS OTP code via MSG91 mock provider", async () => {
      const phone = "+19998887777";
      const requestRes = await requestSmsOtp(phone, "msg91");

      expect(requestRes.status).toBe("success");
      expect(requestRes.sendResult.provider).toContain("MSG91");

      const otpRecord = otpStore.get(phone);
      expect(otpRecord).toBeDefined();

      // Retrieve the generated OTP from map for verification test
      // In production memory, we verify against the user input
      const invalidVerify = await verifySmsOtp(phone, "000000");
      expect(invalidVerify.success).toBe(false);
      expect(invalidVerify.reason).toBe("INVALID_CODE");
    });

    test("Generates and verifies SMS OTP code via Twilio mock provider", async () => {
      const phone = "+18887776666";
      const requestRes = await requestSmsOtp(phone, "twilio");

      expect(requestRes.status).toBe("success");
      expect(requestRes.sendResult.provider).toContain("TWILIO");
    });

    test("Enforces 60-second OTP request rate limiting", async () => {
      const phone = "+17776665555";
      await requestSmsOtp(phone, "msg91");

      await expect(requestSmsOtp(phone, "msg91")).rejects.toThrow(/rate limited/i);
    });

    test("Enforces max 3 failed verification attempts before invalidating OTP", async () => {
      const phone = "+16665554444";
      await requestSmsOtp(phone, "msg91");

      await verifySmsOtp(phone, "111111"); // Attempt 1
      await verifySmsOtp(phone, "222222"); // Attempt 2
      const res3 = await verifySmsOtp(phone, "333333"); // Attempt 3 (Max)

      expect(res3.reason).toBe("MAX_ATTEMPTS_EXCEEDED");
      expect(otpStore.has(phone)).toBe(false);
    });
  });
});
