#!/usr/bin/env bash

set -euo pipefail

container="${CONTAINER_NAME:-nyumatflix}"

exec 9>/run/nyumatflix-watchdog/lock
flock -n 9 || exit 0

if ! docker inspect "$container" >/dev/null 2>&1; then
  exit 0
fi

state="$(docker inspect "$container" --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}')"
if [[ "$state" != "running unhealthy" ]]; then
  exit 0
fi

logger -t nyumatflix-watchdog "restarting unhealthy container $container"
docker restart --time 30 "$container" >/dev/null
