const fs = require('fs');
const path = require('path');
const net = require('net');

const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
const dbUrl = process.env.DATABASE_URL || '';
const isRender = process.env.RENDER === 'true' || Boolean(process.env.RENDER_SERVICE_ID);
const isPostgres = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://') || isRender;

// 1. Adapt schema datasource provider
if (fs.existsSync(schemaPath)) {
  let content = fs.readFileSync(schemaPath, 'utf8');
  if (isPostgres && !dbUrl.startsWith('mysql:')) {
    console.log('⚡ Adapting Prisma schema datasource provider to postgresql...');
    content = content.replace(/provider\s*=\s*"mysql"/, 'provider = "postgresql"');
    fs.writeFileSync(schemaPath, content, 'utf8');
  } else {
    console.log('⚡ Using MySQL datasource provider for Prisma schema.');
  }
}

// 2. Wait for database connection if --wait flag is passed
if (process.argv.includes('--wait') && dbUrl) {
  try {
    const url = new URL(dbUrl);
    const host = url.hostname;
    const port = parseInt(url.port, 10) || (isPostgres ? 5432 : 3306);

    console.log(`⏳ Waiting for database connection at ${host}:${port}...`);
    
    let retries = 15;
    const checkConnection = () => {
      return new Promise((resolve) => {
        const socket = new net.Socket();
        socket.setTimeout(2000);
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        socket.on('error', () => {
          socket.destroy();
          resolve(false);
        });
        socket.on('timeout', () => {
          socket.destroy();
          resolve(false);
        });
        socket.connect(port, host);
      });
    };

    (async () => {
      while (retries > 0) {
        const ok = await checkConnection();
        if (ok) {
          console.log(' Database is ready and accepting connections.');
          process.exit(0);
        }
        retries--;
        console.log(` Database not ready yet, retrying (${retries} attempts left)...`);
        await new Promise((r) => setTimeout(r, 2000));
      }
      console.log('⚠️ Database connection check timed out. Proceeding anyway...');
      process.exit(0);
    })();
  } catch (err) {
    console.log('⚠️ Could not parse DATABASE_URL to check connection:', err.message);
    process.exit(0);
  }
} else {
  process.exit(0);
}
