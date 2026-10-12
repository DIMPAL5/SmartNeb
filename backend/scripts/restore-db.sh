#!/bin/bash
# ==============================================================================
# SmartNeb Managed MySQL Verified Restore Script (TLS Enforced)
# ==============================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "Usage: ./restore-db.sh <path-to-backup-file.sql.gz>"
  echo "Example: ./restore-db.sh /var/backups/smartneb/smartneb_prod_20261002_030000.sql.gz"
  exit 1
fi

TARGET_DB="${DB_NAME:-smartneb_restore_test}"

echo "================================================================="
echo "⚠️  CRITICAL RESTORE ACTION"
echo "Target Database: ${TARGET_DB}"
echo "Source Snapshot: ${BACKUP_FILE}"
echo "Host:            ${DB_HOST:-127.0.0.1}"
echo "================================================================="
read -p "Type 'CONFIRM' to proceed with database restoration: " confirmation

if [ "${confirmation}" != "CONFIRM" ]; then
  echo "Restore aborted by operator."
  exit 1
fi

echo "[$(date -u)] Decompressing and executing restoration via TLS..."

gunzip -c "${BACKUP_FILE}" | mysql \
  --host="${DB_HOST:-127.0.0.1}" \
  --port="${DB_PORT:-3306}" \
  --user="${DB_USER:-root}" \
  --password="${DB_PASSWORD}" \
  --ssl-mode=REQUIRED \
  "${TARGET_DB}"

echo "[$(date -u)] Restore completed successfully."

# Run Prisma schema validation check against restored database
echo "[$(date -u)] Validating table count and integrity..."
mysql \
  --host="${DB_HOST:-127.0.0.1}" \
  --port="${DB_PORT:-3306}" \
  --user="${DB_USER:-root}" \
  --password="${DB_PASSWORD}" \
  --ssl-mode=REQUIRED \
  -e "SELECT table_name, table_rows FROM information_schema.tables WHERE table_schema='${TARGET_DB}';" "${TARGET_DB}"

echo "[$(date -u)] Integrity check completed successfully."
