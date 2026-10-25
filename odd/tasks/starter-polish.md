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
- [ ] T2 `attackFrame` spreads a `hitFrame <= 1` sheet like a markerless one; per-move animation choices (Litwick releases off Charge copies, Feint Attack windup starts later in the sheet, turns round after the dash). Route: inline. Tests first: frame spreading, windup start.
- [ ] T3 Numbers (Ember, Bone Rush, Bone Club, Stomping Tantrum, Inferno, Feint Attack, Fury Swipes, Litwick HP), Bonemerang homes back to the player and is caught; passives get a flash and distinct sounds; Flash Fire also charges from Litwick's own Fire hits; Illusion text says floor. Route: inline. Tests first: homing/catch, kindling.
- [ ] T4 Loadout move cards: stamina cost, shape label, "effective / not very effective against" hint from `typeEffectiveness` vs the Crypt roster; Feint Attack description fixed; Fury Swipes warns about Ghosts. Route: inline. Tests first: shape and hint helpers.

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
