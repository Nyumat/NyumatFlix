#!/usr/bin/env bash
# Shared health checks for NyumatFlix production dependencies (VPN, imgproxy, scrape).
# Sourced by reconcile-prod-infra.sh and nyumatflix-infra-watchdog.sh.

infra_read_env_value() {
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

infra_gluetun_api_key() {
  local env_file="${GLUETUN_ENV_FILE:-$HOME/apps/gluetun/.env}"
  infra_read_env_value "$env_file" GLUETUN_CONTROL_API_KEY
}

infra_gluetun_control_get() {
  local path="$1" api_key
  api_key="$(infra_gluetun_api_key)" || return 1
  sudo docker exec gluetun wget -qO- --timeout=8 \
    --header="X-API-Key: ${api_key}" \
    "http://127.0.0.1:8000${path}" 2>/dev/null
}

infra_gluetun_vpn_status() {
  local payload status
  payload="$(infra_gluetun_control_get /v1/vpn/status)" || return 1
  status="$(printf '%s' "$payload" | sed -n 's/.*"status":"\([^"]*\)".*/\1/p')"
  [[ -n "$status" ]] || return 1
  printf '%s' "$status"
}

infra_gluetun_public_ip() {
  local payload ip
  payload="$(infra_gluetun_control_get /v1/publicip/ip)" || return 1
  ip="$(printf '%s' "$payload" | sed -n 's/.*"public_ip":"\([^"]*\)".*/\1/p')"
  [[ -n "$ip" ]] || return 1
  printf '%s' "$ip"
}

infra_gluetun_set_vpn_status() {
  local status="$1" api_key
  api_key="$(infra_gluetun_api_key)" || return 1
  sudo docker exec gluetun wget -qO- --timeout=15 \
    --method=PUT \
    --header="X-API-Key: ${api_key}" \
    --header="Content-Type: application/json" \
    --body-data="{\"status\":\"${status}\"}" \
    "http://127.0.0.1:8000/v1/vpn/status" >/dev/null 2>&1
}

infra_wait_for_gluetun_vpn() {
  local deadline="${1:-90}" vpn_status public_ip
  deadline=$((SECONDS + deadline))
  while ((SECONDS < deadline)); do
    vpn_status="$(infra_gluetun_vpn_status 2>/dev/null || true)"
    public_ip="$(infra_gluetun_public_ip 2>/dev/null || true)"
    if [[ "$vpn_status" == "running" && -n "$public_ip" ]]; then
      return 0
    fi
    sleep 2
  done
  return 1
}

infra_ensure_gluetun_vpn() {
  local vpn_status restart_attempts=0
  if ! sudo docker inspect gluetun >/dev/null 2>&1; then
    return 1
  fi

  vpn_status="$(infra_gluetun_vpn_status 2>/dev/null || true)"
  if [[ "$vpn_status" != "running" ]]; then
    infra_gluetun_set_vpn_status running || true
    if ! infra_wait_for_gluetun_vpn "${INFRA_VPN_WAIT_SECONDS:-90}"; then
      while ((restart_attempts < 2)); do
        restart_attempts=$((restart_attempts + 1))
        sudo docker restart gluetun >/dev/null
        sleep 10
        infra_gluetun_set_vpn_status running || true
        if infra_wait_for_gluetun_vpn "${INFRA_VPN_WAIT_SECONDS:-90}"; then
          break
        fi
      done
    fi
  fi

  vpn_status="$(infra_gluetun_vpn_status 2>/dev/null || true)"
  [[ "$vpn_status" == "running" ]] || return 1
  [[ -n "$(infra_gluetun_public_ip 2>/dev/null || true)" ]] || return 1
  return 0
}

infra_verify_gluetun_proxy() {
  local proxy_ip=""
  if sudo docker inspect nyumatflix >/dev/null 2>&1; then
    proxy_ip="$(sudo docker exec nyumatflix curl -fsS --max-time 20 \
      -x http://gluetun:8888 https://ifconfig.me/ip 2>/dev/null || true)"
  fi
  if [[ -z "$proxy_ip" ]]; then
    proxy_ip="$(sudo docker run --rm --network "${DOCKER_NETWORK:-betterome}" \
      curlimages/curl:8.5.0 -fsS --max-time 20 \
      -x "http://gluetun:8888" https://ifconfig.me/ip 2>/dev/null || true)"
  fi
  [[ -n "$proxy_ip" ]] || return 1
  printf '%s' "$proxy_ip"
}

infra_verify_imgproxy() {
  curl -fsS --max-time 5 "http://127.0.0.1:9081/health" >/dev/null 2>&1
}

infra_verify_flaresolverr() {
  sudo docker exec gluetun wget -qO- --timeout=8 http://flaresolverr:8191/ >/dev/null 2>&1
}

infra_verify_flipt() {
  sudo docker exec gluetun wget -qO- --timeout=8 http://flipt:8080/health >/dev/null 2>&1
}

infra_verify_all_dependencies() {
  local proxy_ip
  infra_ensure_gluetun_vpn || return 1
  proxy_ip="$(infra_verify_gluetun_proxy)" || return 1
  infra_verify_imgproxy || return 1
  infra_verify_flaresolverr || return 1
  infra_verify_flipt || return 1
  echo "gluetun vpn ok (egress ${proxy_ip})"
  return 0
}
