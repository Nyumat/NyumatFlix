#!/usr/bin/env bash
# Push repo .env.prod managed keys to the NyumatFlix production runtime env.
# Usage: ./scripts/sync-prod-env.sh push

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSH_HOST="${SSH_HOST:-leetbot}"
REMOTE_DIR="apps/nyumatflix"
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

  ssh "$SSH_HOST" "mkdir -p \"\$HOME/${REMOTE_DIR}/scripts\""
  rsync -avz "$SEED_ENV_FILE" "${SSH_HOST}:~/${REMOTE_DIR}/.env.prod"
  rsync -avz \
    "$MANAGED_KEYS_FILE" \
    "$ROOT/scripts/reconcile-prod-infra.sh" \
    "$ROOT/scripts/reconcile-cap.sh" \
    "$ROOT/scripts/deploy.sh" \
    "$ROOT/docker-compose.scrape.yml" \
    "$ROOT/docker-compose.ffs.yml" \
    "${SSH_HOST}:~/${REMOTE_DIR}/scripts/"
  rsync -avz "$ROOT/scripts/deploy.sh" "${SSH_HOST}:~/${REMOTE_DIR}/deploy.sh"
  rsync -avz "$ROOT/docker-compose.cap.yml" "${SSH_HOST}:~/${REMOTE_DIR}/docker-compose.cap.yml"
  if [[ -d "$ROOT/flipt" ]]; then
    rsync -avz "$ROOT/flipt/" "${SSH_HOST}:~/${REMOTE_DIR}/flipt/"
  fi

  ssh "$SSH_HOST" 'chmod +x "$HOME/apps/nyumatflix/deploy.sh" "$HOME/apps/nyumatflix/scripts/deploy.sh" "$HOME/apps/nyumatflix/scripts/reconcile-prod-infra.sh" "$HOME/apps/nyumatflix/scripts/reconcile-cap.sh"'
  ssh "$SSH_HOST" "NYUMATFLIX_ROOT=\"\$HOME/${REMOTE_DIR}\" \"\$HOME/${REMOTE_DIR}/scripts/reconcile-prod-infra.sh\" ensure"
  ssh "$SSH_HOST" "CAP_ENV_FILE=\"\$HOME/${REMOTE_DIR}/.env\" \"\$HOME/${REMOTE_DIR}/scripts/reconcile-cap.sh\" ensure"
  echo "production env synced"
}

cmd="${1:-}"
case "$cmd" in
  push) push_env ;;
  *)
    die "usage: $0 push"
    ;;
esac
