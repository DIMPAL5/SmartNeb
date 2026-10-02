const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_API_URL || 'http://127.0.0.1:5000';
console.log(`\n🔍 ==================================================`);
console.log(`🚀 RUNNING DEPLOYED SMOKE TEST (GATE 5) AGAINST: ${BASE_URL}`);
console.log(`==================================================\n`);

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const isHttps = BASE_URL.startsWith('https://');
    const client = isHttps ? https : http;
    const url = new URL(path, BASE_URL);

    const reqHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const req = client.request(
      url,
      {
        method,
        headers: reqHeaders,
        timeout: 10000,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(rawData);
          } catch (e) {
            parsed = rawData;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runSmokeTests() {
  let passed = 0;
  let failed = 0;

  async function check(name, fn) {
    process.stdout.write(`• Testing: ${name}... `);
    try {
      await fn();
      console.log('✅ PASS');
      passed++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  }

  // 1. Health Probe
  await check('Health Endpoint (/health)', async () => {
    const res = await request('GET', '/health');
    if (res.statusCode !== 200 || res.body.status !== 'healthy') {
      throw new Error(`Expected 200 healthy, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
  });

  // 2. Readiness Probe
  await check('Readiness Endpoint (/ready)', async () => {
    const res = await request('GET', '/ready');
    if (res.statusCode !== 200 || res.body.status !== 'ready' || res.body.database !== 'connected') {
      throw new Error(`Expected 200 database connected, got ${res.statusCode}: ${JSON.stringify(res.body)}`);
    }
  });

  // 3. Security Headers
  await check('Security Headers (Helmet & Request-ID)', async () => {
    const res = await request('GET', '/health');
    if (!res.headers['x-request-id']) throw new Error('Missing X-Request-Id header');
    if (!res.headers['x-content-type-options']) throw new Error('Missing X-Content-Type-Options header');
  });

  // 4. Role Escalation Prevention
  await check('Role-Escalation Signup Block (Attempt ADMIN creation)', async () => {
    const res = await request('POST', '/api/v1/auth/signup', {
      email: `hacker.${Date.now()}@evil.corp`,
      password: 'HackerPassword123!',
      fullName: 'Evil Hacker',
      role: 'admin',
    });
    if (res.statusCode !== 403) throw new Error(`Expected 403 Forbidden, got ${res.statusCode}`);
  });

  // 5. Patient Registration
  const testEmail = `patient.smoke.${Date.now()}@smartneb.test`;
  const testPassword = 'SafePassword2026!#';
  let accessToken = null;
  let refreshToken = null;

  await check('Patient Self-Registration (REST /api/v1/auth/signup)', async () => {
    const res = await request('POST', '/api/v1/auth/signup', {
      email: testEmail,
      password: testPassword,
      fullName: 'Smoke Test Patient',
      role: 'patient',
    });
    if (res.statusCode !== 201 || !res.body.accessToken) {
      throw new Error(`Expected 201 with accessToken, got ${res.statusCode}`);
    }
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
  });

  // 6. User Login
  await check('User Authentication (REST /api/v1/auth/login)', async () => {
    const res = await request('POST', '/api/v1/auth/login', {
      email: testEmail,
      password: testPassword,
    });
    if (res.statusCode !== 200 || !res.body.accessToken) {
      throw new Error(`Login failed with status ${res.statusCode}`);
    }
  });

  // 7. Protected Route with Auth Token
  await check('Authenticated Route (GET /api/v1/auth/me)', async () => {
    const res = await request('GET', '/api/v1/auth/me', null, {
      Authorization: `Bearer ${accessToken}`,
    });
    if (res.statusCode !== 200 || res.body.user.email !== testEmail) {
      throw new Error(`Auth/me check failed with status ${res.statusCode}`);
    }
  });

  // 8. Protected Route Rejection without Token
  await check('Unauthorized Protection (401 when token omitted)', async () => {
    const res = await request('GET', '/api/v1/auth/me');
    if (res.statusCode !== 401) throw new Error(`Expected 401, got ${res.statusCode}`);
  });

  // 9. Token Refresh Flow
  await check('Token Refresh (POST /api/v1/auth/refresh)', async () => {
    const res = await request('POST', '/api/v1/auth/refresh', { refreshToken });
    if (res.statusCode !== 200 || !res.body.accessToken) {
      throw new Error(`Refresh failed with status ${res.statusCode}`);
    }
    accessToken = res.body.accessToken; // update with refreshed token
  });

  // 10. Consent Recording
  await check('In-App Patient Consent Recording (/api/v1/consent/record)', async () => {
    const res = await request('POST', '/api/v1/consent/record', { isMinor: false }, {
      Authorization: `Bearer ${accessToken}`,
    });
    if (res.statusCode !== 200 || !res.body.consentGivenAt) {
      throw new Error(`Consent record failed: ${res.statusCode}`);
    }
  });

  // 11. Account Deletion (Google Play Compliance)
  await check('Account Deletion (DELETE /api/v1/auth/delete-account)', async () => {
    const res = await request('DELETE', '/api/v1/auth/delete-account', null, {
      Authorization: `Bearer ${accessToken}`,
    });
    if (res.statusCode !== 200) {
      throw new Error(`Account deletion failed: ${res.statusCode}`);
    }
  });

  console.log(`\n==================================================`);
  console.log(`🏁 SMOKE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================\n`);

  if (failed > 0) process.exit(1);
}

runSmokeTests().catch((err) => {
  console.error('Smoke test suite failed unexpectedly:', err);
  process.exit(1);
});
