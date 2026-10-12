const mqtt = require("mqtt");

const args = process.argv.slice(2);
const isDisconnectTest = args.includes("--disconnect");
const isLowSpO2Test = args.includes("--low-spo2");
const isTimeoutTest = args.includes("--timeout");

const BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://127.0.0.1:1883";
const HOSPITAL_ID = process.env.HOSPITAL_ID || "demo-hospital";
const DEVICE_CODE = process.env.DEVICE_CODE || "NEB-001";

const statusTopic = `hospitals/${HOSPITAL_ID}/devices/${DEVICE_CODE}/status`;
const healthTopic = `hospitals/${HOSPITAL_ID}/devices/${DEVICE_CODE}/telemetry/health`;
const batteryTopic = `hospitals/${HOSPITAL_ID}/devices/${DEVICE_CODE}/telemetry/battery`;
const commandTopic = `hospitals/${HOSPITAL_ID}/devices/${DEVICE_CODE}/commands`;
const ackTopic = `hospitals/${HOSPITAL_ID}/devices/${DEVICE_CODE}/commands/ack`;

console.log(`📡 [ESP32 Simulator] Target Device: ${DEVICE_CODE} (Hospital: ${HOSPITAL_ID})`);
console.log(`📡 [ESP32 Simulator] Connecting to broker: ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL, {
  protocolId: 'MQTT',
  protocolVersion: 4,
  clientId: DEVICE_CODE,
  clean: true,
  connectTimeout: 4000,
  will: {
    topic: statusTopic,
    payload: Buffer.from(JSON.stringify({ status: "OFFLINE", reason: "UNEXPECTED_DISCONNECT" })),
    qos: 1,
    retain: true,
  },
});

client.on("error", (err) => {
  console.error("❌ [ESP32 Simulator] MQTT Error:", err.message);
});

client.on("connect", () => {
  console.log("✅ [ESP32 Simulator] Connected to MQTT broker successfully!");

  // Publish ONLINE status
  client.publish(
    statusTopic,
    JSON.stringify({ status: "ONLINE", uptimeSec: 120 }),
    { qos: 1, retain: true },
    () => {
      console.log(`🟢 [ESP32 Simulator] Published status: ONLINE to ${statusTopic}`);
    },
  );

  // Subscribe to device commands topic
  client.subscribe(commandTopic, { qos: 1 }, (err) => {
    if (err) console.error("❌ Subscribe error:", err);
    else console.log(`📥 [ESP32 Simulator] Subscribed to command topic: ${commandTopic}`);
  });

  // Publish Telemetry
  const spo2Value = isLowSpO2Test ? 88.0 : 98.0;
  const healthPayload = {
    patientId: "patient-test-id",
    deviceId: DEVICE_CODE,
    bpm: 76,
    spo2: spo2Value,
    bodyTemperature: 36.8,
  };

  client.publish(healthTopic, JSON.stringify(healthPayload), { qos: 1 }, () => {
    console.log(`📊 [ESP32 Simulator] Published Health Telemetry (SpO2: ${spo2Value}%)...`);
  });

  const batteryPayload = {
    deviceId: DEVICE_CODE,
    percentage: 85,
    charging: false,
    fluidLevel: 90.0,
  };

  client.publish(batteryTopic, JSON.stringify(batteryPayload), { qos: 1 }, () => {
    console.log(`🔋 [ESP32 Simulator] Published Battery & Fluid Level Telemetry...`);
  });

  // If abrupt disconnect simulation flag is passed
  if (isDisconnectTest) {
    console.log("⚡ [ESP32 Simulator] Simulating abrupt power failure / TCP drop...");
    setTimeout(() => {
      if (client.stream) {
        client.stream.destroy();
      } else {
        client.end(true);
      }
      console.log("💥 [ESP32 Simulator] TCP socket destroyed without graceful disconnect (LWT triggered).");
      process.exit(0);
    }, 1500);
  }
});

client.on("message", (topic, message) => {
  console.log(`📩 [ESP32 Simulator] Received command on [${topic}]:`, message.toString());

  if (isTimeoutTest) {
    console.log("⏳ [ESP32 Simulator] Simulating command TIMEOUT: Ignoring message (no ACK returned).");
    return;
  }

  try {
    const cmdObj = JSON.parse(message.toString());
    const ackPayload = {
      commandId: cmdObj.id || cmdObj.commandId || "cmd_123",
      idempotencyKey: cmdObj.idempotencyKey || null,
      status: "EXECUTED",
      deviceCode: DEVICE_CODE,
      timestamp: Math.floor(Date.now() / 1000),
    };

    setTimeout(() => {
      client.publish(ackTopic, JSON.stringify(ackPayload), { qos: 1 }, () => {
        console.log(`✅ [ESP32 Simulator] Published ACK response to ${ackTopic}`);
      });
    }, 500);
  } catch (err) {
    console.error("❌ Failed to parse incoming command:", err);
  }
});
