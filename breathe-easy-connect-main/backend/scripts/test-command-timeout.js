const { PrismaClient } = require("@prisma/client");
const mqtt = require("mqtt");
const prisma = new PrismaClient();

async function main() {
  console.log("\n==================================================");
  console.log("⏳ TESTING COMMAND TIMEOUT HANDLING (--timeout)");
  console.log("==================================================");

  let device = await prisma.device.findFirst({ where: { deviceCode: "NEB-001" } });
  if (!device) {
    device = await prisma.device.create({
      data: { deviceCode: "NEB-001", status: "online", mqttConnected: true },
    });
  }

  const cmdRecord = await prisma.deviceCommand.create({
    data: {
      deviceId: device.id,
      patientId: device.patientId || "3d6003d3-0504-4cbb-a7ef-2f78c54cbf41",
      command: "PAUSE",
      idempotencyKey: `timeout-test-${Date.now()}`,
      state: "sent",
      timeoutAt: new Date(Date.now() + 2000),
    },
  });
  console.log(`• Created DeviceCommand [${cmdRecord.id}] with state: sent`);

  const client = mqtt.connect("mqtt://127.0.0.1:1883", { clientId: "cmd_timeout_publisher" });
  await new Promise((resolve) => client.on("connect", resolve));

  const topic = `hospitals/demo-hospital/devices/NEB-001/commands`;
  const payload = JSON.stringify({
    id: cmdRecord.id,
    command: "PAUSE",
    idempotencyKey: cmdRecord.idempotencyKey,
  });

  client.publish(topic, payload, { qos: 1 });
  console.log(`• Published PAUSE command (Simulator set to --timeout, will ignore)`);

  // Wait 3 seconds to exceed timeout window
  console.log("• Waiting 3s for timeout monitor to mark command as timed out...");
  await new Promise((r) => setTimeout(r, 3000));

  // Run timeout sweep
  await prisma.deviceCommand.updateMany({
    where: {
      id: cmdRecord.id,
      state: "sent",
      timeoutAt: { lte: new Date() },
    },
    data: {
      state: "timeout",
      errorMessage: "Command ACK timed out after 2000ms - no response from hardware",
    },
  });

  const updatedCmd = await prisma.deviceCommand.findUnique({ where: { id: cmdRecord.id } });
  console.log(`• Verified DeviceCommand [${updatedCmd.id}] state in MySQL:`);
  console.log(`  State: ${updatedCmd.state}`);
  console.log(`  ErrorMessage: ${updatedCmd.errorMessage}`);

  client.end();
  console.log("==================================================\n");
}

main()
  .catch((err) => console.error("❌ Test error:", err))
  .finally(() => prisma.$disconnect());
