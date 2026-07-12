#!/usr/bin/env bash
# Bootstrap Gluetun/FlareSolverr scrape egress.
# Usage: ensure-local | local | prod | prod-local | sync-env
# SKIP_SCRAPE_STACK=1 and FORCE_SCRAPE_SYNC=1 are supported.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GLUETUN_DIR="$ROOT/scripts/gluetun"
LOCAL_ENV_FILE="${LOCAL_ENV_FILE:-$ROOT/.env.local}"
VPN_ENV_FILE="${VPN_ENV_FILE:-$ROOT/.env.vpn}"
SSH_HOST="${SSH_HOST:-leetbot}"
DOCKER_NETWORK="${DOCKER_NETWORK:-betterome}"
PROD_NYUMAT_ENV="${PROD_NYUMAT_ENV:-\$HOME/apps/nyumatflix/.env}"
PROD_GLUETUN_DIR="${PROD_GLUETUN_DIR:-\$HOME/apps/gluetun}"
LOCAL_PROXY_URL="${LOCAL_PROXY_URL:-http://127.0.0.1:8888}"
LOCAL_CONTROL_URL="${LOCAL_CONTROL_URL:-http://127.0.0.1:8000}"
PROD_PROXY_URL="${PROD_PROXY_URL:-http://gluetun:8888}"
PROD_CONTROL_URL="${PROD_CONTROL_URL:-http://gluetun:8000}"
ROTATE_COUNTRIES="${ROTATE_COUNTRIES:-Germany,Netherlands,France,United States}"

cmd="${1:-local}"

random_secret() {
  openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-32
}

ensure_vpn_secrets() {
  touch "$VPN_ENV_FILE"
  chmod 600 "$VPN_ENV_FILE"

  local api_key rotate_secret rotate_countries
  api_key="$(read_env_value "$VPN_ENV_FILE" GLUETUN_CONTROL_API_KEY || true)"
  rotate_secret="$(read_env_value "$VPN_ENV_FILE" SCRAPE_VPN_ROTATE_SECRET || true)"
  rotate_countries="$(read_env_value "$VPN_ENV_FILE" SCRAPE_VPN_ROTATE_COUNTRIES || true)"

  if [[ -z "$api_key" ]]; then
    api_key="$(random_secret)"
    upsert_env_var "$VPN_ENV_FILE" GLUETUN_CONTROL_API_KEY "$api_key"
  fi
  if [[ -z "$rotate_secret" ]]; then
    rotate_secret="$(random_secret)"
    upsert_env_var "$VPN_ENV_FILE" SCRAPE_VPN_ROTATE_SECRET "$rotate_secret"
  fi
  if [[ -z "$rotate_countries" ]]; then
    upsert_env_var "$VPN_ENV_FILE" SCRAPE_VPN_ROTATE_COUNTRIES "$ROTATE_COUNTRIES"
    rotate_countries="$ROTATE_COUNTRIES"
  fi

  GLUETUN_CONTROL_API_KEY="$api_key"
  SCRAPE_VPN_ROTATE_SECRET="$rotate_secret"
  SCRAPE_VPN_ROTATE_COUNTRIES="$rotate_countries"
}

upsert_env_var() {
  local file="$1"
  local key="$2"
  local value="$3"
  touch "$file"
  local quoted
  quoted="$(printf '%s' "$value" | sed 's/"/\\"/g')"
  if grep -q "^${key}=" "$file"; then
    sed -i '' "s|^${key}=.*|${key}=\"${quoted}\"|" "$file"
  else
    echo "${key}=\"${quoted}\"" >>"$file"
  fi
}

read_env_value() {
  local file="$1"
  local key="$2"
  if [[ ! -f "$file" ]]; then
    return 1
  fi
  local raw
  raw="$(grep -E "^${key}=" "$file" | tail -n 1 | cut -d= -f2-)"
  raw="${raw%\"}"
  raw="${raw#\"}"
  printf '%s' "$raw"
}

read_vpn_secret() {
  read_env_value "$VPN_ENV_FILE" "$1" || true
}

