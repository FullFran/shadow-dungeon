# M2 procedural dungeon

## Objective
Replace the fixed M0 sandbox room with a short, seeded, Mystery Dungeon-style run: small procedurally generated floors (rooms joined by corridors, stairs to the next floor), ending in the Aegislash boss floor, plus the first urgent floor (collapse).

## Problem
M0 is one fixed room and a boss arena. Playtest feedback asks for procedural dungeons "like Mystery Dungeon, but small". The GDD (§3) defines floors with stairs, enemies per room, urgent floors weighted by depth, and bosses at fixed floors.

## Why
A full run (enter, descend, boss) is what makes the demo replayable on stream and is the base for co-op (M4) and meta-progression (M3).

## Scope (MVP run, provisional numbers kept in data/tuning)
- Floors 1–3: generated; floor 4: Aegislash arena (existing `boss` room). About 8–12 minutes.
- Floor generator (pure, seeded): tile grid, 4–6 rooms on a cell grid (MD style), corridors forming a connected graph (spanning tree plus a few loops), start room and stairs room distinct, spawn points per room, enemy count growing with depth.
- Tile collision for walkers and projectiles; ghosts (Gastly) pass walls but stay inside the map.
- Camera follows the player; enemies dormant until the player enters their room or comes close with line of sight.
- Stairs: stepping on them goes to the next floor (no clear requirement, like MD).
- HP carries over between floors; Disguise resets per floor; small heal on each new floor (tuning value).
- Run seed: random per run, shown on the end screens.
- Collapse floor: weighted by depth (never floor 1), announced on entry; a collapse front advances from the start along the walking distance field towards the stairs; standing on collapsed ground hurts and pushes. Quick clear shown as a bonus line (no currency yet).
- Presentation: tile rendering (dungeon palette), stairs, MD-style minimap with fog of war, "Floor N" title card on entry, collapse visuals; sounds for stairs and collapse.

Out of scope: other urgent floors (flood, gas, hunter), items and pickups, currency, new species, co-op, the 12-floor structure.

## Constraints
- Core stays pure and deterministic (seeded RNG, fixed timestep); architecture test green.
- Generated floors must always be fully connected and solvable; property tests over many seeds.
- No AI attribution in commits; Conventional Commits.
- Delivery: work-unit commits on `feat/m2-procedural-dungeon`; the user deploys the demo by fast-forwarding `main` (no PR flow so far).

## Tasks
- [x] T1 Seeded floor generator with property tests (route: delegated writer A; trigger: new core module, data, tests)
  - `src/core/dungeon.ts` (generator), `src/core/tiles.ts` (TileGrid, isWall, tileCenter), `deriveSeed` in `src/core/rng.ts`, tuning and run plan in `src/data/dungeon.ts`; tests `tests/core/dungeon.test.ts`.
  - Decisions: 40x28 tiles of 32 px on a 3x2 cell grid (4-6 rooms, the rest junctions); Prim spanning tree over neighbouring cells plus 1-2 loop edges; L-shaped 2-tile corridors; stairs in the room whose centre is the longest walk from the start; spawns on inner room tiles, outside a 192 px safe radius; per-room count 1-2 on floor 1, +1 per depth (tuning, not yet the GDD 3 + n).
  - Evidence: RED observed (module missing), then 8 property tests green over 1000 seeds and depths 1-3; mutation check (dropping one corridor) fails the connectivity test. `npm test` 209 passed, `npm run build` ok.
- [x] T2 World integration: tile collision, camera, enemy activation, stairs, tile rendering (route: writer A; trigger: core world/step/enemies, renderer, app)
  - `Arena` gains optional `tiles` and `stairs`; `confineCircle` pushes walkers out of wall tiles (floaters only meet the map bounds); projectiles die inside wall tiles; `src/core/floor.ts` (floorArena, loadFloor, onStairs); `src/core/activation.ts` (asleep enemies wake on entering their room, within `wakeRadius` with tile line of sight, or when hit, then hunt for good); `followCamera` and `visibleTiles` in `src/adapters/view.ts`; tile and stairs drawing in the renderer; `game.ts` starts on a generated floor and the stairs lead to the boss room (T3 adds the full run).
  - Decisions: the boss arena keeps the rect-obstacle path (no tile grid), both coexist in `confineCircle`; new `asleep` AI mode separate from the training-dummy `dormant`; woken walkers chase without pathfinding (they slide along walls); the camera rect from the smoothed focus is the same rect used for cursor->world and the lock-on view.
  - Evidence: RED observed (modules missing), 17 floor/collision/activation tests and 6 camera tests green; mutation checks (tile push off, line of sight ignored, projectile wall check off) each fail their tests. `npm test` 232 passed, `npm run build` ok.
- [x] T3 Run structure: floors 1–3 + boss floor 4, HP carry-over, Disguise per floor, heal, seed on end screens, HUD floor counter (route: writer A)
  - `src/core/run.ts` (startRun, progressRun, floorSeed via `deriveSeed(runSeed, floor)`, isBossFloor); `RUN_PLAN` and `RUN.floorHeal` (25%) in `src/data/dungeon.ts`; `game.ts` drives the run (music: room loop on generated floors, boss loop on floor 4; "Restart floor" restores the floor-entry snapshot); HUD "Planta N"/"Floor N"; end screens show floor reached and seed; random seed per run or `?seed=` in the URL (`main.ts`); i18n, GDD §3 and the Disguise row ("por planta"), README run paragraph.
  - Decisions: the heal happens on leaving a floor (none on floor 1, capped at max HP); the run plan also accepts fixed rooms with an exit (`atExit`), so a non-final fixed room still leads on; the stairs need no clear.
  - Evidence: RED observed (module missing), 6 run tests green (plan order, boss on floor 4, HP carry + heal + Disguise reset, defeat/victory, full scripted run identical for the same seed and different for another) plus i18n run strings. `npm test` 239 passed, `npm run build` ok. Headless render of seed 7 floor 1 (camera view and full map) checked by eye: walls, corridors, stairs and sleeping enemies read clearly.
- [ ] T4 Collapse urgent floor (route: delegated writer B; trigger: core hazard, data weights, renderer, audio, tests)
- [ ] T5 Minimap with fog of war, floor title card, stairs/collapse sounds, GDD and README updates (route: writer B)
- [ ] T6 Deploy to Pages (route: parent)

## Acceptance criteria
- 1000 seeds: every floor connected (BFS from start reaches stairs and every room), start and stairs in different rooms, no spawn inside walls or within a safe radius of the start.
- Same seed gives the same floor.
- A run goes floor 1 → 2 → 3 → Aegislash; dying or winning shows the seed.
- Collapse floor never appears on floor 1; the front always reaches the stairs later than a reasonable walking time (tuned so it is beatable).
- `npm test` and `npm run build` pass.

## Checks
`npm test`, `npm run build`.

## Progress
- T1-T3 done by writer A, one `feat(dungeon): ...` work-unit commit each.
Created 2026-10-25. Forecast ~1500 authored lines across 6 tasks (above the ~400 slice budget; delivery stays direct work-unit commits per the user's deploy flow).
