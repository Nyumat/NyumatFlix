#!/usr/bin/env bash
# Push repo .env.prod managed keys to the NyumatFlix production runtime env.
# Usage: ./scripts/sync-prod-env.sh push

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSH_HOST="${SSH_HOST:-leetbot}"
REMOTE_DIR="${REMOTE_APP_DIR:-apps/nyumatflix}"
SEED_ENV_FILE="${SEED_ENV_FILE:-$ROOT/.env.prod}"
MANAGED_KEYS_FILE="${MANAGED_KEYS_FILE:-$SCRIPT_DIR/prod-env-managed-keys.txt}"

die() {
  echo "sync-prod-env: $*" >&2
  exit 1
}

push_env() {
  [[ -f "$SEED_ENV_FILE" ]] || die "seed env file missing: $SEED_ENV_FILE"
  [[ -f "$MANAGED_KEYS_FILE" ]] || die "managed keys file missing: $MANAGED_KEYS_FILE"

  echo "syncing managed env keys to ${SSH_HOST}:~/${REMOTE_DIR}/.env"

  ssh "$SSH_HOST" "mkdir -p \"\$HOME/${REMOTE_DIR}/infra\" \"\$HOME/${REMOTE_DIR}/scripts\""
  rsync -avz "$SEED_ENV_FILE" "${SSH_HOST}:~/${REMOTE_DIR}/.env.prod"
  rsync -avz \
    "$ROOT/infra/docker-compose.scrape.yml" \
    "$ROOT/infra/docker-compose.ffs.yml" \
    "$ROOT/infra/docker-compose.imgproxy.yml" \
    "$ROOT/infra/docker-compose.cap.yml" \
    "$ROOT/infra/docker-compose.crowdsec.yml" \
    "${SSH_HOST}:~/${REMOTE_DIR}/infra/"
  rsync -avz \
    "$ROOT/scripts/crowdsec/" \
    "${SSH_HOST}:~/${REMOTE_DIR}/scripts/crowdsec/"
  rsync -avz \
    "$MANAGED_KEYS_FILE" \
    "$ROOT/scripts/reconcile-prod-infra.sh" \
    "$ROOT/scripts/infra-health.sh" \
    "$ROOT/scripts/nyumatflix-infra-watchdog.sh" \
    "$ROOT/scripts/nyumatflix-infra-watchdog.service" \
    "$ROOT/scripts/nyumatflix-infra-watchdog.timer" \
    "$ROOT/scripts/nyumatflix-watchdog.sh" \
    "$ROOT/scripts/nyumatflix-watchdog.service" \
    "$ROOT/scripts/nyumatflix-watchdog.timer" \
    "$ROOT/scripts/install-prod-watchdogs.sh" \
    "$ROOT/scripts/reconcile-cap.sh" \
    "$ROOT/scripts/reconcile-crowdsec.sh" \
    "$ROOT/scripts/lock-cap-cors.sh" \
    "$ROOT/scripts/update-cap-key-cors.sh" \
    "$ROOT/scripts/nginx-nyumatflix.conf" \
    "$ROOT/scripts/nginx-nyumatflix-limits.conf" \
    "$ROOT/scripts/nginx-crowdsec-bouncer.conf" \
    "$ROOT/scripts/deploy.sh" \
    "$ROOT/scripts/deploy-lib.sh" \
    "${SSH_HOST}:~/${REMOTE_DIR}/scripts/"
  if [[ -d "$ROOT/flipt" ]]; then
    rsync -avz "$ROOT/flipt/" "${SSH_HOST}:~/${REMOTE_DIR}/flipt/"
  fi

  ssh "$SSH_HOST" "chmod +x \"\$HOME/${REMOTE_DIR}/scripts/deploy.sh\" \"\$HOME/${REMOTE_DIR}/scripts/deploy-lib.sh\" \"\$HOME/${REMOTE_DIR}/scripts/reconcile-prod-infra.sh\" \"\$HOME/${REMOTE_DIR}/scripts/infra-health.sh\" \"\$HOME/${REMOTE_DIR}/scripts/nyumatflix-infra-watchdog.sh\" \"\$HOME/${REMOTE_DIR}/scripts/install-prod-watchdogs.sh\" \"\$HOME/${REMOTE_DIR}/scripts/reconcile-cap.sh\" \"\$HOME/${REMOTE_DIR}/scripts/reconcile-crowdsec.sh\" \"\$HOME/${REMOTE_DIR}/scripts/lock-cap-cors.sh\" \"\$HOME/${REMOTE_DIR}/scripts/update-cap-key-cors.sh\""
  ssh "$SSH_HOST" "NYUMATFLIX_ROOT=\"\$HOME/${REMOTE_DIR}\" \"\$HOME/${REMOTE_DIR}/scripts/reconcile-prod-infra.sh\" ensure"
  ssh "$SSH_HOST" "CAP_ENV_FILE=\"\$HOME/${REMOTE_DIR}/.env\" \"\$HOME/${REMOTE_DIR}/scripts/reconcile-cap.sh\" ensure"
  ssh "$SSH_HOST" "sudo NYUMATFLIX_ROOT=\"\$HOME/${REMOTE_DIR}\" \"\$HOME/${REMOTE_DIR}/scripts/install-prod-watchdogs.sh\" || true"
  echo "production env synced"
}

cmd="${1:-}"
case "$cmd" in
  push) push_env ;;
  *)
    die "usage: $0 push"
    ;;
esac
