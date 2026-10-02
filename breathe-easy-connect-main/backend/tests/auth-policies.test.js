const request = require("supertest");
const { app, prisma } = require("../server");

describe("GATE 2: Authorization, Role Escalation & Invite Code Policies", () => {
  let approvedHospital;
  let suspendedHospital;

  beforeAll(async () => {
    // Setup test hospitals
    approvedHospital = await prisma.hospital.upsert({
      where: { slug: "test-auth-approved-hosp" },
      update: { status: "approved" },
      create: {
        name: "Auth Test Approved Hospital",
        slug: "test-auth-approved-hosp",
        code: "HOSP-AUTH-001",
        status: "approved",
      },
    });

    suspendedHospital = await prisma.hospital.upsert({
      where: { slug: "test-auth-suspended-hosp" },
      update: { status: "suspended" },
      create: {
        name: "Auth Test Suspended Hospital",
        slug: "test-auth-suspended-hosp",
        code: "HOSP-AUTH-002",
        status: "suspended",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("ROLE ESCALATION PREVENTED: Direct signup cannot create ADMIN role", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send({
      email: "hacker.admin@test.local",
      password: "StrongPassword123!",
      fullName: "Malicious Attacker",
      role: "admin",
    });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Direct registration of administrative roles is forbidden/i);
  });

  test("ROLE ESCALATION PREVENTED: Direct signup cannot create SUPER_ADMIN role", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send({
      email: "hacker.superadmin@test.local",
      password: "StrongPassword123!",
      fullName: "Malicious Attacker",
      role: "super_admin",
    });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Direct registration of administrative roles is forbidden/i);
  });

  test("VALIDATION: Password shorter than 8 characters is rejected", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send({
      email: "shortpass@test.local",
      password: "short",
      fullName: "Short Pass",
      role: "patient",
    });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/at least 8 characters/i);
  });

  test("INVITE CODES: Invite code cannot be reused after first registration", async () => {
    // 1. Create a single-use invite code
    const invite = await prisma.inviteCode.create({
      data: {
        code: `INV-REUSE-TEST-${Date.now()}`,
        hospitalId: approvedHospital.id,
        role: "doctor",
      },
    });

    // 2. First signup with invite code succeeds
    const firstRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: `doc.legit.${Date.now()}@test.local`,
        password: "DoctorPassword123!",
        fullName: "Dr. First Invite",
        inviteCode: invite.code,
      });

    expect(firstRes.statusCode).toBe(201);
    expect(firstRes.body.user.role).toBe("doctor");

    // 3. Second signup attempting to reuse the same invite code must fail
    const secondRes = await request(app)
      .post("/api/v1/auth/signup")
      .send({
        email: `doc.attacker.${Date.now()}@test.local`,
        password: "AttackerPassword123!",
        fullName: "Attacker Impersonator",
        inviteCode: invite.code,
      });

    expect(secondRes.statusCode).toBe(400);
    expect(secondRes.body.error).toMatch(/already been used/i);
  });

  test("SUSPENDED HOSPITAL: Users affiliated with suspended hospitals are locked out from logging in", async () => {
    // 1. Create a user inside suspended hospital
    const bcrypt = require("bcryptjs");
    const pwdHash = await bcrypt.hash("SuspendedUserPass123!", 10);
    const suspendedEmail = `user.locked.${Date.now()}@suspended.local`;

    await prisma.user.create({
      data: {
        email: suspendedEmail,
        passwordHash: pwdHash,
        fullName: "Suspended Staff",
        hospitalId: suspendedHospital.id,
        roles: { create: [{ role: "doctor" }] },
      },
    });

    // 2. Attempt login
    const loginRes = await request(app).post("/api/v1/auth/login").send({
      email: suspendedEmail,
      password: "SuspendedUserPass123!",
    });

    expect(loginRes.statusCode).toBe(403);
    expect(loginRes.body.error).toMatch(/Hospital workspace is currently suspended/i);
  });
});
