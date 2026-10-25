# Balance harness (bots, metrics, bands, report)

## Objective
Measure difficulty instead of guessing (docs/souls-difficulty-research.md P7): headless bots play floors and boss arenas of every dungeon on every tier, the harness records time to kill, damage, deaths, hit sizes, telegraph timings and fairness counters, checks them against target bands, and writes a report usable for every future rebalance.

## Problem
Tier numbers, boss HP and telegraphs were tuned by hand and by feel. Nothing tells us whether the average player clears the Crypt on easy, whether a boss takes 30 s or 5 min, or whether a pattern is unwinnable. P5's fairness rules are not checked anywhere.

## Why
User request (via the orchestrator, 2026-10-25): build the P7 harness with bots, metrics, bands in CI (WARN for the current content except hard fairness invariants), a "planted unwinnable pattern" test proving the gate can fail, and a report (`npm run balance`).

## Scope
- T1 Bots (`src/sim/`, imports core and data only; the core never imports sim): perfect, average, novice, masher; they see only the camera view and produce `PlayerInput` per tick; deterministic per seed.
- T2 Runner + metrics: floor by floor runs and isolated boss arenas, dungeon × tier × bot × party (1–4) × seeds; per floor/boss metrics.
- T3 Bands + fairness checks in CI: band config, WARN vs FAIL, a planted unwinnable pattern, record current violations.
- T4 Report: `npm run balance` writes `reports/balance/latest.md` (+ JSON); README and GDD §9 (Spanish).

Out of scope: changing game balance; co-op party scaling itself (another writer adds it; the harness calls it through one adapter, `src/sim/party.ts`).

## Constraints
- Core pure and deterministic; any core hook must be behaviour-neutral (golden digest `bebcc214` must still pass).
- Architecture test green and extended (core/data never import sim; sim imports only core/data).
- `npm test`, `npm run build` green; CI subset < 60 s.
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Delivery strategy
`ask-on-risk` (default). Forecast ~1500 authored lines over four tasks; the parent decides PR slicing (one PR per task commit is the natural chain).

## Tasks
- [x] T1 Bots + observation + architecture rule (route: inline writer, this agent; one coherent module set in `src/sim/` + tests)
  - `src/sim/observe.ts`: the screen as a player sees it: camera rect 512 x 320 around the player (same math as `adapters/view.ts`), enemies and enemy shots inside it, each wind-up's real ms left (tier, elite pace, slow-mo), the positional ground it burns (`core/victim.ts` `pierceZone`, which the renderer draws), the map layout (minimap knowledge).
  - `src/sim/bots.ts`: perfect / average / novice / masher profiles (lag 0/230/400/230 ms, choice +0/100/150 ms, noise, 0/15/40 % wrong choices, novice over-rolls, masher spams attacks and whim rolls). Perception lag = the bot acts on the observation from `reactionMs` ago; its own body (HP, stamina, rolling) it feels at once. Seeded with `core/rng.ts`.
  - `src/sim/nav.ts`: straight in sight, else downhill on a BFS field (`core/flow.ts`) to the goal tile; unvisited rooms, then the stairs; fixed rooms: middle, then exit once cleared.
  - Architecture: core/data may not import `/sim/`; sim imports only `./`, `../core/`, `../data/`; no app layer imports sim.
  - Evidence: `tests/sim/bots.test.ts` (4 tests) written right after the module, so no RED first; mutation checks instead: perfect `dodges: false` fails 2 tests (Poochyena duel, reaction), removing the perception lag fails the reaction test. `tests/architecture.test.ts` 5/5. `npm run typecheck` ok.
