#!/usr/bin/env bash

DOCKER_REPO="${DOCKER_REPO:-whotypes/nyumatflix}"
DEPLOY_HISTORY_FILE="${DEPLOY_HISTORY_FILE:-}"

resolve_deploy_git_meta() {
  if [[ -n "${DEPLOY_SHA:-}" ]]; then
    DEPLOY_SHORT_SHA="${DEPLOY_SHORT_SHA:-${DEPLOY_SHA:0:7}}"
    DEPLOY_MESSAGE="${DEPLOY_MESSAGE:-}"
    DEPLOY_AUTHOR="${DEPLOY_AUTHOR:-}"
    return 0
  fi

  if ! git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    echo "deploy: not a git repository and DEPLOY_SHA is unset" >&2
    return 1
  fi

  DEPLOY_SHA="$(git -C "$ROOT" rev-parse HEAD)"
  DEPLOY_SHORT_SHA="$(git -C "$ROOT" rev-parse --short=7 HEAD)"
  DEPLOY_MESSAGE="$(git -C "$ROOT" log -1 --pretty=format:%s)"
  DEPLOY_AUTHOR="$(git -C "$ROOT" log -1 --pretty=format:%an)"
  apply_deploy_dirty_suffix
}

apply_deploy_dirty_suffix() {
  if [[ "${DEPLOY_SHA:-}" == *"-dirty" ]]; then
    return 0
  fi
  if git -C "$ROOT" diff --quiet && git -C "$ROOT" diff --cached --quiet; then
    return 0
  fi

  DEPLOY_SHA="${DEPLOY_SHA}-dirty"
  DEPLOY_SHORT_SHA="${DEPLOY_SHORT_SHA}+"
  DEPLOY_MESSAGE="${DEPLOY_MESSAGE} (uncommitted)"
}

label_safe() {
  local value="${1:-}"
  value="${value//$'\n'/ }"
  value="${value//$'\r'/}"
  printf '%.120s' "$value"
}

read_env_file_value() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 1
  python3 - "$file" "$key" <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
key = sys.argv[2]
for raw in path.read_text(encoding="utf-8").splitlines():
    line = raw.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    name, _, value = line.partition("=")
    if name.strip() != key:
        continue
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
        value = value[1:-1]
    print(value, end="")
    break
PY
}

export_env_keys_from_file() {
  local file="$1"
  shift
  local key value
  [[ -f "$file" ]] || return 0
  for key in "$@"; do
    value="$(read_env_file_value "$file" "$key" || true)"
    if [[ -n "$value" ]]; then
      export "$key=$value"
    fi
  done
}

record_deployment() {
  local history_file="${DEPLOY_HISTORY_FILE:-$ROOT/deployments.jsonl}"
  local deployed_at target_port
  deployed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  target_port="${DEPLOY_TARGET_PORT:-0}"

  mkdir -p "$(dirname "$history_file")"
  DEPLOY_SHA="${DEPLOY_SHA:-unknown}"
  DEPLOY_SHORT_SHA="${DEPLOY_SHORT_SHA:-${DEPLOY_SHA:0:7}}"
  DEPLOY_MESSAGE="${DEPLOY_MESSAGE:-}"
  DEPLOY_AUTHOR="${DEPLOY_AUTHOR:-}"
  DEPLOY_SOURCE="${DEPLOY_SOURCE:-local}"
  DOCKER_IMAGE="${DOCKER_IMAGE:-$DOCKER_REPO:latest}"
  DEPLOY_TS="$deployed_at"
  DEPLOY_PORT="$target_port"
  export DEPLOY_SHA DEPLOY_SHORT_SHA DEPLOY_MESSAGE DEPLOY_AUTHOR DEPLOY_SOURCE DOCKER_IMAGE DEPLOY_TS DEPLOY_PORT

  python3 - <<'PY' >>"$history_file"
import json
import os

entry = {
    "sha": os.environ["DEPLOY_SHA"],
    "shortSha": os.environ["DEPLOY_SHORT_SHA"],
    "message": os.environ.get("DEPLOY_MESSAGE", ""),
    "author": os.environ.get("DEPLOY_AUTHOR", ""),
    "deployedAt": os.environ["DEPLOY_TS"],
    "image": os.environ["DOCKER_IMAGE"],
    "source": os.environ.get("DEPLOY_SOURCE", "local"),
    "port": int(os.environ.get("DEPLOY_PORT") or "0"),
    "dirty": os.environ.get("DEPLOY_SHA", "").endswith("-dirty"),
}
print(json.dumps(entry, ensure_ascii=True))
PY
}

