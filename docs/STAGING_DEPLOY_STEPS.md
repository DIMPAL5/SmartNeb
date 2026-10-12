# Staging Server Cloud Deployment Guide

**Target Audience:** Operator / System Administrator  
**Difficulty:** Beginner-friendly  
**Target Environment:** Cloud VPS (Hetzner / DigitalOcean / AWS Lightsail) running Ubuntu 24.04 LTS

---

## 1. Prerequisites & Account Setup `[YOU MUST DO THIS]`

1. **Purchase VPS Instance:**
   - Provider: Hetzner Cloud (CPX21 - 2 vCPU, 4GB RAM) or DigitalOcean ($24/mo Droplet).
   - OS: Ubuntu 24.04 LTS.
   - Record Server IPv4 address (e.g., `203.0.113.100`).
2. **Domain & DNS Configuration:**
   - In Cloudflare or domain registrar, add `A` records:
     - `api.staging.smartneb.health` -> `203.0.113.100`
     - `mqtt.staging.smartneb.health` -> `203.0.113.100` (DNS-only / bypass proxy for port 8883)

---

## 2. Server Environment Setup `[YOU MUST DO THIS]`

SSH into your server and run:
```bash
# 1. System updates & package installation
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin certbot python3-certbot-nginx git

# 2. Obtain Let's Encrypt SSL/TLS certificates
sudo certbot certonly --standalone -d api.staging.smartneb.health -d mqtt.staging.smartneb.health
```

---

## 3. Code Checkout & Configuration `[YOU MUST DO THIS]`

```bash
# 1. Clone repository
git clone https://github.com/your-org/smartneb.git /opt/smartneb
cd /opt/smartneb/backend

# 2. Create staging environment configuration from template
cp .env.staging.example .env.staging

# 3. Edit .env.staging and set strong credentials
nano .env.staging
```

---

## 4. Migration, Bootstrap & Container Launch `[YOU MUST DO THIS]`

```bash
# 1. Execute production database schema migrations
npx prisma migrate deploy

# 2. Create initial SuperAdmin account (interactive prompt)
node scripts/bootstrap-superadmin.js ops.staging@smartneb.health "Super Admin Password 123!" "Lead Staging Admin"

# 3. Launch container stack
bash scripts/deploy-staging.sh
```

---

## 5. Deployed Smoke Test Verification `[YOU MUST DO THIS]`

Run the automated smoke test in **deployed mode** against your live HTTPS staging URL:
```bash
node scripts/smoke-test-api.js https://api.staging.smartneb.health --deployed
```
*Note: Passing `localhost` or `127.0.0.1` to `--deployed` mode will intentionally fail the test.*

---

## 6. Post-Deployment Verification Checklist

| Step # | Verification Item | Manual Verification Command / Action `[YOU MUST DO THIS]` | Expected Result | Status |
| :--- | :--- | :--- | :--- | :---: |
| **CHECK-01** | **API Health Probe** | `curl -i https://api.staging.smartneb.health/health` | Returns `HTTP/1.1 200 OK`, `{"status":"ok"}`. | `[ ] UNTESTED` |
| **CHECK-02** | **Database Readiness Probe** | `curl -i https://api.staging.smartneb.health/ready` | Returns `HTTP/1.1 200 OK`, `{"status":"ready"}`. | `[ ] UNTESTED` |
| **CHECK-03** | **Secure WSS Connection** | Connect mobile app or wscat to `wss://api.staging.smartneb.health` | WebSocket upgrade handshake succeeds over TLS. | `[ ] UNTESTED` |
| **CHECK-04** | **MQTTS Broker Handshake** | `openssl s_client -connect mqtt.staging.smartneb.health:8883 -tls1_3` | Certificate verified; TLS 1.3 session established. | `[ ] UNTESTED` |
| **CHECK-05** | **Database Backup & Restore** | `bash scripts/backup-db.sh && bash scripts/restore-db.sh /opt/smartneb/backups/latest.sql.gz` | Backup completes without error and restores cleanly. | `[ ] UNTESTED` |
