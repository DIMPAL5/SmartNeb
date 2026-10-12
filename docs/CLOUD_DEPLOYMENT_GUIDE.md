# SmartNeb Cloud Deployment & Production Preparation Guide

This runbook guides operators through deploying the SmartNeb IoT Respiratory Platform to production cloud infrastructure.

---

## 1. Architecture Overview

SmartNeb consists of four core tiers:
1. **Mobile Application**: Expo / React Native Android (`.apk` and `.aab`) communicating via REST and WebSockets.
2. **Backend API & Realtime**: Express 5.2.1 + Socket.IO on Node.js.
3. **Database**: Managed MySQL 8.0 accessed via Prisma ORM (5.22.0).
4. **IoT Broker & Hardware**: MQTT Broker with TLS (MQTTS 8883) + ESP32 Smart Nebulizer controllers.

---

## 2. Environment Variables & Secret Handling

Never commit production `.env` files to Git. Copy the provided templates to your cloud hosting dashboard or secure secrets manager.

### Required Backend Environment Variables (`.env.production`)
See [`backend/.env.production.example`](file:///c:/Users/Public/SmartNeb-main/SmartNeb-main/breathe-easy-connect-main/backend/.env.production.example) for the complete reference.

| Variable | Description | Example / Required Format |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment identifier | `production` |
| `PORT` | API listen port | `5000` (or host assigned) |
| `HOST` | Bind address | `0.0.0.0` |
| `ALLOWED_ORIGINS` | Permitted web browser origins | `https://app.smartneb.health` |
| `PUBLIC_API_URL` | Public HTTPS API base URL | `https://api.smartneb.health/api/v1` |
| `PUBLIC_WS_URL` | Public WebSocket endpoint | `wss://api.smartneb.health` |
| `DATABASE_URL` | Managed MySQL connection URL | `mysql://user:pass@host:3306/smartneb_prod?sslaccept=strict` |
| `MQTT_BROKER_URL` | Cloud TLS MQTT broker URL | `mqtts://broker.smartneb.health:8883` |
| `MQTT_USERNAME` | Backend MQTT service client user | Configured in cloud broker ACL |
| `MQTT_PASSWORD` | Backend MQTT service password | Secure password |
| `JWT_SECRET` | 64+ char cryptographically random secret | `node -e "console.log(crypto.randomBytes(32).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | 64+ char cryptographically random secret | Independent random secret |
| `EXPO_ACCESS_TOKEN` | Expo push notification delivery token | Generated from Expo dashboard |
| `GEMINI_API_KEY` | Google Gemini AI assistant key (optional) | AI Studio API key |

---

## 3. Step-by-Step Backend Cloud Deployment

### Option A: Turnkey Cloud Containers (Render / Railway / Fly.io)
1. **Create Web Service**:
   - Connect repository or deploy from Dockerfile (`backend/Dockerfile`).
   - Root directory: `breathe-easy-connect-main/backend`.
   - Build Command: `npm install && npx prisma generate`
   - Start Command: `node server.js`
2. **Environment Variables**:
   - Populate the environment variables from the table above in the provider's Environment settings.
3. **Run Prisma Migrations**:
   - In the cloud service console / release command:
     ```bash
     npx prisma migrate deploy
     ```
4. **Verify Health**:
   - `curl -i https://<your-service-url>/api/v1/health`
   - Must return HTTP 200 OK with `{"status":"healthy","service":"smartneb-backend",...}`.

### Option B: Cloud VM / VPS (AWS Lightsail / DigitalOcean / Hetzner)
1. Clone repository to server.
2. Configure `.env.production` in `backend/`.
3. Launch container stack:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
4. Verify upstream:
   ```bash
   curl -f http://localhost:5000/api/v1/health
   ```

---

## 4. Production MQTT Broker Provisioning

1. **Broker Options**:
   - **Managed**: HiveMQ Cloud, EMQX Cloud, or AWS IoT Core.
   - **Self-Hosted**: Eclipse Mosquitto using `backend/mqtt/mosquitto.conf` with Let's Encrypt TLS certificate.
2. **Port Configuration**:
   - **Port 8883**: TLS 1.3 MQTTS (for ESP32 and Backend).
   - **Port 8084 / 443**: WSS (for web WebSocket fallbacks).
3. **Access Control**:
   - Ensure backend client has full publish/subscribe permission on `hospitals/#`.
   - Per-device credentials provisioned via `POST /api/v1/devices/:id/provision-credentials` allow restricted publishing on `hospitals/{hospitalId}/devices/{deviceCode}/#`.

---

## 5. ESP32 Firmware Preparation

1. **Configuration**:
   - Copy [`firmware/config.h.example`](file:///c:/Users/Public/SmartNeb-main/SmartNeb-main/firmware/config.h.example) to `firmware/config.h`.
   - Set `MQTT_HOST` to your cloud broker domain.
   - Set `MQTT_PORT` to `8883`.
   - Provision per-device credentials from the backend API:
     ```bash
     curl -X POST https://api.smartneb.health/api/v1/devices/<DEVICE_ID>/provision-credentials \
       -H "Authorization: Bearer <ADMIN_TOKEN>"
     ```
   - Copy the generated `mqttUsername` and `mqttPassword` into `config.h`.
2. **Compile and Flash**:
   ```bash
   cd firmware
   pio run --target upload
   ```

---

## 6. Mobile Application Cloud Build (Expo / EAS)

1. **Verify Environment**:
   ```bash
   cd breathe-easy-connect-main/mobile
   node scripts/check-env.js
   ```
   Must pass with: `✅ PRODUCTION BUILD VERIFIED: Production API_BASE_URL uses valid HTTPS cloud endpoint.`

2. **Trigger Standalone APK Build (Internal Testing)**:
   ```bash
   eas build --profile preview --platform android
   ```
   The generated `.apk` will connect directly to the cloud backend over HTTPS from any mobile network (Wi-Fi or cellular).

3. **Trigger Production App Bundle Build (Google Play Submission)**:
   ```bash
   eas build --profile production --platform android
   ```
   Generates a signed `.aab` file ready for the Google Play Console.
