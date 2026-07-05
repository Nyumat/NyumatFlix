#!/usr/bin/env bash
# Usage (from repo root):
#   bun run bp                 # build linux/amd64 + push to registry
#   ./scripts/deploy.sh serve  # on leetbot: pull, replace container
#   ./scripts/deploy.sh stop   # stop app container
#
# Override defaults:
#   DOCKER_IMAGE=whotypes/nyumatflix:latest CONTAINER_NAME=nyumatflix \
#   ENV_FILE="$HOME/apps/nyumatflix/.env" HOST_APP_PORT=8081 \
#   ./scripts/deploy.sh serve

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_IMAGE="${DOCKER_IMAGE:-whotypes/nyumatflix:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-nyumatflix}"
DOCKER_NETWORK="${DOCKER_NETWORK:-betterome}"
ENV_FILE="${ENV_FILE:-$HOME/apps/nyumatflix/.env}"
BUILD_ENV_FILE="${BUILD_ENV_FILE:-$ROOT/.env.prod}"
HOST_APP_PORT="${HOST_APP_PORT:-8081}"
CONTAINER_APP_PORT="${CONTAINER_APP_PORT:-8080}"

cmd="${1:-}"
if [[ -z "$cmd" ]]; then
  echo "usage: $0 bp | serve | stop" >&2
  exit 1
fi

load_build_env() {
  if [[ ! -f "$BUILD_ENV_FILE" ]]; then
    echo "build env file not found: $BUILD_ENV_FILE" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1090
  source "$BUILD_ENV_FILE"
  set +a
}

build_push() {
  cd "$ROOT"
  load_build_env
  docker build --platform linux/amd64 \
    --build-arg TMDB_API_KEY="${TMDB_API_KEY:-}" \
    -t "$DOCKER_IMAGE" .
  docker push "$DOCKER_IMAGE"
  echo "pushed $DOCKER_IMAGE"
}

ensure_network() {
  sudo docker network create "$DOCKER_NETWORK" 2>/dev/null || true
}

serve() {
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "env file not found: $ENV_FILE (set ENV_FILE=...)" >&2
    exit 1
  fi
  ensure_network
  sudo docker pull "$DOCKER_IMAGE"
  sudo docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  sudo docker run -d \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    --network "$DOCKER_NETWORK" \
    -p "127.0.0.1:${HOST_APP_PORT}:${CONTAINER_APP_PORT}" \
    --env-file "$ENV_FILE" \
    -e NODE_ENV=production \
    -e HOSTNAME=0.0.0.0 \
    -e "PORT=${CONTAINER_APP_PORT}" \
    "$DOCKER_IMAGE"
  echo "running $CONTAINER_NAME from $DOCKER_IMAGE (127.0.0.1:${HOST_APP_PORT}->:${CONTAINER_APP_PORT})"
  sudo docker logs --tail 20 "$CONTAINER_NAME"
  sudo docker ps --filter "name=${CONTAINER_NAME}" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

stop_container() {
  sudo docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  echo "stopped $CONTAINER_NAME"
}

case "$cmd" in
  build-push | bp) build_push ;;
  serve | deploy) serve ;;
  stop) stop_container ;;
  *)
    echo "unknown command: $cmd (use bp, serve, or stop)" >&2
    exit 1
    ;;
esac
