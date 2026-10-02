const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function bootstrapSuperAdmin() {
  const email = process.env.ADMIN_EMAIL || process.argv[2];
  const password = process.env.ADMIN_PASSWORD || process.argv[3];
  const fullName = process.env.ADMIN_NAME || process.argv[4] || 'Super Administrator';

  if (!email || !password) {
    console.error('❌ Usage: node scripts/bootstrap-superadmin.js <email> <password> [fullName]');
    console.error('   OR set environment variables: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('❌ Password strength check failed: SuperAdmin password must be at least 12 characters.');
    process.exit(1);
  }

  console.log(`🔐 Bootstrapping SUPER_ADMIN account for: ${email}...`);

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.error(`❌ User with email ${email} already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        isActive: true,
        roles: {
          create: [{ role: 'super_admin' }, { role: 'admin' }]
        },
        auditLogs: {
          create: {
            actorName: 'SYSTEM_BOOTSTRAP',
            action: 'BOOTSTRAP_SUPERADMIN_CREATED',
            meta: { email }
          }
        }
      }
    });

    console.log(`✅ SUPER_ADMIN successfully created! User ID: ${user.id}`);
  } catch (err) {
    console.error('❌ Error bootstrapping SuperAdmin:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

bootstrapSuperAdmin();
