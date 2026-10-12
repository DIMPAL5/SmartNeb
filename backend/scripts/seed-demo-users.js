const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting demo users and credentials setup...");

  // 1. Get or create a default hospital
  let hospital = await prisma.hospital.findFirst({
    where: { status: "approved" },
  });

  if (!hospital) {
    hospital = await prisma.hospital.create({
      data: {
        name: "SmartNeb Memorial Hospital",
        slug: "smartneb-memorial",
        code: "SN-HOSP-001",
        contactEmail: "info@smartneb.com",
        phone: "+1-800-555-0199",
        address: "742 Evergreen Terrace, Medical Wing",
        status: "approved",
        approvedAt: new Date(),
      },
    });
    console.log(" Created default hospital:", hospital.name);
  } else {
    console.log(" Using existing hospital:", hospital.name, `(${hospital.id})`);
  }

  // 2. Hash passwords
  const patientHash = await bcrypt.hash("Patient@123", 10);
  const doctorHash = await bcrypt.hash("Doctor@123", 10);
  const caregiverHash = await bcrypt.hash("Caregiver@123", 10);
  const adminHash = await bcrypt.hash("Admin@123", 10);

  // 3. Upsert Patient: patient@smartneb.com
  let patientUser = await prisma.user.findUnique({
    where: { email: "patient@smartneb.com" },
  });

  if (!patientUser) {
    patientUser = await prisma.user.create({
      data: {
        email: "patient@smartneb.com",
        passwordHash: patientHash,
        fullName: "Jane Patient",
        hospitalId: hospital.id,
        isActive: true,
        roles: { create: [{ role: "patient" }] },
      },
    });
    console.log(" Created patient user:", patientUser.email);
  } else {
    patientUser = await prisma.user.update({
      where: { id: patientUser.id },
      data: {
        passwordHash: patientHash,
        isActive: true,
        deletedAt: null,
      },
    });
    // Ensure role exists
    const hasRole = await prisma.userRole.findFirst({
      where: { userId: patientUser.id, role: "patient" },
    });
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId: patientUser.id, role: "patient" },
      });
    }
    console.log(" Updated patient user password & status:", patientUser.email);
  }

  // Ensure patient profile exists
  let patientProfile = await prisma.patient.findFirst({
    where: { userId: patientUser.id },
  });
  if (!patientProfile) {
    patientProfile = await prisma.patient.create({
      data: {
        userId: patientUser.id,
        hospitalId: hospital.id,
        fullName: "Jane Patient",
        mrn: "MRN-PATIENT-001",
        condition: "Chronic Asthma & COPD",
        spo2Threshold: 92.0,
        bpmLowThreshold: 50.0,
        bpmHighThreshold: 120.0,
        tempThreshold: 38.0,
      },
    });
    console.log(" Created Patient profile with MRN:", patientProfile.mrn);
  }

  // 4. Upsert Doctor: doctor@smartneb.com
  let doctorUser = await prisma.user.findUnique({
    where: { email: "doctor@smartneb.com" },
  });

  if (!doctorUser) {
    doctorUser = await prisma.user.create({
      data: {
        email: "doctor@smartneb.com",
        passwordHash: doctorHash,
        fullName: "Dr. Robert Smith",
        hospitalId: hospital.id,
        isActive: true,
        roles: { create: [{ role: "doctor" }] },
      },
    });
    console.log(" Created doctor user:", doctorUser.email);
  } else {
    doctorUser = await prisma.user.update({
      where: { id: doctorUser.id },
      data: {
        passwordHash: doctorHash,
        isActive: true,
        deletedAt: null,
      },
    });
    const hasRole = await prisma.userRole.findFirst({
      where: { userId: doctorUser.id, role: "doctor" },
    });
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId: doctorUser.id, role: "doctor" },
      });
    }
    console.log(" Updated doctor user password & status:", doctorUser.email);
  }

  // Ensure doctor profile exists
  let doctorProfile = await prisma.doctor.findFirst({
    where: { userId: doctorUser.id },
  });
  if (!doctorProfile) {
    doctorProfile = await prisma.doctor.create({
      data: {
        userId: doctorUser.id,
        fullName: "Dr. Robert Smith",
        specialty: "Pulmonology & Critical Respiratory Care",
      },
    });
    console.log(" Created Doctor profile:", doctorProfile.fullName);
  }

  // Assign doctor to patient if not already assigned
  const docAssignment = await prisma.doctorPatientAssignment.findFirst({
    where: { doctorId: doctorProfile.id, patientId: patientProfile.id },
  });
  if (!docAssignment) {
    await prisma.doctorPatientAssignment.create({
      data: { doctorId: doctorProfile.id, patientId: patientProfile.id },
    });
    console.log(" Assigned doctor to patient");
  }

  // 5. Upsert Caregiver: caregiver@smartneb.com
  let caregiverUser = await prisma.user.findUnique({
    where: { email: "caregiver@smartneb.com" },
  });

  if (!caregiverUser) {
    caregiverUser = await prisma.user.create({
      data: {
        email: "caregiver@smartneb.com",
        passwordHash: caregiverHash,
        fullName: "Mary Caregiver",
        hospitalId: hospital.id,
        isActive: true,
        roles: { create: [{ role: "caregiver" }] },
      },
    });
    console.log(" Created caregiver user:", caregiverUser.email);
  } else {
    caregiverUser = await prisma.user.update({
      where: { id: caregiverUser.id },
      data: {
        passwordHash: caregiverHash,
        isActive: true,
        deletedAt: null,
      },
    });
    const hasRole = await prisma.userRole.findFirst({
      where: { userId: caregiverUser.id, role: "caregiver" },
    });
    if (!hasRole) {
      await prisma.userRole.create({
        data: { userId: caregiverUser.id, role: "caregiver" },
      });
    }
    console.log(" Updated caregiver user password & status:", caregiverUser.email);
  }

  // Ensure caregiver profile exists
  let caregiverProfile = await prisma.caregiver.findFirst({
    where: { userId: caregiverUser.id },
  });
  if (!caregiverProfile) {
    caregiverProfile = await prisma.caregiver.create({
      data: {
        userId: caregiverUser.id,
        fullName: "Mary Caregiver",
        relation: "Primary Family Caregiver",
      },
    });
    console.log(" Created Caregiver profile:", caregiverProfile.fullName);
  }

  // Assign caregiver to patient if not already assigned
  const cgAssignment = await prisma.caregiverPatientAssignment.findFirst({
    where: { caregiverId: caregiverProfile.id, patientId: patientProfile.id },
  });
  if (!cgAssignment) {
    await prisma.caregiverPatientAssignment.create({
      data: { caregiverId: caregiverProfile.id, patientId: patientProfile.id },
    });
    console.log(" Assigned caregiver to patient");
  }

  // 6. Upsert Admin: admin@smartneb.com
  let adminUser = await prisma.user.findUnique({
    where: { email: "admin@smartneb.com" },
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        email: "admin@smartneb.com",
        passwordHash: adminHash,
        fullName: "System Administrator",
        hospitalId: hospital.id,
        isActive: true,
        roles: {
          create: [{ role: "admin" }, { role: "super_admin" }],
        },
      },
    });
    console.log(" Created admin user:", adminUser.email);
  } else {
    adminUser = await prisma.user.update({
      where: { id: adminUser.id },
      data: {
        passwordHash: adminHash,
        isActive: true,
        deletedAt: null,
      },
    });
    // Ensure admin & super_admin roles
    for (const role of ["admin", "super_admin"]) {
      const hasRole = await prisma.userRole.findFirst({
        where: { userId: adminUser.id, role },
      });
      if (!hasRole) {
        await prisma.userRole.create({
          data: { userId: adminUser.id, role },
        });
      }
    }
    console.log(" Updated admin user password & status:", adminUser.email);
  }

  // 7. Also set password for dimpal users if they exist
  const dimpalEmails = ["dimpalrajput511@gmail.com", "patient.dimpal@smartneb.com"];
  for (const dEmail of dimpalEmails) {
    const dUser = await prisma.user.findUnique({ where: { email: dEmail } });
    if (dUser) {
      await prisma.user.update({
        where: { id: dUser.id },
        data: { passwordHash: patientHash, isActive: true, deletedAt: null },
      });
      console.log(` Reset password for ${dEmail} to Patient@123`);
    }
  }

  console.log("\n==================================================");
  console.log("✅ ALL DEMO USERS SEEDED & READY FOR LOGIN:");
  console.log("• Patient:   patient@smartneb.com   / Patient@123");
  console.log("• Doctor:    doctor@smartneb.com    / Doctor@123");
  console.log("• Caregiver: caregiver@smartneb.com / Caregiver@123");
  console.log("• Admin:     admin@smartneb.com     / Admin@123");
  console.log("• Dimpal:    dimpalrajput511@gmail.com / Patient@123");
  console.log("==================================================\n");
}

main()
  .catch((err) => {
    console.error("❌ Error seeding users:", err);
  })
  .finally(() => prisma.$disconnect());
