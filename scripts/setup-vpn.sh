#!/usr/bin/env bash
# Deploy Surfshark VPN (Gluetun) on leetbot and wire FlareSolverr + NyumatFlix to it.
#
# Local (from repo root):
#   ./scripts/setup-vpn.sh push-env     # copy .env.vpn -> leetbot ~/apps/gluetun/.env
#   ./scripts/setup-vpn.sh up           # start gluetun on leetbot
#   ./scripts/setup-vpn.sh flaresolverr # recreate flaresolverr with PROXY_URL
#   ./scripts/setup-vpn.sh app-env      # add SCRAPE_PROXY_URL to nyumatflix .env
#   ./scripts/setup-vpn.sh rotate       # reconnect until the public IP changes
#   ./scripts/setup-vpn.sh test         # verify VPN egress + scrape targets
#   ./scripts/setup-vpn.sh all          # push-env + up + flaresolverr + app-env + test
#
# Requires: .env.vpn at repo root (gitignored) with Surfshark WireGuard values.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${SSH_HOST:-leetbot}"
GLUETUN_DIR="${GLUETUN_DIR:-\$HOME/apps/gluetun}"
FLARESOLVERR_CONTAINER="${FLARESOLVERR_CONTAINER:-flaresolverr}"
FLARESOLVERR_IMAGE="${FLARESOLVERR_IMAGE:-flaresolverr/flaresolverr:latest}"
DOCKER_NETWORK="${DOCKER_NETWORK:-betterome}"
PROXY_URL="${PROXY_URL:-http://gluetun:8888}"
VPN_CONTROL_URL="${VPN_CONTROL_URL:-http://gluetun:8000}"
NYUMAT_ENV="${NYUMAT_ENV:-\$HOME/apps/nyumatflix/.env}"
LOCAL_VPN_ENV="${LOCAL_VPN_ENV:-$ROOT/.env.vpn}"
LOCAL_WG_CONF="${LOCAL_WG_CONF:-$ROOT/de-ber.conf}"

cmd="${1:-}"
if [[ -z "$cmd" ]]; then
  echo "usage: $0 push-env | up | rotate | flaresolverr | app-env | test | all" >&2
  exit 1
fi

read_wg_from_conf() {
  local key=""
  local addr=""
  if [[ -f "$LOCAL_WG_CONF" ]]; then
    key="$(awk -F' = ' '/^PrivateKey/{print $2}' "$LOCAL_WG_CONF" | tr -d '\r')"
    addr="$(awk -F' = ' '/^Address/{print $2}' "$LOCAL_WG_CONF" | tr -d '\r' | cut -d, -f1)"
  fi
  if [[ -z "$key" && -f "$LOCAL_VPN_ENV" ]]; then
    # shellcheck disable=SC1090
    source "$LOCAL_VPN_ENV"
    key="${WIREGUARD_PRIV_KEY:-}"
  fi
  if [[ -z "$key" || -z "$addr" ]]; then
    echo "missing WireGuard key/address in $LOCAL_WG_CONF or $LOCAL_VPN_ENV" >&2
    exit 1
  fi
  WIREGUARD_PRIVATE_KEY="$key"
  WIREGUARD_ADDRESSES="$addr"
}

rotate_gluetun() {
  ssh "$SSH_HOST" 'set -eu
    old_ip="$(sudo docker exec gluetun wget -qO- --timeout=10 http://ifconfig.io/ip 2>/dev/null || true)"
    for attempt in 1 2 3; do
      sudo docker restart gluetun >/dev/null
      for wait_attempt in $(seq 1 45); do
        new_ip="$(sudo docker exec gluetun wget -qO- --timeout=8 http://ifconfig.io/ip 2>/dev/null || true)"
        if [ -n "$new_ip" ]; then
          if [ "$new_ip" != "$old_ip" ]; then
            printf "gluetun egress changed: %s -> %s\n" "$old_ip" "$new_ip"
            exit 0
          fi
          break
        fi
        sleep 2
      done
    done
    echo "gluetun reconnected but Surfshark reused the same public IP" >&2
    exit 1'
}

