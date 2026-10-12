const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { app, prisma } = require("../server");

describe("GATE 2: Multi-Tenant Hospital Isolation & IDOR Protection", () => {
  let hospitalA, hospitalB;
  let userA, userB;
  let patientA, patientB;
  let deviceA, deviceB;
  let tokenA, tokenB;

  const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key_for_local_testing_only_12345";

  beforeAll(async () => {
    const pwdHash = await bcrypt.hash("StandardPass123!", 10);

    // Setup Hospital A
    hospitalA = await prisma.hospital.upsert({
      where: { slug: "hosp-a-idor-test" },
      update: { status: "approved" },
      create: {
        name: "Hospital Alpha",
        slug: "hosp-a-idor-test",
        code: "HOSP-A-TEST",
        status: "approved",
      },
    });

    // Setup Hospital B
    hospitalB = await prisma.hospital.upsert({
      where: { slug: "hosp-b-idor-test" },
      update: { status: "approved" },
      create: {
        name: "Hospital Beta",
        slug: "hosp-b-idor-test",
        code: "HOSP-B-TEST",
        status: "approved",
      },
    });

    // Doctor A in Hospital A
    userA = await prisma.user.create({
      data: {
        email: `doc.alpha.${Date.now()}@hosp-a.local`,
        passwordHash: pwdHash,
        fullName: "Dr. Alpha One",
        hospitalId: hospitalA.id,
        roles: { create: [{ role: "doctor" }] },
      },
    });
    const docA = await prisma.doctor.create({
      data: { userId: userA.id, fullName: userA.fullName, specialty: "Pulmonology" },
    });

    // Doctor B in Hospital B
    userB = await prisma.user.create({
      data: {
        email: `doc.beta.${Date.now()}@hosp-b.local`,
        passwordHash: pwdHash,
        fullName: "Dr. Beta One",
        hospitalId: hospitalB.id,
        roles: { create: [{ role: "doctor" }] },
      },
    });
    const docB = await prisma.doctor.create({
      data: { userId: userB.id, fullName: userB.fullName, specialty: "Pulmonology" },
    });

    // Patient A in Hospital A
    patientA = await prisma.patient.create({
      data: {
        hospitalId: hospitalA.id,
        fullName: "Patient Alpha Patient",
        mrn: `MRN-A-${Date.now()}`,
        spo2Threshold: 92.0,
      },
    });
    await prisma.doctorPatientAssignment.create({
      data: { doctorId: docA.id, patientId: patientA.id },
    });

    // Patient B in Hospital B
    patientB = await prisma.patient.create({
      data: {
        hospitalId: hospitalB.id,
        fullName: "Patient Beta Patient",
        mrn: `MRN-B-${Date.now()}`,
        spo2Threshold: 90.0,
      },
    });
    await prisma.doctorPatientAssignment.create({
      data: { doctorId: docB.id, patientId: patientB.id },
    });

    // Device A & Device B
    deviceA = await prisma.device.create({
      data: {
        deviceCode: `DEV-A-${Date.now()}`,
        hospitalId: hospitalA.id,
        patientId: patientA.id,
        status: "online",
      },
    });
    deviceB = await prisma.device.create({
      data: {
        deviceCode: `DEV-B-${Date.now()}`,
        hospitalId: hospitalB.id,
        patientId: patientB.id,
        status: "online",
      },
    });

    // Generate Tokens
    tokenA = jwt.sign(
      {
        userId: userA.id,
        email: userA.email,
        fullName: userA.fullName,
        role: "doctor",
        doctorId: docA.id,
        hospitalId: hospitalA.id,
      },
      JWT_SECRET,
    );
    tokenB = jwt.sign(
      {
        userId: userB.id,
        email: userB.email,
        fullName: userB.fullName,
        role: "doctor",
        doctorId: docB.id,
        hospitalId: hospitalB.id,
      },
      JWT_SECRET,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("IDOR REST: Doctor A cannot read Patient B snapshot from Hospital B", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${patientB.id}/snapshot`)
      .set("Authorization", `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Unauthorized/i);
  });

  test("IDOR REST: Doctor B cannot read Patient A snapshot from Hospital A", async () => {
    const res = await request(app)
      .get(`/api/v1/patients/${patientA.id}/snapshot`)
      .set("Authorization", `Bearer ${tokenB}`);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Unauthorized/i);
  });

  test("IDOR CARE PLANS: Doctor A cannot prescribe a care plan for Patient B", async () => {
    const res = await request(app)
      .post("/api/v1/care-plans")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        patientId: patientB.id,
        medication: "Illegal Prescribed Drug",
        dosage: "10mg",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Unauthorized/i);
  });

  test("IDOR CLINICAL NOTES: Doctor A cannot post clinical notes on Patient B record", async () => {
    const res = await request(app)
      .post("/api/v1/clinical-notes")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        patientId: patientB.id,
        note: "Cross-tenant illegal clinical observation",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Unauthorized/i);
  });

  test("IDOR AI ENDPOINT: Doctor A cannot query AI assistant using Patient B health vitals", async () => {
    const res = await request(app)
      .post("/api/v1/ai/ask")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        question: "Analyze recent SpO2 drops for this patient",
        targetPatientId: patientB.id,
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Unauthorized/i);
  });

  test("CROSS-TENANT DEVICE COMMAND: Doctor A cannot dispatch command to Device B in Hospital B", async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${deviceB.id}/command`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({
        command: "START",
      });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Unauthorized access to device from another hospital tenant/i);
  });
});
