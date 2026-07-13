#!/usr/bin/env bash
# Reconcile NyumatFlix's long-lived production dependencies on the VPS.
# Usage: reconcile-prod-infra.sh ensure | update | status

set -euo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${NYUMATFLIX_ROOT:-}" ]]; then
  ROOT="$NYUMATFLIX_ROOT"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

DOCKER_NETWORK="${DOCKER_NETWORK:-betterome}"
SCRAPE_PROJECT="${SCRAPE_PROJECT:-gluetun}"
FLIPT_PROJECT="${FLIPT_PROJECT:-nyumatflix}"
GLUETUN_ENV_FILE="${GLUETUN_ENV_FILE:-$HOME/apps/gluetun/.env}"
GLUETUN_SEED_ENV_FILE="${GLUETUN_SEED_ENV_FILE:-$HOME/apps/gluetun/.env.seed}"
APP_ENV_FILE="${APP_ENV_FILE:-$HOME/apps/nyumatflix/.env}"
SCRAPE_COMPOSE_FILE="${SCRAPE_COMPOSE_FILE:-$ROOT/docker-compose.scrape.yml}"
FLIPT_COMPOSE_FILE="${FLIPT_COMPOSE_FILE:-$ROOT/docker-compose.ffs.yml}"
LOCK_FILE="${INFRA_LOCK_FILE:-$ROOT/.prod-infra.lock}"
ROTATE_COUNTRIES="${ROTATE_COUNTRIES:-Germany,Netherlands,France,United States}"
HEALTH_WAIT_SECONDS="${INFRA_HEALTH_WAIT_SECONDS:-90}"

die() {
  echo "production infrastructure: $*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command is missing: $1"
}

