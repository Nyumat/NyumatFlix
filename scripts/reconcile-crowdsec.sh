#!/usr/bin/env bash
# Reconcile self-hosted CrowdSec + nginx bouncer for NyumatFlix.
# Usage: reconcile-crowdsec.sh ensure | update | status | bouncer-key

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${CROWDSEC_COMPOSE_FILE:-$ROOT/docker-compose.crowdsec.yml}"
PROJECT="${CROWDSEC_COMPOSE_PROJECT:-nyumatflix-crowdsec}"
ENV_FILE="${CROWDSEC_ENV_FILE:-$HOME/apps/nyumatflix/.env}"
ACQUIS_DIR="${CROWDSEC_ACQUIS_DIR:-$ROOT/scripts/crowdsec/acquis.d}"

read_env_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  awk -v key="$key" '
    index($0, key "=") == 1 { value = substr($0, length(key) + 2); found = 1 }
    END { if (found) print value }
  ' "$file"
}

upsert_env_var() {
  local file="$1" key="$2" value="$3" tmp
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

compose() {
  local env_args=(--env-file "$ENV_FILE")
  CROWDSEC_ACQUIS_DIR="$ACQUIS_DIR" \
    docker compose "${env_args[@]}" -p "$PROJECT" -f "$COMPOSE_FILE" "$@"
}

compose_with_bouncer() {
  compose --profile bouncer "$@"
}

ensure_bouncer_key() {
  local existing
  existing="$(read_env_value "$ENV_FILE" CROWDSEC_BOUNCER_KEY || true)"
  if [[ -n "$existing" ]]; then
    return 0
  fi

  compose up -d crowdsec
  for _ in $(seq 1 30); do
    if compose exec -T crowdsec cscli version >/dev/null 2>&1; then
      break
    fi
    sleep 2
  done

  local key
  key="$(compose exec -T crowdsec cscli bouncers add nyumatflix-nginx -o raw 2>/dev/null | tr -d '\r' || true)"
  if [[ -z "$key" ]]; then
    key="$(compose exec -T crowdsec cscli bouncers list -o raw 2>/dev/null | awk -F',' 'NR==2 {print $1}' || true)"
  fi
  [[ -n "$key" ]] || {
    echo "failed to provision CrowdSec bouncer key" >&2
    exit 1
  }
  upsert_env_var "$ENV_FILE" CROWDSEC_BOUNCER_KEY "$key"
  echo "stored CROWDSEC_BOUNCER_KEY in $ENV_FILE"
}

install_nginx_bouncer_config() {
  local src="$ROOT/scripts/nginx-crowdsec-bouncer.conf"
  local dest="/etc/nginx/conf.d/crowdsec-bouncer.conf"
  sudo cp "$src" "$dest"
  sudo nginx -t
  sudo systemctl reload nginx
}

# these scenarios treat normal browsing + our own api 403s as attacks
NOISY_SCENARIOS=(
  crowdsecurity/http-probing
  crowdsecurity/http-crawl-non_statics
  LePresidente/http-generic-403-bf
)

disable_noisy_scenarios() {
  local scenario
  for scenario in "${NOISY_SCENARIOS[@]}"; do
    compose exec -T crowdsec cscli scenarios remove "$scenario" --force >/dev/null 2>&1 || true
  done
  compose exec -T crowdsec cscli decisions delete --all >/dev/null 2>&1 || true
}

case "${1:-}" in
  ensure)
    ensure_bouncer_key
    compose config --quiet
    compose up -d crowdsec
    compose_with_bouncer up -d
    disable_noisy_scenarios
    install_nginx_bouncer_config
    ;;
  update)
    ensure_bouncer_key
    compose pull
    compose up -d crowdsec
    compose_with_bouncer up -d
    disable_noisy_scenarios
    install_nginx_bouncer_config
    ;;
  status)
    compose_with_bouncer ps
    ;;
  bouncer-key)
    ensure_bouncer_key
    ;;
  *)
    echo "usage: $0 ensure | update | status | bouncer-key" >&2
    exit 1
    ;;
esac
