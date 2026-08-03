#!/usr/bin/env bash
# Update an existing Cap site key's origin allowlist without printing secrets.
# Usage: update-cap-key-cors.sh ENV_FILE INTERNAL_BASE_URL CORS_ORIGINS

set -euo pipefail

ENV_FILE="${1:?environment file is required}"
INTERNAL_BASE_URL="${2:?internal base URL is required}"
CORS_ORIGINS="${3:?CORS origins are required}"

read_env_value() {
  local file="$1" key="$2"
  awk -v key="$key" '
    index($0, key "=") == 1 { value = substr($0, length(key) + 2); found = 1 }
    END { if (found) print value }
  ' "$file"
}

admin_key="$(read_env_value "$ENV_FILE" CAP_ADMIN_KEY)"
endpoint="$(read_env_value "$ENV_FILE" CAP_API_ENDPOINT)"
site_key="$(printf '%s' "$endpoint" | python3 -c 'import sys; print(sys.stdin.read().rstrip("/").rsplit("/", 1)[-1])')"

login_response="$({ printf '{"admin_key":"%s"}' "$admin_key"; } | \
  curl -fsS --max-time 10 -H 'Content-Type: application/json' \
    --data-binary @- "$INTERNAL_BASE_URL/auth/login")"
auth_token="$(printf '%s' "$login_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["session_token"])')"
auth_hash="$(printf '%s' "$login_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["hashed_token"])')"
auth_header="$(printf '{"token":"%s","hash":"%s"}' "$auth_token" "$auth_hash" | openssl base64 -A)"
cors_json="$(printf '%s' "$CORS_ORIGINS" | python3 -c 'import json,sys; print(json.dumps([v.strip() for v in sys.stdin.read().split(",") if v.strip()]))')"

{ printf '{"corsOrigins":%s}' "$cors_json"; } | \
  curl -fsS --max-time 10 -H "Authorization: Bearer $auth_header" \
    -H 'Content-Type: application/json' --data-binary @- \
    -X PUT "$INTERNAL_BASE_URL/server/keys/$site_key/config" >/dev/null

unset admin_key endpoint site_key login_response auth_token auth_hash auth_header
echo "Cap site-key CORS origins updated"