sync_prod_env() {
  echo "syncing scrape env from ${SSH_HOST}..."
  local tmp_prod tmp_gluetun
  tmp_prod="$(mktemp)"
  tmp_gluetun="$(mktemp)"
  scp -q "${SSH_HOST}:~/apps/nyumatflix/.env" "$tmp_prod"
  scp -q "${SSH_HOST}:~/apps/gluetun/.env" "$tmp_gluetun"

  ensure_vpn_secrets

  local prod_tmdb prod_idmoe prod_auth_resend prod_auth_secret prod_wg_key prod_wg_addr
  prod_tmdb="$(read_env_value "$tmp_prod" TMDB_API_KEY || true)"
  prod_idmoe="$(read_env_value "$tmp_prod" ID_MOE_API_KEY || true)"
  prod_auth_resend="$(read_env_value "$tmp_prod" AUTH_RESEND_KEY || true)"
  prod_auth_secret="$(read_env_value "$tmp_prod" AUTH_SECRET || true)"
  prod_wg_key="$(read_env_value "$tmp_gluetun" WIREGUARD_PRIVATE_KEY || true)"
  prod_wg_addr="$(read_env_value "$tmp_gluetun" WIREGUARD_ADDRESSES || true)"

  if [[ -n "$prod_wg_key" ]]; then
    upsert_env_var "$VPN_ENV_FILE" WIREGUARD_PRIVATE_KEY "$prod_wg_key"
    upsert_env_var "$VPN_ENV_FILE" WIREGUARD_PRIV_KEY "$prod_wg_key"
  fi
  if [[ -n "$prod_wg_addr" ]]; then
    upsert_env_var "$VPN_ENV_FILE" WIREGUARD_ADDRESSES "$prod_wg_addr"
  fi

  touch "$LOCAL_ENV_FILE"
  [[ -n "$prod_tmdb" ]] && upsert_env_var "$LOCAL_ENV_FILE" TMDB_API_KEY "$prod_tmdb"
  [[ -n "$prod_idmoe" ]] && upsert_env_var "$LOCAL_ENV_FILE" ID_MOE_API_KEY "$prod_idmoe"
  [[ -n "$prod_auth_resend" ]] && upsert_env_var "$LOCAL_ENV_FILE" AUTH_RESEND_KEY "$prod_auth_resend"
  [[ -n "$prod_auth_secret" ]] && upsert_env_var "$LOCAL_ENV_FILE" AUTH_SECRET "$prod_auth_secret"

  upsert_env_var "$LOCAL_ENV_FILE" AUTH_URL "http://localhost:3000"
  upsert_env_var "$LOCAL_ENV_FILE" APP_URL "http://localhost:3000"
  upsert_env_var "$LOCAL_ENV_FILE" NEXTAUTH_URL "http://localhost:3000"
  upsert_env_var "$LOCAL_ENV_FILE" FLARESOLVERR_URL "http://127.0.0.1:8191/v1"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_PROXY_URL "$LOCAL_PROXY_URL"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_VPN_CONTROL_URL "$LOCAL_CONTROL_URL"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_VPN_CONTROL_API_KEY "$GLUETUN_CONTROL_API_KEY"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_VPN_ROTATE_SECRET "$SCRAPE_VPN_ROTATE_SECRET"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_VPN_ROTATE_COUNTRIES "${SCRAPE_VPN_ROTATE_COUNTRIES:-$ROTATE_COUNTRIES}"

  rm -f "$tmp_prod" "$tmp_gluetun"
  echo "updated $LOCAL_ENV_FILE and $VPN_ENV_FILE"
}

