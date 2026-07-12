#!/usr/bin/env bash
set -euo pipefail

HTPASSWD_FILE="${HTPASSWD_FILE:-/etc/nginx/.htpasswd-ffs}"
USERNAME="${1:-admin}"
PASSWORD="${2:-}"

usage() {
  cat <<EOF
usage: $0 [username] [password]

  username  htpasswd user (default: admin)
  password  if omitted, htpasswd prompts interactively

env:
  HTPASSWD_FILE  default /etc/nginx/.htpasswd-ffs

examples:
  $0                    # prompt for admin password
  $0 admin              # prompt for admin password
  $0 admin 's3cret'     # set password non-interactively
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v htpasswd >/dev/null 2>&1; then
  echo "htpasswd not found. Install apache2-utils (Debian/Ubuntu) or httpd-tools (RHEL)." >&2
  exit 1
fi

if [[ -f "$HTPASSWD_FILE" ]]; then
  echo "Updating password for $USERNAME in $HTPASSWD_FILE"
  if [[ -n "$PASSWORD" ]]; then
    sudo htpasswd -b "$HTPASSWD_FILE" "$USERNAME" "$PASSWORD"
  else
    sudo htpasswd "$HTPASSWD_FILE" "$USERNAME"
  fi
else
  echo "Creating $HTPASSWD_FILE for user $USERNAME"
  if [[ -n "$PASSWORD" ]]; then
    sudo htpasswd -cb "$HTPASSWD_FILE" "$USERNAME" "$PASSWORD"
  else
    sudo htpasswd -c "$HTPASSWD_FILE" "$USERNAME"
  fi
fi

echo "Done. Reload nginx: sudo nginx -t && sudo systemctl reload nginx"
