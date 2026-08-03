#!/usr/bin/env bash
# Copy only Cap-managed keys between ignored environment files.
# Usage: import-cap-env.sh SOURCE_ENV TARGET_ENV

set -euo pipefail
umask 077

SOURCE_ENV="${1:?source environment file is required}"
TARGET_ENV="${2:?target environment file is required}"

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

touch "$TARGET_ENV"
for key in CAP_API_ENDPOINT CAP_SECRET_KEY CAP_SESSION_SECRET CAP_ADMIN_KEY CAP_CORS_ORIGIN CAP_PORT; do
  value="$(read_env_value "$SOURCE_ENV" "$key")"
  [[ -n "$value" ]] || { echo "missing $key in source environment" >&2; exit 1; }
  upsert_env_var "$TARGET_ENV" "$key" "$value"
done

echo "Cap environment imported into $TARGET_ENV"
