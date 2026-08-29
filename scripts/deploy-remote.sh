#!/usr/bin/env bash
# Non-interactive deploy pipeline for workstation -> leetbot.
# Prefer: bun run deploy (TUI). This script is the plain backend.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SSH_HOST="${SSH_HOST:-leetbot}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-apps/nyumatflix}"

# shellcheck disable=SC1091
source "$SCRIPT_DIR/deploy-lib.sh"
ROOT="$ROOT" resolve_deploy_git_meta

export DEPLOY_SHA DEPLOY_SHORT_SHA DEPLOY_MESSAGE DEPLOY_AUTHOR
export DEPLOY_SOURCE="${DEPLOY_SOURCE:-local}"
export DOCKER_IMAGE="${DOCKER_IMAGE:-$DOCKER_REPO:$DEPLOY_SHA}"

echo "==> NyumatFlix remote deploy (${SSH_HOST}) ${DEPLOY_SHORT_SHA}"

"$ROOT/scripts/deploy.sh" bp
"$ROOT/scripts/sync-prod-env.sh" push

ssh "$SSH_HOST" "$(cat <<EOF
set -euo pipefail
cd "\$HOME/${REMOTE_APP_DIR}"
export NYUMATFLIX_ROOT="\$HOME/${REMOTE_APP_DIR}"
export DOCKER_IMAGE='${DOCKER_IMAGE}'
export DEPLOY_SHA='${DEPLOY_SHA}'
export DEPLOY_SHORT_SHA='${DEPLOY_SHORT_SHA}'
export DEPLOY_MESSAGE='$(label_safe "$DEPLOY_MESSAGE" | sed "s/'/'\\\\''/g")'
export DEPLOY_AUTHOR='$(label_safe "$DEPLOY_AUTHOR" | sed "s/'/'\\\\''/g")'
export DEPLOY_SOURCE='${DEPLOY_SOURCE}'
./scripts/deploy.sh serve
EOF
)"

echo "deploy complete: ${DEPLOY_SHORT_SHA}"
