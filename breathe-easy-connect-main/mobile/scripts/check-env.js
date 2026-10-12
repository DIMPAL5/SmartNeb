const fs = require("fs");
const path = require("path");

console.log("🔒 Verifying Mobile App Production Build Environment Configuration...");

let apiUrl = null;
const configFilePath = path.join(__dirname, "../src/config/api.config.ts");
const clientFilePath = path.join(__dirname, "../src/api/client.ts");

if (fs.existsSync(configFilePath)) {
  const configContent = fs.readFileSync(configFilePath, "utf8");
  const match = configContent.match(/export const PRODUCTION_API_URL = ['"]([^'"]+)['"]/);
  if (match) apiUrl = match[1];
}

if (!apiUrl && fs.existsSync(clientFilePath)) {
  const clientContent = fs.readFileSync(clientFilePath, "utf8");
  const match = clientContent.match(/export const (?:API_BASE_URL|DEFAULT_API_URL|PRODUCTION_API_URL) = ['"]([^'"]+)['"]/);
  if (match) apiUrl = match[1];
}

if (!apiUrl) {
  console.error("❌ FAIL: Could not locate API endpoint declaration in mobile configuration");
  process.exit(1);
}

console.log(`📌 Detected Mobile API_BASE_URL: "${apiUrl}"`);

const isProductionBuild =
  process.env.EAS_BUILD_PROFILE === "production" || process.env.NODE_ENV === "production";

if (isProductionBuild) {
  const forbiddenSubstrings = ["localhost", "127.0.0.1", "172.16.", "192.168.", "10."];
  const isForbidden = forbiddenSubstrings.some((substring) => apiUrl.includes(substring));

  if (isForbidden || !apiUrl.startsWith("https://")) {
    console.error(
      `\n❌ PRODUCTION BUILD FAILED: Production API_BASE_URL must be a secure public HTTPS endpoint (https://).\n   Detected prohibited URL: "${apiUrl}"`,
    );
    process.exit(1);
  }
  console.log(
    "✅ PRODUCTION BUILD VERIFIED: Production API_BASE_URL uses valid HTTPS cloud endpoint.",
  );
} else {
  console.log("ℹ️ Development build detected. Skipping strict HTTPS domain enforcement.");
}

process.exit(0);