read_env_value() {
  local file="$1" key="$2" raw
  [[ -f "$file" ]] || return 1
  raw="$(awk -v key="$key" '
    index($0, key "=") == 1 { value = substr($0, length(key) + 2); found = 1 }
    END { if (found) print value }
  ' "$file")"
  [[ -n "$raw" ]] || return 1
  if [[ "$raw" == \"*\" && "$raw" == *\" ]]; then
    raw="${raw:1:${#raw}-2}"
  elif [[ "$raw" == \'*\' && "$raw" == *\' ]]; then
    raw="${raw:1:${#raw}-2}"
  fi
  printf '%s' "$raw"
}

upsert_env_var() {
  local file="$1" key="$2" value="$3" tmp
  [[ "$key" =~ ^[A-Z0-9_]+$ ]] || die "invalid env key: $key"
  [[ "$value" != *$'\n'* && "$value" != *$'\r'* ]] || die "env value for $key contains a newline"
  mkdir -p "$(dirname "$file")"
  touch "$file"
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

random_secret() {
  openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-32
}

consume_seed_env() {
  [[ -f "$GLUETUN_SEED_ENV_FILE" ]] || return 0

  local key value legacy_key rotate_secret
  for key in VPN_SERVICE_PROVIDER VPN_TYPE WIREGUARD_PRIVATE_KEY WIREGUARD_ADDRESSES SERVER_COUNTRIES GLUETUN_CONTROL_API_KEY SCRAPE_VPN_ROTATE_COUNTRIES; do
    value="$(read_env_value "$GLUETUN_SEED_ENV_FILE" "$key" || true)"
    [[ -n "$value" ]] && upsert_env_var "$GLUETUN_ENV_FILE" "$key" "$value"
  done

  legacy_key="$(read_env_value "$GLUETUN_SEED_ENV_FILE" WIREGUARD_PRIV_KEY || true)"
  if [[ -n "$legacy_key" && -z "$(read_env_value "$GLUETUN_ENV_FILE" WIREGUARD_PRIVATE_KEY || true)" ]]; then
    upsert_env_var "$GLUETUN_ENV_FILE" WIREGUARD_PRIVATE_KEY "$legacy_key"
  fi

  rotate_secret="$(read_env_value "$GLUETUN_SEED_ENV_FILE" SCRAPE_VPN_ROTATE_SECRET || true)"
  [[ -n "$rotate_secret" ]] && upsert_env_var "$APP_ENV_FILE" SCRAPE_VPN_ROTATE_SECRET "$rotate_secret"

  rm -f "$GLUETUN_SEED_ENV_FILE"
  echo "consumed VPN seed environment"
}

ensure_env_files() {
  [[ -f "$APP_ENV_FILE" ]] || die "app env file is missing: $APP_ENV_FILE"
  mkdir -p "$(dirname "$GLUETUN_ENV_FILE")"
  touch "$GLUETUN_ENV_FILE"
  chmod 600 "$GLUETUN_ENV_FILE" "$APP_ENV_FILE"
  consume_seed_env

  local provider vpn_type wg_key wg_address control_api_key rotate_secret rotate_countries
  provider="$(read_env_value "$GLUETUN_ENV_FILE" VPN_SERVICE_PROVIDER || true)"
  vpn_type="$(read_env_value "$GLUETUN_ENV_FILE" VPN_TYPE || true)"
  wg_key="$(read_env_value "$GLUETUN_ENV_FILE" WIREGUARD_PRIVATE_KEY || true)"
  if [[ -z "$wg_key" ]]; then
    wg_key="$(read_env_value "$GLUETUN_ENV_FILE" WIREGUARD_PRIV_KEY || true)"
  fi
  wg_address="$(read_env_value "$GLUETUN_ENV_FILE" WIREGUARD_ADDRESSES || true)"
  control_api_key="$(read_env_value "$GLUETUN_ENV_FILE" GLUETUN_CONTROL_API_KEY || true)"
  rotate_secret="$(read_env_value "$APP_ENV_FILE" SCRAPE_VPN_ROTATE_SECRET || true)"
  rotate_countries="$(read_env_value "$APP_ENV_FILE" SCRAPE_VPN_ROTATE_COUNTRIES || true)"
  if [[ -z "$rotate_countries" ]]; then
    rotate_countries="$(read_env_value "$GLUETUN_ENV_FILE" SCRAPE_VPN_ROTATE_COUNTRIES || true)"
  fi
  if [[ -z "$rotate_countries" ]]; then
    rotate_countries="$(read_env_value "$GLUETUN_ENV_FILE" SERVER_COUNTRIES || true)"
  fi

  [[ -n "$wg_key" ]] || die "WireGuard private key is missing from $GLUETUN_ENV_FILE"
  [[ -n "$wg_address" ]] || die "WireGuard address is missing from $GLUETUN_ENV_FILE"
  [[ -n "$control_api_key" ]] || control_api_key="$(random_secret)"
  [[ -n "$rotate_secret" ]] || rotate_secret="$(random_secret)"
  [[ -n "$rotate_countries" ]] || rotate_countries="$ROTATE_COUNTRIES"
  [[ -n "$provider" ]] || provider="surfshark"
  [[ -n "$vpn_type" ]] || vpn_type="wireguard"

  upsert_env_var "$GLUETUN_ENV_FILE" VPN_SERVICE_PROVIDER "$provider"
  upsert_env_var "$GLUETUN_ENV_FILE" VPN_TYPE "$vpn_type"
  upsert_env_var "$GLUETUN_ENV_FILE" WIREGUARD_PRIVATE_KEY "$wg_key"
  upsert_env_var "$GLUETUN_ENV_FILE" WIREGUARD_ADDRESSES "$wg_address"
  upsert_env_var "$GLUETUN_ENV_FILE" SERVER_COUNTRIES "$rotate_countries"
  upsert_env_var "$GLUETUN_ENV_FILE" GLUETUN_CONTROL_API_KEY "$control_api_key"
  upsert_env_var "$GLUETUN_ENV_FILE" SCRAPE_VPN_ROTATE_COUNTRIES "$rotate_countries"
  upsert_env_var "$GLUETUN_ENV_FILE" HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE "{\"auth\":\"apikey\",\"apikey\":\"$control_api_key\"}"

  upsert_env_var "$APP_ENV_FILE" SCRAPE_PROXY_URL "http://gluetun:8888"
  upsert_env_var "$APP_ENV_FILE" SCRAPE_VPN_CONTROL_URL "http://gluetun:8000"
  upsert_env_var "$APP_ENV_FILE" SCRAPE_VPN_CONTROL_API_KEY "$control_api_key"
  upsert_env_var "$APP_ENV_FILE" SCRAPE_VPN_ROTATE_SECRET "$rotate_secret"
  upsert_env_var "$APP_ENV_FILE" SCRAPE_VPN_ROTATE_COUNTRIES "$rotate_countries"
  upsert_env_var "$APP_ENV_FILE" FLIPT_URL "http://flipt:8080"
  upsert_env_var "$APP_ENV_FILE" FLIPT_ENVIRONMENT "default"
  upsert_env_var "$APP_ENV_FILE" FLIPT_NAMESPACE "default"
}

scrape_compose() {
  sudo env "GLUETUN_ENV_FILE=$GLUETUN_ENV_FILE" \
    docker compose -p "$SCRAPE_PROJECT" -f "$SCRAPE_COMPOSE_FILE" "$@"
}

flipt_compose() {
  sudo docker compose --env-file "$APP_ENV_FILE" \
    -p "$FLIPT_PROJECT" -f "$FLIPT_COMPOSE_FILE" "$@"
}

validate_compose() {
  [[ -f "$SCRAPE_COMPOSE_FILE" ]] || die "scrape compose file is missing: $SCRAPE_COMPOSE_FILE"
  [[ -f "$FLIPT_COMPOSE_FILE" ]] || die "Flipt compose file is missing: $FLIPT_COMPOSE_FILE"
  scrape_compose config --quiet
  flipt_compose config --quiet
}

reconcile_container_owner() {
  local container="$1" expected_service="$2" project service
  sudo docker inspect "$container" >/dev/null 2>&1 || return 0
  project="$(sudo docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.project"}}')"
  service="$(sudo docker inspect "$container" --format '{{index .Config.Labels "com.docker.compose.service"}}')"
  if [[ "$project" == "$SCRAPE_PROJECT" && "$service" == "$expected_service" ]]; then
    return 0
  fi
  if [[ -z "$project" && -z "$service" ]]; then
    echo "migrating legacy standalone container: $container"
    sudo docker rm -f "$container" >/dev/null
    return 0
  fi
  die "container $container is owned by unexpected Compose project '$project' service '$service'"
}

wait_for_gluetun() {
  local control_api_key deadline health
  control_api_key="$(read_env_value "$GLUETUN_ENV_FILE" GLUETUN_CONTROL_API_KEY)"
  deadline=$((SECONDS + HEALTH_WAIT_SECONDS))
  while ((SECONDS < deadline)); do
    health="$(sudo docker inspect gluetun --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || true)"
    if [[ "$health" == "healthy" ]] && sudo docker exec gluetun wget -qO- --timeout=5 \
      --header="X-API-Key: $control_api_key" http://127.0.0.1:8000/v1/vpn/status >/dev/null 2>&1; then
      return 0
    fi
    [[ "$health" == "unhealthy" ]] && break
    sleep 2
  done
  sudo docker logs --tail 50 gluetun >&2 || true
  die "Gluetun did not become healthy"
}

wait_for_service_url() {
  local service="$1" url="$2" deadline
  deadline=$((SECONDS + HEALTH_WAIT_SECONDS))
  while ((SECONDS < deadline)); do
    if sudo docker exec gluetun wget -qO- --timeout=5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  sudo docker logs --tail 50 "$service" >&2 || true
  die "$service did not become reachable at $url"
}

print_status() {
  sudo docker ps -a \
    --filter name=^/gluetun$ \
    --filter name=^/flaresolverr$ \
    --filter name=^/flipt$ \
    --format 'table {{.Names}}\t{{.Status}}\t{{.Image}}'
}

acquire_lock() {
  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 8>"$LOCK_FILE"
  flock -w 120 8 || die "timed out waiting for infrastructure reconciliation lock"
}

reconcile() {
  local update_images="$1"
  acquire_lock
  ensure_env_files
  sudo docker network create "$DOCKER_NETWORK" 2>/dev/null || true
  validate_compose
  reconcile_container_owner gluetun gluetun
  reconcile_container_owner flaresolverr flaresolverr

  if [[ "$update_images" == "true" ]]; then
    scrape_compose pull
    flipt_compose pull
  fi

  scrape_compose up -d
  flipt_compose up -d
  wait_for_gluetun
  wait_for_service_url flaresolverr http://flaresolverr:8191/
  wait_for_service_url flipt http://flipt:8080/health
  print_status
}

main() {
  local command="${1:-ensure}"
  require_command docker
  require_command flock
  require_command openssl

  case "$command" in
    ensure) reconcile false ;;
    update) reconcile true ;;
    status) print_status ;;
    *) die "usage: $0 ensure | update | status" ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
