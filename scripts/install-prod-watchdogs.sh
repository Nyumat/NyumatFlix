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

install_watchdog() {
  local script_name="$1" service_file="$2" timer_file="$3"
  install -m 0755 "$ROOT/scripts/${script_name}.sh" "/usr/local/sbin/${script_name}"
  install -m 0644 "$ROOT/scripts/${service_file}" "/etc/systemd/system/${service_file}"
  install -m 0644 "$ROOT/scripts/${timer_file}" "/etc/systemd/system/${timer_file}"
  systemctl daemon-reload
  systemctl enable --now "${timer_file}"
}

main() {
  require_root
  install_watchdog nyumatflix-watchdog nyumatflix-watchdog.service nyumatflix-watchdog.timer
  install_watchdog nyumatflix-infra-watchdog nyumatflix-infra-watchdog.service nyumatflix-infra-watchdog.timer
  echo "watchdog timers installed"
  systemctl list-timers --all | grep nyumatflix || true
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
