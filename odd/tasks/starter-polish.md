# Starter polish: Zorua, Litwick and Cubone feel

## Objective
Make the three new starters feel as good as Mimikyu (playtest 2026-10-25: Mimikyu feels great; Zorua, Litwick and Cubone all feel odd) and colour every attack by its move type.

## Problem
A read-only audit found the causes (each verified against the code before acting):
- Heavy juice (90 ms hitstop, shake, `hitHeavy`) only fires at damage >= 18 or super effective (`adapters/juice.ts`, `audio.ts soundFor`); starter fast moves deal 4-12, so they never feel impactful.
- No player melee/dash/360 VFX at all (the renderer only draws enemy telegraphs), and every player projectile is the same purple orb.
- Frozen windups: `attackFrame` with `hitFrame <= 1` holds frame 0 for the whole windup (Night Daze, Stomping Tantrum, Shadow Ball); Litwick's Shoot/SpAttack sheets are copies of Charge, so its releases are invisible; Feint Attack plays its sheet ~3-4x fast.
- `passiveTriggered` (Illusion, Flash Fire, Battle Armor) only logs. Flash Fire cannot trigger in the Crypt (no Fire enemies). Illusion resets per floor while its text says room.
- Several move numbers are off (see T3) and the loadout shows only power and a description (Feint Attack's is a copy of Shadow Sneak's).

## Why
The starter pick is the first choice of a run; a starter that feels weak or unreadable makes the pick feel wrong.

## Scope
- T1 juice tiers + player VFX + one type palette for player and enemy attacks.
- T2 animation fixes.
- T3 kit numbers and passives.
- T4 loadout info (stamina, shape, matchup hint).

Out of scope: Fire attacks on enemies, status conditions, Mimikyu's kit and feel (unchanged).

## Constraints
- `src/core` stays pure; architecture test green; existing tests green.
- Two writers work in parallel (Misty Forest: renderer/enemies; mobile + PWA: input/hud/index.html): edits stay additive; player VFX live in a new adapter module, renderer changes are a few call sites.
- One Conventional Commit per task, explicit paths, no AI attribution. No push/merge.
- Browsers for screenshots are silent (`media.volume_scale` 0 in user.js, `muted: true` in the stored settings).

## Tasks
- [x] T1 Juice tier rule (multi-hit finisher + per-move `juice` override), `enemyHit` carries the move and finisher flag; type palette in `ui/tokens.ts` (complete over `POKEMON_TYPES`); player VFX module (fading arcs, 360 rings, dash trails, multi-hit swipes, per-type projectiles, spinning bone); enemy telegraphs tinted by attack type with the red warning edge kept. Route: inline (this writer is the delegated one). Tests first: tier rule, palette completeness.
- [x] T2 `attackFrame` spreads a `hitFrame <= 1` sheet like a markerless one; per-move animation choices (Litwick releases off Charge copies, Feint Attack windup starts later in the sheet, turns round after the dash). Route: inline. Tests first: frame spreading, windup start.
- [x] T3 Numbers (Ember, Bone Rush, Bone Club, Stomping Tantrum, Inferno, Feint Attack, Fury Swipes, Litwick HP), Bonemerang homes back to the player and is caught; passives get a flash and distinct sounds; Flash Fire also charges from Litwick's own Fire hits; Illusion text says floor. Route: inline. Tests first: homing/catch, kindling.
- [x] T4 Loadout move cards: stamina cost, shape label, "effective / not very effective against" hint from `typeEffectiveness` vs the Crypt roster; Feint Attack description fixed; Fury Swipes warns about Ghosts. Route: inline. Tests first: shape and hint helpers.

## Acceptance criteria
- Last part of a multi-hit move and moves flagged `juice: 'heavy'` give heavy hitstop/shake/sound; Mimikyu's hits classify exactly as before.
- Every type has a palette entry; player arcs/rings/dashes/projectiles are visible and coloured by move type; enemy telegraphs keep their red edge.
- No player attack holds frame 0 for its whole windup.
- Bonemerang returns to where Cubone is and disappears when caught.
- Passive triggers show a flash and play their own sound.
- Loadout shows cost, shape and matchup for each move.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 4 | grep -ic co-authored` = 0, headless screenshots in `/tmp/polish/`.

## Progress
- T1 done: `isHeavyHit` (juice.ts) is the one tier rule for hitstop, shake, big numbers and `soundFor`; `enemyHit` carries `moveId`/`finisher`; `juice: 'heavy'` on feint-attack, night-daze, foul-play, astonish, hex, inferno, bone-club, bonemerang, stomping-tantrum (Ember stays light: a rapid pea-shooter; no Mimikyu move flagged). `TYPE_COLORS` in `ui/tokens.ts`; `adapters/move-vfx.ts` (pure `playerVfx` + draw code); renderer gets 3 call sites (ground VFX, projectile look, telegraph tint + red rim on blade arcs). Remote players' projectiles carry no type in the snapshot, so they fall back to the Ghost look (protocol untouched). Tests: tests/adapters/move-feel.test.ts (9). RED not observed separately: the tests were written first but run after the implementation.
- T2 done: `attackFrame` treats HitFrame <= 1 as markerless (Night Daze, Stomping Tantrum, Shadow Ball: the general fix also reaches Mimikyu's Shadow Ball windup, which was frozen too); `attackFrame(..., windupFrom)` and `MOVE_ANIMS.windupFrom/turnAround`; `attackSheet` skips sheets whose source is Charge (Double, Rotate, Attack fallbacks). Litwick: Ember -> Attack, Hex -> Rotate, Inferno -> Double. Feint Attack: windup from frame 2, faces back in recovery. Tests: tests/adapters/move-anim.test.ts (5), RED observed (5 failing) before the change.
- T3 done. Numbers (before -> after): Ember power 40 -> 50, radius 5 -> 7; Bone Rush power 25 -> 30, dash 30 -> 60 px over 240 ms (250 px/s); Bone Club windup/active/recovery 110/80/200 -> 90/80/170, range 32 -> 36; Stomping Tantrum windup 340 -> 300, recovery 400 -> 360, stamina 35 -> 30; Inferno speed 90 -> 130, stamina 40 -> 35; Feint Attack windup 60 -> 80; Fury Swipes power 18 -> 25 (still x0.25 vs Ghost: 1 damage per scratch on Gastly/Aegislash); Litwick HP 85 -> 95. Bonemerang: on the way back it steers to the player's current position at its speed and is caught (removed) within body reach. Passives: `passiveTriggered` flashes the passive's name (`hud.passiveTriggered`), light shake, own sounds `illusion` / `flashFire` / `battleArmor`. Flash Fire design (decision): it also counts Litwick's own Fire hits; the 4th (`TUNING.passives.flashFireKindle`) powers up the next heavy move (x1.5), event `kindled: true` with its own log line; text says the Crypt has no Fire attackers. Illusion: behaviour kept (reset on every floor/room entry), text now says floor. Disguise text still says room (Mimikyu untouched, same per-floor reset). Tests: tests/core/starter-polish.test.ts (5) and 2 passive-feedback tests, RED observed before the change.
- T4 done: `app/move-info.ts` (`moveShape`, `cryptRoster` = DUNGEON spawns + RUN_PLAN rooms, `matchup`, `moveInfoLines`); move cards show power, stamina or "Sin coste", shape, xN hits, description and an effective / not-very-effective line (no new CSS: reuses .move-desc). Feint Attack, Fury Swipes (Ghost warning), Bone Rush and Bonemerang descriptions rewritten; GDD starter table and notes updated. Tests: tests/app/move-info.test.ts (6), RED observed (module missing).