- [x] T2 Runner + metrics (route: same)
  - Core hook (behaviour-neutral): `playerHurt` carries `pierceRoll: true` for a positional hit (`core/hits.ts`, `GameEvent` type). Golden digest `bebcc214` still passes; nothing in the game reads the field.
  - `src/sim/metrics.ts` `FloorRecorder`: floor time, damage (attacks + floor hazards), hits and positional hits, biggest hit / max HP, kills, per-enemy TTK (from waking; fixed rooms from the start), boss TTK (from first on screen), telegraph→attack ms (ordinary and positional = choice), max simultaneous wind-ups (interval overlap), wind-ups started off screen (count and max at once), attacks with no pending wind-up.
  - `src/sim/runner.ts`: `runDungeon` (floor by floor, HP/level/items carry over, the bot takes the first item offered; stops at death, timeout, victory or `maxFloors`, default 10 for the endless Sima), `runFloor` (one floor or arena in isolation: fresh level-1 player via `startRun` on that floor), `arenaFloors`, `inject` test hook. Urgent floors (collapse, fog, flood, gas): the bot heads for the stairs.
  - `src/sim/party.ts`: the single co-op adapter. `partyScaling(size)` is identity today (no game party scaling yet); `applyParty` divides enemy HP by the party size (equal-DPS teammates) on top of it, enemy damage takes its factor. Enemies still all target the bot (pessimistic).
  - Bot fixes found while running: a floater inside a wall is approached from the nearest floor tile; an enemy chased 15 s without losing HP is ignored for 10 s (Gastly kiting from walls timed floors out).
  - Speed: the full Crypt × 4 bots × 3 seeds + arenas ≈ 2 s; every dungeon ≈ 2–5 s on easy.
  - Evidence: `tests/sim/runner.test.ts` (6 tests): replay identity, floor-by-floor Crypt, Sableye arena TTK, `maxOverlap`, recorder on synthetic events, the hook (mutation: removing the hook fails it), party adapter. Full suite 139 files / 1330 tests passed; typecheck ok.
- [x] T3 Bands + fairness checks + planted unwinnable pattern + CI subset (route: same)
  - `src/sim/bands.ts`: fairness invariants (`fail`): max hit ≤ 35 % max HP, ordinary telegraph ≥ 280 ms, positional (choice) telegraph ≥ 400 ms (one tick of slack), ≤ 2 wind-ups at once (3 on nightmare), ≤ 1 off-screen wind-up at once, 0 blind hits. Performance bands (`warn`): average clears easy ≥ 80 %, average boss TTK 45–150 s solo (isolated arena), HP lost per floor (average) ≤ 25/35/50/65 %, nightmare harder than easy, perfect clears nightmare ≥ 80 %, perfect never dies.
  - New metric `blindHits` (`metrics.ts`): a hit whose best-announced nearby threat had been on screen < 263 ms (shots inherit the wind-up of an enemy that just attacked beside them; lingering clouds were false positives before that).
  - `KNOWN_VIOLATIONS` ratchet (band × dungeon, with reason): a listed violation reports WARN, any other fails CI. Filled from the first full sweep.
  - `src/sim/sweep.ts`: `FULL_SWEEP` (5 dungeons × 4 tiers × 4 bots × parties 1–4 × 3 seeds, arenas for every bot; 960 runs + 1920 arenas, measured 200 s) and `CI_SWEEP` (easy + nightmare, perfect/average/masher, solo, 2 seeds, Sima to floor 5; 60 runs + 72 arenas, ~12 s).
  - Bug fixed: `maxFloors` now caps only the endless Sima (it had cut finite dungeons short and zeroed their clear rate).
  - Evidence: `tests/sim/bands.test.ts` (4): clean arena passes, each invariant fails alone, known violation scoped to its dungeon, planted unwinnable pattern (a no-wind-up positional burst on the player every 300 ms) kills the perfect bot and fails `blind-hits` while the same floor without it has 0 blind hits. `tests/sim/balance-ci.test.ts` (2): CI subset has no unknown failures (with the list emptied it fails: 20+ fails seen in the exploratory run). 16 sim tests in 12.3 s.
