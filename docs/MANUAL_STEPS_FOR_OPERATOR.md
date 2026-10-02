# Operator Manual: Cloud Deployment, Play Store Launch & Hospital Onboarding

**Guide Classification:** Production Operator & Administrator Manual  
**Author:** SmartNeb Engineering  
**Version:** 1.0 (Production Release)  

> [!IMPORTANT]
> Every section is explicitly marked with **`[AGENT DID THIS]`** (automated codebase changes, configuration files, and scripts) or **`[YOU MUST DO THIS]`** (manual actions requiring your credit card, domain registrar, government ID, or server access).

---

## 1. Domain Registration & Cloud Infrastructure Setup

### Step 1.1: Register a Domain Name `[YOU MUST DO THIS]`
1. Visit a domain registrar (e.g., [Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) or [Namecheap](https://www.namecheap.com)).
2. Purchase your production domain (e.g., `smartneb.health` or `smartneb.io`).
3. Set your nameservers to Cloudflare (Free plan provides DDoS protection, SSL termination, and WebSocket proxying).

### Step 1.2: Provision a Cloud Virtual Server (VPS) `[YOU MUST DO THIS]`
1. Create an account on [Hetzner](https://www.hetzner.com/cloud), [DigitalOcean](https://www.digitalocean.com), or [AWS Lightsail](https://aws.amazon.com/lightsail/).
2. Deploy an **Ubuntu 24.04 LTS** instance:
   - **Recommended Specs:** 2 vCPU, 4 GB RAM, 80 GB SSD (e.g., Hetzner CPX21 ~€7/mo or DigitalOcean Droplet ~$24/mo).
3. Record the Public IPv4 address (e.g., `203.0.113.50`).

### Step 1.3: Configure DNS Records in Cloudflare `[YOU MUST DO THIS]`
Add the following `A` and `CNAME` records pointing to your server IP:
- `A` record: `api.smartneb.health` -> `203.0.113.50` (Proxy status: Proxied or DNS-only for Certbot).
- `A` record: `app.smartneb.health` -> `203.0.113.50` (Web portal).
- `A` record: `mqtt.smartneb.health` -> `203.0.113.50` (DNS-only; MQTT on port 8883 bypasses HTTP proxy).

### Step 1.4: Server Environment & TLS Setup `[YOU MUST DO THIS]`
SSH into your server and run:
```bash
# Update and install Docker + Nginx + Certbot
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx

# Obtain Let's Encrypt TLS certificates
sudo certbot certonly --nginx -d api.smartneb.health -d app.smartneb.health -d mqtt.smartneb.health
```

### Step 1.5: Production Deployment Files `[AGENT DID THIS]`
The agent has prepared all server configuration files ready in the repository:
- `backend/Dockerfile`: Multi-stage build running as non-root user `smartneb` with dumb-init.
- `backend/nginx/smartneb.conf`: Nginx configuration with TLS 1.3, HSTS, rate-limiting, and WebSocket upgrade headers.
- `backend/ecosystem.config.js`: PM2 cluster file for auto-restart on memory limits.
- `backend/mqtt/acl.conf`: EMQX topic access-control list isolating hospital telemetry topics.

---

## 2. Server Bootstrap & First Hospital Onboarding

### Step 2.1: Populate Production Environment Variables `[YOU MUST DO THIS]`
Create `/opt/smartneb/backend/.env` on your production server:
```ini
NODE_ENV=production
PORT=5000
DATABASE_URL="mysql://smartneb_prod_user:StrongRandomDbPass123!@127.0.0.1:3306/smartneb_production?sslmode=require"
JWT_SECRET="GenerateWith: openssl rand -base64 48"
JWT_REFRESH_SECRET="GenerateWith: openssl rand -base64 48"
MQTT_BROKER_URL="tls://mqtt.smartneb.health:8883"
MQTT_USERNAME="backend_service_worker"
MQTT_PASSWORD="SuperSecretMqttPassword2026!"
GEMINI_API_KEY="Your-Google-AI-Studio-Production-Key"
```

### Step 2.2: Run Database Migrations `[YOU MUST DO THIS]`
```bash
cd /opt/smartneb/backend
npx prisma migrate deploy
```

### Step 2.3: Create SUPER_ADMIN Account (One-Time Bootstrap) `[YOU MUST DO THIS]`
Run the interactive bootstrap script implemented by the agent:
```bash
node scripts/bootstrap-superadmin.js
```
- **Prompt:** `Enter SuperAdmin Email: ops@smartneb.health`
- **Prompt:** `Enter SuperAdmin Full Name: Lead Operations Admin`
- **Prompt:** `Enter Strong SuperAdmin Password (min 12 chars, upper/lower/digit/symbol): [HIDDEN]`
- **Result:** Account created with `role: "super_admin"`. Default seed credentials remain disabled.

### Step 2.4: Onboard the First Hospital `[YOU MUST DO THIS]`
1. Log in to the web management portal (`https://app.smartneb.health`) using your SuperAdmin credentials.
2. In the Admin Dashboard under **Hospital Approvals**:
   - Locate the hospital registration or click **Register New Hospital**.
   - Input Hospital Name: `Apollo Children's Hospital`, Head Clinician: `Dr. Ramesh Gupta`.
   - Click **Approve Organization** (`PUT /api/v1/admin/hospitals/:id/approve`).
3. Generate Clinician Single-Use Invite Codes:
   - Click **Generate Staff Invites**.
   - Issue invite code (e.g., `INV-APOLLO-98214`) to Dr. Ramesh Gupta.
4. Dr. Gupta signs up at `https://app.smartneb.health/signup` or via the mobile app using the invite code.
5. In Dr. Gupta's clinician console:
   - Click **Admit Patient** -> Create patient profile for `Aarav Sharma` (Age: 6, Guardian: `Pooja Sharma`).
   - Click **Provision Device** -> Link Device Serial `SN-NEB-2026-0042` to Aarav.

---

## 3. Google Play Console Account & Verification

### Step 3.1: Developer Account Registration `[YOU MUST DO THIS]`
1. Navigate to [Google Play Console](https://play.google.com/console/signup).
2. Sign in with your dedicated business Google account.
3. Pay the **one-time registration fee of $25 USD**.
4. **Mandatory Identity Verification:**
   - Provide legal entity name or individual name matching official documentation.
   - Upload Government ID (Passport, Driver's License, or Voter ID).
   - Upload Proof of Address (Utility bill or bank statement within 90 days).
   - If registering as an Organization, provide an active **D-U-N-S Number** (Dun & Bradstreet).
   - Official Policy Reference: [Google Play Developer Identity Verification](https://support.google.com/googleplay/android-developer/answer/10841244).

---

## 4. Google Play Closed Testing (20 Testers / 14 Days)

> [!IMPORTANT]
> Under Google Play policy enacted for personal developer accounts created after November 13, 2023, you **cannot** publish to production until you complete closed testing with at least **20 testers opted in for at least 14 consecutive days**.

### Step 4.1: Recruitment & Setup Plan `[YOU MUST DO THIS]`
1. **Recruit 25 Testers** (aim for 25 to allow for dropouts):
   - Internal staff, clinical colleagues, biomedical engineers, and family members with Android devices.
   - Collect their Google Play email addresses.
2. Create a Google Group:
   - Go to [Google Groups](https://groups.google.com) and create `smartneb-closed-testers@googlegroups.com`.
   - Add all 25 emails as members.
3. Configure Closed Test Track in Play Console:
   - Go to **Release** > **Testing** > **Closed testing**.
   - Click **Create track** > Name: `Closed Alpha`.
   - Under **Testers**, select Google Groups and enter `smartneb-closed-testers@googlegroups.com`.
   - Copy the **Opt-in URL** (e.g., `https://play.google.com/apps/testing/health.smartneb.app`).

### Step 4.2: Build and Upload Android App Bundle (.aab) `[YOU MUST DO THIS]`
1. In the `mobile/` directory, execute:
   ```bash
   npx eas build -p android --profile production
   ```
2. Download the signed `.aab` file from Expo/EAS dashboard.
3. In Play Console:
   - Click **Create new release** in your Closed Testing track.
   - Upload the `.aab`.
   - Release Name: `1.0.0 (Build 1)`.
   - Release Notes: `Initial closed pilot release for SmartNeb pediatric nebulizer monitoring.`
   - Review and rollout release to Closed Testing.

### Step 4.3: Running the 14-Day Test `[YOU MUST DO THIS]`
1. Send an email to all testers with instructions:
   - "Click the Opt-in URL, click 'Become a Tester', then download the app from Google Play."
2. **Crucial Rule:** All 20 testers must keep the app installed and check it periodically over 14 uninterrupted days.
3. On Day 15:
   - In Google Play Console, go to **Dashboard**.
   - The button **Apply for production access** will become active.
   - Fill out Google's questionnaire describing how you gathered feedback (e.g., "Tested telemetry ingestion, error recovery when Wi-Fi drops, and parent vitals readability").

---

## 5. Play Console Store Forms & Declarations

### Step 5.1: Data Safety Form Answer Sheet `[YOU MUST DO THIS]`
Fill in the Play Console **App Content > Data safety** section with these verified answers:

| Data Type | Collected? | Shared? | Purpose | Encrypted in Transit? | Ephemeral / Optional? |
| :--- | :---: | :---: | :--- | :---: | :---: |
| **Health Info (SpO2, Pulse, Respiratory Rate)** | **Yes** | **No** | App functionality, Clinical care | **Yes (HTTPS / TLS 1.3)** | Required for care |
| **Personal Info (Name, Email)** | **Yes** | **No** | Account management | **Yes** | Required |
| **User IDs (Patient ID, Hospital ID)** | **Yes** | **No** | Account management | **Yes** | Required |
| **Device Identifiers (ESP32 MAC, Serial)** | **Yes** | **No** | Device pairing & telemetry | **Yes** | Required |
| **Crash Logs & Performance Diagnostics** | **Yes** | **No** | App health & stability | **Yes** | Ephemeral, no PHI |
| **Precise Location** | **No** | **No** | N/A (Not collected) | N/A | N/A |
| **Microphone / Camera / Photos** | **No** | **No** | N/A (Not collected) | N/A | N/A |

- **Account Deletion Link:** Provide the live public URL: `https://app.smartneb.health/delete-account` `[AGENT DID THIS]`.
- **Privacy Policy Link:** Provide the live public URL: `https://app.smartneb.health/privacy` `[AGENT DID THIS]`.

### Step 5.2: Health Apps Declaration `[YOU MUST DO THIS]`
In Play Console **App Content > Health apps**:
1. Category: Select **"Health management and medical monitoring"**.
2. Medical Device Status: Select **"This app connects to an external device but is currently intended as a secondary monitoring and informational aid."**
3. Verify that your app does not claim to make standalone clinical diagnoses or triage emergencies without clinician oversight.

### Step 5.3: Permissions Audit `[AGENT DID THIS]`
The Android manifest has been audited to eliminate all non-essential permissions:
- Retained: `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`.
- Excluded: `ACCESS_FINE_LOCATION`, `CAMERA`, `RECORD_AUDIO`, `READ_EXTERNAL_STORAGE`.

---

## 6. Play Store Listing Copy `[YOU MUST DO THIS]`

Copy and paste these verified texts into your Store Listing:

- **App Title:** SmartNeb: Connected Nebulizer  
- **Short Description (80 chars max):**  
  *Pediatric smart nebulizer companion for treatment tracking & SpO2 monitoring.*
- **Full Description:**  
  *SmartNeb is a connected pediatric respiratory care platform designed to support families and clinicians during nebulization therapy.*  
  *Key Capabilities:*  
  *• Real-time SpO2 and pulse rate monitoring during treatment sessions.*  
  *• Treatment logging and automated session history for pediatricians.*  
  *• Clinician care plans and medication adherence insights.*  
  *• Secure, hospital-grade encrypted cloud connectivity.*  
  *Important Medical Disclaimer:*  
  *SmartNeb is an informational monitoring aid designed to assist caregivers and healthcare providers. It is not an automated diagnostic device or a replacement for emergency medical care. Always follow the direct instructions of your licensed physician in case of respiratory distress.*
