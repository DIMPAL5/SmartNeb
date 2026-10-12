const http = require("http");
const net = require("net");
const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

async function checkConnectivity() {
  console.log("🔍 ==================================================");
  console.log("🚀 SMARTNEB CONNECTIVITY SELF-TEST SUITE");
  console.log("==================================================\n");

  let allPassed = true;

  // 1. MySQL Connectivity Test
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("• MySQL Database (Prisma Ping): ........ ✅ PASS");
  } catch (err) {
    console.error("• MySQL Database (Prisma Ping): ........ ❌ FAIL");
    console.error(`  Error: ${err.message}`);
    allPassed = false;
  }

  // 2. Mosquitto MQTT Broker Port 1883 Test
  await new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.on("connect", () => {
      console.log("• Mosquitto MQTT Broker (TCP 1883): .... ✅ PASS");
      socket.destroy();
      resolve();
    });
    socket.on("error", (err) => {
      console.error("• Mosquitto MQTT Broker (TCP 1883): .... ❌ FAIL (Broker offline or port 1883 blocked)");
      console.error(`  Error: ${err.message}`);
      allPassed = false;
      resolve();
    });
    socket.on("timeout", () => {
      console.error("• Mosquitto MQTT Broker (TCP 1883): .... ❌ FAIL (Connection timed out)");
      socket.destroy();
      allPassed = false;
      resolve();
    });
    socket.connect(1883, "127.0.0.1");
  });

  // 3. Backend HTTP /health Endpoint Test
  await new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:5000/health", { timeout: 3000 }, (res) => {
      if (res.statusCode === 200) {
        console.log("• Backend API Probe (/health): ......... ✅ PASS");
      } else {
        console.error(`• Backend API Probe (/health): ......... ❌ FAIL (Status: ${res.statusCode})`);
        allPassed = false;
      }
      resolve();
    });
    req.on("error", (err) => {
      console.error("• Backend API Probe (/health): ......... ❌ FAIL (Backend server not running)");
      console.error(`  Error: ${err.message}`);
      allPassed = false;
      resolve();
    });
  });

  // 4. Backend HTTP /ready Endpoint Test
  await new Promise((resolve) => {
    const req = http.get("http://127.0.0.1:5000/ready", { timeout: 3000 }, (res) => {
      if (res.statusCode === 200) {
        console.log("• Backend Readiness Probe (/ready): ..... ✅ PASS");
      } else {
        console.error(`• Backend Readiness Probe (/ready): ..... ❌ FAIL (Status: ${res.statusCode})`);
        allPassed = false;
      }
      resolve();
    });
    req.on("error", (err) => {
      console.error("• Backend Readiness Probe (/ready): ..... ❌ FAIL");
      console.error(`  Error: ${err.message}`);
      allPassed = false;
      resolve();
    });
  });

  await prisma.$disconnect();

  console.log("\n==================================================");
  if (allPassed) {
    console.log("🏁 CONNECTIVITY SELF-TEST SUMMARY: ALL PASSED ✅");
    process.exit(0);
  } else {
    console.log("🏁 CONNECTIVITY SELF-TEST SUMMARY: SOME CHECKS FAILED ❌");
    process.exit(1);
  }
}

checkConnectivity();
