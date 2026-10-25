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
- [x] T7 Enemy chase pathfinding (route: delegated writer B; trigger: core enemies/step, tests; done before T4)
  - `src/core/flow.ts` (flowField, flowStep, updateFlow); `WorldState.flow` (optional) rebuilt in `step` only when the player changes tile or the grid changes (new floor), shared by every enemy; `updateLunger` in `src/core/enemies.ts` follows the next downhill tile when it has no tile line of sight to the player, otherwise steers directly as before. Tests `tests/core/pathfinding.test.ts`.
  - Decisions: BFS (4-connected distances, reusing `tileDistances`) with 8-neighbour descent where diagonals need both side tiles open (no corner cutting); out of sight a walker neither stalks nor starts a lunge (no lunging into a wall); telegraph and lunge themselves unchanged; Gastly and the boss untouched (no tiles in the boss arena, so no field there). Found while testing: a Poochyena with its lunge ready hovered forever at the 130 px stalk ring (lunge range 115); stalking now only happens while the lunge recharges, as its comment already said.
  - Evidence: RED observed twice (module missing; then with the field but no steering the L-wall chase test failed, the enemy pinned under the bar), GREEN after steering plus the stalk fix. 7 tests: field distances, downhill without corner cutting, rebuilt only on tile/grid change, none without tiles, L-wall chase reaches lunge range with sight in under 24 tiles of walking time, determinism, Gastly unaffected. `npm test` 246 passed, `npm run build` ok.
- [x] T4 Collapse urgent floor (route: delegated writer B; trigger: core hazard, data weights, renderer, audio, tests)
  - Core: `src/core/collapse.ts` (startCollapse, collapseFront, isCollapsed, advanceCollapse, collapseProximity, updateCollapse, run inside `step` after the enemies); `WorldState.collapse`; `loadFloor(state, floor, kind)`; `RunState.kind` and `RunState.escape`, `floorKind(runSeed, floor)` in `src/core/run.ts`; `URGENT.collapseChance` [0, 0.25, 0.4] and `COLLAPSE` tuning in `src/data/dungeon.ts`; new event `collapseHurt`. Adapters: `src/adapters/card.ts` (floor title card: dungeon name, "Planta N", collapse warning, escape line), rubble/void tiles, cracks and dust on the tiles just ahead of the front and a continuous rumble shake in the renderer (`rumbleLevel`/`rumbleOffset` in juice.ts, `JUICE.rumblePx`), `collapse` crash sound and a looping low rumble (`setRumble`, `rumbleGain`) in audio.ts; `game.ts` shows the card on every floor entry (and on "Restart floor"), plays the entry sounds, drives the rumble (silent while paused or after the end). Dev only: `?floor=N` on the dev server starts the run on floor N (`startRun(seed, options, floor)`). Strings `card.collapse`, `card.escaped` (es/en). Tests `tests/core/collapse.test.ts`, `tests/adapters/collapse-presentation.test.ts`.
  - Decisions: the draw uses its own salt over the run seed, so the floor layout of a seed does not change; fixed rooms are never urgent. Constant front speed 1.5 tiles/s after a 5 s grace, so it reaches the stairs after about 2.9x the straight walking time (the test asserts at least 1.8x over 300 seeds x depths 2-3, simulated tick by tick). Rubble hurts 6% of max HP every 500 ms; roll i-frames skip a tick (the next one lands as soon as they end) but Disguise does not absorb it (the ground is not an attack); the push (110 px/s) follows the shortest walk to ground 1.5 tiles past the front, so an idle player rides the front edge and keeps getting hurt. Walking enemies on rubble fall (marked defeated, with the normal defeat fade and sound); Gastly floats on. The escape time is the collapse clock when the stairs are taken and shows as a line on the next floor's card (boss floor included), not on the end screen. Inputs keep working while the card shows (no freeze). The rumble is silent during the grace delay (no moving front) and swells over the last 6 tiles. The title card itself was built here (T5 keeps the minimap, stairs and chime sounds, wall contrast and docs).
  - Evidence: RED observed (module missing), GREEN 12 core + 6 presentation tests. Mutation checks: front speed 2.6 tiles/s fails the safety test; push disabled fails the push test; ignoring i-frames fails the roll test. The crash noise first exceeded the 1 s noise buffer (the fake AudioContext caught the negative offset), shortened to 0.9 s. Headless Firefox screenshot of seed 3 floor 2 (`?seed=3&floor=2`, 13 s in) checked by eye: rubble behind the front, cracks ahead of it, player on the edge. `npm test` 264 passed, `npm run build` ok.
- [x] T5 Minimap with fog of war, floor title card, stairs/collapse sounds, GDD and README updates (route: writer B)
  - `src/adapters/minimap.ts` (createMemory, revealAround, minimapMarks, drawMinimap): top-right, semi-transparent, floor tiles only, rubble in red on collapse floors, blinking player dot, stairs once their tile was seen, enemies only inside the camera view; the memory lives in `game.ts` per floor (reset on every floor entry and on "Restart floor"), revealed each frame from the player's tile. `Arena.rooms` (tile rects, set by `floorArena`) so a room is revealed whole on entering (walls included); corridors reveal a 3-tile square. Tab toggles it (`preventDefault`, ignored while the Esc menu is open); `menu.controls.minimap` in the controls list. Sounds `stairs` (four descending footsteps) and `floorCard` (A minor chime) via `floorEntrySounds(kind, descended)`: stairs only when reached by the stairs, the chime on every card, the crash on collapse floors. Wall tops get a staggered block pattern and the tiled view is cleared to pure black with a thin rim at the map edge, so walls no longer blend into the dark around them. GDD §3 (collapse values marked provisional, title card, minimap, chasing enemies) and §4 controls (Tab); README (collapse floors, card, minimap, Tab, `?seed=`, dev `?floor=`).
  - Decisions: the title card was built in T4 (inputs keep working while it shows, no freeze); the minimap draws floor only (MD style), no walls; the camera never shows outside the map (it is clamped), so the "void" that blended with the wall tops is the dark page around the canvas and the rubble void: the wall pattern fixes both readings (the page CSS is outside the allowed surfaces).
  - Evidence: RED observed (minimap module missing; entry sounds test failing on the old signature), GREEN: 3 minimap tests (start room revealed whole with walls, corridor radius only, marks: player always, stairs once seen, enemies only in view), entry sounds, i18n keys for the minimap control and card lines in both languages. Headless Firefox screenshot `/tmp/m2-collapse.png` (seed 3, `?floor=2`, about 11 s in): rubble behind the front, cracked tiles ahead of it, minimap with the revealed start room in red rubble and the current room in blue, player dot and enemies. `npm test` 269 passed, `npm run build` ok.
- [x] T6 Deploy to Pages (route: parent). Run 40196272562 success on `6def0be`; live bundle `index-BwbEaK0Q.js` matches the local build.

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
- T7 done by writer B: `feat(enemies): chase the player around walls with a shared tile flow field`.
- T4 done by writer B: `feat(dungeon): add the collapse urgent floor with its title card, rubble and rumble`.
- T5 done by writer B: `feat(dungeon): add the fog-of-war minimap, floor entry sounds and clearer walls`.
- Next: T6 deploy (parent). Unverified by hand: the feel of the rumble loop and crash, the stairs and chime sounds, Tab in a real browser, collapse pacing in real play.
Created 2026-10-25. Forecast ~1500 authored lines across 6 tasks (above the ~400 slice budget; delivery stays direct work-unit commits per the user's deploy flow).
