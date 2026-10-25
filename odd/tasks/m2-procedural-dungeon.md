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
- [ ] T2 World integration: tile collision, camera, enemy activation, stairs, tile rendering (route: writer A; trigger: core world/step/enemies, renderer, app)
- [ ] T3 Run structure: floors 1–3 + boss floor 4, HP carry-over, Disguise per floor, heal, seed on end screens, HUD floor counter (route: writer A)
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
Created 2026-10-25. Forecast ~1500 authored lines across 6 tasks (above the ~400 slice budget; delivery stays direct work-unit commits per the user's deploy flow).
