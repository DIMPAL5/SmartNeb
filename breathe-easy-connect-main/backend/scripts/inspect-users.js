const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      roles: true,
      patientProfile: true,
      doctorProfile: true,
      caregiverProfile: true,
    },
  });
  console.log("Found", users.length, "users:");
  for (const u of users) {
    console.log({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      isActive: u.isActive,
      deletedAt: u.deletedAt,
      roles: u.roles.map(r => r.role),
      hasPatient: !!u.patientProfile,
      hasDoctor: !!u.doctorProfile,
      hasCaregiver: !!u.caregiverProfile,
    });
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
