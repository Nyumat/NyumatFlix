#!/usr/bin/env bash
# Usage (from repo root):
#   bun run bp                 # build linux/amd64 + push to registry
#   ./scripts/deploy.sh serve  # on leetbot: pull, replace container
#   ./scripts/deploy.sh stop   # stop app container
#
# Override defaults:
#   DOCKER_IMAGE=whotypes/nyumatflix:latest CONTAINER_NAME=nyumatflix \
#   ENV_FILE="$HOME/apps/nyumatflix/.env" \
#   ./scripts/deploy.sh serve

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

DOCKER_REPO="${DOCKER_REPO:-whotypes/nyumatflix}"
DOCKER_IMAGE="${DOCKER_IMAGE:-$DOCKER_REPO:latest}"
DEPLOY_HISTORY_FILE="${DEPLOY_HISTORY_FILE:-$ROOT/deployments.jsonl}"
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
DEPLOY_LOCK_FILE="${DEPLOY_LOCK_FILE:-$ROOT/.deploy.lock}"

CONTAINER_MEMORY="${CONTAINER_MEMORY:-4200m}"
CONTAINER_MEMORY_SWAP="${CONTAINER_MEMORY_SWAP:-4200m}"
CONTAINER_HEALTH_INTERVAL="${CONTAINER_HEALTH_INTERVAL:-30s}"
CONTAINER_HEALTH_TIMEOUT="${CONTAINER_HEALTH_TIMEOUT:-5s}"
CONTAINER_HEALTH_RETRIES="${CONTAINER_HEALTH_RETRIES:-5}"
CONTAINER_HEALTH_START_PERIOD="${CONTAINER_HEALTH_START_PERIOD:-45s}"

cmd="${1:-}"
if [[ -z "$cmd" ]]; then
  echo "usage: $0 bp | serve | stop | history | current" >&2
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
  resolve_deploy_git_meta || true
  if [[ -n "${DEPLOY_SHA:-}" ]]; then
    DOCKER_IMAGE="$DOCKER_REPO:$DEPLOY_SHA"
  fi

  "$ROOT/scripts/bootstrap-scrape-vpn.sh" ensure-local
  cd "$ROOT"
  load_build_env

  bunx turbo build:wasm --filter=@nyumatflix/player

  local -a tags=(-t "$DOCKER_IMAGE")
  if [[ -n "${DEPLOY_SHA:-}" && "$DOCKER_IMAGE" != "$DOCKER_REPO:latest" ]]; then
    tags+=(-t "$DOCKER_REPO:latest")
  fi

  docker build --platform linux/amd64 \
    --build-arg TMDB_API_KEY="${TMDB_API_KEY:-}" \
    --build-arg CAP_API_ENDPOINT="${CAP_API_ENDPOINT:-}" \
    "${tags[@]}" .

  docker push "$DOCKER_IMAGE"
  if [[ -n "${DEPLOY_SHA:-}" && "$DOCKER_IMAGE" != "$DOCKER_REPO:latest" ]]; then
    docker push "$DOCKER_REPO:latest"
  fi
  echo "pushed $DOCKER_IMAGE"
}

acquire_deploy_lock() {
  exec 9>"$DEPLOY_LOCK_FILE"
  if ! flock -n 9; then
    echo "another NyumatFlix deploy is already running" >&2
    exit 1
  fi
}

sync_nginx_site_configs() {
  local limits_src="$ROOT/scripts/nginx-nyumatflix-limits.conf"
  local site_src="$ROOT/scripts/nginx-nyumatflix.conf"
  local crowdsec_src="$ROOT/scripts/nginx-crowdsec-bouncer.conf"
  local limits_dest="/etc/nginx/conf.d/nyumatflix-limits.conf"
  local crowdsec_dest="/etc/nginx/conf.d/crowdsec-bouncer.conf"
  local site_dest="/etc/nginx/sites-available/nyumatflix"

  if [[ -f "$limits_src" ]]; then
    sudo cp "$limits_src" "$limits_dest"
  fi
  if [[ -f "$crowdsec_src" ]]; then
    sudo cp "$crowdsec_src" "$crowdsec_dest"
  fi
  if [[ -f "$site_src" ]]; then
    sudo cp "$site_src" "$site_dest"
    sudo ln -sf "$site_dest" /etc/nginx/sites-enabled/nyumatflix 2>/dev/null || true
  fi
}

ensure_runtime_infra() {
  sync_nginx_site_configs
  NYUMATFLIX_ROOT="$ROOT" APP_ENV_FILE="$ENV_FILE" \
    "$ROOT/scripts/reconcile-prod-infra.sh" ensure
  CAP_ENV_FILE="$ENV_FILE" "$ROOT/scripts/reconcile-cap.sh" ensure
  chmod +x "$ROOT/scripts/reconcile-crowdsec.sh" "$ROOT/scripts/lock-cap-cors.sh" 2>/dev/null || true
  if [[ -x "$ROOT/scripts/reconcile-crowdsec.sh" ]]; then
    CROWDSEC_ENV_FILE="$ENV_FILE" "$ROOT/scripts/reconcile-crowdsec.sh" ensure || true
  fi
  if [[ -x "$ROOT/scripts/lock-cap-cors.sh" ]]; then
    CAP_ENV_FILE="$ENV_FILE" "$ROOT/scripts/lock-cap-cors.sh" "$ENV_FILE" || true
  fi
}

