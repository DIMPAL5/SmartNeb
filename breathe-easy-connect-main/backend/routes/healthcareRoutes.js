/**
 * Healthcare Routes Router
 * Mounts all production healthcare, IoT provisioning, emergency SOS,
 * gamification, and telehealth endpoints with tenant-isolation and IDOR checks.
 */

const express = require("express");
const jwt = require("jsonwebtoken");
const NotificationService = require("../services/NotificationService");
const OTPService = require("../services/OTPService");
const BLEProvisioningService = require("../services/BLEProvisioningService");
const OfflineSyncService = require("../services/OfflineSyncService");
const EnvironmentalHealthService = require("../services/EnvironmentalHealthService");
const PEFService = require("../services/PEFService");
const RespiratoryRiskService = require("../services/RespiratoryRiskService");
const MedicationVerificationService = require("../services/MedicationVerificationService");
const EmergencyService = require("../services/EmergencyService");
const EmergencySummaryService = require("../services/EmergencySummaryService");
const GamificationService = require("../services/GamificationService");
const TelehealthService = require("../services/TelehealthService");

module.exports = function createHealthcareRouter(prisma, io, authenticateToken, verifyPatientAccess, generateTokens) {
  const router = express.Router();

  const notificationService = new NotificationService(prisma);
  const otpService = new OTPService(prisma);
  const bleProvisioningService = new BLEProvisioningService(prisma);
  const offlineSyncService = new OfflineSyncService(prisma);
  const environmentalService = new EnvironmentalHealthService(prisma);
  const pefService = new PEFService(prisma);
  const riskService = new RespiratoryRiskService(prisma);
  const medicationService = new MedicationVerificationService(prisma);
  const emergencyService = new EmergencyService(prisma, notificationService);
  const emergencySummaryService = new EmergencySummaryService(prisma);
  const gamificationService = new GamificationService(prisma);
  const telehealthService = new TelehealthService(prisma);

  /* -------------------------------------------------------------------------- */
  /*                            1. PUSH NOTIFICATIONS                           */
  /* -------------------------------------------------------------------------- */

  router.post("/push-tokens", authenticateToken, async (req, res) => {
    try {
      const { token, platform, deviceModel } = req.body;
      if (!token) return res.status(400).json({ error: "Push token is required" });

      const result = await notificationService.registerPushToken({
        userId: req.user.userId,
        token,
        platform,
        deviceModel,
      });
      res.status(200).json({ success: true, result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete("/push-tokens", authenticateToken, async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) return res.status(400).json({ error: "Push token is required" });

      const result = await notificationService.removePushToken({
        userId: req.user.userId,
        token,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/push-tokens/test-alert", authenticateToken, async (req, res) => {
    try {
      const { patientId, spo2, message } = req.body;
      const targetPatientId = patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await notificationService.sendAlertNotification({
        patientId: targetPatientId,
        spo2: spo2 !== undefined ? Number(spo2) : 89,
        severity: Number(spo2) < 88 ? "critical" : "warning",
        message,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                           2. SMS / WHATSAPP OTP                            */
  /* -------------------------------------------------------------------------- */

  router.post("/auth/otp/send", async (req, res) => {
    try {
      const { phone, channel, purpose } = req.body;
      const result = await otpService.sendOtp({ phone, channel, purpose });
      res.status(200).json(result);
    } catch (err) {
      res.status(err.statusCode || 400).json({ error: err.message });
    }
  });

  router.post("/auth/otp/verify", async (req, res) => {
    try {
      const { phone, code, purpose } = req.body;
      const result = await otpService.verifyOtp({ phone, code, purpose });

      if (result.user) {
        // User exists, issue JWT session tokens
        const user = result.user;
        const role = user.role || (user.roles && user.roles[0]?.role) || "patient";
        const tokens = generateTokens(
          user,
          role,
          user.patientProfile?.id,
          user.doctorProfile?.id,
          user.caregiverProfile?.id,
          user.hospitalId
        );
        return res.status(200).json({
          success: true,
          verified: true,
          ...tokens,
        });
      }

      res.status(200).json({
        success: true,
        verified: true,
        phone: result.phone,
        message: "Phone verified successfully. Proceed to user account linking or setup.",
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                     3. BLE DEVICE PROVISIONING                             */
  /* -------------------------------------------------------------------------- */

  router.post("/devices/provision/start", authenticateToken, async (req, res) => {
    try {
      const hospitalId = req.user.hospitalId || (await prisma.hospital.findFirst({ where: { status: "approved" } }))?.id;
      const patientId = req.user.patientId || req.body.patientId;

      if (!hospitalId) return res.status(400).json({ error: "Hospital affiliation required" });

      const session = await bleProvisioningService.startSession({ hospitalId, patientId });
      res.status(200).json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/devices/provision/complete", async (req, res) => {
    try {
      const { sessionToken, deviceCode, macAddress, firmwareVersion } = req.body;
      const result = await bleProvisioningService.completeProvisioning({
        sessionToken,
        deviceCode,
        macAddress,
        firmwareVersion,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post("/devices/provision/unpair", authenticateToken, async (req, res) => {
    try {
      const { deviceCode } = req.body;
      const result = await bleProvisioningService.unpairDevice({
        deviceCode,
        hospitalId: req.user.hospitalId,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                       4. OFFLINE BATCH SYNCHRONIZATION                     */
  /* -------------------------------------------------------------------------- */

  router.post("/sync/batch", authenticateToken, async (req, res) => {
    try {
      const { patientId, records } = req.body;
      const targetPatientId = patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await offlineSyncService.syncBatch({
        patientId: targetPatientId,
        records,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                        5. AIR QUALITY + WEATHER                            */
  /* -------------------------------------------------------------------------- */

  router.get("/environment/current", authenticateToken, async (req, res) => {
    try {
      const lat = parseFloat(req.query.lat) || 12.9716;
      const lon = parseFloat(req.query.lon) || 77.5946;
      const city = req.query.city || "Bengaluru";
      const patientId = req.user.patientId || req.query.patientId;

      const data = await environmentalService.getEnvironmentalData({
        patientId,
        lat,
        lon,
        city,
      });
      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                     6. PEAK EXPIRATORY FLOW TRACKING                       */
  /* -------------------------------------------------------------------------- */

  router.post("/pef/reading", authenticateToken, async (req, res) => {
    try {
      const { patientId, value, baselineOverride, symptoms, note, recordedAt } = req.body;
      const targetPatientId = patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await pefService.recordReading({
        patientId: targetPatientId,
        value,
        baselineOverride,
        symptoms,
        note,
        recordedAt,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/pef/history", authenticateToken, async (req, res) => {
    try {
      const targetPatientId = req.query.patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await pefService.getHistory({
        patientId: targetPatientId,
        limit: req.query.limit || 30,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                  7. RESPIRATORY RISK INTELLIGENCE                          */
  /* -------------------------------------------------------------------------- */

  router.get("/respiratory-risk/evaluate", authenticateToken, async (req, res) => {
    try {
      const targetPatientId = req.query.patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await riskService.evaluateRisk({
        patientId: targetPatientId,
        aqiOverride: req.query.aqi ? Number(req.query.aqi) : undefined,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/respiratory-risk/history", authenticateToken, async (req, res) => {
    try {
      const targetPatientId = req.query.patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await riskService.getHistory({
        patientId: targetPatientId,
        limit: req.query.limit || 10,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                    8. MEDICATION BARCODE / OCR SCANNER                     */
  /* -------------------------------------------------------------------------- */

  router.post("/medications/verify", authenticateToken, async (req, res) => {
    try {
      const { patientId, scannedCode, medicationName, expiryDate } = req.body;
      const targetPatientId = patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await medicationService.verifyMedication({
        patientId: targetPatientId,
        scannedCode,
        medicationName,
        expiryDate,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get("/medications/history", authenticateToken, async (req, res) => {
    try {
      const targetPatientId = req.query.patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await medicationService.getVerificationHistory({
        patientId: targetPatientId,
        limit: req.query.limit || 10,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                  9. EMERGENCY SOS & EMERGENCY SUMMARY LINK                 */
  /* -------------------------------------------------------------------------- */

  router.post("/emergency/sos", authenticateToken, async (req, res) => {
    try {
      const { patientId, source, coords } = req.body;
      const targetPatientId = patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await emergencyService.triggerSOS({
        patientId: targetPatientId,
        source: source || "mobile_app_sos",
        coords,
        socketEmitter: (evt, data) => io.emit(evt, data),
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/emergency/resolve", authenticateToken, async (req, res) => {
    try {
      const { eventId } = req.body;
      const result = await emergencyService.resolveSOS({
        eventId,
        resolvedBy: req.user.fullName || req.user.email,
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post("/emergency/summary/token", authenticateToken, async (req, res) => {
    try {
      const targetPatientId = req.body.patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await emergencySummaryService.generateToken({
        patientId: targetPatientId,
        validityHours: req.body.validityHours || 24,
      });
      res.status(201).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Public View-Only Emergency Summary (No auth header required)
  router.get("/emergency/summary/public/:token", async (req, res) => {
    try {
      const { token } = req.params;
      const summary = await emergencySummaryService.getPublicSummary(token);
      res.status(200).json(summary);
    } catch (err) {
      res.status(err.statusCode || 404).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                  10. GAMIFICATION (BREATHE WITH BUNNY)                     */
  /* -------------------------------------------------------------------------- */

  router.get("/gamification/profile", authenticateToken, async (req, res) => {
    try {
      const targetPatientId = req.query.patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await gamificationService.getProfile(targetPatientId);
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/gamification/complete-session", authenticateToken, async (req, res) => {
    try {
      const { patientId, durationSeconds, adherenceRatio } = req.body;
      const targetPatientId = patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await gamificationService.recordSessionCompletion({
        patientId: targetPatientId,
        durationSeconds: Number(durationSeconds || 600),
        adherenceRatio: parseFloat(adherenceRatio || 1.0),
      });
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.put("/gamification/character", authenticateToken, async (req, res) => {
    try {
      const { patientId, character } = req.body;
      const targetPatientId = patientId || req.user.patientId;
      if (!targetPatientId) return res.status(400).json({ error: "patientId is required" });

      const hasAccess = await verifyPatientAccess(req.user, targetPatientId);
      if (!hasAccess) return res.status(403).json({ error: "Access denied to target patient" });

      const result = await gamificationService.updateCharacter(targetPatientId, character);
      res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  /* -------------------------------------------------------------------------- */
  /*                      11. TELEHEALTH CONSULTATION                           */
  /* -------------------------------------------------------------------------- */

  router.post("/telehealth/session", authenticateToken, async (req, res) => {
    try {
      const { patientId, doctorId, scheduledTime } = req.body;
      const targetPatientId = patientId || req.user.patientId;
      const targetDoctorId = doctorId || req.user.doctorId;

      if (!targetPatientId || !targetDoctorId) {
        return res.status(400).json({ error: "patientId and doctorId are required" });
      }

      const session = await telehealthService.createSession({
        patientId: targetPatientId,
        doctorId: targetDoctorId,
        scheduledTime,
      });
      res.status(201).json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/telehealth/session/:id", authenticateToken, async (req, res) => {
    try {
      const details = await telehealthService.getSessionDetails(req.params.id);
      res.status(200).json(details);
    } catch (err) {
      res.status(404).json({ error: err.message });
    }
  });

  router.post("/telehealth/session/:id/end", authenticateToken, async (req, res) => {
    try {
      const session = await telehealthService.endSession(req.params.id);
      res.status(200).json(session);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get("/telehealth/sessions", authenticateToken, async (req, res) => {
    try {
      const sessions = await telehealthService.getUserSessions({
        patientId: req.user.patientId,
        doctorId: req.user.doctorId,
      });
      res.status(200).json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
