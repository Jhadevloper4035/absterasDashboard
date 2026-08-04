#!/usr/bin/env sh
set -eu

URL="${CRM_HEALTH_URL:-https://127.0.0.1/health}"
BODY="$(curl -kfsS --max-time 5 "$URL")"

echo "$BODY" | grep -q '"status":"ok"'
echo "$BODY"
