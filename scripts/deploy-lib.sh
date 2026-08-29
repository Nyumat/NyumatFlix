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
