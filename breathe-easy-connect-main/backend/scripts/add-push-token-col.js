const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe("ALTER TABLE users ADD COLUMN push_token VARCHAR(255) NULL;");
    console.log("✓ push_token column added to users table.");
  } catch (err) {
    if (err.message.includes("Duplicate column name")) {
      console.log("✓ push_token column already exists.");
    } else {
      console.error("Error adding push_token column:", err.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
