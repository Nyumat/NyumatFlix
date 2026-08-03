#!/usr/bin/env bash
# Workstation deploy: build/push image, sync prod env, roll container on leetbot.
# Usage: ./scripts/deploy-remote.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSH_HOST="${SSH_HOST:-leetbot}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-apps/nyumatflix}"

echo "==> NyumatFlix remote deploy (${SSH_HOST})"
"$ROOT/scripts/deploy.sh" bp
"$ROOT/scripts/sync-prod-env.sh" push
ssh "$SSH_HOST" "cd \"\$HOME/${REMOTE_APP_DIR}\" && ./scripts/deploy.sh serve"
echo "✅ NyumatFlix deploy complete"
