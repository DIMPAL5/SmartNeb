# Operations Runbook: SmartNeb Production Management & Incident Response

**Audience:** Site Reliability Engineers (SRE), Cloud Operations, System Administrators  
**Classification:** Operational Runbook  
**Last Revised:** October 2026  

---

## 1. Zero-Downtime Deployment Procedure

### Standard Software Update
```bash
# 1. Connect to production host
ssh deploy@api.smartneb.health

# 2. Pull validated production git release
cd /opt/smartneb
git fetch --tags
git checkout tags/v1.0.1

# 3. Apply schema migrations safely
cd backend
npx prisma migrate deploy

# 4. Reload PM2 cluster in rolling mode (zero dropped requests)
pm2 reload ecosystem.config.js --update-env

# 5. Verify live health probes
curl -f https://api.smartneb.health/health
curl -f https://api.smartneb.health/ready
```

---

## 2. Emergency Rollback Procedure

If a newly deployed release triggers elevated 5xx error rates or unhandled exceptions:
```bash
# 1. Rollback PM2 cluster to previous known stable tag
cd /opt/smartneb
git checkout tags/v1.0.0
cd backend
npm install --omit=dev
pm2 reload ecosystem.config.js --update-env

# 2. Database Schema Consideration
# If a migration added non-destructive columns, DO NOT revert schema immediately.
# If a destructive migration occurred, restore from the pre-deployment snapshot:
bash scripts/restore-db.sh /opt/smartneb/backups/smartneb_backup_pre_deploy.sql.gz
```

---

## 3. Database Backup & Disaster Recovery

### Automated Daily Snapshots
Managed backups run daily at 02:00 UTC via system cron:
```cron
0 2 * * * /opt/smartneb/backend/scripts/backup-db.sh >> /var/log/smartneb_backup.log 2>&1
```
- **Storage Location:** `/opt/smartneb/backups/smartneb_db_YYYYMMDD_HHMMSS.sql.gz`
- **Retention Policy:** Kept locally for 14 days, synced to encrypted offsite Amazon S3 / Cloudflare R2 bucket with 30-day lifecycle.

### Manual Backup On-Demand
```bash
cd /opt/smartneb/backend
bash scripts/backup-db.sh
```

### Tested Database Restoration
To restore a backup into a fresh or recovered database:
```bash
cd /opt/smartneb/backend
bash scripts/restore-db.sh /opt/smartneb/backups/smartneb_db_20261002_020000.sql.gz
```

---

## 4. Zero-Downtime Secret & Credential Rotation

### 4.1 Rotating JWT Authentication Secrets
To rotate `JWT_SECRET` without logging out active mobile users:
1. Update `server.js` to accept an array of valid verification secrets (`[NEW_SECRET, OLD_SECRET]`), but sign new tokens using `NEW_SECRET`.
2. Deploy the update.
3. Allow 24 hours for active access tokens to expire naturally and be refreshed under `NEW_SECRET`.
4. Remove `OLD_SECRET` from `.env` and reload the cluster.

### 4.2 Rotating MQTT Broker Passwords
1. Add the new credential set to EMQX/Mosquitto authentication database.
2. Update `MQTT_PASSWORD` in `backend/.env`.
3. Perform a graceful rolling restart of PM2 (`pm2 reload ecosystem.config.js`). The existing MQTT connection remains active until the worker restarts and connects with the new password.
4. Revoke the old MQTT user credential in the broker.

---

## 5. Tenant Administration: Onboarding & Suspension

### 5.1 Onboarding a New Hospital
1. Clinician submits registration request via Web portal.
2. SuperAdmin checks credential authenticity (State Medical Council registration of Medical Superintendent).
3. SuperAdmin approves hospital via API or Web UI:
   ```bash
   curl -X PUT https://api.smartneb.health/api/v1/admin/hospitals/12/approve \
     -H "Authorization: Bearer $SUPERADMIN_TOKEN"
   ```
4. Generate single-use invitation tokens for clinical staff:
   ```bash
   curl -X POST https://api.smartneb.health/api/v1/admin/hospitals/12/invites \
     -H "Authorization: Bearer $SUPERADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"role": "doctor"}'
   ```

### 5.2 Emergency Tenant Suspension (Compromised Hospital / Security Incident)
If a clinic is compromised or payment/contract terminates:
```bash
curl -X PUT https://api.smartneb.health/api/v1/admin/hospitals/12/suspend \
  -H "Authorization: Bearer $SUPERADMIN_TOKEN"
```
- **System Impact:**
  - All clinicians belonging to Hospital ID 12 are instantly blocked on their next API request (`403 Forbidden`).
  - Active Socket.IO real-time channels are disconnected.
  - Devices provisioned under Hospital 12 reject incoming command dispatches.
  - Patient data remains preserved in database for legal audit trails.

---

## 6. Incident Triage & Emergency Playbooks

### Incident A: Server Returns 502 Bad Gateway / Offline Probes
1. Check Nginx reverse proxy status:
   `sudo systemctl status nginx`
2. Inspect PM2 process health:
   `pm2 status`
3. View backend error logs:
   `pm2 logs --err --lines 50`
4. Inspect memory consumption (detect OOM crashes):
   `free -h && top -b -n 1 | head -n 20`
5. Restart cluster if frozen:
   `pm2 restart ecosystem.config.js`

### Incident B: MQTT Broker Disconnect / Telemetry Stalled
1. Check MQTT broker daemon status:
   `sudo systemctl status emqx` (or `sudo docker ps | grep emqx`)
2. Backend logs will show: `MQTT Broker Warning/Reconnecting`. The backend will automatically attempt reconnection with backoff.
3. Test broker TLS port 8883 accessibility:
   `openssl s_client -connect 127.0.0.1:8883 -tls1_3`
4. If broker crashed due to disk space exhaustion (message store filled):
   - Purge stale offline message queues: `emqx ctl retainers clean`
   - Restart broker: `sudo systemctl restart emqx`
