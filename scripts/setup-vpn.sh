#!/usr/bin/env bash
# Workstation entrypoint for NyumatFlix production infrastructure.
# Usage: setup-vpn.sh bootstrap | ensure | update | rotate | status | test

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SSH_HOST="${SSH_HOST:-leetbot}"
LOCAL_VPN_ENV="${LOCAL_VPN_ENV:-$ROOT/.env.vpn}"

sync_reconciler() {
  ssh "$SSH_HOST" 'mkdir -p "$HOME/apps/nyumatflix/scripts" "$HOME/apps/gluetun"'
  rsync -avz \
    "$ROOT/docker-compose.scrape.yml" \
    "$ROOT/docker-compose.ffs.yml" \
    "$SSH_HOST:~/apps/nyumatflix/"
  rsync -avz \
    "$ROOT/scripts/reconcile-prod-infra.sh" \
    "$SSH_HOST:~/apps/nyumatflix/scripts/reconcile-prod-infra.sh"
  if [[ -d "$ROOT/flipt" ]]; then
    rsync -avz "$ROOT/flipt/" "$SSH_HOST:~/apps/nyumatflix/flipt/"
  fi
}

upload_vpn_seed() {
  [[ -f "$LOCAL_VPN_ENV" ]] || {
    echo "VPN seed file is missing: $LOCAL_VPN_ENV" >&2
    exit 1
  }
  ssh "$SSH_HOST" 'umask 077; cat > "$HOME/apps/gluetun/.env.seed.incoming"; mv "$HOME/apps/gluetun/.env.seed.incoming" "$HOME/apps/gluetun/.env.seed"' <"$LOCAL_VPN_ENV"
}

run_reconciler() {
  local action="$1"
  ssh "$SSH_HOST" "NYUMATFLIX_ROOT=\"\$HOME/apps/nyumatflix\" \"\$HOME/apps/nyumatflix/scripts/reconcile-prod-infra.sh\" '$action'"
}

bootstrap() {
  sync_reconciler
  upload_vpn_seed
  run_reconciler ensure
}

ensure() {
  sync_reconciler
  run_reconciler ensure
}

update() {
  sync_reconciler
  run_reconciler update
}

rotate() {
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

test_runtime() {
  ssh "$SSH_HOST" 'set -eu
    sudo docker exec gluetun wget -qO- --timeout=10 http://ifconfig.io/ip >/dev/null
    sudo docker exec gluetun wget -qO- --timeout=10 http://flaresolverr:8191/ >/dev/null
    sudo docker exec gluetun wget -qO- --timeout=10 http://flipt:8080/health >/dev/null
    echo "production infrastructure checks passed"'
}

main() {
  local command="${1:-}"
  if [[ -z "$command" ]]; then
    echo "usage: $0 bootstrap | ensure | update | rotate | status | test" >&2
    exit 1
  fi

  case "$command" in
    bootstrap | all) bootstrap ;;
    ensure) ensure ;;
    update) update ;;
    rotate) rotate ;;
    status)
      sync_reconciler
      run_reconciler status
      ;;
    test) test_runtime ;;
    *)
      echo "unknown command: $command (use bootstrap, ensure, update, rotate, status, or test)" >&2
      exit 1
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
