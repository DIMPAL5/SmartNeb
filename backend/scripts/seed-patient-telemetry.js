const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const patient = await prisma.patient.findFirst({
    where: { fullName: "Jane Patient" },
  });

  if (!patient) {
    console.log("Jane Patient not found.");
    return;
  }

  // Find or create device NEB-001
  let device = await prisma.device.findFirst({
    where: { deviceCode: "NEB-001" },
  });

  if (!device) {
    device = await prisma.device.create({
      data: {
        deviceCode: "NEB-001",
        patientId: patient.id,
        hospitalId: patient.hospitalId,
        status: "online",
        firmwareVersion: "v2.0.0",
        fluidLevel: 85.0,
      },
    });
  } else {
    device = await prisma.device.update({
      where: { id: device.id },
      data: {
        patientId: patient.id,
        status: "online",
        lastSeenAt: new Date(),
      },
    });
  }
  console.log("Associated device NEB-001 with Jane Patient");

  // Add 10 health telemetry rows
  const now = Date.now();
  for (let i = 0; i < 10; i++) {
    await prisma.healthTelemetry.create({
      data: {
        patientId: patient.id,
        deviceId: device.id,
        bpm: 72 + Math.floor(Math.random() * 8),
        spo2: 97 + Math.floor(Math.random() * 3),
        bodyTemperature: 36.6 + Math.random() * 0.4,
        recordedAt: new Date(now - i * 60000),
      },
    });
  }
  console.log("Inserted recent health telemetry");

  // Add battery telemetry
  await prisma.batteryTelemetry.create({
    data: {
      patientId: patient.id,
      deviceId: device.id,
      percentage: 92,
      charging: false,
      voltage: 4.1,
    },
  });

  // Add active care plan
  const existingPlan = await prisma.carePlan.findFirst({
    where: { patientId: patient.id },
  });
  if (!existingPlan) {
    const doctor = await prisma.doctor.findFirst();
    await prisma.carePlan.create({
      data: {
        patientId: patient.id,
        doctorId: doctor?.id,
        medication: "Albuterol Sulfate (2.5mg/3mL)",
        dosage: "3 mL inhalation solution",
        frequencyPerDay: 2,
        instructions: "Twice daily after meals",
        durationMinutes: 15,
        status: "published",
        startDate: new Date(),
      },
    });
    console.log("Created active Care Plan for Jane Patient");
  }

  console.log("✅ Jane Patient seeded with live device, telemetry, and care plan!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
