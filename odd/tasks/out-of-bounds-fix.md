# Out-of-bounds enemies (wave-room soft-lock)

Branch: `fix/out-of-bounds-enemies` (from main `be4e833`). Engram mirror: `odd/out-of-bounds-fix/tasks` (pending: writer worktree has no Engram session).

## Problem

Sima floor 26 (caves stratum), wave room "Oleada 1/4", doors sealed. The player hit a
Spinarak; it was knocked out of the map into the void (bottom-left, far from any
room). Nobody can reach it, so the wave never ends and the doors never open: a
soft-lock.

## Root cause (found)

`confineCircle` (`src/core/geometry.ts`) resolved a walker against wall tiles with
`pushOutOfRect`, which, when the circle's *centre* is inside a wall tile, exits
through the nearest side of that tile regardless of what lies there. Two things
put the centre inside a wall:

1. Knockback is applied in one jump per tick (`updateEnemyReactions`, 25 % of the
   remaining push per tick: a 90 px hit moves 22.5 px in the first tick). A
   walker (Spinarak radius 10) touching a wall gets its centre 12+ px into the
   wall tile.
2. Tiles are resolved in row-major order, so the first overlapping wall tile may
   push the centre sideways into a *neighbouring* wall tile. From there each tick
   the nearest-side exit marches it through solid rock, and the final arena clamp
   leaves it at the map border.

Evidence (probe before the fix, real Sima floor 26, seed 4242): of 230 400
wall-adjacent knockback samples (radius 10/14/20, 16 directions, 30-180 px),
16 917 ended inside a wall tile; e.g. tile (4,4), r=10, 135 deg, 135 px ended at
(10.0, 270.0): the left map border, in the void. Plain 90 px hits (the game's
heaviest moves) already tunnel.

Nothing pulled a stranded wave enemy back, and the wave room had no failsafe.

## Fix

- [x] T1 Geometry: a wall tile never "exits" into another wall: when the centre is
  inside a wall tile it escapes to the nearest floor tile (adjacent first, BFS
  otherwise). `sweepCircle` sub-steps any displacement into <= TILE/4 steps.
- [x] T2 Knockback: applied through `sweepCircle`, clamped to
  `TUNING.combat.maxKnockbackPx` (also caps a guest's wire claim). Walker
  movement (`moveEnemy`) is swept too.
- [x] T3 Safety net `src/core/bounds.ts` (host/solo, every step): walkers whose
  centre is in a wall tile, or whose tile is not connected to a living player's
  region, snap to the nearest reachable floor tile (BFS). Floaters stay inside
  the map. During a sealed wave, wave enemies outside the room are pulled toward
  it (floaters) and teleported to a free inner tile after 3 s (`warpMs` poof).
- [x] T4 Wave room: on sealing, enemies overlapping a door tile are moved inside
  the room first. Failsafe: 60 s sealed with a player inside and no HP change on
  either side ends the wave room (remaining wave enemies die `spent`, doors
  open). Monster houses and nests gate nothing (no doors); vault guards are
  covered by the snap.
- [x] T5 Renderer: a small poof ring while `warpMs > 0`.

Co-op: all of this runs on the host only; guests get positions and the `sealed`
flag through the existing snapshot (no protocol change).

## Acceptance / checks

- `tests/core/out-of-bounds.test.ts`: knockback sweep near walls, corners and
  sealed doors; door-overlap at sealing; snap of a walker buried in rock;
  stray/floater teleport after 3 s; 60 s failsafe. RED before the fix, GREEN after.
- `npm test`, `npm run build`; solo golden digest (`tests/core/difficulty-tiers.test.ts`).

## Evidence

- RED (before the fix): all 9 first tests of `tests/core/out-of-bounds.test.ts`
  failed, e.g. `seed 4242 dir 0 kb 160: expected [ 'e11@406.0,144.0', …(16) ] to deeply equal []`;
  the door, buried, stray and failsafe cases failed on their first assertion.
- The pure-collision test ("collision alone") fails when `escapeWall` and the
  sub-stepping are disabled (`'144,144 r10 a7 kb90'` ends in rock): a plain 90 px
  hit tunnels.
- GREEN: `npm test` 142 files / 1378 tests pass; `npm run build` passes.
- Solo golden digest (`PRE_TIER_DIGEST`, difficulty-tiers.test.ts) unchanged:
  `sweepCircle` aims each unobstructed sub-step at `from + delta * i/steps`, so a
  free move lands bit for bit where the old single jump did; only moves that meet
  a wall resolve differently, and the scripted Crypt runs never tunnelled.
- Failsafe design note: only the wave enemies' HP resets its clock. The players'
  HP is excluded because the Sima's collapse damages a player standing still
  (observed `collapseHurt` every ~1.5 s after ~54 s on floor 26), which would
  keep the failsafe from ever firing. A forced end uses outcome `cleared` (the
  room still pays its time and item pick: the player was locked in by a bug);
  the stranded enemies die `spent` (no XP, no coins).

## Unverified

- Not run in a browser: the poof ring (`warpPoof`, renderer.ts) is host-side
  only (`warpMs` is not in the snapshot), so co-op guests see the enemy reappear
  without the puff.
- Player movement (`player.ts`, rolls) still uses one-jump `confineCircle`; it now
  escapes rock safely but is not swept.
