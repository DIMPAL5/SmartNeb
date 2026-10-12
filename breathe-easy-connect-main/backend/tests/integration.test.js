const request = require("supertest");
const mqtt = require("mqtt");
const { app, prisma, server } = require("../server");

jest.setTimeout(30000);

describe("SmartNeb Real End-to-End Integration Suite", () => {
  let brokerClient;
  let hospA, hospB;
  let adminA, adminB;
  let deviceA, deviceB;
  let tokenA, tokenB;

  beforeAll(async () => {
    // 1. Create two isolated test hospitals
    hospA = await prisma.hospital.create({
      data: {
        name: "Metro General Hospital A",
        slug: `metro-a-${Date.now()}`,
        code: `HOSP-A-${Date.now()}`,
        status: "approved",
      },
    });

    hospB = await prisma.hospital.create({
      data: {
        name: "CityCare Hospital B",
        slug: `citycare-b-${Date.now()}`,
        code: `HOSP-B-${Date.now()}`,
        status: "approved",
      },
    });

    // 2. Create Admin Users for each hospital
    adminA = await prisma.user.create({
      data: {
        email: `admin.a.${Date.now()}@hospital-a.org`,
        fullName: "Dr. Alice Admin A",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        hospitalId: hospA.id,
        roles: { create: { role: "admin" } },
      },
    });

    adminB = await prisma.user.create({
      data: {
        email: `admin.b.${Date.now()}@hospital-b.org`,
        fullName: "Dr. Bob Admin B",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        hospitalId: hospB.id,
        roles: { create: { role: "admin" } },
      },
    });

    // 3. Create Patient Profiles for each hospital
    const patientUserA = await prisma.user.create({
      data: {
        email: `patient.a.${Date.now()}@hospital-a.org`,
        fullName: "Patient A Integration Test",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        hospitalId: hospA.id,
        roles: { create: { role: "patient" } },
        patientProfile: { create: { fullName: "Patient A Integration Test", mrn: `MRN-A-${Date.now()}` } },
      },
      include: { patientProfile: true },
    });

    const patientUserB = await prisma.user.create({
      data: {
        email: `patient.b.${Date.now()}@hospital-b.org`,
        fullName: "Patient B Integration Test",
        passwordHash: "$2a$10$abcdefghijklmnopqrstuvwxyz012345",
        hospitalId: hospB.id,
        roles: { create: { role: "patient" } },
        patientProfile: { create: { fullName: "Patient B Integration Test", mrn: `MRN-B-${Date.now()}` } },
      },
      include: { patientProfile: true },
    });

    // 4. Register Devices for each hospital
    deviceA = await prisma.device.create({
      data: {
        deviceCode: `NEB-HOSP-A-${Date.now()}`,
        hospitalId: hospA.id,
        patientId: patientUserA.patientProfile.id,
        status: "online",
        mqttConnected: true,
      },
    });

    deviceB = await prisma.device.create({
      data: {
        deviceCode: `NEB-HOSP-B-${Date.now()}`,
        hospitalId: hospB.id,
        patientId: patientUserB.patientProfile.id,
        status: "online",
        mqttConnected: true,
      },
    });

    // Connect MQTT test publisher client
    brokerClient = mqtt.connect("mqtt://127.0.0.1:1883", {
      clientId: `integration_test_runner_${Date.now()}`,
    });
    await new Promise((resolve) => brokerClient.on("connect", resolve));
  });

  afterAll(async () => {
    if (brokerClient) brokerClient.end();
    await prisma.$disconnect();
  });

  test("1. Device Telemetry Ingestion via MQTT saves real rows in MySQL", async () => {
    const healthTopic = `hospitals/${hospA.id}/devices/${deviceA.deviceCode}/telemetry/health`;
    const payload = {
      bpm: 82,
      spo2: 97.5,
      bodyTemperature: 36.6,
    };

    brokerClient.publish(healthTopic, JSON.stringify(payload), { qos: 1 });

    // Allow 800ms for MQTT message handler execution
    await new Promise((r) => setTimeout(r, 800));

    const latestTelemetry = await prisma.healthTelemetry.findFirst({
      where: { deviceId: deviceA.id },
      orderBy: { recordedAt: "desc" },
    });

    expect(latestTelemetry).not.toBeNull();
    expect(latestTelemetry.bpm).toBe(82);
    expect(latestTelemetry.spo2).toBe(97.5);
  });

  test("2. Abrupt Disconnect (LWT) updates device status to offline", async () => {
    const statusTopic = `hospitals/${hospA.id}/devices/${deviceA.deviceCode}/status`;
    const lwtPayload = { status: "OFFLINE", reason: "UNEXPECTED_DISCONNECT" };

    brokerClient.publish(statusTopic, JSON.stringify(lwtPayload), { qos: 1 });

    await new Promise((r) => setTimeout(r, 800));

    const updatedDevice = await prisma.device.findUnique({
      where: { id: deviceA.id },
    });

    expect(updatedDevice.status).toBe("offline");
    expect(updatedDevice.mqttConnected).toBe(false);
  });

  test("3. Command Execution & Hardware ACK recorded in MySQL", async () => {
    const cmdRecord = await prisma.deviceCommand.create({
      data: {
        deviceId: deviceA.id,
        patientId: "3d6003d3-0504-4cbb-a7ef-2f78c54cbf41",
        command: "START",
        state: "sent",
      },
    });

    const ackTopic = `hospitals/${hospA.id}/devices/${deviceA.deviceCode}/commands/ack`;
    const ackPayload = {
      commandId: cmdRecord.id,
      status: "EXECUTED",
      deviceCode: deviceA.deviceCode,
    };

    brokerClient.publish(ackTopic, JSON.stringify(ackPayload), { qos: 1 });

    await new Promise((r) => setTimeout(r, 800));

    const updatedCmd = await prisma.deviceCommand.findUnique({
      where: { id: cmdRecord.id },
    });

    expect(updatedCmd.state).toBe("acked");
    expect(updatedCmd.ackedAt).not.toBeNull();
  });

  test("4. Low SpO2 (<90%) triggers Alert & SOS Event creation", async () => {
    const healthTopic = `hospitals/${hospA.id}/devices/${deviceA.deviceCode}/telemetry/health`;
    const lowSpo2Payload = { bpm: 75, spo2: 87.0, bodyTemperature: 36.8 };

    brokerClient.publish(healthTopic, JSON.stringify(lowSpo2Payload), { qos: 1 });
    await new Promise((r) => setTimeout(r, 400));
    brokerClient.publish(healthTopic, JSON.stringify(lowSpo2Payload), { qos: 1 });
    await new Promise((r) => setTimeout(r, 800));

    const alert = await prisma.alert.findFirst({
      where: { deviceId: deviceA.id, type: "LOW_SPO2" },
      orderBy: { createdAt: "desc" },
    });

    expect(alert).not.toBeNull();
    expect(alert.severity).toBe("critical");
    expect(alert.value).toBe(87.0);

    const sosEvent = await prisma.sOSEvent.findFirst({
      where: { source: "automated_spo2" },
      orderBy: { createdAt: "desc" },
    });

    expect(sosEvent).not.toBeNull();
  });

  test("5. Multi-Tenant Isolation across two hospitals (Hospital A vs Hospital B)", async () => {
    // Generate JWT token for Admin A
    const jwt = require("jsonwebtoken");
    tokenA = jwt.sign(
      {
        userId: adminA.id,
        email: adminA.email,
        role: "admin",
        hospitalId: hospA.id,
      },
      process.env.JWT_SECRET || "smartneb_dev_fallback_secret_key_2026",
    );

    // Admin A attempting to issue command to Device B (Hospital B)
    const res = await request(app)
      .post(`/api/v1/devices/${deviceB.id}/command`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ command: "START" });

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/Unauthorized access to device from another hospital tenant/i);
  });
});
