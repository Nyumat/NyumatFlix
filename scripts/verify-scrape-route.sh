#!/usr/bin/env bash
# Verify /api/scrape boots and returns provider metadata (catches Playwright import regressions).
#
# Usage:
#   ./scripts/verify-scrape-route.sh --container nyumatflix-preview-local
#   ./scripts/verify-scrape-route.sh --url http://127.0.0.1:9080
#   ./scripts/verify-scrape-route.sh --container nyumatflix --port 8080

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${NYUMATFLIX_ROOT:-}" ]]; then
  ROOT="$NYUMATFLIX_ROOT"
elif [[ "$(basename "$SCRIPT_DIR")" == "scripts" ]]; then
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
  ROOT="$SCRIPT_DIR"
fi

# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-lib.sh"

CONTAINER=""
BASE_URL=""
PORT="${CONTAINER_APP_PORT:-8080}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --container)
      CONTAINER="${2:-}"
      shift 2
      ;;
    --url)
      BASE_URL="${2:-}"
      shift 2
      ;;
    --port)
      PORT="${2:-}"
      shift 2
      ;;
    -h | --help)
      echo "usage: $0 --container NAME | --url BASE_URL [--port PORT]" >&2
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -n "$CONTAINER" ]]; then
  verify_scrape_api_route "$CONTAINER" "$PORT"
elif [[ -n "$BASE_URL" ]]; then
  verify_scrape_api_route "" "" "$BASE_URL"
else
  echo "usage: $0 --container NAME | --url BASE_URL [--port PORT]" >&2
  exit 1
fi
