# Report performance sampler: overhead before/after (issue #71)

Measured 2026-11-24 on branch `feat/perf-diagnostics-in-tickets`. Machine: AMD Ryzen 5 5500 (12 threads), Linux, headless Firefox 160.0.1 on the Vite dev server, DPR 3, phone viewports 844x390 and 390x844, seed 7. Other agents were running builds on the same machine (load average 4 to 7), so differences under about 0.2 ms are noise.

Commands:

```sh
node tools/mobile/bench.mjs --sampler=off --out=reports/perf/issue71-off-1.json
node tools/mobile/bench.mjs --sampler=on  --out=reports/perf/issue71-on-1.json
# twice each, density ladder only:
node tools/mobile/bench.mjs --sampler=off --only=crowd-4,crowd-12 --out=reports/perf/issue71-crowd-off-N.json
node tools/mobile/bench.mjs --sampler=on  --only=crowd-4,crowd-12 --out=reports/perf/issue71-crowd-on-N.json
```

`--sampler=off` loads the game with `?perfsampler=0` (development only), which turns the production sampler off. The dev probe's `sampler` channel is the sampler's own cost per frame (the enemy count pass plus `frame()`), timed inside the real run loop.

## In-game, sampler off → on (ms, mean of the runs)

| Scene | Viewport | Runs off/on | Frame p95 off → on | Sim p95 off → on | Render p50 off → on | Render p95 off → on | Sampler p95 (on) |
|---|---|---|---|---|---|---|---|
| boss-card | 844x390 | 1/1 | 17.10 → 17.10 | 0.58 → 0.48 | 3.84 → 3.78 | 4.66 → 4.52 | 0.02 |
| card-decidueye | 844x390 | 1/1 | 17.08 → 17.10 | 0.72 → 0.80 | 2.84 → 2.90 | 3.74 → 3.84 | 0.02 |
| card-lanturn | 844x390 | 1/1 | 17.08 → 17.08 | 0.76 → 0.62 | 3.00 → 3.04 | 4.04 → 4.00 | 0.02 |
| crowd-12 | 844x390 | 3/3 | 17.10 → 17.10 | 0.81 → 0.75 | 2.61 → 2.53 | 3.45 → 3.21 | 0.02 |
| floor | 844x390 | 1/1 | 17.10 → 17.10 | 0.44 → 0.42 | 2.04 → 1.96 | 2.82 → 2.52 | 0.02 |
| town | 844x390 | 1/1 | 17.10 → 17.10 | - → - | 4.02 → 4.04 | 4.62 → 4.66 | - |
| boss-card | 390x844 | 1/1 | 17.10 → 17.10 | 0.38 → 0.32 | 1.90 → 1.88 | 2.38 → 2.22 | 0.02 |
| card-decidueye | 390x844 | 1/1 | 17.10 → 17.10 | 0.62 → 0.62 | 2.04 → 2.06 | 2.56 → 2.66 | 0.02 |
| card-lanturn | 390x844 | 1/1 | 17.08 → 17.10 | 0.54 → 0.42 | 2.00 → 2.02 | 2.54 → 2.54 | 0.02 |
| crowd-12 | 390x844 | 3/3 | 17.10 → 17.09 | 0.69 → 0.65 | 1.63 → 1.61 | 2.24 → 2.07 | 0.02 |
| floor | 390x844 | 1/1 | 17.10 → 17.10 | 0.38 → 0.38 | 1.16 → 1.14 | 1.48 → 1.40 | 0.02 |
| town | 390x844 | 1/1 | 17.10 → 17.10 | - → - | 1.52 → 1.48 | 1.82 → 1.76 | - |
| crowd-4 | 844x390 | 2/2 | 17.10 → 17.10 | 0.76 → 0.70 | 2.11 → 2.16 | 2.76 → 2.80 | 0.02 |
| crowd-4 | 390x844 | 2/2 | 17.10 → 17.10 | 0.55 → 0.51 | 1.30 → 1.30 | 1.70 → 1.62 | 0.02 |

Reading: frame interval p95 stays at the 60 Hz vsync (17.1 ms) in every scene; simulation and render p50/p95 move by at most ±0.25 ms in either direction, the same spread as two runs in the same mode. The sampler's own cost per frame is 0.00 ms p50 and 0.02 ms p95, which is Firefox's timer resolution: too small to time here. The town has no `sampler` channel (it only calls `frame()`).

## Pure cost (Node 24, `vite-node`, same machine)

| What | Cost |
|---|---|
| `frame()` per call | 57.7 ns (2,000,000 calls) |
| `snapshot()` with a full 10 s window (599 frames) | 0.22 ms, only when a report is previewed or sent |
| Memory | 7 rings x 1500 frames x 8 bytes = 82 KiB, fixed |
| Summary JSON | 604 bytes (canvas included) |

At a phone budget about 4 to 6 times slower than this desktop, `frame()` costs well under 1 µs of a 16.7 ms frame.

## Limitations

- Firefox cannot throttle the CPU and has a coarse timer (20 µs steps here); a real phone was not measured.
- The test arena takes at most 12 enemies (`TEST_FLOOR.maxEnemies` in `src/core/test-floor.ts`), so the density ladder is 0 (floor, town), 1 (card bosses), 4 and 12; a 24+ point needs a larger arena and is pending. The crowd runs first had a `crowd-24` scene; it spawned 12 like `crowd-12`, so its rows were removed from the JSON files and the scene from the bench.
- `performance.now()` around the canvas calls is CPU time; GPU and fill-rate cost shows only in the frame interval.
