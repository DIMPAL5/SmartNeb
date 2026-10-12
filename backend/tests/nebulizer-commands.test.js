const request = require("supertest");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { app, prisma } = require("../server");

describe("GATE 2: Nebulizer Command Confirmation Engine", () => {
  let user, patient, onlineDevice, offlineDevice, token;
  const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_key_for_local_testing_only_12345";

  beforeAll(async () => {
    const pwdHash = await bcrypt.hash("StandardPass123!", 10);
    user = await prisma.user.create({
      data: {
        email: `patient.cmd.${Date.now()}@test.local`,
        passwordHash: pwdHash,
        fullName: "Command Test Patient",
        roles: { create: [{ role: "patient" }] },
      },
    });

    patient = await prisma.patient.create({
      data: {
        userId: user.id,
        fullName: user.fullName,
        mrn: `MRN-CMD-${Date.now()}`,
      },
    });

    onlineDevice = await prisma.device.create({
      data: {
        deviceCode: `DEV-ONLINE-${Date.now()}`,
        patientId: patient.id,
        status: "online",
        nebulizerState: "OFF",
      },
    });

    offlineDevice = await prisma.device.create({
      data: {
        deviceCode: `DEV-OFFLINE-${Date.now()}`,
        patientId: patient.id,
        status: "offline",
        nebulizerState: "OFF",
      },
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test("DEVICE OFFLINE: Command is rejected with 409 Conflict if nebulizer is offline", async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${offlineDevice.id}/command`)
      .set("Authorization", `Bearer ${token}`)
      .send({ command: "START" });

    expect(res.statusCode).toBe(409);
    expect(res.body.status).toBe("DEVICE_OFFLINE");
    expect(res.body.error).toMatch(/offline/i);
  });

  test("COMMAND DISPATCH: Command is dispatched with state=STARTING when device is online", async () => {
    const res = await request(app)
      .post(`/api/v1/devices/${onlineDevice.id}/command`)
      .set("Authorization", `Bearer ${token}`)
      .send({ command: "START" });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("COMMAND_SENT");
    expect(res.body.state).toBe("STARTING");
    expect(res.body.cmdId).toBeDefined();

    // Verify command record in database
    const cmd = await prisma.deviceCommand.findUnique({ where: { id: res.body.cmdId } });
    expect(cmd.command).toBe("START");
    expect(cmd.state).toBe("sent");
  });

  test("DUPLICATE SUPPRESSION: Re-sending command with same idempotencyKey returns existing state", async () => {
    const idempotencyKey = `idemp-${Date.now()}`;

    // First call
    const firstRes = await request(app)
      .post(`/api/v1/devices/${onlineDevice.id}/command`)
      .set("Authorization", `Bearer ${token}`)
      .send({ command: "PAUSE", idempotencyKey });

    expect(firstRes.statusCode).toBe(200);
    expect(firstRes.body.status).toBe("COMMAND_SENT");

    // Duplicate call with identical idempotencyKey
    const secondRes = await request(app)
      .post(`/api/v1/devices/${onlineDevice.id}/command`)
      .set("Authorization", `Bearer ${token}`)
      .send({ command: "PAUSE", idempotencyKey });

    expect(secondRes.statusCode).toBe(200);
    expect(secondRes.body.status).toBe("DUPLICATE_IGNORED");
    expect(secondRes.body.cmdId).toBe(firstRes.body.cmdId);
  });
});
