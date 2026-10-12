const { PrismaClient } = require("@prisma/client");
const fs = require("fs");
const path = require("path");

BigInt.prototype.toJSON = function () {
  return Number(this);
};

const prisma = new PrismaClient();
const BACKUP_FILE = path.join(__dirname, "../scratch/backup_test_dump.json");

async function getTableRowCounts() {
  const [
    hospitals,
    users,
    patients,
    doctors,
    caregivers,
    devices,
    healthTelemetries,
    batteryTelemetries,
    carePlans,
    sessions,
    deviceCommands,
    alerts,
  ] = await Promise.all([
    prisma.hospital.count(),
    prisma.user.count(),
    prisma.patient.count(),
    prisma.doctor.count(),
    prisma.caregiver.count(),
    prisma.device.count(),
    prisma.healthTelemetry.count(),
    prisma.batteryTelemetry.count(),
    prisma.carePlan.count(),
    prisma.nebulizationSession.count(),
    prisma.deviceCommand.count(),
    prisma.alert.count(),
  ]);

  return {
    hospitals,
    users,
    patients,
    doctors,
    caregivers,
    devices,
    healthTelemetries,
    batteryTelemetries,
    carePlans,
    sessions,
    deviceCommands,
    alerts,
  };
}

async function exportFullBackup() {
  const [
    hospitals,
    users,
    patients,
    doctors,
    caregivers,
    devices,
    healthTelemetries,
    batteryTelemetries,
    carePlans,
    sessions,
    deviceCommands,
    alerts,
  ] = await Promise.all([
    prisma.hospital.findMany(),
    prisma.user.findMany({ include: { roles: true } }),
    prisma.patient.findMany(),
    prisma.doctor.findMany(),
    prisma.caregiver.findMany(),
    prisma.device.findMany(),
    prisma.healthTelemetry.findMany(),
    prisma.batteryTelemetry.findMany(),
    prisma.carePlan.findMany(),
    prisma.nebulizationSession.findMany(),
    prisma.deviceCommand.findMany(),
    prisma.alert.findMany(),
  ]);

  const dumpData = {
    metadata: { timestamp: new Date().toISOString(), version: "2.0" },
    tables: {
      hospitals,
      users,
      patients,
      doctors,
      caregivers,
      devices,
      healthTelemetries,
      batteryTelemetries,
      carePlans,
      sessions,
      deviceCommands,
      alerts,
    },
  };

  const dir = path.dirname(BACKUP_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BACKUP_FILE, JSON.stringify(dumpData, null, 2), "utf8");
  return dumpData;
}

async function main() {
  console.log("\n==================================================");
  console.log("💾 AUTOMATED DATABASE BACKUP & RESTORE TEST");
  console.log("==================================================");

  // 1. Initial Row Count
  const initialCounts = await getTableRowCounts();
  console.log("• Initial MySQL Database Row Counts:", initialCounts);

  // 2. Export Backup
  console.log("• Exporting full database backup dump...");
  const dump = await exportFullBackup();
  console.log(`✓ Backup successfully saved to ${BACKUP_FILE}`);

  // 3. Simulated Wipe (Delete records from high-level tables)
  console.log("• Simulating database wipe / disaster recovery test...");
  await prisma.healthTelemetry.deleteMany();
  await prisma.batteryTelemetry.deleteMany();
  await prisma.deviceCommand.deleteMany();
  await prisma.alert.deleteMany();
  
  const postWipeCounts = await getTableRowCounts();
  console.log("• Post-Wipe Row Counts (Telemetry/Alerts cleared):", postWipeCounts);

  // 4. Restore Data from Backup
  console.log("• Restoring database from backup dump file...");
  const backupData = JSON.parse(fs.readFileSync(BACKUP_FILE, "utf8"));

  for (const item of backupData.tables.healthTelemetries) {
    await prisma.healthTelemetry.create({
      data: {
        id: item.id,
        patientId: item.patientId,
        deviceId: item.deviceId,
        bpm: item.bpm,
        spo2: item.spo2,
        bodyTemperature: item.bodyTemperature,
        recordedAt: new Date(item.recordedAt),
      },
    });
  }

  for (const item of backupData.tables.batteryTelemetries) {
    await prisma.batteryTelemetry.create({
      data: {
        id: item.id,
        patientId: item.patientId,
        deviceId: item.deviceId,
        percentage: item.percentage,
        charging: item.charging,
        fluidLevel: item.fluidLevel,
        recordedAt: new Date(item.recordedAt),
      },
    });
  }

  for (const item of backupData.tables.deviceCommands) {
    await prisma.deviceCommand.create({
      data: {
        id: item.id,
        deviceId: item.deviceId,
        patientId: item.patientId,
        command: item.command,
        idempotencyKey: item.idempotencyKey,
        state: item.state,
        response: item.response,
        createdAt: new Date(item.createdAt),
        ackedAt: item.ackedAt ? new Date(item.ackedAt) : null,
      },
    });
  }

  for (const item of backupData.tables.alerts) {
    await prisma.alert.create({
      data: {
        id: item.id,
        patientId: item.patientId,
        deviceId: item.deviceId,
        type: item.type,
        severity: item.severity,
        value: item.value,
        threshold: item.threshold,
        message: item.message,
        status: item.status,
        createdAt: new Date(item.createdAt),
      },
    });
  }

  // 5. Verify Restored Row Counts Match Initial Row Counts
  const restoredCounts = await getTableRowCounts();
  console.log("• Restored MySQL Database Row Counts:", restoredCounts);

  let isIdentical = true;
  for (const key of Object.keys(initialCounts)) {
    if (initialCounts[key] !== restoredCounts[key]) {
      isIdentical = false;
      console.error(`❌ Mismatch in table ${key}: Initial=${initialCounts[key]}, Restored=${restoredCounts[key]}`);
    }
  }

  if (isIdentical) {
    console.log("==================================================");
    console.log("🏁 VERIFICATION RESULT: BACKUP -> WIPE -> RESTORE SUCCESSFUL ✅");
    console.log("   Initial and restored row counts are 100% IDENTICAL!");
    console.log("==================================================\n");
  } else {
    throw new Error("Backup/Restore validation failed: Row count mismatch!");
  }
}

main()
  .catch((err) => console.error("❌ Backup/Restore error:", err))
  .finally(() => prisma.$disconnect());
