#!/usr/bin/env bash
# Restart or reconcile NyumatFlix production dependencies when they drift unhealthy.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${NYUMATFLIX_ROOT:-}" ]]; then
  ROOT="$NYUMATFLIX_ROOT"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

GLUETUN_ENV_FILE="${GLUETUN_ENV_FILE:-$HOME/apps/gluetun/.env}"
APP_ENV_FILE="${APP_ENV_FILE:-$HOME/apps/nyumatflix/.env}"
DOCKER_NETWORK="${DOCKER_NETWORK:-betterome}"

exec 9>/run/nyumatflix-infra-watchdog/lock
flock -n 9 || exit 0

# shellcheck disable=SC1091
source "$SCRIPT_DIR/infra-health.sh"

if infra_verify_all_dependencies >/dev/null 2>&1; then
  exit 0
fi

logger -t nyumatflix-infra-watchdog "production dependencies unhealthy; reconciling scrape stack"

NYUMATFLIX_ROOT="$ROOT" APP_ENV_FILE="$APP_ENV_FILE" GLUETUN_ENV_FILE="$GLUETUN_ENV_FILE" \
  "$ROOT/scripts/reconcile-prod-infra.sh" ensure || {
  logger -t nyumatflix-infra-watchdog "reconcile failed; restarting gluetun"
  sudo docker restart gluetun >/dev/null 2>&1 || true
  sleep 12
  infra_ensure_gluetun_vpn || true
}

if infra_verify_all_dependencies >/dev/null 2>&1; then
  logger -t nyumatflix-infra-watchdog "production dependencies recovered"
  exit 0
fi

logger -t nyumatflix-infra-watchdog "production dependencies still unhealthy after reconcile"
exit 1
