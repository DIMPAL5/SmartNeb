const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("\n==================================================");
  console.log("📊 MYSQL DATABASE VERIFICATION FOR SCENARIO 1");
  console.log("==================================================");

  const device = await prisma.device.findFirst({
    where: { deviceCode: "NEB-001" },
  });
  console.log("• Device Record:", device);

  const health = await prisma.healthTelemetry.findMany({
    take: 5,
    orderBy: { recordedAt: "desc" },
  });
  console.log("• Health Telemetry Rows:", health);

  const battery = await prisma.batteryTelemetry.findMany({
    take: 5,
    orderBy: { recordedAt: "desc" },
  });
  console.log("• Battery Telemetry Rows:", battery);

  const alerts = await prisma.alert.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  console.log("• Alert Records:", alerts);

  const commands = await prisma.deviceCommand.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  console.log("• Device Command Records:", commands);
  console.log("==================================================\n");
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
