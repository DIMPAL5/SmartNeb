const { PrismaClient } = require("@prisma/client");
const mqtt = require("mqtt");
const prisma = new PrismaClient();

async function main() {
  console.log("\n==================================================");
  console.log("🚀 TESTING NEBULIZER COMMAND & ACK TRANSMISSION");
  console.log("==================================================");

  // 1. Ensure device NEB-001 exists in DB
  let device = await prisma.device.findFirst({ where: { deviceCode: "NEB-001" } });
  if (!device) {
    device = await prisma.device.create({
      data: { deviceCode: "NEB-001", status: "online", mqttConnected: true },
    });
  }

  // 2. Create a DeviceCommand record
  const cmdRecord = await prisma.deviceCommand.create({
    data: {
      deviceId: device.id,
      patientId: device.patientId || "3d6003d3-0504-4cbb-a7ef-2f78c54cbf41",
      command: "START",
      idempotencyKey: `ack-test-${Date.now()}`,
      state: "sent",
    },
  });
  console.log(`• Created DeviceCommand [${cmdRecord.id}] with state: sent`);

  // 3. Connect backend simulation client & publish command
  const client = mqtt.connect("mqtt://127.0.0.1:1883", { clientId: "cmd_test_publisher" });
  
  await new Promise((resolve) => client.on("connect", resolve));
  console.log("• Backend connected to MQTT broker");

  const topic = `hospitals/demo-hospital/devices/NEB-001/commands`;
  const payload = JSON.stringify({
    id: cmdRecord.id,
    command: "START",
    idempotencyKey: cmdRecord.idempotencyKey,
  });

  client.publish(topic, payload, { qos: 1 });
  console.log(`• Sent START command to topic: ${topic}`);

  // 4. Wait 1.5 seconds for simulator ACK & backend handling
  await new Promise((r) => setTimeout(r, 1500));

  // 5. Query DB to prove state updated to acked
  const updatedCmd = await prisma.deviceCommand.findUnique({ where: { id: cmdRecord.id } });
  console.log(`• Verified DeviceCommand [${updatedCmd.id}] in MySQL:`);
  console.log(`  State: ${updatedCmd.state}`);
  console.log(`  AckedAt: ${updatedCmd.ackedAt}`);
  console.log(`  Response:`, updatedCmd.response);

  client.end();
  console.log("==================================================\n");
}

main()
  .catch((err) => console.error("❌ Test error:", err))
  .finally(() => prisma.$disconnect());
