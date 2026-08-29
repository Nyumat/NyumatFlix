#!/usr/bin/env bash
# Run any local NyumatFlix service under one Docker Compose project.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

exec docker compose \
  --project-directory "$ROOT" \
  --env-file "$ROOT/.env" \
  --env-file "$ROOT/.env.local" \
  -f "$ROOT/docker-compose.local-stack.yml" \
  "$@"
