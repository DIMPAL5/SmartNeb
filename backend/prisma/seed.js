const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV !== "development") {
    console.error(
      "❌ SEED REFUSED: Database seed script is strictly restricted to development environments.",
    );
    console.error(`   Current NODE_ENV: [${process.env.NODE_ENV || "undefined"}].`);
    console.error(
      "   Production databases must NEVER be seeded with test data or default credentials.",
    );
    process.exit(1);
  }

  console.log("🌱 Starting SmartNeb development database seed...");

  const defaultPassword = await bcrypt.hash("Password123!", 10);

  // 0. Seed Demo Hospital Tenant
  const demoHospital = await prisma.hospital.upsert({
    where: { slug: "demo-hospital" },
    update: {
      name: "SmartNeb Demo Memorial Hospital",
      status: "approved",
    },
    create: {
      name: "SmartNeb Demo Memorial Hospital",
      slug: "demo-hospital",
      code: "HOSP-DEMO-001",
      contactEmail: "demo-hospital@smartneb.local",
      status: "approved",
      approvedAt: new Date(),
    },
  });

  // 1. Users & Roles (Excluding any platform super_admin)
  const usersData = [
    {
      email: "patient.dimpal@smartneb.com",
      fullName: "Dimpal D.",
      role: "patient",
      patientInfo: { mrn: "MRN-1001", condition: "Asthma", sex: "Female" },
    },
    {
      email: "patient.kalpak@smartneb.com",
      fullName: "Kalpak H S",
      role: "patient",
      patientInfo: { mrn: "MRN-1002", condition: "COPD", sex: "Male" },
    },
    {
      email: "patient.chandana@smartneb.com",
      fullName: "Chandana G O",
      role: "patient",
      patientInfo: { mrn: "MRN-1003", condition: "Bronchitis", sex: "Female" },
    },
    {
      email: "doctor.thorne@smartneb.com",
      fullName: "Dr. Aris Thorne",
      role: "doctor",
      doctorInfo: { specialty: "Pulmonology & Critical Care" },
    },
    {
      email: "doctor.lin@smartneb.com",
      fullName: "Dr. Sarah Lin",
      role: "doctor",
      doctorInfo: { specialty: "Pediatric Respiratory Care" },
    },
    {
      email: "caregiver.elena@smartneb.com",
      fullName: "Elena Vance",
      role: "caregiver",
      caregiverInfo: { relation: "Family Caregiver" },
    },
    {
      email: "caregiver.marcus@smartneb.com",
      fullName: "Marcus Reed",
      role: "caregiver",
      caregiverInfo: { relation: "Home Health Aide" },
    },
  ];

  const createdUsers = {};
  const createdPatients = {};
  const createdDoctors = {};
  const createdCaregivers = {};

  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        hospitalId: demoHospital.id,
      },
      create: {
        email: u.email,
        passwordHash: defaultPassword,
        fullName: u.fullName,
        hospitalId: demoHospital.id,
        consentGivenAt: new Date(),
        roles: {
          create: { role: u.role },
        },
      },
    });

    createdUsers[u.email] = user;

    if (u.role === "patient") {
      const p = await prisma.patient.upsert({
        where: { mrn: u.patientInfo.mrn },
        update: {
          fullName: u.fullName,
          hospitalId: demoHospital.id,
        },
        create: {
          userId: user.id,
          hospitalId: demoHospital.id,
          fullName: u.fullName,
          mrn: u.patientInfo.mrn,
          condition: u.patientInfo.condition,
          sex: u.patientInfo.sex,
          spo2Threshold: 92,
          bpmLowThreshold: 50,
          bpmHighThreshold: 120,
          tempThreshold: 38.0,
        },
      });
      createdPatients[u.email] = p;
    } else if (u.role === "doctor") {
      const d = await prisma.doctor.upsert({
        where: { userId: user.id },
        update: { fullName: u.fullName },
        create: {
          userId: user.id,
          fullName: u.fullName,
          specialty: u.doctorInfo.specialty,
        },
      });
      createdDoctors[u.email] = d;
    } else if (u.role === "caregiver") {
      const c = await prisma.caregiver.upsert({
        where: { userId: user.id },
        update: { fullName: u.fullName },
        create: {
          userId: user.id,
          fullName: u.fullName,
          relation: u.caregiverInfo.relation,
        },
      });
      createdCaregivers[u.email] = c;
    }
  }

  // 2. Doctor & Caregiver Patient Assignments
  const docThorne = createdDoctors["doctor.thorne@smartneb.com"];
  const docLin = createdDoctors["doctor.lin@smartneb.com"];
  const pDimpal = createdPatients["patient.dimpal@smartneb.com"];
  const pKalpak = createdPatients["patient.kalpak@smartneb.com"];
  const pChandana = createdPatients["patient.chandana@smartneb.com"];
  const cgElena = createdCaregivers["caregiver.elena@smartneb.com"];
  const cgMarcus = createdCaregivers["caregiver.marcus@smartneb.com"];

  if (docThorne && pDimpal) {
    await prisma.doctorPatientAssignment.upsert({
      where: { doctorId_patientId: { doctorId: docThorne.id, patientId: pDimpal.id } },
      update: {},
      create: { doctorId: docThorne.id, patientId: pDimpal.id },
    });
  }
  if (docThorne && pKalpak) {
    await prisma.doctorPatientAssignment.upsert({
      where: { doctorId_patientId: { doctorId: docThorne.id, patientId: pKalpak.id } },
      update: {},
      create: { doctorId: docThorne.id, patientId: pKalpak.id },
    });
  }
  if (docLin && pChandana) {
    await prisma.doctorPatientAssignment.upsert({
      where: { doctorId_patientId: { doctorId: docLin.id, patientId: pChandana.id } },
      update: {},
      create: { doctorId: docLin.id, patientId: pChandana.id },
    });
  }
  if (cgElena && pDimpal) {
    await prisma.caregiverPatientAssignment.upsert({
      where: { caregiverId_patientId: { caregiverId: cgElena.id, patientId: pDimpal.id } },
      update: {},
      create: { caregiverId: cgElena.id, patientId: pDimpal.id },
    });
  }
  if (cgMarcus && pKalpak) {
    await prisma.caregiverPatientAssignment.upsert({
      where: { caregiverId_patientId: { caregiverId: cgMarcus.id, patientId: pKalpak.id } },
      update: {},
      create: { caregiverId: cgMarcus.id, patientId: pKalpak.id },
    });
  }

  // 3. Devices
  const devicesData = [
    {
      code: "NEB-001",
      patient: pDimpal,
      status: "online",
      nebulizerState: "OFF",
      fluidLevel: 85.0,
    },
    {
      code: "NEB-002",
      patient: pKalpak,
      status: "online",
      nebulizerState: "OFF",
      fluidLevel: 92.0,
    },
    {
      code: "NEB-003",
      patient: pChandana,
      status: "offline",
      nebulizerState: "OFF",
      fluidLevel: 45.0,
    },
  ];

  const createdDevices = {};
  for (const d of devicesData) {
    const dev = await prisma.device.upsert({
      where: { deviceCode: d.code },
      update: {
        patientId: d.patient ? d.patient.id : null,
        hospitalId: demoHospital.id,
        status: d.status,
        fluidLevel: d.fluidLevel,
      },
      create: {
        deviceCode: d.code,
        hospitalId: demoHospital.id,
        patientId: d.patient ? d.patient.id : null,
        status: d.status,
        mqttConnected: d.status === "online",
        cloudConnected: d.status === "online",
        nebulizerState: d.nebulizerState,
        fluidLevel: d.fluidLevel,
        lastSeenAt: new Date(),
      },
    });
    createdDevices[d.code] = dev;
  }

  // 4. Initial Telemetry for Patients
  for (const p of [pDimpal, pKalpak, pChandana]) {
    if (!p) continue;
    const dev =
      createdDevices[
        p.mrn === "MRN-1001" ? "NEB-001" : p.mrn === "MRN-1002" ? "NEB-002" : "NEB-003"
      ];

    await prisma.healthTelemetry.create({
      data: {
        patientId: p.id,
        deviceId: dev ? dev.id : null,
        bpm: p.mrn === "MRN-1002" ? 104 : 76,
        spo2: p.mrn === "MRN-1002" ? 91.5 : 98.0,
        bodyTemperature: 36.8,
      },
    });

    await prisma.environmentalTelemetry.create({
      data: {
        patientId: p.id,
        deviceId: dev ? dev.id : null,
        ambientTemperature: 24.5,
        humidity: 52.0,
        aqi: p.mrn === "MRN-1002" ? 88.0 : 35.0,
        simulated: true,
      },
    });

    await prisma.batteryTelemetry.create({
      data: {
        patientId: p.id,
        deviceId: dev ? dev.id : null,
        percentage: 88,
        voltage: 4.1,
        current: 0.45,
        power: 1.84,
        cellTemperature: 28.5,
        charging: false,
        fluidLevel: dev ? dev.fluidLevel : 85,
      },
    });

    // Care Plan
    const carePlan = await prisma.carePlan.create({
      data: {
        patientId: p.id,
        doctorId: docThorne ? docThorne.id : null,
        medication:
          p.mrn === "MRN-1001"
            ? "Salbutamol 2.5mg"
            : p.mrn === "MRN-1002"
              ? "Budesonide 0.5mg"
              : "Ipratropium 500mcg",
        dosage: "2.5 ml",
        durationMinutes: 10,
        frequencyPerDay: 2,
        instructions: "Inhale via nebulizer twice daily after meals.",
        status: "published",
      },
    });

    // Session & Adherence
    const session = await prisma.nebulizationSession.create({
      data: {
        patientId: p.id,
        deviceId: dev ? dev.id : null,
        carePlanId: carePlan.id,
        medication: carePlan.medication,
        dosage: carePlan.dosage,
        prescribedSeconds: 600,
        elapsedSeconds: 600,
        status: "completed",
        endedAt: new Date(),
      },
    });

    await prisma.adherenceRecord.create({
      data: {
        patientId: p.id,
        carePlanId: carePlan.id,
        sessionId: session.id,
        status: "completed",
        completionRatio: 1.0,
      },
    });

    // Alert if Kalpak
    if (p.mrn === "MRN-1002") {
      await prisma.alert.create({
        data: {
          patientId: p.id,
          deviceId: dev ? dev.id : null,
          type: "SPO2_LOW",
          severity: "critical",
          value: 91.5,
          threshold: 92.0,
          message: "SpO2 level (91.5%) dropped below safe threshold (92.0%)",
          status: "active",
        },
      });
    }
  }

  console.log("✅ SmartNeb development database seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
