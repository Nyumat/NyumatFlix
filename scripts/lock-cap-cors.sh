#!/usr/bin/env bash
# Lock Cap site-key CORS to NyumatFlix origins only.
# Usage: lock-cap-cors.sh [ENV_FILE]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${1:-${CAP_ENV_FILE:-$HOME/apps/nyumatflix/.env}}"
CORS_ORIGINS="${CAP_CORS_ORIGINS:-https://nyumatflix.com,https://www.nyumatflix.com}"
INTERNAL_BASE_URL="${CAP_INTERNAL_BASE_URL:-http://127.0.0.1:3030}"

"$SCRIPT_DIR/update-cap-key-cors.sh" "$ENV_FILE" "$INTERNAL_BASE_URL" "$CORS_ORIGINS"
echo "Cap CORS locked to: $CORS_ORIGINS"
