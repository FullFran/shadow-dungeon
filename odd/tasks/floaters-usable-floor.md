# Floaters always on usable floor

Branch: `fix/floaters-usable-floor` (from main `b9c1cdf`). Engram mirror: `odd/floaters-usable-floor/tasks` (pending: the writer worktree has no Engram session; the parent mirrors it).

## Objective

Enemies that `float` (ghosts, bats, balloons, jellyfish, gas) are always on a
spot the player can use: never resting, telegraphing, casting or idling inside a
wall tile, never out of reach.

## Problem (playtest, 2026-10-26)

"Lo de que los Gastly y demás puedan meterse en las paredes está bien pero está
muy roto... tenemos que balancearlo haciendo que siempre estén en sitio usable,
y ya veremos cómo meter el guiño de que atraviesen paredes."

Floaters ignored wall tiles everywhere: `confineCircle(solid = false)` skipped
the tiles (`src/core/geometry.ts`), `pathDirection` sent them straight over the
walls (`src/core/brain.ts`), the safety net only kept them inside the map
(`src/core/bounds.ts`), sealing wave doors left them in the doorway
(`src/core/sima-events.ts`). Walls stop the player and every projectile, so a
Gastly could sit inside rock and keep shooting while nothing could hit it.

Floaters (every `floats: true`): Gastly, Haunter, Gengar, Duskull, Dusclops,
Drifloon, Drifblim, Phantump, Hoothoot, Noctowl, Zubat, Golbat, Tentacool,
Koffing, Weezing, Eclipse Echo. Heralds, Aegislash and the other card bosses do
not float (their own movement already confines them to floor).

## Decision

- Wall tiles confine everyone. `floats` now means only: over `obstacles`
  (old arena blocks), over shallow water (no wade slowdown), over collapse
  rubble (does not fall). The `solid` flag of `confineCircle`/`sweepCircle`
  is renamed `walker` and only governs obstacles.
- Floaters path like walkers: the shared flow field when out of sight, so a
  caster only reaches its "in band, telegraph" branch with line of sight to
  its target (the lunger rule). Casters hold their band on floor tiles only.
- Safety net: a floater buried in rock or cut off from every player (old
  snapshot, spawn, odd push) is snapped to the nearest reachable floor tile,
  like a walker. The wave-room floater drift over the walls is removed: a
  stray floater walks back or is warped after `strayMs`, like a walker.
- Projectiles: unchanged, walls stop every shot.
- The future "guiño" (F2) is a design note only, no gameplay flag: a dead flag
  that does nothing would be a gate that cannot fail. The hook point is
  `pathDirection` (brain.ts), documented there and in the GDD.

## Tasks

- [x] T1 Floaters confined by wall tiles, pathing on the flow field (geometry, brain, enemies, roster) and the bounds safety net snapping a buried floater to reachable floor; tests first. Route: inline (small call sites, the parent context already held the map; no second non-trivial file needing research).
- [ ] T2 Sealing wave doors and the wave-room herd treat floaters as walkers (no drift over the walls); tests first. Route: inline.
- [ ] T3 Docs (GDD future idea, Arena comment), golden digest / balance / prove check. Route: inline.

## Checks

- RED before GREEN: `tests/core/floaters-floor.test.ts` (chasing over N seeded steps never in a wall tile, caster telegraphs/casts only on floor with line of sight, safety net ejects a buried floater, determinism).
- `npm test`, `npm run build`, `npm run balance -- --quick --slots` (before/after), `npm run prove` if a boss fight includes floaters.

## Progress

- T1: RED observed (18 of 22 new tests failed: every floater entered rock at the wall column, e.g. Gastly seed 1 tick 132 at x 351.7). GREEN after the change: 22/22, full suite 2412/2412 after rewriting the two tests that asserted the old wall-crossing (floor.test.ts, pathfinding.test.ts). Found on the way: the walkers' strafe slide held a floater against a wall corner of a one-tile corridor; floaters keep no strafe slide (only the wall's push), walkers unchanged. Golden digest unchanged (`6e22f931`). Assessed tier / RDD: left to the parent.
