const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { app, prisma } = require("../server");

describe("GATE 2: Alert Engine, Threshold Escalation & SOS Triggers", () => {
  let user, patient, doctor, token, docToken;
  const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key_for_local_testing_only_12345";

  beforeAll(async () => {
    const pwdHash = await bcrypt.hash("StandardPass123!", 10);
    user = await prisma.user.create({
      data: {
        email: `patient.alert.${Date.now()}@test.local`,
        passwordHash: pwdHash,
        fullName: "Alert Test Patient",
        roles: { create: [{ role: "patient" }] },
      },
    });

    patient = await prisma.patient.create({
      data: {
        userId: user.id,
        fullName: user.fullName,
        mrn: `MRN-ALERT-${Date.now()}`,
        spo2Threshold: 92.0,
      },
    });

    const docUser = await prisma.user.create({
      data: {
        email: `doc.alert.${Date.now()}@test.local`,
        passwordHash: pwdHash,
        fullName: "Dr. Alert Watcher",
        roles: { create: [{ role: "doctor" }] },
      },
    });

    doctor = await prisma.doctor.create({
      data: { userId: docUser.id, fullName: docUser.fullName },
    });

    await prisma.doctorPatientAssignment.create({
      data: { doctorId: doctor.id, patientId: patient.id },
    });

    token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        role: "patient",
        patientId: patient.id,
      },
      JWT_SECRET,
    );

    docToken = jwt.sign(
      {
        userId: docUser.id,
        email: docUser.email,
        fullName: docUser.fullName,
        role: "doctor",
        doctorId: doctor.id,
      },
      JWT_SECRET,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("THRESHOLD ESCALATION: Telemetry with SpO2 below threshold generates CRITICAL alert", async () => {
    const res = await request(app).post("/api/v1/telemetry/health").send({
      patientId: patient.id,
      bpm: 112,
      spo2: 89.5, // Below threshold of 92.0
      bodyTemperature: 37.5,
    });

    expect(res.statusCode).toBe(201);

    // Verify alert was created in database
    const alert = await prisma.alert.findFirst({
      where: { patientId: patient.id, type: "SPO2_CRITICAL" },
      orderBy: { createdAt: "desc" },
    });

    expect(alert).toBeDefined();
    expect(alert.severity).toBe("critical");
    expect(alert.value).toBe(89.5);
    expect(alert.status).toBe("active");
  });

  test("SOS EMERGENCY TRIGGER: Patient triggers SOS event and generates critical alert", async () => {
    const res = await request(app)
      .post("/api/v1/sos/trigger")
      .set("Authorization", `Bearer ${token}`)
      .send({
        source: "manual_app_button",
        vitals: { BPM: 125, SpO2: 88.0, BodyTemp: 38.6 },
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.status).toBe("SOS_TRIGGERED");
    expect(res.body.sos.status).toBe("active");
    expect(res.body.alert.type).toBe("SOS_EMERGENCY");
    expect(res.body.alert.severity).toBe("critical");
  });

  test("ALERT ACKNOWLEDGMENT: Assigned clinician can acknowledge critical alert", async () => {
    const alert = await prisma.alert.findFirst({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
    });

    const res = await request(app)
      .put(`/api/v1/alerts/${alert.id}/acknowledge`)
      .set("Authorization", `Bearer ${docToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.alert.status).toBe("acknowledged");
    expect(res.body.alert.acknowledgedAt).toBeDefined();
  });
});
