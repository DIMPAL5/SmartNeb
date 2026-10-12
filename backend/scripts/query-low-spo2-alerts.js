const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("\n==================================================");
  console.log("🚨 VERIFYING LOW SPO2 ALERT & SOS ESCALATION IN MYSQL");
  console.log("==================================================");

  const device = await prisma.device.findFirst({ where: { deviceCode: "NEB-001" } });
  console.log("• Device Record:", device);

  const alerts = await prisma.alert.findMany({
    where: { type: "LOW_SPO2" },
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  console.log("• Low SpO2 Alert Records in MySQL:", alerts);

  const sosEvents = await prisma.sOSEvent.findMany({
    where: { source: "automated_spo2" },
    take: 3,
    orderBy: { createdAt: "desc" },
  });
  console.log("• Automated SOS Event Records in MySQL:", sosEvents);

  console.log("==================================================\n");
}

main()
  .catch((err) => console.error(err))
  .finally(() => prisma.$disconnect());