serve() {
  acquire_deploy_lock
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "env file not found: $ENV_FILE (set ENV_FILE=...)" >&2
    exit 1
  fi

  if [[ -z "${DEPLOY_SHA:-}" && "$DOCKER_IMAGE" == *:* ]]; then
    DEPLOY_SHA="${DOCKER_IMAGE##*:}"
  fi
  if [[ -n "${DEPLOY_SHA:-}" && -z "${DEPLOY_SHORT_SHA:-}" ]]; then
    DEPLOY_SHORT_SHA="${DEPLOY_SHA:0:7}"
  fi
  DEPLOY_MESSAGE="${DEPLOY_MESSAGE:-}"
  DEPLOY_AUTHOR="${DEPLOY_AUTHOR:-}"
  DEPLOY_SOURCE="${DEPLOY_SOURCE:-local}"

  ensure_runtime_infra
  if [[ "${SKIP_DOCKER_PULL:-}" != "1" ]]; then
    sudo docker pull "$DOCKER_IMAGE"
  fi

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

  local deploy_at safe_message safe_author
  deploy_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  safe_message="$(label_safe "${DEPLOY_MESSAGE:-}")"
  safe_author="$(label_safe "${DEPLOY_AUTHOR:-}")"

  sudo docker run -d \
    --name "$candidate" \
    --restart unless-stopped \
    --init \
    --memory "${CONTAINER_MEMORY}" \
    --memory-swap "${CONTAINER_MEMORY_SWAP}" \
    --pids-limit 256 \
    --stop-timeout 30 \
    --label "nyumatflix.deploy.sha=${DEPLOY_SHA:-unknown}" \
    --label "nyumatflix.deploy.short_sha=${DEPLOY_SHORT_SHA:-${DEPLOY_SHA:-unknown}}" \
    --label "nyumatflix.deploy.message=${safe_message}" \
    --label "nyumatflix.deploy.author=${safe_author}" \
    --label "nyumatflix.deploy.at=${deploy_at}" \
    --label "nyumatflix.deploy.source=${DEPLOY_SOURCE:-local}" \
    --health-cmd "curl -fsS --max-time 5 http://127.0.0.1:${CONTAINER_APP_PORT}/api/healthz || exit 1" \
    --health-interval "${CONTAINER_HEALTH_INTERVAL}" \
    --health-timeout "${CONTAINER_HEALTH_TIMEOUT}" \
    --health-retries "${CONTAINER_HEALTH_RETRIES}" \
    --health-start-period "${CONTAINER_HEALTH_START_PERIOD}" \
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

  if sudo docker network inspect calluspirates-net >/dev/null 2>&1; then
    sudo docker network connect calluspirates-net "$candidate" 2>/dev/null || true
  fi

  upstream_backup="$(mktemp)"
  if sudo test -f "$NGINX_UPSTREAM_FILE"; then
    sudo cp "$NGINX_UPSTREAM_FILE" "$upstream_backup"
  fi
  printf '# Managed by scripts/deploy.sh. This file is loaded from nginx\047s http context.\nupstream nyumatflix_app {\n    server 127.0.0.1:%s;\n    keepalive 64;\n}\n\nupstream nyumatflix_imgproxy {\n    server 127.0.0.1:9081;\n    keepalive 32;\n}\n' "$target_port" \
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

  DEPLOY_TARGET_PORT="$target_port"
  record_deployment

  echo "running $CONTAINER_NAME from $DOCKER_IMAGE (127.0.0.1:${target_port}->:${CONTAINER_APP_PORT})"
  echo "deploy ${DEPLOY_SHORT_SHA:-unknown} ${DEPLOY_MESSAGE:-}"
  sudo docker logs --tail 20 "$CONTAINER_NAME"
  sudo docker ps --filter "name=${CONTAINER_NAME}" --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
}

show_current() {
  local labels sha short_sha message author deployed_at source image
  labels="$(current_deploy_labels)"
  if [[ -z "$labels" ]]; then
    echo "no running deployment"
    return 0
  fi
  IFS='|' read -r sha short_sha message author deployed_at source image <<<"$labels"
  printf 'sha=%s\nshortSha=%s\nmessage=%s\nauthor=%s\ndeployedAt=%s\nsource=%s\nimage=%s\n' \
    "$sha" "$short_sha" "$message" "$author" "$deployed_at" "$source" "$image"
}

stop_container() {
  acquire_deploy_lock
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
  history) print_deploy_history "${2:-20}" ;;
  current) show_current ;;
  *)
    echo "unknown command: $cmd (use bp, serve, stop, history, or current)" >&2
    exit 1
    ;;
esac
