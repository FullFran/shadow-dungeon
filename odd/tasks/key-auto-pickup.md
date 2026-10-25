# Key gate: the key is collected when its bearer falls

Branch: `fix/key-auto-pickup` from main `da33dc1`. Engram mirror `odd/key-auto-pickup/tasks`: pending (writer worktree has no Engram session).

## Objective
A key gate can never soft-lock a floor: when the key carrier dies (any cause: a player's hit, a guest's hit claim applied by the host, a collapse/fall, a self-destruct, toxic or any hazard), the party gets the key at once and the stairs room's doors open. The dropped-key pickup step is removed.

## Problem
Bug report (Toxic Swamp, floor 4): after the key carrier died the HUD read "La llave ha caído: recógela", but the key could not be picked up, so the floor could not be finished.

## Scope
- `src/core/gates.ts`: a dead or missing key bearer opens the gate (`outcome: 'opened'`); no `keyDropped` event; a legacy `gate.key` (old state) or `GateSync.key` (old host snapshot) resolves as opened.
- HUD/renderer: a short "key taken, door opens" line after a key gate opens (and the seal's equivalent); the minimap flashes the opened doorways briefly. `gateOpen` sound; `keyDrop` sound removed.
- Bots (`src/sim`): no path to a dropped key.
- The 60 s unreachable break for a living gate enemy stays.
- Seal gate audit: the marked enemy's death anywhere opens the stairs; test added.

## Constraints
- Core pure and deterministic; host-authoritative (guests follow snapshot `g`). `src/net/protocol.ts` untouched (outside the allowed surface): `GateSync.key` stays as an optional legacy field, never written.
- Conventional Commits, no AI attribution, no push.

## Tasks
- [x] T1 Core: auto-collect on bearer death, legacy key resolves opened, seal test (route: inline; RED observed: 5 gate tests failed on the old `updateGate`, including the wall-tile reproduction).
- [x] T2 Presentation and bots: HUD notice (`gateNotice`, RED observed: 4 tests failed before the helpers existed), minimap doorway flash, `keyDropped` event and `keyDrop` sound removed, bots no longer path to a key, i18n, GDD (route: inline).
- [x] T3 Checks: `npm test`, `npm run build`, `npm run balance -- --quick` (see below).

## Root cause
The key lay at the bearer's death position and was taken only by a player within `GATE.keyTouch` (28 px) of it. The 60 s break uses `reachable()`, which accepts a point whose tile *or a 4-neighbour* is on the players' flow field. A bearer that dies over a wall tile next to the floor (the Swamp's floaters fly over walls; knockback can press a body into a wall) leaves the key 32 px from the nearest floor tile centre: never touchable, yet "reachable", so the break never fires. Permanent soft-lock. Reproduced by `a bearer that falls where no body can stand (a floater over a wall) still opens the door` (RED on the old code). A key in a toxic pool or under decor is a weaker variant of the same "must walk to it" step.

## Fix
- `updateGate`: a dead or missing bearer (or a legacy `gate.key`) settles the gate `opened` that step; the doors open; `gateOpened` plays `gateOpen`. The 60 s break only applies to a living gate enemy.
- `gateSync` never sends `key`; `applyGateSync` treats an older host's `key` as opened.
- Seal: already opened on any death or disappearance; now covered by tests (off-map, far away, removed, killed between steps).
- Presentation: `gateNotice` (pure, frame to frame, works for guests from the snapshot) shows "¡Has conseguido la llave! La puerta se abre." / "You got the key! The door opens." (and "¡Sello roto! La escalera se abre." for a seal) for 3.5 s; the minimap blinks the opened doorways gold for 3 s.

## Verification evidence
- `npm test`: 155 files, 1530 tests passed.
- `npm run build`: built (chunk-size warning only).
- `npm run balance -- --quick`: 60 runs, 72 arena fights, 0 failures, 39 warnings, 74 passes (report file not committed).
- Unverified: the in-game look of the notice and the minimap flash (no screenshot run).
