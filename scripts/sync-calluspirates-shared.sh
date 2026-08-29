#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE="${CALLUSPIRATES_SHARED_SOURCE:-$ROOT/../calluspirates/packages/shared}"
TARGET="$ROOT/packages/calluspirates-shared"

if [[ ! -f "$SOURCE/package.json" ]]; then
  if [[ -f "$TARGET/dist/index.js" ]]; then
    echo "using existing vendored @calluspirates/shared"
    exit 0
  fi
  echo "calluspirates shared package not found at: $SOURCE" >&2
  exit 1
fi

mkdir -p "$TARGET"
rsync -a --delete \
  --exclude node_modules \
  --exclude dist \
  --exclude 'src/*.test.ts' \
  "$SOURCE/" "$TARGET/"

if command -v npm >/dev/null 2>&1; then
  (cd "$TARGET" && npm run build)
else
  (cd "$TARGET" && bun run build)
fi

echo "synced @calluspirates/shared -> packages/calluspirates-shared"
