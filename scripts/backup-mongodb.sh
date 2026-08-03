#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$ROOT_DIR/backups}"
MONGODB_URI="${MONGODB_URI:-$(awk '/^MONGODB_URI=/{sub(/^MONGODB_URI=/,""); print; exit}' "$ROOT_DIR/.env" 2>/dev/null || true)}"

if [ -z "$MONGODB_URI" ]; then
  echo "MONGODB_URI is required in environment or root .env" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/mongodb-$(date -u +%Y%m%d-%H%M%S).archive.gz"

mongodump --uri="$MONGODB_URI" --archive="$OUT" --gzip
echo "$OUT"
