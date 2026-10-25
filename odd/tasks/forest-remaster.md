# Misty Forest remaster

## Objective
Remaster the second dungeon (Bosque Brumoso) the way the Crypt was remastered: more variety (new species with their own behaviours, mixed packs, a forest event), code-drawn forest atmosphere and per-floor lore, and bosses that lean towards bullet hell (named Touhou-style spell cards with readable shapes and a safe path): Trevenant as a mid-boss with spell cards, Decidueye with a phase 2 at half HP and an arena whose trees stop arrows. Difficulty hooks: one extra trick per forest enemy on hard and up, one extra card and longer combos for both bosses on hard and nightmare; easy unchanged.

## Problem
The Forest plays with the T2 content of `dungeon-misty-forest`: six species, a Trevenant that only slams and throws one leaf ring, a one-phase Decidueye in an empty clearing, plain green tiles, and no per-floor lines. After the Crypt remaster it is the flatter of the two.

## Why
User request 2026-10-25: "remasteriza el segundo… más variedad… me gusta que los jefes parezcan un poco bullet hell". The Crypt remaster (odd/tasks/crypt-remaster.md) is the reference the user liked: per-floor lore lines, code-drawn atmosphere, a mid-boss with spell cards, a guardian phase 2 with pillars, telegraphs of at least 500 ms.

## Scope
- T1 Variety and atmosphere: forest dressing drawn in code (giant roots on wall faces, glowing mushrooms, fallen logs, fireflies, drifting mist layers, stone shrines; arenas dressed too), per-floor lore lines on the floor card, three new species with verified full animation sets (Impidimp, Shroomish, Drifloon) and their behaviours, mixed packs, a forest event (a wandering spirit light that guides to a hidden berry cache).
- T2 Trevenant mid-boss remaster: named spell cards (root lanes, leaf spirals with gaps, curse rings) between its slams, always a safe path, telegraphs >= 500 ms on easy.
- T3 Decidueye remaster: phase 2 at 50 % HP ("El Arquero se desvanece en la niebla") with denser readable cards (arrow-rain lanes, feather spiral, shadow-stitch clones), trees in the roost that stop arrows (like the Crypt pillars), cinematic text consistent with the lore, a cap on simultaneous enemy projectiles.
- T4 Difficulty hooks for the forest: `minDifficulty`-gated tricks read through `atLeast(worldDifficulty(state), ...)`; easy unchanged (characterisation tests).

Out of scope (other writers): the difficulty framework itself (selection, stats), dungeons 3 and 4, the Sima remaster.

## Constraints
- Core pure and deterministic; architecture test green; `npm test`, `npm run build` green.
- Shared files edited additively; new i18n keys in one contiguous block per language (placed after the forest guardian lines).
- No protocol break: new boss state goes through `boss.stance`/`comboIndex`, `ai.attackDir` and projectiles already in the snapshot; host-only fields where needed.
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Tasks
- [x] T1 Variety and atmosphere (route: inline writer, this agent; core, data, adapters, tools, sprites)
  - Species chosen after checking SpriteCollab `tracker.json` (2026-10-25): Impidimp 0859, Shroomish 0285, Drifloon 0425, all phase 1 with Idle, Walk, Attack, Shoot, Charge and Hurt (Sewaddle, Swadloon and Noctowl also had full sets; not taken this round). Sprites via `tools/fetch-sprites.mjs` (10 sheets each; existing sheets unchanged), CREDITS sprite section regenerated (baronessfaron + CHUNSOFT rows grew), XP 9/10/11, attack anims.
  - Behaviours: Impidimp (Dark/Fairy) is a lunger with `feint`: its first wind-up is a fake (same lane, shimmering as the tell), it sidesteps across the line to the player (harmless, also on guests), then a 420 ms re-aimed real lunge from the side. Shroomish (Grass) is a slammer with `leap`: the wind-up marks the landing circle (follows the player until 250 ms before take-off), 420 ms in the air (harmless), then the slam around the landing spot. Drifloon (Ghost/Flying, floats) is a caster with `ring`: rings of 8 slow will-o-wisps, one aimed at the player, every other cast turned half a step (the gaps move).
  - Mixed packs: `SpawnEntry.escort` places another species on the next tiles of a pick (no extra draw, so it draws like a pack of the same size; the Crypt has none and generates as before). Forest pool: Shroomish pairs with a Foongus from floor 1, Drifloon from 2, Impidimp leading two Pumpkaboo Small from 3.
  - Forest event (`src/core/wisp.ts`, `FOREST.wisp`): on ~35-40 % of generated floors from floor 2, three extra Oran Berries in the side room with the longest walk from the start (never the start room, nor the stairs room when there is another), drawn from the floor seed with its own salt (generator and room berries untouched; every peer places the same cache; the snapshots' berry ids already sync it). `world.wisp.cache` (cleared by `enterRoom`); the renderer draws a spirit light a few tiles ahead of the player along the walk to it, resting over the cache when close, gone once the cache is eaten; log lines on arrival and when the first cache berry is eaten.
  - Atmosphere: `DungeonDef.decor: 'forest'`; `src/adapters/forest-decor.ts` (placement by tile hash: roots on 30 % of lit wall faces, glowing mushrooms on 9 % of floor tiles along walls, fallen logs on 2 % of inner tiles, at most one shrine set into a wall over a room, three fireflies per room; never on the stairs or the start) and `src/adapters/forest-draw.ts` (drawing; arenas get root veins, mushrooms along the edges, old trees on their obstacles, fireflies; two slow mist layers over everything). Per-floor lore lines (8, es+en) on the floor card through the existing `floorKeys`.
  - Existing test changed on purpose: `crypt-atmosphere` no longer asserts the Forest has no floor lines.
  - Evidence: `tests/core/forest-variety.test.ts` (9) and `tests/adapters/forest-atmosphere.test.ts` (3) RED first (modules missing), then GREEN after fixing two wrong test claims (an escort pick draws like a pack, not like single picks; the aim is set on the first telegraph tick). Mutation: dropping the feint (plain lunge first) fails the Impidimp test. `npm test` 108 files / 1030 tests passed; typecheck clean.
- [ ] T2 Trevenant spell cards (route: same)
- [ ] T3 Decidueye phase 2, roost trees, projectile cap (route: same)
- [ ] T4 Forest difficulty hooks + GDD/README (route: same)

## Acceptance criteria
- Every forest floor has a lore line in es and en; the floor card shows it.
- Each new species behaviour is covered by a deterministic test; mixed packs only add tiles (the Crypt generates exactly as before).
- Every ring and spiral card leaves a gap wide enough for the player; every boss telegraph on easy lasts >= 500 ms.
- Decidueye enters phase 2 once at <= 50 % HP (never in a Sima echo); roost trees stop arrows; simultaneous enemy projectiles never exceed the cap.
- Easy plays exactly as without the hooks; hard and nightmare add the tricks.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 5 | grep -ic co-authored` = 0, silent headless screenshots in `/tmp/forest-remaster/`.

## Forecast
About 2000 authored lines over 4 tasks (T1 ~800 incl. sprite metadata, T2 ~450, T3 ~500, T4 ~250). Above the ~400 slice budget; the delivery decision stays with the parent.

## Progress
Created 2026-10-25 on `feat/forest-remaster` from `main` 043cb02. Engram mirror: pending (writer has no Engram session; parent owns it).
