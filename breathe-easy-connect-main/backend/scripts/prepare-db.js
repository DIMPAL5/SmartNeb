const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
if (fs.existsSync(schemaPath)) {
  let content = fs.readFileSync(schemaPath, 'utf8');
  const dbUrl = process.env.DATABASE_URL || '';
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    console.log('Detected PostgreSQL connection string, adapting Prisma schema datasource provider to postgresql...');
    content = content.replace(/provider\s*=\s*"mysql"/, 'provider = "postgresql"');
    fs.writeFileSync(schemaPath, content, 'utf8');
  } else {
    console.log('Using MySQL datasource provider for Prisma schema.');
  }
}
