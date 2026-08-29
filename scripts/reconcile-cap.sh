#!/usr/bin/env bash
# Reconcile NyumatFlix's self-hosted Cap CAPTCHA and Valkey datastore.
# Usage: reconcile-cap.sh ensure | update | status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${CAP_COMPOSE_FILE:-$ROOT/docker-compose.cap.yml}"
PROJECT="${CAP_COMPOSE_PROJECT:-nyumatflix-cap}"

compose() {
  local env_args=(--env-file "$ROOT/.env" --env-file "$ROOT/.env.local")
  if [[ -n "${CAP_ENV_FILE:-}" ]]; then
    env_args=(--env-file "$CAP_ENV_FILE")
  fi
  docker compose "${env_args[@]}" -p "$PROJECT" -f "$COMPOSE_FILE" "$@"
}

case "${1:-}" in
  ensure)
    compose config --quiet
    compose up -d
    ;;
  update)
    compose config --quiet
    compose pull
    compose up -d
    ;;
  status)
    compose ps
    ;;
  *)
    echo "usage: $0 ensure | update | status" >&2
    exit 1
    ;;
esac
