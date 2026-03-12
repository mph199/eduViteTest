#!/usr/bin/env bash
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# ── Resolve docker compose project name ────────────────────────
COMPOSE_CMD="docker compose"
if [ -n "$COMPOSE_PROJECT" ]; then
  COMPOSE_CMD="docker compose -p $COMPOSE_PROJECT"
fi

# ── Create backup directory ────────────────────────────────────
mkdir -p "$BACKUP_DIR"

echo "[$TIMESTAMP] Starting backup…"

# ── 1. Database dump ──────────────────────────────────────────
DB_FILE="$BACKUP_DIR/db_${TIMESTAMP}.sql.gz"
echo "  Dumping database…"
$COMPOSE_CMD exec -T postgres pg_dump -U "${POSTGRES_USER:-sprechtag}" "${POSTGRES_DB:-sprechtag}" \
  | gzip > "$DB_FILE"
echo "  → $DB_FILE ($(du -h "$DB_FILE" | cut -f1))"

# ── 2. Uploads volume ─────────────────────────────────────────
UPLOADS_FILE="$BACKUP_DIR/uploads_${TIMESTAMP}.tar.gz"
echo "  Backing up uploads…"
$COMPOSE_CMD exec -T backend tar czf - -C /app uploads 2>/dev/null > "$UPLOADS_FILE" || true

if [ -s "$UPLOADS_FILE" ]; then
  echo "  → $UPLOADS_FILE ($(du -h "$UPLOADS_FILE" | cut -f1))"
else
  rm -f "$UPLOADS_FILE"
  echo "  → No uploads to back up"
fi

# ── 3. Cleanup old backups ─────────────────────────────────────
DELETED=$(find "$BACKUP_DIR" -name "db_*.sql.gz" -o -name "uploads_*.tar.gz" | \
  while read f; do
    if [ "$(find "$f" -mtime +$RETENTION_DAYS)" ]; then
      rm -f "$f"
      echo "$f"
    fi
  done | wc -l)

if [ "$DELETED" -gt 0 ]; then
  echo "  Cleaned up $DELETED backup(s) older than $RETENTION_DAYS days"
fi

echo "[$TIMESTAMP] Backup complete."