push_env() {
  read_wg_from_conf
  ssh "$SSH_HOST" "mkdir -p ~/apps/gluetun"
  scp "$ROOT/scripts/gluetun/docker-compose.yml" "$SSH_HOST:~/apps/gluetun/docker-compose.yml"
  ssh "$SSH_HOST" "cat > ~/apps/gluetun/.env <<EOF
VPN_SERVICE_PROVIDER=surfshark
VPN_TYPE=wireguard
WIREGUARD_PRIVATE_KEY=${WIREGUARD_PRIVATE_KEY}
WIREGUARD_ADDRESSES=${WIREGUARD_ADDRESSES}
SERVER_COUNTRIES=Germany
EOF
chmod 600 ~/apps/gluetun/.env"
  echo "wrote ~/apps/gluetun/.env on $SSH_HOST"
}

up_gluetun() {
  ssh "$SSH_HOST" "sudo docker network create $DOCKER_NETWORK 2>/dev/null || true
    cd ~/apps/gluetun && sudo docker compose pull && sudo docker compose up -d
    echo 'waiting for gluetun VPN...'
    for i in \$(seq 1 45); do
      if sudo docker exec gluetun wget -qO- --timeout=8 http://ifconfig.io/ip >/tmp/gluetun-ip 2>/dev/null; then
        echo \"gluetun egress IP: \$(cat /tmp/gluetun-ip)\"
        break
      fi
      sleep 2
    done"
}

recreate_flaresolverr() {
  ssh "$SSH_HOST" "sudo docker rm -f $FLARESOLVERR_CONTAINER 2>/dev/null || true
    sudo docker run -d \
      --name $FLARESOLVERR_CONTAINER \
      --restart unless-stopped \
      --network $DOCKER_NETWORK \
      -e LOG_LEVEL=info \
      -e CAPTCHA_SOLVER=none \
      -e PROXY_URL=$PROXY_URL \
      $FLARESOLVERR_IMAGE
    sleep 3
    sudo docker logs --tail 10 $FLARESOLVERR_CONTAINER"
}

patch_app_env() {
  ssh "$SSH_HOST" "touch $NYUMAT_ENV
    if grep -q '^SCRAPE_PROXY_URL=' $NYUMAT_ENV; then
      sed -i 's|^SCRAPE_PROXY_URL=.*|SCRAPE_PROXY_URL=$PROXY_URL|' $NYUMAT_ENV
    else
      echo 'SCRAPE_PROXY_URL=$PROXY_URL' >> $NYUMAT_ENV
    fi
    if grep -q '^SCRAPE_VPN_CONTROL_URL=' $NYUMAT_ENV; then
      sed -i 's|^SCRAPE_VPN_CONTROL_URL=.*|SCRAPE_VPN_CONTROL_URL=$VPN_CONTROL_URL|' $NYUMAT_ENV
    else
      echo 'SCRAPE_VPN_CONTROL_URL=$VPN_CONTROL_URL' >> $NYUMAT_ENV
    fi
    grep -E 'SCRAPE_(PROXY|VPN_CONTROL)_URL=' $NYUMAT_ENV"
}

test_vpn() {
  ssh "$SSH_HOST" "echo '=== VPN egress IP ==='
    sudo docker exec gluetun wget -qO- --timeout=15 http://ifconfig.io/ip || true
    echo
    echo '=== VidKing seed via gluetun proxy ==='
    sudo docker exec gluetun wget -qS --timeout=15 -e use_proxy=yes -e http_proxy=$PROXY_URL \
      --header='Origin: https://www.vidking.net' \
      --header='Referer: https://www.vidking.net/' \
      'https://api.wingsdatabase.com/seed?mediaId=550' 2>&1 | head -5 || true"
}

case "$cmd" in
  push-env) push_env ;;
  up) up_gluetun ;;
  rotate) rotate_gluetun ;;
  flaresolverr) recreate_flaresolverr ;;
  app-env) patch_app_env ;;
  test) test_vpn ;;
  all)
    push_env
    up_gluetun
    recreate_flaresolverr
    patch_app_env
    test_vpn
    ;;
  *)
    echo "unknown command: $cmd" >&2
    exit 1
    ;;
esac
