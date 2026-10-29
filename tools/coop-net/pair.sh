#!/usr/bin/env bash
# Runs one host and one guest of tools/coop-net/peer.mjs in the Playwright image
# and prints both RESULT lines. The guest runs here (GUEST_AT=local) or on an SSH
# host (GUEST_AT=<ssh host>, its work dir in REMOTE_DIR), so the two browsers
# meet over the real Internet.
#   HOST_ARGS="--browser=firefox" GUEST_ARGS="--turn=relay" GUEST_AT=vpscontavo tools/coop-net/pair.sh
# WORK: a local dir holding peer.mjs and node_modules/playwright (see README.md).
# DOCKER_NET=host lets local peers reach a build served on this machine (vite preview).
set -euo pipefail
IMAGE=${IMAGE:-mcr.microsoft.com/playwright:v1.49.1-noble}
WORK=${WORK:?set WORK to the local work dir}
REMOTE_DIR=${REMOTE_DIR:-/home/fran/coop-net}
GUEST_AT=${GUEST_AT:-local}
log=$(mktemp)
trap 'rm -f "$log"' EXIT

run() { docker run --rm --init --ipc=host ${DOCKER_NET:+--network "$DOCKER_NET"} -u "$(id -u):$(id -g)" -e HOME=/w -v "$1":/w -w /w "$IMAGE" node peer.mjs "${@:2}"; }

run "$WORK" --role=host $HOST_ARGS >"$log" 2>&1 &
host=$!
code=""
for _ in $(seq 1 120); do
  code=$(grep -oE '^CODE [A-Z0-9]{5}' "$log" | cut -d' ' -f2 || true)
  [ -n "$code" ] && break
  sleep 0.5
done
if [ -z "$code" ]; then
  wait $host || true
  cat "$log"
  exit 1
fi
if [ "$GUEST_AT" = local ]; then
  run "$WORK" --role=guest --code="$code" $GUEST_ARGS 2>&1 | grep '^RESULT' | sed 's/^/GUEST /' || true
else
  ssh "$GUEST_AT" "docker run --rm --init --ipc=host -u \$(id -u):\$(id -g) -e HOME=/w -v $REMOTE_DIR:/w -w /w $IMAGE node peer.mjs --role=guest --code=$code $GUEST_ARGS" 2>&1 | grep '^RESULT' | sed 's/^/GUEST /' || true
fi
wait $host || true
grep '^RESULT' "$log" | sed 's/^/HOST /'