print_deploy_history() {
  local history_file="${DEPLOY_HISTORY_FILE:-$ROOT/deployments.jsonl}" limit="${1:-20}"
  [[ -f "$history_file" ]] || return 0
  python3 - <<'PY' "$history_file" "$limit"
import json
import sys

path, limit = sys.argv[1], int(sys.argv[2])
entries = []
with open(path, encoding="utf-8") as handle:
    for line in handle:
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue

for entry in entries[-limit:][::-1]:
    print(
        f"{entry.get('shortSha', entry.get('sha', '')[:7])}\t"
        f"{entry.get('deployedAt', '')}\t"
        f"{entry.get('source', '')}\t"
        f"{entry.get('author', '')}\t"
        f"{entry.get('message', '')}\t"
        f"{entry.get('image', '')}"
    )
PY
}

current_deploy_labels() {
  local container="${CONTAINER_NAME:-nyumatflix}"
  sudo docker inspect "$container" --format \
    '{{index .Config.Labels "nyumatflix.deploy.sha"}}|{{index .Config.Labels "nyumatflix.deploy.short_sha"}}|{{index .Config.Labels "nyumatflix.deploy.message"}}|{{index .Config.Labels "nyumatflix.deploy.author"}}|{{index .Config.Labels "nyumatflix.deploy.at"}}|{{index .Config.Labels "nyumatflix.deploy.source"}}|{{.Config.Image}}' \
    2>/dev/null || true
}

docker_cli_for_container() {
  local container="$1"
  if sudo docker inspect "$container" >/dev/null 2>&1; then
    printf '%s\n' "sudo docker"
    return 0
  fi
  if docker inspect "$container" >/dev/null 2>&1; then
    printf '%s\n' "docker"
    return 0
  fi
  return 1
}

verify_scrape_api_route() {
  local container="${1:-}"
  local port="${2:-${CONTAINER_APP_PORT:-8080}}"
  local base_url="${3:-}"
  local payload docker_cli

  if [[ -n "$container" ]]; then
    docker_cli="$(docker_cli_for_container "$container")" || {
      echo "scrape route check failed: container not found ($container)" >&2
      return 1
    }
    payload="$($docker_cli exec "$container" curl -fsS --max-time 15 \
      -H "x-nyumat-client: 1" \
      "http://127.0.0.1:${port}/api/scrape" 2>/dev/null)" || {
      echo "scrape route check failed inside container: $container" >&2
      return 1
    }
  elif [[ -n "$base_url" ]]; then
    payload="$(curl -fsS --max-time 15 \
      -H "x-nyumat-client: 1" \
      "${base_url%/}/api/scrape" 2>/dev/null)" || {
      echo "scrape route check failed at ${base_url}" >&2
      return 1
    }
  else
    echo "verify_scrape_api_route: container name or base_url required" >&2
    return 1
  fi

  # -c keeps the program off stdin so the piped response body is what gets parsed.
  printf '%s' "$payload" | python3 -c "$(cat <<'PY'
import json
import sys

raw = sys.stdin.read()
try:
    data = json.loads(raw)
except json.JSONDecodeError:
    print("scrape route returned invalid JSON", file=sys.stderr)
    raise SystemExit(1)

providers = data.get("providers")
if not isinstance(providers, dict):
    print("scrape route missing providers object", file=sys.stderr)
    raise SystemExit(1)

anime = providers.get("anime")
if not isinstance(anime, list) or len(anime) == 0:
    print("scrape route missing anime providers", file=sys.stderr)
    raise SystemExit(1)

tmdb = providers.get("tmdb")
if not isinstance(tmdb, list) or len(tmdb) == 0:
    print("scrape route missing tmdb providers", file=sys.stderr)
    raise SystemExit(1)

print(
    f"scrape route ok ({len(anime)} anime, {len(tmdb)} tmdb providers)",
    end="",
)
PY
)"
}
