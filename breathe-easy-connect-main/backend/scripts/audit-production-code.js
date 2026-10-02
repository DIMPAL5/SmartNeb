const fs = require("fs");
const path = require("path");

console.log("🔍 Running Production Code Audit & Hardened Security Check (Part 10 Enforcement)...");

const FORBIDDEN_PATTERNS = [
  { pattern: /patient\.dimpal@smartneb\.com/i, name: "Seed Email: patient.dimpal@smartneb.com" },
  { pattern: /patient\.kalpak@smartneb\.com/i, name: "Seed Email: patient.kalpak@smartneb.com" },
  {
    pattern: /patient\.chandana@smartneb\.com/i,
    name: "Seed Email: patient.chandana@smartneb.com",
  },
  { pattern: /doctor\.thorne@smartneb\.com/i, name: "Seed Email: doctor.thorne@smartneb.com" },
  { pattern: /doctor\.lin@smartneb\.com/i, name: "Seed Email: doctor.lin@smartneb.com" },
  { pattern: /caregiver\.elena@smartneb\.com/i, name: "Seed Email: caregiver.elena@smartneb.com" },
  {
    pattern: /caregiver\.marcus@smartneb\.com/i,
    name: "Seed Email: caregiver.marcus@smartneb.com",
  },
  { pattern: /admin\.alex@smartneb\.com/i, name: "Seed Email: admin.alex@smartneb.com" },
  { pattern: /superadmin\.root@smartneb\.com/i, name: "Seed Email: superadmin.root@smartneb.com" },
  { pattern: /Password123!/i, name: "Default Seed Password: Password123!" },
  { pattern: /smartneb_super_secret_jwt_key/i, name: "Default JWT Secret Constant" },
  { pattern: /smartneb_super_secret_refresh_key/i, name: "Default JWT Refresh Secret Constant" },
];

const MOBILE_SPECIFIC_FORBIDDEN = [
  { pattern: /https?:\/\/localhost/i, name: "Localhost URL in mobile bundle" },
  { pattern: /https?:\/\/127\.0\.0\.1/i, name: "Loopback 127.0.0.1 in mobile bundle" },
  {
    pattern: /https?:\/\/172\.(1[6-9]|2\d|3[0-1])\./i,
    name: "LAN IP (172.16-31.x) in mobile bundle",
  },
  { pattern: /https?:\/\/192\.168\./i, name: "LAN IP (192.168.x) in mobile bundle" },
  { pattern: /https?:\/\/10\.\d{1,3}\./i, name: "LAN IP (10.x) in mobile bundle" },
];

const SCAN_TARGETS = [
  { path: path.join(__dirname, "../../mobile/src"), isMobile: true },
  { path: path.join(__dirname, "../server.js"), isMobile: false },
];

let violationsFound = false;

function scanFile(filePath, isMobile) {
  const content = fs.readFileSync(filePath, "utf8");

  // Check generic forbidden patterns
  FORBIDDEN_PATTERNS.forEach(({ pattern, name }) => {
    if (pattern.test(content)) {
      console.error(
        `❌ AUDIT FAILURE in [${filePath}]: Found forbidden credential pattern -> ${name}`,
      );
      violationsFound = true;
    }
  });

  // Check mobile-specific URL restrictions
  if (isMobile) {
    MOBILE_SPECIFIC_FORBIDDEN.forEach(({ pattern, name }) => {
      if (pattern.test(content)) {
        console.error(
          `❌ AUDIT FAILURE in mobile code [${filePath}]: Found forbidden network target -> ${name}`,
        );
        violationsFound = true;
      }
    });
  }
}

function scanDirectory(dirPath, isMobile) {
  if (fs.statSync(dirPath).isFile()) {
    scanFile(dirPath, isMobile);
    return;
  }
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== "node_modules" && file !== ".git" && file !== "dist" && file !== "build") {
        scanDirectory(fullPath, isMobile);
      }
    } else if (/\.(js|ts|tsx|jsx)$/.test(file)) {
      scanFile(fullPath, isMobile);
    }
  });
}

SCAN_TARGETS.forEach(({ path: targetPath, isMobile }) => {
  if (fs.existsSync(targetPath)) {
    scanDirectory(targetPath, isMobile);
  }
});

if (violationsFound) {
  console.error(
    "\n❌ Production Code Audit FAILED! Clean up all hardcoded credentials & seed references before building for production.\n",
  );
  process.exit(1);
} else {
  console.log(
    "\n✅ Production Code Audit PASSED cleanly! Zero demo credentials, zero seed emails, zero localhost/LAN URLs found.\n",
  );
  process.exit(0);
}
