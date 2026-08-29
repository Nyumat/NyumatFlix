#!/usr/bin/env bash
# Apply Drizzle migrations to production only when the journal has pending entries.
# Usage: ./scripts/db-migrate-if-needed.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.prod}"
JOURNAL_FILE="${JOURNAL_FILE:-$ROOT/db/migrations/meta/_journal.json}"

die() {
  echo "db-migrate-if-needed: $*" >&2
  exit 1
}

[[ -f "$ENV_FILE" ]] || die "env file missing: $ENV_FILE"
[[ -f "$JOURNAL_FILE" ]] || die "migration journal missing: $JOURNAL_FILE"

journal_count="$(jq '.entries | length' "$JOURNAL_FILE")"
applied_count="$(
  bunx dotenv -e "$ENV_FILE" -- bun -e "
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);
const rows = await sql\`SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations\`;
console.log(rows[0]?.count ?? 0);
"
)"

if [[ "$applied_count" -ge "$journal_count" ]]; then
  echo "database migrations up to date (${applied_count}/${journal_count})"
  exit 0
fi

pending_count=$((journal_count - applied_count))
echo "applying ${pending_count} pending migration(s) (${applied_count}/${journal_count} applied)"
bunx dotenv -e "$ENV_FILE" -- bun run db:migrate
echo "database migrations complete"