- [x] Integration: merged main be4e833 (co-op scaling) into the branch (clean merge); `src/sim/party.ts` now uses `data/party-scaling.ts` + `core/party.ts`: floor 1 starts with `WorldOptions.party`, later floors (no remote peers in the harness) are rescaled to the party's spawn HP and keep `world.party`; HP then split by party size. Commit 9462f23. Two new known violations from it: Aegislash (Crypt) and Trevenant (Forest) hit 36 % / 40 % on nightmare in 3–4 parties (boss damage ×1.1–1.15).
- [x] T4 Report + `npm run balance` + README + GDD §9 (route: same)
  - `src/sim/report.ts`: markdown (gate line, failures, known violations with reasons, performance warnings, per dungeon: runs per tier/bot/party, arenas per arena/tier/bot/party, telegraph and threat table per tier) and JSON. No date or timing in the markdown, so it diffs cleanly.
  - `tools/balance.ts` (`npm run balance`, via `vite-node`, which ships with Vitest): full sweep, `--quick`, `--seeds=`, `--dungeon=`, `--tier=`, `--out=`; exit 1 on an unknown fairness failure.
  - Decision: `reports/balance/latest.md` is committed (the baseline to diff); `reports/balance/*.json` is gitignored (~MBs of floor results).
  - README (commands, "Balance harness" with the rebalance steps, layout row) and GDD §9 "Arnés de balance" (Spanish).
  - Evidence: `tests/sim/report.test.ts` (tables per party, arena rows, deterministic text, JSON shape). `npm run balance -- --quick` 12.5 s; full `npm run balance` 295 s, 960 runs + 1920 arena fights, gate PASS (59 known fairness violations, 94 performance warnings, 167 passes). `npm test` 146 files / 1386 tests in 28.5 s; `npm run build` ok.

## Acceptance criteria
- Bots are deterministic per seed; the perfect bot dodges a lone telegraphed attack; the delayed bot reacts no earlier than its reaction time.
- The runner reports per floor/boss: TTK (boss, per enemy), damage taken, deaths, max single hit share, pierceRoll vs normal hits, telegraph→attack distribution, max simultaneous telegraphs, unseen threats.
- The planted unwinnable pattern makes the gate FAIL.
- CI subset runs in < 60 s inside `npm test`; hard invariants FAIL, the rest WARN.
- `npm run balance` writes the report with tables per dungeon/tier/bot/party.

## Checks
`npm test`, `npm run build`, `npm run balance` (timed), `git log --format=%B -n 4 | grep -ic co-authored` = 0.

## Progress
All four tasks done (commits 2cb8931, eadb510, 863fb3d, merge of main, 9462f23, T4).

## First findings (full sweep, reports/balance/latest.md)
- Bosses die far under the 45–150 s band for the average bot solo: Aegislash 10–18 s, Decidueye 14 s, Lanturn/Dhelmise 16–29 s, Trevenant 24 s, Sableye ~42 s (just under). Salazzle, Nihilego and the floor-10 Eclipse Echo are not felled by the average bot (level 1, isolated).
- The perfect bot clears no dungeon on nightmare (0 %); the average bot clears the Crypt on easy 67 % and the Swamp 33 % (band ≥ 80 %).
- Fairness: every dungeon has more wind-ups at once than P5.3 allows (up to 8 on Forest fog floors) and 2–4 off-screen wind-ups at once; blind hits in the Forest (Trevenant/Decidueye), Caves, Swamp (Nihilego) and deep Sima floors; Sima wind-ups of 200–217 ms from normal up (under the 280 ms floor; suspected elite pace); single hits of 36–40 % (Dhelmise, Aegislash echo, and bosses in 3–4 parties) on nightmare against a level-1 starter.

## Next step
Parent: review and PR slicing. Content follow-ups (outside this feature): attack tokens (P5.3), hit cap (P5.6), elite pace vs telegraph floor, boss HP vs TTK band; then delete the matching `KNOWN_VIOLATIONS` entries.
