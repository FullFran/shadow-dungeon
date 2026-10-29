# Real-network co-op tests

Headless browsers that play a real co-op room against a deployed build, over
real Trystero signaling and WebRTC. Unit tests use an in-memory full mesh; these
scripts test what players actually hit: discovery, NAT traversal, the TURN relay,
latency, and the whole room entering a dungeon together (issues #1, #2, #4, #5).

- `peer.mjs`: one peer (host or guest), Chromium or Firefox. It prints `CODE <code>` (host) and one `RESULT {json}` line with:
  - timings;
  - the selected ICE candidate pair (host / srflx / relay) and its RTT;
  - the F3 net overlay samples taken in the run.
- `pair.sh`: one host here and one guest here or on an SSH host.
- `party.sh`: one host and N guests (`GUESTS="local vpscontavo vpscontavo"`).
- `summary.py`: turns `pair.sh` output (with `### label` lines) into a table.

## Setup (once per machine)

```sh
docker pull mcr.microsoft.com/playwright:v1.49.1-noble
W=/some/work/dir; mkdir -p "$W/shots"; cp tools/coop-net/peer.mjs "$W/"
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/w -v "$W":/w -w /w mcr.microsoft.com/playwright:v1.49.1-noble \
  npm i --no-audit --no-fund playwright@1.49.1
```

On the VPS the work dir is `/home/fran/coop-net`. Copy `peer.mjs` there again after every change.

## Runs

```sh
WORK=$W GUEST_AT=vpscontavo HOST_ARGS="--run=1" GUEST_ARGS="--run=1" tools/coop-net/pair.sh
WORK=$W GUEST_AT=vpscontavo HOST_ARGS="--turn=relay" GUEST_ARGS="--turn=relay" tools/coop-net/pair.sh
WORK=$W GUESTS="local vpscontavo vpscontavo" HOST_ARGS="--run=1" GUEST_ARGS="--run=1" tools/coop-net/party.sh
```

- `--turn=off`: the TURN route answers nothing, so only direct links are possible.
- `--turn=relay`: the browser may only use relay candidates. A pass proves the TURN relay works.
- `--run=1`: the host walks to the Refugio waystone and leads the room into the Cripta.

The peers wait `--linger` seconds (default 15) before closing, so the other side's samples are not cut short.

Known limit: Firefox's `getStats` gives no candidate-pair RTT here, so its ICE RTT shows as null. The in-game RTT from the overlay still works.

## Results 2026-10-29 (production build `e60dcb9`)

The host ran on the owner's machine (home network). Guests ran on the VPS or on the same machine.

| Case | Guest admitted after | Link | In run (guest) |
|---|---|---|---|
| Chromium ↔ Chromium, TURN available | 2.8–8.3 s | srflx/srflx UDP, ICE RTT ~50 ms | 20 snapshots/s, age 34–84 ms, in 7 KB/s |
| TURN off | 4.8 s | srflx/srflx UDP, p95 RTT 184 ms | 20 snapshots/s, age 27 ms |
| Relay only, Chromium (TCP to the relay) | 4.7 s | relay/relay, RTT ~51 ms | 15 snapshots/s, age 36 ms |
| Relay only, Firefox | 5.7 s | relay/relay UDP | (no run) |
| Firefox host ↔ Chromium guest | 4.6 s | srflx/srflx | 20 snapshots/s, age 42 ms |
| Chromium host ↔ Firefox guest | 8.2 s | srflx/relay | 18 snapshots/s, age 32 ms |
| 4 players (host + 1 local, 2 VPS) | 5.1–7.1 s | full mesh, srflx or host | each guest 20 snapshots/s, in ~11 KB/s, all four entered the run |

A guest's bandwidth: ~1.6 KB/s up, 5–8 KB/s down (about 11 KB/s with 4 players).
That is roughly 25–35 MB per relayed guest-hour.
