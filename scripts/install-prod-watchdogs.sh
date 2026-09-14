#!/usr/bin/env bash
# Install NyumatFlix systemd watchdog timers on the production host.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -n "${NYUMATFLIX_ROOT:-}" ]]; then
  ROOT="$NYUMATFLIX_ROOT"
else
  ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "install-prod-watchdogs: run with sudo" >&2
    exit 1
  fi
}

write_infra_watchdog_env() {
  local app_user="$1" app_home env_file="/etc/nyumatflix/infra-watchdog.env"
  app_home="$(getent passwd "$app_user" | cut -d: -f6)"
  [[ -n "$app_home" ]] || {
    echo "install-prod-watchdogs: could not resolve home for user $app_user" >&2
    exit 1
  }
  mkdir -p /etc/nyumatflix
  cat >"$env_file" <<EOF
NYUMATFLIX_ROOT=${app_home}/apps/nyumatflix
APP_ENV_FILE=${app_home}/apps/nyumatflix/.env
GLUETUN_ENV_FILE=${app_home}/apps/gluetun/.env
EOF
  chmod 0644 "$env_file"
}

install_watchdog() {
  local script_name="$1" service_file="$2" timer_file="$3"
  install -m 0755 "$ROOT/scripts/${script_name}.sh" "/usr/local/sbin/${script_name}"
  install -m 0644 "$ROOT/scripts/${service_file}" "/etc/systemd/system/${service_file}"
  install -m 0644 "$ROOT/scripts/${timer_file}" "/etc/systemd/system/${timer_file}"
  systemctl daemon-reload
  systemctl enable --now "${timer_file}"
}

install_infra_watchdog_user() {
  local app_user="${1:-${SUDO_USER:-}}"
  [[ -n "$app_user" && "$app_user" != "root" ]] || {
    echo "install-prod-watchdogs: run with sudo from your deploy user (e.g. sudo ./install-prod-watchdogs.sh)" >&2
    exit 1
  }
  write_infra_watchdog_env "$app_user"
  mkdir -p "/etc/systemd/system/nyumatflix-infra-watchdog.service.d"
  cat >"/etc/systemd/system/nyumatflix-infra-watchdog.service.d/override.conf" <<EOF
[Service]
User=${app_user}
Group=${app_user}
EOF
  systemctl daemon-reload
}

main() {
  require_root
  install_watchdog nyumatflix-watchdog nyumatflix-watchdog.service nyumatflix-watchdog.timer
  install_watchdog nyumatflix-infra-watchdog nyumatflix-infra-watchdog.service nyumatflix-infra-watchdog.timer
  install_infra_watchdog_user
  echo "watchdog timers installed"
  systemctl list-timers --all | grep nyumatflix || true
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
