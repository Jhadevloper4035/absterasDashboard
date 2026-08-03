#!/usr/bin/env sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
ARCHIVE="${1:-}"
MONGODB_URI="${MONGODB_URI:-$(awk '/^MONGODB_URI=/{sub(/^MONGODB_URI=/,""); print; exit}' "$ROOT_DIR/.env" 2>/dev/null || true)}"

if [ -z "$ARCHIVE" ]; then
  echo "Usage: scripts/restore-mongodb.sh backups/mongodb-YYYYMMDD-HHMMSS.archive.gz" >&2
  exit 1
fi

if [ -z "$MONGODB_URI" ]; then
  echo "MONGODB_URI is required in environment or root .env" >&2
  exit 1
fi

mongorestore --uri="$MONGODB_URI" --archive="$ARCHIVE" --gzip
