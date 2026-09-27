#!/usr/bin/env bash
# Purge BunnyCDN edge cache for catalog HTML after deploy.
# Requires BUNNY_API_KEY and BUNNY_PULL_ZONE_ID (nyumatflix.com HTML zone).
set -euo pipefail

API_KEY="${BUNNY_API_KEY:-}"
ZONE_ID="${BUNNY_PULL_ZONE_ID:-}"
PURGE_MODE="${BUNNY_PURGE_MODE:-full}"
PURGE_PATHS="${BUNNY_PURGE_PATHS:-/,/movies,/tvshows,/trending,/anime,/collections}"
ROOT="${NYUMATFLIX_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
WARM_PATHS_FILE="${BUNNY_WARM_PATHS_FILE:-$ROOT/apps/web/data/hubs/warm-paths.json}"

if [[ -z "$API_KEY" || -z "$ZONE_ID" ]]; then
  echo "bunny purge skipped (set BUNNY_API_KEY and BUNNY_PULL_ZONE_ID to enable)"
  exit 0
fi

purge_url() {
  local path="$1"
  local encoded
  encoded="$(python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=""))' "$path")"
  if curl -fsS -X POST \
    "https://api.bunny.net/pullzone/${ZONE_ID}/purgeCache?url=https://nyumatflix.com${encoded}" \
    -H "AccessKey: ${API_KEY}" \
    -H "Content-Type: application/json" >/dev/null; then
    echo "bunny purged ${path}"
    return 0
  fi
  echo "bunny purge failed for ${path}" >&2
  return 1
}

purge_full_zone() {
  if curl -fsS -X POST \
    "https://api.bunny.net/pullzone/${ZONE_ID}/purgeCache" \
    -H "AccessKey: ${API_KEY}" \
    -H "Content-Type: application/json" >/dev/null; then
    echo "bunny purged full pull zone ${ZONE_ID}"
    return 0
  fi
  echo "bunny full-zone purge failed for pull zone ${ZONE_ID}" >&2
  return 1
}

load_warm_paths() {
  if [[ ! -f "$WARM_PATHS_FILE" ]]; then
    return 1
  fi
  python3 - <<'PY' "$WARM_PATHS_FILE"
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    payload = json.load(handle)

for path in payload.get("paths", []):
    if isinstance(path, str) and path.startswith("/"):
        print(path)
PY
}

failed=0
succeeded=0

case "$PURGE_MODE" in
  full)
    if purge_full_zone; then
      succeeded=1
    else
      failed=1
    fi
    ;;
  warm)
    if ! paths="$(load_warm_paths)"; then
      echo "bunny warm purge: warm-paths file missing, falling back to hub paths" >&2
      paths="$PURGE_PATHS"
      IFS=',' read -r -a path_array <<<"$paths"
      for path in "${path_array[@]}"; do
        trimmed="${path#"${path%%[![:space:]]*}"}"
        trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
        [[ -n "$trimmed" ]] || continue
        if purge_url "$trimmed"; then
          succeeded=$((succeeded + 1))
        else
          failed=$((failed + 1))
        fi
      done
    else
      while IFS= read -r path; do
        [[ -n "$path" ]] || continue
        if purge_url "$path"; then
          succeeded=$((succeeded + 1))
        else
          failed=$((failed + 1))
        fi
      done <<<"$paths"
    fi
    ;;
  paths|*)
    IFS=',' read -r -a path_array <<<"$PURGE_PATHS"
    for path in "${path_array[@]}"; do
      trimmed="${path#"${path%%[![:space:]]*}"}"
      trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
      [[ -n "$trimmed" ]] || continue
      if purge_url "$trimmed"; then
        succeeded=$((succeeded + 1))
      else
        failed=$((failed + 1))
      fi
    done
    ;;
esac

echo "bunny purge complete (${succeeded} ok, ${failed} failed, mode=${PURGE_MODE})"
if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
