const fs = require('fs');
const path = require('path');

console.log('🔒 Verifying Mobile App Production Build Environment Configuration...');

const clientFilePath = path.join(__dirname, '../src/api/client.ts');
const clientContent = fs.readFileSync(clientFilePath, 'utf8');

const apiMatch = clientContent.match(/export const API_BASE_URL = ['"]([^'"]+)['"]/);

if (!apiMatch) {
  console.error('❌ FAIL: Could not locate API_BASE_URL declaration in mobile/src/api/client.ts');
  process.exit(1);
}

const apiUrl = apiMatch[1];
console.log(`📌 Detected Mobile API_BASE_URL: "${apiUrl}"`);

const isProductionBuild = process.env.EAS_BUILD_PROFILE === 'production' || process.env.NODE_ENV === 'production';

if (isProductionBuild) {
  const forbiddenSubstrings = ['localhost', '127.0.0.1', '172.16.', '192.168.', '10.'];
  const isForbidden = forbiddenSubstrings.some((substring) => apiUrl.includes(substring));

  if (isForbidden || !apiUrl.startsWith('https://')) {
    console.error(`\n❌ PRODUCTION BUILD FAILED: Production API_BASE_URL must be a secure public HTTPS endpoint (https://).\n   Detected prohibited URL: "${apiUrl}"`);
    process.exit(1);
  }
  console.log('✅ PRODUCTION BUILD VERIFIED: Production API_BASE_URL uses valid HTTPS cloud endpoint.');
} else {
  console.log('ℹ️ Development build detected. Skipping strict HTTPS domain enforcement.');
}

process.exit(0);
