#!/usr/bin/env bash
# Usage (from repo root):
#   bun run bp                 # build linux/amd64 + push to registry
#   ./scripts/deploy.sh serve  # on leetbot: pull, health-check, blue/green switch
#   ./scripts/deploy.sh stop   # stop app container
#
# Override defaults:
#   DOCKER_IMAGE=whotypes/nyumatflix:latest CONTAINER_NAME=nyumatflix \
#   ENV_FILE="$HOME/apps/nyumatflix/.env" \
#   ./scripts/deploy.sh serve

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCKER_IMAGE="${DOCKER_IMAGE:-whotypes/nyumatflix:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-nyumatflix}"
DOCKER_NETWORK="${DOCKER_NETWORK:-betterome}"
ENV_FILE="${ENV_FILE:-$HOME/apps/nyumatflix/.env}"
BUILD_ENV_FILE="${BUILD_ENV_FILE:-$ROOT/.env.prod}"
CONTAINER_APP_PORT="${CONTAINER_APP_PORT:-8080}"
NGINX_UPSTREAM_FILE="${NGINX_UPSTREAM_FILE:-/etc/nginx/conf.d/nyumatflix-upstream.conf}"
BLUE_PORT="${BLUE_PORT:-8081}"
GREEN_PORT="${GREEN_PORT:-8082}"
HEALTH_WAIT_SECONDS="${HEALTH_WAIT_SECONDS:-60}"
DRAIN_SECONDS="${DRAIN_SECONDS:-95}"

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
  "$ROOT/scripts/bootstrap-scrape-vpn.sh" ensure-local
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
  "$ROOT/scripts/bootstrap-scrape-vpn.sh" prod
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "env file not found: $ENV_FILE (set ENV_FILE=...)" >&2
    exit 1
  fi
  ensure_network
  sudo docker pull "$DOCKER_IMAGE"

  local current_port target_port candidate old_name upstream_backup
  current_port="$(sudo sed -nE 's/^[[:space:]]*server[[:space:]]+127\.0\.0\.1:([0-9]+);/\1/p' "$NGINX_UPSTREAM_FILE" 2>/dev/null | head -n 1)"
  if [[ "$current_port" == "$BLUE_PORT" ]]; then
    target_port="$GREEN_PORT"
  else
    target_port="$BLUE_PORT"
  fi

  candidate="${CONTAINER_NAME}-next"
  old_name="${CONTAINER_NAME}-previous-$(date -u +%Y%m%dT%H%M%SZ)"
  sudo docker rm -f "$candidate" 2>/dev/null || true
  if sudo ss -ltnH | awk '{print $4}' | grep -Eq "(^|:)${target_port}$"; then
    echo "target port is already in use: $target_port" >&2
    exit 1
  fi

  sudo docker run -d \
    --name "$candidate" \
    --restart unless-stopped \
    --init \
    --memory 3g \
    --memory-swap 3g \
    --pids-limit 256 \
    --stop-timeout 30 \
    --health-cmd "curl -fsS http://localhost:${CONTAINER_APP_PORT}/api/healthz" \
    --health-interval 15s \
    --health-timeout 5s \
    --health-retries 3 \
    --health-start-period 20s \
    --log-opt max-size=20m \
    --log-opt max-file=3 \
    --network "$DOCKER_NETWORK" \
    -p "127.0.0.1:${target_port}:${CONTAINER_APP_PORT}" \
    --env-file "$ENV_FILE" \
    -e NODE_ENV=production \
    -e HOSTNAME=0.0.0.0 \
    -e "PORT=${CONTAINER_APP_PORT}" \
    "$DOCKER_IMAGE"

  local deadline health
  deadline=$((SECONDS + HEALTH_WAIT_SECONDS))
  while ((SECONDS < deadline)); do
    health="$(sudo docker inspect "$candidate" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
    [[ "$health" == "healthy" ]] && break
    if [[ "$health" == "unhealthy" ]]; then
      sudo docker logs --tail 100 "$candidate" >&2
      sudo docker rm -f "$candidate" >/dev/null
      exit 1
    fi
    sleep 2
  done
  health="$(sudo docker inspect "$candidate" --format '{{.State.Health.Status}}')"
  if [[ "$health" != "healthy" ]]; then
    echo "candidate did not become healthy within ${HEALTH_WAIT_SECONDS}s" >&2
    sudo docker logs --tail 100 "$candidate" >&2
    sudo docker rm -f "$candidate" >/dev/null
    exit 1
  fi

  upstream_backup="$(mktemp)"
  if sudo test -f "$NGINX_UPSTREAM_FILE"; then
    sudo cp "$NGINX_UPSTREAM_FILE" "$upstream_backup"
  fi
  printf '# Managed by scripts/deploy.sh. This file is loaded from nginx\047s http context.\nupstream nyumatflix_app {\n    server 127.0.0.1:%s;\n    keepalive 64;\n}\n' "$target_port" \
    | sudo tee "${NGINX_UPSTREAM_FILE}.next" >/dev/null
  sudo mv "${NGINX_UPSTREAM_FILE}.next" "$NGINX_UPSTREAM_FILE"

  if ! sudo nginx -t; then
    if [[ -s "$upstream_backup" ]]; then sudo cp "$upstream_backup" "$NGINX_UPSTREAM_FILE"; fi
    rm -f "$upstream_backup"
    sudo docker rm -f "$candidate" >/dev/null
    exit 1
  fi
  sudo systemctl reload nginx

  if ! curl -fsS --max-time 10 "http://127.0.0.1:${target_port}/api/healthz" >/dev/null; then
    if [[ -s "$upstream_backup" ]]; then
      sudo cp "$upstream_backup" "$NGINX_UPSTREAM_FILE"
      sudo nginx -t && sudo systemctl reload nginx
    fi
    rm -f "$upstream_backup"
    sudo docker rm -f "$candidate" >/dev/null
    echo "candidate failed its post-switch health check; upstream rolled back" >&2
    exit 1
  fi
  rm -f "$upstream_backup"

  if sudo docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
    sudo docker update --restart=no "$CONTAINER_NAME" >/dev/null
    sudo docker rename "$CONTAINER_NAME" "$old_name"
  else
    old_name=""
  fi
  sudo docker rename "$candidate" "$CONTAINER_NAME"

  if [[ -n "$old_name" ]]; then
    sudo sh -c "(sleep '$DRAIN_SECONDS'; docker rm -f '$old_name') >>/var/log/nyumatflix-deploy-cleanup.log 2>&1 &"
  fi

  echo "running $CONTAINER_NAME from $DOCKER_IMAGE (127.0.0.1:${target_port}->:${CONTAINER_APP_PORT})"
  sudo docker logs --tail 20 "$CONTAINER_NAME"
  sudo docker ps --filter "name=${CONTAINER_NAME}" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

stop_container() {
  sudo docker rm -f "$CONTAINER_NAME" 2>/dev/null || true
  sudo docker rm -f "${CONTAINER_NAME}-next" 2>/dev/null || true
  local previous
  while IFS= read -r previous; do
    [[ -n "$previous" ]] && sudo docker rm -f "$previous" >/dev/null
  done < <(sudo docker ps -aq --filter "name=^/${CONTAINER_NAME}-previous-")
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
