#!/usr/bin/env bash
# Runs on leetbot via scripts/rotate-vpn.mts over SSH.

set -euo pipefail

GLUETUN_ENV_FILE="${GLUETUN_ENV_FILE:-$HOME/apps/gluetun/.env}"
CURSOR_FILE="${GLUETUN_ROTATE_CURSOR_FILE:-$HOME/.gluetun-rotate-cursor}"
CONTROL_BASE="http://127.0.0.1:8000"
VPN_READY_POLL_SECONDS=1
VPN_READY_MAX_ATTEMPTS=45
VPN_STOP_SETTLE_SECONDS=2

die() {
  local message="${1//\"/\\\"}"
  printf '{"ok":false,"error":"%s"}\n' "$message"
  exit 1
}

read_env_value() {
  local key="$1" raw
  [[ -f "$GLUETUN_ENV_FILE" ]] || return 1
  raw="$(awk -v key="$key" '
    index($0, key "=") == 1 { value = substr($0, length(key) + 2); found = 1 }
    END { if (found) print value }
  ' "$GLUETUN_ENV_FILE")"
  [[ -n "$raw" ]] || return 1
  if [[ "$raw" == \"*\" && "$raw" == *\" ]]; then
    raw="${raw:1:${#raw}-2}"
  elif [[ "$raw" == \'*\' && "$raw" == *\' ]]; then
    raw="${raw:1:${#raw}-2}"
  fi
  printf '%s' "$raw"
}

json_field() {
  local payload="$1" field="$2"
  printf '%s' "$payload" | grep -o "\"${field}\":\"[^\"]*\"" | head -n1 | sed 's/.*:"\([^"]*\)"/\1/'
}

gluetun_request() {
  local method="$1" path="$2" body="${3:-}"
  local args=(
    sudo docker exec gluetun wget -qO- --timeout=30
    --header="X-API-Key: ${API_KEY}"
  )

  if [[ -n "$body" ]]; then
    args+=(--header="Content-Type: application/json" --body-data="$body")
  fi

  args+=(--method="$method" "${CONTROL_BASE}${path}")
  "${args[@]}" 2>/dev/null || return 1
}

pick_rotate_country() {
  local countries_csv="$1"
  local -a countries=()
  local part cursor index country

  while IFS= read -r part; do
    part="${part#"${part%%[![:space:]]*}"}"
    part="${part%"${part##*[![:space:]]}"}"
    [[ -n "$part" ]] && countries+=("$part")
  done < <(printf '%s' "$countries_csv" | tr ',' '\n')

  ((${#countries[@]} > 0)) || return 1

  cursor=0
  [[ -f "$CURSOR_FILE" ]] && cursor="$(cat "$CURSOR_FILE" 2>/dev/null || echo 0)"
  [[ "$cursor" =~ ^[0-9]+$ ]] || cursor=0

  index=$((cursor % ${#countries[@]}))
  country="${countries[$index]}"
  printf '%s\n' "$((cursor + 1))" >"$CURSOR_FILE"
  printf '%s' "$country"
}

read_public_ip() {
  local payload ip
  payload="$(gluetun_request GET /v1/publicip/ip || true)"
  ip="$(json_field "$payload" public_ip)"
  if [[ -n "$ip" ]]; then
    printf '%s' "$ip"
    return 0
  fi

  sudo docker exec gluetun wget -qO- --timeout=10 http://ifconfig.io/ip 2>/dev/null || true
}

wait_for_egress_ready() {
  local attempt status public_ip
  for ((attempt = 1; attempt <= VPN_READY_MAX_ATTEMPTS; attempt += 1)); do
    sleep "$VPN_READY_POLL_SECONDS"
    status="$(json_field "$(gluetun_request GET /v1/vpn/status || true)" status)"
    public_ip="$(read_public_ip)"
    if [[ "$status" == "running" && -n "$public_ip" ]]; then
      printf '%s' "$public_ip"
      return 0
    fi
  done
  return 1
}

status_only() {
  local public_ip vpn_status countries
  API_KEY="$(read_env_value GLUETUN_CONTROL_API_KEY || true)"
  [[ -n "$API_KEY" ]] || die "GLUETUN_CONTROL_API_KEY is missing in $GLUETUN_ENV_FILE"

  sudo docker inspect gluetun >/dev/null 2>&1 || die "gluetun container is not running"

  public_ip="$(read_public_ip)"
  vpn_status="$(json_field "$(gluetun_request GET /v1/vpn/status || true)" status)"
  countries="$(read_env_value SCRAPE_VPN_ROTATE_COUNTRIES || read_env_value SERVER_COUNTRIES || true)"

  printf '{"ok":true,"publicIp":"%s","vpnStatus":"%s","countries":"%s"}\n' \
    "${public_ip:-}" \
    "${vpn_status:-}" \
    "${countries:-}"
}

rotate() {
  local started_at="$SECONDS"
  local countries_csv country previous_ip public_ip elapsed_ms

  API_KEY="$(read_env_value GLUETUN_CONTROL_API_KEY || true)"
  [[ -n "$API_KEY" ]] || die "GLUETUN_CONTROL_API_KEY is missing in $GLUETUN_ENV_FILE"

  countries_csv="$(read_env_value SCRAPE_VPN_ROTATE_COUNTRIES || read_env_value SERVER_COUNTRIES || true)"
  [[ -n "$countries_csv" ]] || die "No rotate countries configured in $GLUETUN_ENV_FILE"

  sudo docker inspect gluetun >/dev/null 2>&1 || die "gluetun container is not running"

  previous_ip="$(read_public_ip)"

  country="$(pick_rotate_country "$countries_csv" || true)"
  if [[ -n "$country" ]]; then
    gluetun_request PUT /v1/vpn/settings \
      "{\"VPN_SERVICE_PROVIDER\":\"surfshark\",\"SERVER_COUNTRIES\":\"$country\"}" \
      >/dev/null || die "Failed to update Gluetun server country"
  fi

  gluetun_request PUT /v1/vpn/status '{"status":"stopped"}' >/dev/null \
    || die "Failed to stop Gluetun VPN"

  sleep "$VPN_STOP_SETTLE_SECONDS"

  gluetun_request PUT /v1/vpn/status '{"status":"running"}' >/dev/null \
    || die "Failed to start Gluetun VPN"

  public_ip="$(wait_for_egress_ready || true)"
  [[ -n "$public_ip" ]] || die "Gluetun reconnected but public IP is unavailable"

  elapsed_ms=$(( (SECONDS - started_at) * 1000 ))
  printf '{"ok":true,"previousPublicIp":"%s","publicIp":"%s","country":"%s","elapsedMs":%s}\n' \
    "${previous_ip:-}" \
    "$public_ip" \
    "${country:-}" \
    "$elapsed_ms"
}

main() {
  local command="${1:-rotate}"
  case "$command" in
    status) status_only ;;
    rotate) rotate ;;
    *) die "unknown command: $command" ;;
  esac
}

main "$@"
