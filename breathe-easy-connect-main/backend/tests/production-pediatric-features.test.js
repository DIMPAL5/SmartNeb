const request = require("supertest");
const { app, prisma } = require("../server");
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

describe("Production Pediatric Healthcare & IoT Features Suite", () => {
  let hospital;
  let testUser;
  let testPatient;
  let authToken;

  beforeAll(async () => {
    // Set up test tenant and patient
    hospital = await prisma.hospital.upsert({
      where: { slug: "test-pediatric-hospital" },
      update: {},
      create: {
        code: "TEST-PED-001",
        name: "Test Pediatric Hospital",
        slug: "test-pediatric-hospital",
        status: "approved",
      },
    });

    testUser = await prisma.user.upsert({
      where: { email: "pediatric.tester@smartneb.local" },
      update: {},
      create: {
        email: "pediatric.tester@smartneb.local",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
        fullName: "Aarav Guardian",
        hospitalId: hospital.id,
        roles: { create: [{ role: "patient" }] },
      },
    });

    testPatient = await prisma.patient.upsert({
      where: { mrn: "MRN-PED-99901" },
      update: {},
      create: {
        user: { connect: { id: testUser.id } },
        hospital: { connect: { id: hospital.id } },
        fullName: testUser.fullName,
        mrn: "MRN-PED-99901",
        dateOfBirth: new Date("2020-05-15"),
        sex: "male",
        condition: "Pediatric Reactive Airway Disease",
        guardianName: "Aarav Guardian",
        guardianPhone: "+919876543210",
      },
    });

    // Create an active CarePlan
    await prisma.carePlan.create({
      data: {
        patientId: testPatient.id,
        medication: "Budesonide Respules 0.5mg",
        dosage: "0.5 mg / 2 ml",
        durationMinutes: 10,
        frequencyPerDay: 2,
        status: "published",
      },
    });

    // Generate JWT token
    const jwt = require("jsonwebtoken");
    const JWT_SECRET = process.env.JWT_SECRET || "smartneb_dev_fallback_secret_key_2026";
    authToken = jwt.sign(
      {
        userId: testUser.id,
        email: testUser.email,
        fullName: testUser.fullName,
        role: "patient",
        patientId: testPatient.id,
        hospitalId: hospital.id,
      },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe("1. Push Notification Service", () => {
    it("should register a device push token and trigger SpO2 threshold alert", async () => {
      const notifService = new NotificationService(prisma);
      const tokenRecord = await notifService.registerPushToken({
        userId: testUser.id,
        token: "ExponentPushToken[TestToken-12345]",
        platform: "android",
        deviceModel: "Pixel 7 Pro",
      });

      expect(tokenRecord).toBeDefined();
      expect(tokenRecord.token).toBe("ExponentPushToken[TestToken-12345]");

      // Warning alert (SpO2: 89%)
      const warnResult = await notifService.sendAlertNotification({
        patientId: testPatient.id,
        spo2: 89,
      });
      expect(warnResult.severity).toBe("warning");
      expect(warnResult.isCritical).toBe(false);

      // Critical alert (SpO2: 86%)
      const critResult = await notifService.sendAlertNotification({
        patientId: testPatient.id,
        spo2: 86,
      });
      expect(critResult.severity).toBe("critical");
      expect(critResult.isCritical).toBe(true);
    });
  });

  describe("2. SMS / WhatsApp OTP Service", () => {
    it("should generate hashed OTP, enforce cooldown, and verify correctly", async () => {
      const otpService = new OTPService(prisma);
      const phone = `+919876${Date.now().toString().slice(-6)}`;

      const sendResult = await otpService.sendOtp({ phone, channel: "sms", purpose: "login" });
      expect(sendResult.success).toBe(true);
      expect(sendResult.cooldownSeconds).toBe(60);

      // Verify cooldown restriction
      await expect(
        otpService.sendOtp({ phone, channel: "sms", purpose: "login" })
      ).rejects.toThrow(/Please wait/);

      // Verify OTP code
      const bypassCode = sendResult.devBypassCode;
      if (bypassCode) {
        const verifyResult = await otpService.verifyOtp({ phone, code: bypassCode, purpose: "login" });
        expect(verifyResult.verified).toBe(true);
      }
    });
  });

  describe("3. BLE Provisioning Service", () => {
    it("should start a provisioning session and complete pairing handshake", async () => {
      const bleService = new BLEProvisioningService(prisma);
      const session = await bleService.startSession({
        hospitalId: hospital.id,
        patientId: testPatient.id,
      });

      expect(session.sessionToken).toBeDefined();
      expect(session.status).toBe("pending");

      const pairResult = await bleService.completeProvisioning({
        sessionToken: session.sessionToken,
        deviceCode: "SN-TEST-ESP32-01",
        macAddress: "AA:BB:CC:DD:EE:FF",
        firmwareVersion: "2.4.0",
      });

      expect(pairResult.success).toBe(true);
      expect(pairResult.device.deviceCode).toBe("SN-TEST-ESP32-01");
      expect(pairResult.mqttConfig).toBeDefined();
    });
  });

  describe("4. Offline Batch Sync Service", () => {
    it("should idempotently process offline vitals without duplicates", async () => {
      const syncService = new OfflineSyncService(prisma);
      const key = "test-sync-key-" + Date.now();

      const batch = [
        {
          idempotencyKey: key,
          recordType: "health_telemetry",
          payload: { bpm: 95, spo2: 97, bodyTemperature: 36.8 },
          recordedAt: new Date().toISOString(),
        },
      ];

      const res1 = await syncService.syncBatch({ patientId: testPatient.id, records: batch });
      expect(res1.processed).toBe(1);
      expect(res1.duplicatesSkipped).toBe(0);

      // Re-sync exact same batch
      const res2 = await syncService.syncBatch({ patientId: testPatient.id, records: batch });
      expect(res2.processed).toBe(0);
      expect(res2.duplicatesSkipped).toBe(1);
    });
  });

  describe("5. Air Quality & Environmental Health Service", () => {
    it("should fetch environmental metrics and generate care plan advisory", async () => {
      const envService = new EnvironmentalHealthService(prisma);
      const result = await envService.getEnvironmentalData({
        patientId: testPatient.id,
        lat: 12.97,
        lon: 77.59,
        city: "Bengaluru",
      });

      expect(result.aqi).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.advisory).toBeDefined();
      expect(result.advisory.message).toBeDefined();
    });
  });

  describe("6. Peak Expiratory Flow (PEF) Service", () => {
    it("should record PEF and accurately classify Green/Yellow/Red zones", async () => {
      const pefService = new PEFService(prisma);

      // Green zone reading (250 / 250 = 100%)
      const greenRes = await pefService.recordReading({
        patientId: testPatient.id,
        value: 250,
        baselineOverride: 250,
        note: "Normal morning reading",
      });
      expect(greenRes.zone).toBe("Green");
      expect(greenRes.ratioPercent).toBe(100);

      // Yellow zone reading (170 / 250 = 68%)
      const yellowRes = await pefService.recordReading({
        patientId: testPatient.id,
        value: 170,
        baselineOverride: 250,
      });
      expect(yellowRes.zone).toBe("Yellow");
      expect(yellowRes.ratioPercent).toBe(68);

      // Red zone reading (100 / 250 = 40%)
      const redRes = await pefService.recordReading({
        patientId: testPatient.id,
        value: 100,
        baselineOverride: 250,
      });
      expect(redRes.zone).toBe("Red");
      expect(redRes.ratioPercent).toBe(40);
    });
  });

  describe("7. Respiratory Risk Intelligence Service", () => {
    it("should compute transparent rule-based risk with contributing factors", async () => {
      const riskService = new RespiratoryRiskService(prisma);
      const assessment = await riskService.evaluateRisk({
        patientId: testPatient.id,
      });

      expect(["LOW RISK", "MODERATE RISK", "HIGH RISK"]).toContain(assessment.riskLevel);
      expect(Array.isArray(assessment.factors)).toBe(true);
      expect(assessment.explanation).toBeDefined();
      expect(assessment.advice).toBeDefined();
      expect(assessment.disclaimer).toMatch(/Not an autonomous diagnostic device/);
    });
  });

  describe("8. Medication Verification Service", () => {
    it("should verify correct medication and reject mismatched items", async () => {
      const medService = new MedicationVerificationService(prisma);

      // Prescribed: Budesonide
      const matchRes = await medService.verifyMedication({
        patientId: testPatient.id,
        medicationName: "Budesonide Respules",
      });
      expect(matchRes.matched).toBe(true);
      expect(matchRes.status).toBe("VERIFIED_CORRECT");

      // Mismatched: Aspirin
      const mismatchRes = await medService.verifyMedication({
        patientId: testPatient.id,
        medicationName: "Aspirin 500mg",
      });
      expect(mismatchRes.matched).toBe(false);
      expect(mismatchRes.status).toBe("MEDICATION_MISMATCH");
    });
  });

  describe("9. Emergency SOS & Expiring Emergency Summary Link", () => {
    it("should trigger SOS, generate public token, and return read-only clinical card", async () => {
      const emergencyService = new EmergencyService(prisma);
      const summaryService = new EmergencySummaryService(prisma);

      // 1. Trigger SOS
      const sosRes = await emergencyService.triggerSOS({
        patientId: testPatient.id,
        source: "mobile_test_runner",
      });
      expect(sosRes.success).toBe(true);
      expect(sosRes.status).toBe("active");

      // 2. Generate token
      const tokenRes = await summaryService.generateToken({
        patientId: testPatient.id,
        validityHours: 24,
      });
      expect(tokenRes.token).toBeDefined();

      // 3. Fetch public view-only clinical card
      const summary = await summaryService.getPublicSummary(tokenRes.token);
      expect(summary.patient.gender).toBe("male");
      expect(summary.patient.knownAllergies).toBeDefined();
      expect(summary.activeCarePlans.length).toBeGreaterThan(0);
      expect(summary.notice).toMatch(/EMERGENCY VIEW ONLY/);
    });
  });

  describe("10. Pediatric Gamification (Breathe With Bunny)", () => {
    it("should reward stars, inflate balloons, and unlock milestone badges", async () => {
      const gamification = new GamificationService(prisma);

      const res = await gamification.recordSessionCompletion({
        patientId: testPatient.id,
        durationSeconds: 600,
        adherenceRatio: 1.0,
      });

      expect(res.starsEarned).toBe(5);
      expect(res.balloonsInflated).toBeGreaterThanOrEqual(1);
      expect(res.currentStreak).toBeGreaterThanOrEqual(1);

      // Verify profile retrieval
      const profileData = await gamification.getProfile(testPatient.id);
      expect(profileData.profile.character).toBe("bunny");
      expect(profileData.badges.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("11. Telehealth Consultation Service", () => {
    it("should create consultation room with live vitals overlay", async () => {
      const telehealth = new TelehealthService(prisma);

      // Create test doctor
      const doctorUser = await prisma.user.create({
        data: {
          email: `doc.telehealth.${Date.now()}@smartneb.local`,
          passwordHash: "dummy",
          fullName: "Dr. Ananya Rao",
          hospitalId: hospital.id,
          roles: { create: [{ role: "doctor" }] },
        },
      });
      const doctor = await prisma.doctor.create({
        data: {
          user: { connect: { id: doctorUser.id } },
          fullName: doctorUser.fullName,
          specialty: "Pediatric Pulmonology",
        },
      });

      const session = await telehealth.createSession({
        patientId: testPatient.id,
        doctorId: doctor.id,
      });

      expect(session.roomName).toMatch(/^smartneb-room-/);

      const details = await telehealth.getSessionDetails(session.id);
      expect(details.session.id).toBe(session.id);
      expect(details.liveVitalsOverlay).toBeDefined();
    });
  });

  describe("12. REST API Endpoint Integration", () => {
    it("GET /api/v1/environment/current should return air quality data", async () => {
      const res = await request(app)
        .get("/api/v1/environment/current")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.aqi).toBeDefined();
    });

    it("POST /api/v1/pef/reading should record PEF reading via REST API", async () => {
      const res = await request(app)
        .post("/api/v1/pef/reading")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          patientId: testPatient.id,
          value: 240,
        });

      expect(res.status).toBe(201);
      expect(res.body.zone).toBeDefined();
    });

    it("GET /api/v1/respiratory-risk/evaluate should return risk evaluation", async () => {
      const res = await request(app)
        .get("/api/v1/respiratory-risk/evaluate")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.riskLevel).toBeDefined();
    });
  });
});
