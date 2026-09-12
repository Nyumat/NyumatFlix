#!/usr/bin/env bash
# Sync production schema: repair legacy rows, stamp baseline if needed, run migrations.
#
# Usage (from repo root):
#   ENV_FILE=/absolute/path/.env.prod ./scripts/db-migrate-if-needed.sh
#
# CI usage (secrets only):
#   PROD_DATABASE_URL=... ./scripts/db-migrate-if-needed.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.prod}"
WEB_DIR="$ROOT/apps/web"

die() {
  echo "db-migrate-if-needed: $*" >&2
  exit 1
}

[[ -d "$WEB_DIR" ]] || die "web app missing: $WEB_DIR"

if [[ -f "$ENV_FILE" ]]; then
  ENV_FILE="$(cd "$(dirname "$ENV_FILE")" && pwd)/$(basename "$ENV_FILE")"
  echo "using env file: $ENV_FILE"
  DOTENV_PREFIX=(bunx dotenv -e "$ENV_FILE" --)
else
  echo "no env file — using process environment"
  DOTENV_PREFIX=()
fi

run_web() {
  local cmd="$1"
  if [[ ${#DOTENV_PREFIX[@]} -gt 0 ]]; then
    (
      cd "$WEB_DIR"
      "${DOTENV_PREFIX[@]}" bash -c "
        set -euo pipefail
        export DATABASE_URL=\"\${PROD_DATABASE_URL:-\${DATABASE_URL:-}}\"
        [[ -n \"\$DATABASE_URL\" ]] || { echo 'DATABASE_URL missing' >&2; exit 1; }
        $cmd
      "
    )
  else
    (
      cd "$WEB_DIR"
      bash -c "
        set -euo pipefail
        export DATABASE_URL=\"\${PROD_DATABASE_URL:-\${DATABASE_URL:-}}\"
        [[ -n \"\$DATABASE_URL\" ]] || { echo 'DATABASE_URL missing' >&2; exit 1; }
        $cmd
      "
    )
  fi
}

echo "repairing legacy watchlist statuses (if any)..."
run_web "bun run db:repair-watchlist"

echo "ensuring migration baseline is stamped for existing databases..."
run_web "bun run db:ensure-baseline"

echo "applying pending drizzle migrations..."
run_web "bun run db:migrate"

echo "production database schema sync complete"
