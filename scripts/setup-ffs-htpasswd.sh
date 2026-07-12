#!/usr/bin/env bash
set -euo pipefail

HTPASSWD_FILE="${HTPASSWD_FILE:-/etc/nginx/.htpasswd-ffs}"

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "htpasswd not found. Install apache2-utils (Debian/Ubuntu) or httpd-tools (RHEL)." >&2
  exit 1
fi

if [[ -f "$HTPASSWD_FILE" ]]; then
  echo "Updating password for user in $HTPASSWD_FILE"
  sudo htpasswd "$HTPASSWD_FILE"
else
  echo "Creating $HTPASSWD_FILE"
  sudo htpasswd -c "$HTPASSWD_FILE"
fi

echo "Done. Reload nginx after updating scripts/nginx-ffs-nyumatflix.conf."
