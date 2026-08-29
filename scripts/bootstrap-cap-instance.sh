#!/usr/bin/env bash
# Bootstrap one Cap Standalone instance without printing generated credentials.
# Usage: bootstrap-cap-instance.sh ENV_FILE INTERNAL_BASE_URL PUBLIC_BASE_URL CORS_ORIGINS

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${1:?environment file is required}"
INTERNAL_BASE_URL="${2:?internal base URL is required}"
PUBLIC_BASE_URL="${3:?public base URL is required}"
CORS_ORIGINS="${4:?CORS origins are required}"
PORT="${CAP_PORT:-3030}"

read_env_value() {
  local file="$1" key="$2"
  awk -v key="$key" '
    index($0, key "=") == 1 { value = substr($0, length(key) + 2); found = 1 }
    END { if (found) print value }
  ' "$file"
}

upsert_env_var() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp "${file}.tmp.XXXXXX")"
  awk -v key="$key" -v value="$value" '
    index($0, key "=") == 1 {
      if (!written) print key "=" value
      written = 1
      next
    }
    { print }
    END { if (!written) print key "=" value }
  ' "$file" >"$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$file"
}

mkdir -p "$(dirname "$ENV_FILE")"
touch "$ENV_FILE"
chmod 600 "$ENV_FILE"

admin_key="$(read_env_value "$ENV_FILE" CAP_ADMIN_KEY || true)"
session_secret="$(read_env_value "$ENV_FILE" CAP_SESSION_SECRET || true)"
[[ -n "$admin_key" ]] || admin_key="$(openssl rand -base64 48 | tr -d '\n')"
[[ -n "$session_secret" ]] || session_secret="$(openssl rand -hex 32)"

upsert_env_var "$ENV_FILE" CAP_ADMIN_KEY "$admin_key"
upsert_env_var "$ENV_FILE" CAP_SESSION_SECRET "$session_secret"
upsert_env_var "$ENV_FILE" CAP_CORS_ORIGIN "$CORS_ORIGINS"
upsert_env_var "$ENV_FILE" CAP_PORT "$PORT"

CAP_ENV_FILE="$ENV_FILE" "$SCRIPT_DIR/reconcile-cap.sh" ensure >/dev/null

for _ in $(seq 1 30); do
  curl -fsS --max-time 3 "$INTERNAL_BASE_URL/" >/dev/null 2>&1 && break
  sleep 1
done
curl -fsS --max-time 3 "$INTERNAL_BASE_URL/" >/dev/null

site_endpoint="$(read_env_value "$ENV_FILE" CAP_API_ENDPOINT || true)"
secret_key="$(read_env_value "$ENV_FILE" CAP_SECRET_KEY || true)"
if [[ -z "$site_endpoint" || -z "$secret_key" ]]; then
  login_response="$({ printf '{"admin_key":"%s"}' "$admin_key"; } | \
    curl -fsS --max-time 10 -H 'Content-Type: application/json' \
      --data-binary @- "$INTERNAL_BASE_URL/auth/login")"
  auth_token="$(printf '%s' "$login_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["session_token"])')"
  auth_hash="$(printf '%s' "$login_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["hashed_token"])')"
  auth_header="$(printf '{"token":"%s","hash":"%s"}' "$auth_token" "$auth_hash" | openssl base64 -A)"

  cors_json="$(printf '%s' "$CORS_ORIGINS" | python3 -c 'import json,sys; print(json.dumps([v.strip() for v in sys.stdin.read().split(",") if v.strip()]))')"
  key_response="$({ printf '{"name":"NyumatFlix","instrumentation":true,"corsOrigins":%s}' "$cors_json"; } | \
    curl -fsS --max-time 10 -H "Authorization: Bearer $auth_header" \
      -H 'Content-Type: application/json' --data-binary @- \
      "$INTERNAL_BASE_URL/server/keys")"
  site_key="$(printf '%s' "$key_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["siteKey"])')"
  secret_key="$(printf '%s' "$key_response" | python3 -c 'import json,sys; print(json.load(sys.stdin)["secretKey"])')"
  upsert_env_var "$ENV_FILE" CAP_SECRET_KEY "$secret_key"
else
  site_key="$(printf '%s' "$site_endpoint" | python3 -c 'import sys; print(sys.stdin.read().rstrip("/").rsplit("/", 1)[-1])')"
fi
site_endpoint="${PUBLIC_BASE_URL%/}/${site_key}/"
upsert_env_var "$ENV_FILE" CAP_API_ENDPOINT "$site_endpoint"

unset admin_key session_secret secret_key login_response auth_token auth_hash auth_header key_response
echo "Cap instance ready at ${PUBLIC_BASE_URL%/}"
