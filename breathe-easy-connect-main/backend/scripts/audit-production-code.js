const fs = require('fs');
const path = require('path');

console.log('🔍 Running Production Code Audit & Hardened Security Check...');

const FORBIDDEN_PATTERNS = [
  { pattern: /patient\.dimpal@smartneb\.com/i, name: 'Seed Email: patient.dimpal@smartneb.com' },
  { pattern: /doctor\.thorne@smartneb\.com/i, name: 'Seed Email: doctor.thorne@smartneb.com' },
  { pattern: /caregiver\.elena@smartneb\.com/i, name: 'Seed Email: caregiver.elena@smartneb.com' },
  { pattern: /admin\.alex@smartneb\.com/i, name: 'Seed Email: admin.alex@smartneb.com' },
  { pattern: /Password123!/i, name: 'Default Seed Password: Password123!' },
  { pattern: /smartneb_super_secret_jwt_key/i, name: 'Default JWT Secret Constant' },
  { pattern: /smartneb_super_secret_refresh_key/i, name: 'Default JWT Refresh Secret Constant' },
];

const SCAN_DIRS = [
  path.join(__dirname, '../../mobile/src'),
  path.join(__dirname, '../server.js'),
];

let violationsFound = false;

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  FORBIDDEN_PATTERNS.forEach(({ pattern, name }) => {
    if (pattern.test(content)) {
      console.error(`❌ AUDIT FAILURE in file [${filePath}]: Found forbidden pattern -> ${name}`);
      violationsFound = true;
    }
  });
}

function scanDirectory(dirPath) {
  if (fs.statSync(dirPath).isFile()) {
    scanFile(dirPath);
    return;
  }
  const files = fs.readdirSync(dirPath);
  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist' && file !== 'build') {
        scanDirectory(fullPath);
      }
    } else if (/\.(js|ts|tsx|jsx)$/.test(file)) {
      scanFile(fullPath);
    }
  });
}

SCAN_DIRS.forEach((targetPath) => {
  if (fs.existsSync(targetPath)) {
    scanDirectory(targetPath);
  }
});

if (violationsFound) {
  console.error('\n❌ Production Code Audit FAILED! Clean up all hardcoded credentials & seed references before building for production.\n');
  process.exit(1);
} else {
  console.log('\n✅ Production Code Audit PASSED cleanly! No hardcoded demo credentials or default secrets found.\n');
  process.exit(0);
}
