# 📖 SmartNeb Managed Cloud Database Backup & Disaster Recovery Runbook

This runbook documents the steps for automated daily backups, managed Cloud MySQL backups (AWS RDS & DigitalOcean), and tested disaster recovery restore procedures.

---

## 1. Provider Automated Backups (AWS RDS & DigitalOcean)

### A. AWS RDS Managed MySQL
1. Open the **AWS RDS Console** -> Select `smartneb-production-db`.
2. Enable **Automated Backups** under *Maintenance & Backups*.
3. Set **Backup Retention Period** to `30 days`.
4. Enable **Point-in-Time Restore (PITR)** to allow restoration to any second within the retention window.

### B. DigitalOcean Managed Database
1. Open **DigitalOcean Cloud Dashboard** -> Databases -> `smartneb-prod-db`.
2. Managed MySQL performs daily automatic snapshots and retains them for 7 days.
3. Enable **Point-in-time recovery (PITR)** under the *Backups* tab.

---

## 2. Automated Daily `mysqldump` Off-Site Backup Script

The production backend includes `backend/scripts/backup-db.sh` for cron execution:

```bash
# Crontab schedule (Runs daily at 02:00 UTC)
0 2 * * * DB_HOST=db-prod.internal DB_USER=smartneb_backup DB_PASSWORD="xxx" AWS_S3_BUCKET=smartneb-backups /usr/local/bin/backup-db.sh >> /var/log/smartneb_backup.log 2>&1
```

---

## 3. Disaster Recovery Restore Procedure (Step-by-Step)

In the event of database corruption or hardware failure, follow these exact steps to restore:

### Step 1: Provision Clean Target Database
```bash
# Provision a fresh MySQL 8.0 instance with TLS enabled
mysql -h <NEW_DB_HOST> -u root -p -e "CREATE DATABASE smartneb_prod CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Step 2: Download & Decrypt Latest Backup Snapshot
```bash
# Download latest snapshot from S3 or backup directory
aws s3 cp s3://smartneb-backups/backups/smartneb_prod_latest.sql.gz ./restore_target.sql.gz

# Decompress backup file
gunzip -k restore_target.sql.gz
```

### Step 3: Execute Database Restore via TLS
```bash
# Import schema and data into clean target database
mysql --host=<NEW_DB_HOST> \
      --port=3306 \
      --user=smartneb_admin \
      --password="<STRONG_PASSWORD>" \
      --ssl-mode=REQUIRED \
      smartneb_prod < restore_target.sql
```

### Step 4: Execute Production Migration Catch-Up
```bash
# Run Prisma migrate deploy to apply any schema updates
cd backend
NODE_ENV=production DATABASE_URL="mysql://smartneb_admin:<STRONG_PASSWORD>@<NEW_DB_HOST>:3306/smartneb_prod?sslaccept=strict" npx prisma migrate deploy
```

### Step 5: Verification & Health Check
```bash
# Run connectivity check script against target database
node backend/scripts/check-connectivity.js
```
