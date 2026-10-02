const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { app, prisma } = require("../server");

describe("GATE 2: Hospital Lifecycle & Provisioning Flow", () => {
  let superAdminUser, superAdminToken;
  let createdHospital;
  let adminInvite, doctorInvite;
  let doctorToken;
  let admittedPatient;
  let assignedDevice;

  const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key_for_local_testing_only_12345";

  beforeAll(async () => {
    const pwdHash = await bcrypt.hash("SuperAdminSecret123!", 12);
    superAdminUser = await prisma.user.create({
      data: {
        email: `platform.owner.${Date.now()}@smartneb.local`,
        passwordHash: pwdHash,
        fullName: "Dr. Platform Root",
        roles: { create: [{ role: "super_admin" }, { role: "admin" }] },
      },
    });

    superAdminToken = jwt.sign(
      {
        userId: superAdminUser.id,
        email: superAdminUser.email,
        fullName: superAdminUser.fullName,
        role: "super_admin",
      },
      JWT_SECRET,
    );
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("STEP 1: Hospital registration creates hospital in PENDING state", async () => {
    const res = await request(app)
      .post("/api/v1/admin/hospitals")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        name: "St. Jude Respiratory Center",
        slug: `st-jude-${Date.now()}`,
        code: `HOSP-JUDE-${Date.now()}`,
        contactEmail: "contact@stjude.org",
        phone: "+1-555-0199",
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.hospital.status).toBe("pending");
    createdHospital = res.body.hospital;
  });

  test("STEP 2: SUPER_ADMIN approves pending hospital", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/hospitals/${createdHospital.id}/approve`)
      .set("Authorization", `Bearer ${superAdminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.hospital.status).toBe("approved");
    expect(res.body.hospital.approvedAt).toBeDefined();
  });

  test("STEP 3: Hospital workspace creates invite codes for staff", async () => {
    const res = await request(app)
      .post(`/api/v1/admin/hospitals/${createdHospital.id}/invites`)
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({ role: "doctor" });

    expect(res.statusCode).toBe(201);
    expect(res.body.invite.code).toMatch(/^INV-/);
    expect(res.body.invite.role).toBe("doctor");
    doctorInvite = res.body.invite;
  });

  test("STEP 4: Staff doctor registers with invite code into hospital workspace", async () => {
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: `doc.stjude.${Date.now()}@stjude.org`,
        password: "DoctorSafePassword123!",
        fullName: "Dr. Gregory House",
        inviteCode: doctorInvite.code,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.user.role).toBe("doctor");
    expect(res.body.user.hospitalId).toBe(createdHospital.id);
    doctorToken = res.body.accessToken;
  });

  test("STEP 5: Clinician admits new respiratory patient into hospital", async () => {
    const res = await request(app)
      .post("/api/v1/admin/patients/admit")
      .set("Authorization", `Bearer ${doctorToken}`)
      .send({
        fullName: "Arthur Dent",
        condition: "Severe COPD",
        hospitalId: createdHospital.id,
        spo2Threshold: 91.0,
      });

    expect(res.statusCode).toBe(201);
    expect(res.body.patient.fullName).toBe("Arthur Dent");
    expect(res.body.patient.hospitalId).toBe(createdHospital.id);
    admittedPatient = res.body.patient;
  });

  test("STEP 6: Device is assigned to the admitted patient", async () => {
    const deviceCode = `NEB-HOSP-${Date.now()}`;
    const res = await request(app)
      .post("/api/v1/admin/devices/assign")
      .set("Authorization", `Bearer ${superAdminToken}`)
      .send({
        deviceCode,
        patientId: admittedPatient.id,
        hospitalId: createdHospital.id,
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.device.patientId).toBe(admittedPatient.id);
    expect(res.body.device.hospitalId).toBe(createdHospital.id);
    expect(res.body.device.status).toBe("online");
    assignedDevice = res.body.device;
  });
});