write_local_gluetun_env() {
  ensure_vpn_secrets

  local wg_key wg_addr rotate_countries
  wg_key="$(read_vpn_secret WIREGUARD_PRIVATE_KEY)"
  if [[ -z "$wg_key" ]]; then
    wg_key="$(read_vpn_secret WIREGUARD_PRIV_KEY)"
  fi
  wg_addr="$(read_vpn_secret WIREGUARD_ADDRESSES)"
  rotate_countries="${SCRAPE_VPN_ROTATE_COUNTRIES:-$ROTATE_COUNTRIES}"
  if [[ -z "$wg_addr" ]]; then
    wg_addr="10.14.0.2/16"
  fi
  if [[ -z "$wg_key" ]]; then
    echo "missing WireGuard private key in $VPN_ENV_FILE (run sync-env first)" >&2
    exit 1
  fi

  cat >"$GLUETUN_DIR/.env" <<EOF
VPN_SERVICE_PROVIDER=surfshark
VPN_TYPE=wireguard
WIREGUARD_PRIVATE_KEY=${wg_key}
WIREGUARD_ADDRESSES=${wg_addr}
SERVER_COUNTRIES=${rotate_countries}
HTTPPROXY=on
HTTPPROXY_LOG=off
HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE={"auth":"apikey","apikey":"${GLUETUN_CONTROL_API_KEY}"}
EOF
  chmod 600 "$GLUETUN_DIR/.env"
}

wait_for_local_control() {
  local api_key="$1"
  for _ in $(seq 1 45); do
    if curl -fsS --max-time 5 \
      -H "X-API-Key: ${api_key}" \
      "${LOCAL_CONTROL_URL}/v1/vpn/status" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
  done
  return 1
}

docker_is_available() {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
}

needs_prod_sync() {
  if [[ "${FORCE_SCRAPE_SYNC:-}" == "1" ]]; then
    return 0
  fi
  if [[ ! -f "$LOCAL_ENV_FILE" ]]; then
    return 0
  fi
  if [[ -z "$(read_env_value "$LOCAL_ENV_FILE" SCRAPE_PROXY_URL || true)" ]]; then
    return 0
  fi
  if [[ -z "$(read_env_value "$LOCAL_ENV_FILE" SCRAPE_VPN_CONTROL_URL || true)" ]]; then
    return 0
  fi
  local wg_key
  wg_key="$(read_vpn_secret WIREGUARD_PRIVATE_KEY)"
  if [[ -z "$wg_key" ]]; then
    wg_key="$(read_vpn_secret WIREGUARD_PRIV_KEY)"
  fi
  [[ -z "$wg_key" ]]
}

apply_local_env_defaults() {
  ensure_vpn_secrets
  touch "$LOCAL_ENV_FILE"
  upsert_env_var "$LOCAL_ENV_FILE" AUTH_URL "http://localhost:3000"
  upsert_env_var "$LOCAL_ENV_FILE" APP_URL "http://localhost:3000"
  upsert_env_var "$LOCAL_ENV_FILE" NEXTAUTH_URL "http://localhost:3000"
  upsert_env_var "$LOCAL_ENV_FILE" FLARESOLVERR_URL "http://127.0.0.1:8191/v1"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_PROXY_URL "$LOCAL_PROXY_URL"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_VPN_CONTROL_URL "$LOCAL_CONTROL_URL"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_VPN_CONTROL_API_KEY "$GLUETUN_CONTROL_API_KEY"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_VPN_ROTATE_SECRET "$SCRAPE_VPN_ROTATE_SECRET"
  upsert_env_var "$LOCAL_ENV_FILE" SCRAPE_VPN_ROTATE_COUNTRIES "${SCRAPE_VPN_ROTATE_COUNTRIES:-$ROTATE_COUNTRIES}"
}

gluetun_is_healthy() {
  ensure_vpn_secrets
  curl -fsS --max-time 3 \
    -H "X-API-Key: ${GLUETUN_CONTROL_API_KEY}" \
    "${LOCAL_CONTROL_URL}/v1/vpn/status" 2>/dev/null | grep -q '"status":"running"'
}

