#!/bin/bash
# ==============================================================================
# SmartNeb Managed MySQL Automated Daily Backup Script (TLS Protected)
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/smartneb}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/smartneb_prod_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=30

mkdir -p "${BACKUP_DIR}"

echo "[$(date -u)] Starting Managed MySQL backup via TLS..."

# Enforce TLS and single-transaction dump for transactional consistency
mysqldump \
  --host="${DB_HOST:-127.0.0.1}" \
  --port="${DB_PORT:-3306}" \
  --user="${DB_USER:-smartneb_backup}" \
  --password="${DB_PASSWORD}" \
  --ssl-mode=REQUIRED \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  "${DB_NAME:-smartneb_prod}" | gzip -9 > "${BACKUP_FILE}"

echo "[$(date -u)] Backup created successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Encrypted Off-site Sync to S3 / Cloud Storage (if AWS_S3_BUCKET configured)
if [ -n "${AWS_S3_BUCKET:-}" ]; then
  echo "[$(date -u)] Uploading encrypted backup to s3://${AWS_S3_BUCKET}/backups/..."
  aws s3 cp "${BACKUP_FILE}" "s3://${AWS_S3_BUCKET}/backups/smartneb_prod_${TIMESTAMP}.sql.gz" --sse AES256
  echo "[$(date -u)] Cloud upload verified."
fi

# Rotate backups older than retention period
find "${BACKUP_DIR}" -name "smartneb_prod_*.sql.gz" -mtime +"${RETENTION_DAYS}" -exec rm -f {} +
echo "[$(date -u)] Retained snapshots within ${RETENTION_DAYS} days. Backup complete."
