#!/usr/bin/env bash
# A full room: one host here and one guest per entry of GUESTS ("local" or an SSH
# host whose work dir is REMOTE_DIR), all started together on the host's code.
#   GUESTS="local vpscontavo vpscontavo" HOST_ARGS="--run=1" WORK=/dir tools/coop-net/party.sh
set -euo pipefail
IMAGE=${IMAGE:-mcr.microsoft.com/playwright:v1.49.1-noble}
WORK=${WORK:?set WORK to the local work dir}
REMOTE_DIR=${REMOTE_DIR:-/home/fran/coop-net}
read -r -a guests <<<"${GUESTS:-local}"
expect=$((${#guests[@]} + 1))
dir=$(mktemp -d)
trap 'rm -rf "$dir"' EXIT
run() { docker run --rm --init --ipc=host -u "$(id -u):$(id -g)" -e HOME=/w -v "$1":/w -w /w "$IMAGE" node peer.mjs "${@:2}"; }

run "$WORK" --role=host --expect=$expect $HOST_ARGS >"$dir/host" 2>&1 &
pids=($!)
code=""
for _ in $(seq 1 120); do
  code=$(grep -oE '^CODE [A-Z0-9]{5}' "$dir/host" | cut -d' ' -f2 || true)
  [ -n "$code" ] && break
  sleep 0.5
done
[ -n "$code" ] || { wait "${pids[0]}" || true; cat "$dir/host"; exit 1; }
i=0
for at in "${guests[@]}"; do
  i=$((i + 1))
  a="--role=guest --code=$code --n=$i --expect=$expect ${GUEST_ARGS:-}"
  if [ "$at" = local ]; then
    run "$WORK" $a >"$dir/g$i" 2>&1 &
  else
    ssh "$at" "docker run --rm --init --ipc=host -u \$(id -u):\$(id -g) -e HOME=/w -v $REMOTE_DIR:/w -w /w $IMAGE node peer.mjs $a" >"$dir/g$i" 2>&1 &
  fi
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p" || true; done
grep -h '^RESULT' "$dir/host" | sed 's/^/HOST /'
for f in "$dir"/g*; do grep -h '^RESULT' "$f" | sed "s/^/GUEST /"; done