ensure_gluetun() {
  if gluetun_is_healthy; then
    return 0
  fi

  write_local_gluetun_env
  docker network create "$DOCKER_NETWORK" 2>/dev/null || true
  echo "starting gluetun..."
  docker compose \
    -f "$GLUETUN_DIR/docker-compose.yml" \
    -f "$GLUETUN_DIR/docker-compose.local.yml" \
    up -d

  if ! wait_for_local_control "$GLUETUN_CONTROL_API_KEY"; then
    echo "gluetun control API did not become ready at ${LOCAL_CONTROL_URL}" >&2
    docker logs --tail 40 gluetun >&2 || true
    return 1
  fi

  local public_ip
  public_ip="$(curl -fsS -H "X-API-Key: ${GLUETUN_CONTROL_API_KEY}" \
    "${LOCAL_CONTROL_URL}/v1/publicip/ip" | sed -n 's/.*"public_ip":"\([^"]*\)".*/\1/p' || true)"
  echo "gluetun ready (egress ${public_ip:-unknown})"
}

flaresolverr_is_healthy() {
  curl -fsS --max-time 3 "http://127.0.0.1:8191/" >/dev/null 2>&1
}

ensure_flaresolverr() {
  if flaresolverr_is_healthy; then
    return 0
  fi

  echo "starting flaresolverr..."
  docker compose -f "$ROOT/docker-compose.yml" up -d flaresolverr

  for _ in $(seq 1 30); do
    if flaresolverr_is_healthy; then
      echo "flaresolverr ready"
      return 0
    fi
    sleep 2
  done

  echo "flaresolverr did not become ready on :8191" >&2
  return 1
}

ensure_local() {
  if [[ "${SKIP_SCRAPE_STACK:-}" == "1" ]]; then
    return 0
  fi

  if ! docker_is_available; then
    echo "docker unavailable — scrape stack skipped" >&2
    return 0
  fi

  local changed=0

  if needs_prod_sync; then
    if ! ssh -o ConnectTimeout=8 -o BatchMode=yes "$SSH_HOST" true 2>/dev/null; then
      echo "cannot reach ${SSH_HOST} — using existing local env" >&2
      apply_local_env_defaults
    else
      sync_prod_env
    fi
    changed=1
  else
    apply_local_env_defaults
  fi

  if ! gluetun_is_healthy; then
    ensure_gluetun
    changed=1
  fi

  if ! flaresolverr_is_healthy; then
    ensure_flaresolverr
    changed=1
  fi

  if [[ "$changed" -eq 1 ]]; then
    echo "scrape stack ready"
  fi
}

bootstrap_local() {
  sync_prod_env
  ensure_gluetun
  ensure_flaresolverr
}

bootstrap_prod() {
  local execution_mode="${1:-remote}"
  local bootstrap_command
  bootstrap_command="set -eu
    PROD_NYUMAT_ENV=${PROD_NYUMAT_ENV}
    PROD_GLUETUN_DIR=${PROD_GLUETUN_DIR}
    PROD_PROXY_URL=${PROD_PROXY_URL}
    PROD_CONTROL_URL=${PROD_CONTROL_URL}
    ROTATE_COUNTRIES='${ROTATE_COUNTRIES}'

    random_secret() {
      openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-32
    }

    upsert_env_var() {
      local file=\"\$1\" key=\"\$2\" value=\"\$3\"
      touch \"\$file\"
      if grep -q \"^\${key}=\" \"\$file\"; then
        sed -i \"s|^\${key}=.*|\${key}=\${value}|\" \"\$file\"
      else
        echo \"\${key}=\${value}\" >>\"\$file\"
      fi
    }

  GLUETUN_CONTROL_API_KEY=\"\$(grep -E '^GLUETUN_CONTROL_API_KEY=' \"\$PROD_GLUETUN_DIR/.env\" 2>/dev/null | tail -n1 | cut -d= -f2- || true)\"
  SCRAPE_VPN_ROTATE_SECRET=\"\$(grep -E '^SCRAPE_VPN_ROTATE_SECRET=' \"\$PROD_NYUMAT_ENV\" 2>/dev/null | tail -n1 | cut -d= -f2- || true)\"
  if [ -z \"\$GLUETUN_CONTROL_API_KEY\" ]; then GLUETUN_CONTROL_API_KEY=\"\$(random_secret)\"; fi
  if [ -z \"\$SCRAPE_VPN_ROTATE_SECRET\" ]; then SCRAPE_VPN_ROTATE_SECRET=\"\$(random_secret)\"; fi

  if ! grep -q '^HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE=' \"\$PROD_GLUETUN_DIR/.env\" 2>/dev/null; then
    echo \"HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE={\\\"auth\\\":\\\"apikey\\\",\\\"apikey\\\":\\\"\$GLUETUN_CONTROL_API_KEY\\\"}\" >>\"\$PROD_GLUETUN_DIR/.env\"
  else
    sed -i \"s|^HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE=.*|HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE={\\\"auth\\\":\\\"apikey\\\",\\\"apikey\\\":\\\"\$GLUETUN_CONTROL_API_KEY\\\"}|\" \"\$PROD_GLUETUN_DIR/.env\"
  fi
  upsert_env_var \"\$PROD_GLUETUN_DIR/.env\" GLUETUN_CONTROL_API_KEY \"\$GLUETUN_CONTROL_API_KEY\"
  upsert_env_var \"\$PROD_GLUETUN_DIR/.env\" SCRAPE_VPN_ROTATE_COUNTRIES \"\$ROTATE_COUNTRIES\"
  if ! grep -q '^SERVER_COUNTRIES=' \"\$PROD_GLUETUN_DIR/.env\"; then
    echo \"SERVER_COUNTRIES=\$ROTATE_COUNTRIES\" >>\"\$PROD_GLUETUN_DIR/.env\"
  fi

  upsert_env_var \"\$PROD_NYUMAT_ENV\" SCRAPE_PROXY_URL \"\$PROD_PROXY_URL\"
  upsert_env_var \"\$PROD_NYUMAT_ENV\" SCRAPE_VPN_CONTROL_URL \"\$PROD_CONTROL_URL\"
  upsert_env_var \"\$PROD_NYUMAT_ENV\" SCRAPE_VPN_CONTROL_API_KEY \"\$GLUETUN_CONTROL_API_KEY\"
  upsert_env_var \"\$PROD_NYUMAT_ENV\" SCRAPE_VPN_ROTATE_SECRET \"\$SCRAPE_VPN_ROTATE_SECRET\"
  upsert_env_var \"\$PROD_NYUMAT_ENV\" SCRAPE_VPN_ROTATE_COUNTRIES \"\$ROTATE_COUNTRIES\"

  sudo docker network create ${DOCKER_NETWORK} 2>/dev/null || true
  cd \"\$PROD_GLUETUN_DIR\" && sudo docker compose pull && sudo docker compose up -d

  for i in \$(seq 1 45); do
    if sudo docker exec gluetun wget -qO- --timeout=5 \
      --header=\"X-API-Key: \$GLUETUN_CONTROL_API_KEY\" \
      http://127.0.0.1:8000/v1/vpn/status >/dev/null 2>&1; then
      ip=\"\$(sudo docker exec gluetun wget -qO- --timeout=8 \
        --header=\"X-API-Key: \$GLUETUN_CONTROL_API_KEY\" \
        http://127.0.0.1:8000/v1/publicip/ip 2>/dev/null | sed -n 's/.*\\\"public_ip\\\":\\\"\\([^\\\"]*\\)\\\".*/\\1/p' || true)\"
      echo \"prod gluetun ready (egress \${ip:-unknown})\"
      exit 0
    fi
    sleep 2
  done
  echo 'prod gluetun did not become ready' >&2
  sudo docker logs --tail 40 gluetun >&2 || true
  exit 1"

  if [[ "$execution_mode" == "local" ]]; then
    bash -c "$bootstrap_command"
  else
    ssh "$SSH_HOST" "$bootstrap_command"
  fi
}

case "$cmd" in
  sync-env) sync_prod_env ;;
  ensure-local) ensure_local ;;
  local) bootstrap_local ;;
  prod) bootstrap_prod ;;
  prod-local) bootstrap_prod local ;;
  *)
    echo "usage: $0 ensure-local | local | prod | prod-local | sync-env" >&2
    exit 1
    ;;
esac
