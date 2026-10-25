# Dungeon framework + Misty Forest

## Objective
Make dungeons data-driven (`DungeonDef`), port the Crypt of the Sword King to it unchanged, and add the second dungeon, the Misty Forest (Bosque Brumoso): new enemies, a mid-boss, the guardian Decidueye with named spell-card attacks, a new urgent floor (Niebla), forest music, lore and short guardian cinematics for both guardians.

## Problem
Everything about a run is hardwired to the Crypt: one `RUN_PLAN`, one enemy table, one urgent-floor table, one music set, one tile palette, one guardian. A second dungeon needs all of these per dungeon, a way to pick it, and an unlock tied to beating the first one.

## Why
docs/gdd.md and docs/species-candidates.md plan several dungeons with their own guardians; the stream needs variety after the Crypt is beaten.

## Scope
- T1 Framework: `DungeonDef` (id, name/subtitle keys, lore keys, music contexts for floors/urgent/guardian, floor plan incl. mid-boss and guardian rooms, enemy pool weighted by depth, spawn tuning, urgent kinds and weights, tile palette, unlock condition). Crypt ported with identical generation (existing tests green). Dungeon select after the loadout (title Play) and in the town exit window, only unlocked dungeons; Forest unlocks once the Crypt guardian is beaten (`cleared` per dungeon in the records reducer). Floor-1 entry card (name, subtitle, "♪ track title" in a corner). Records/best floor per dungeon. Co-op: the host sends the dungeon id in `start`.
- T2 Forest content: 8 floors (provisional): 1-3 generated, 4 mid-boss Trevenant arena, 5-7 generated, 8 guardian Decidueye arena. Enemies Phantump (phaser lunger, drains), Pumpkaboo Small (swarm, packs of 3), Pumpkaboo Super (tank, ground slam), Foongus (stationary spore cloud), Spinarak (walking ranged, 3-thread spread), Hoothoot (flying dive). Decidueye: three spell cards with on-screen names, telegraphed and dodgeable. Urgent floor Niebla (vision closes in, minimap reveal reduced). Forest palette. Sprites via the pipeline.
- T3 Music + lore: forest floors "Cathedral in the forest" (CC0, re-verified, -18 LUFS, loop-checked); guardian music decision recorded; Niebla reuses the forest file with a low-pass; lore lines, guardian pre/post dialogue es+en; GDD section.
- T4 Guardian cinematics (scope addition from the user): short pre-fight and post-fight lore cinematics for Aegislash and Decidueye on the prologue engine; full the first time per save, then a 2-3 s name card; skippable; solo pauses the run; shared runs never pause (name card overlay only).

Out of scope: meta-progression (Pokémonedas, shop: another writer), the hunter urgent floor, flood and gas floors.

## Constraints
- Core pure and deterministic; architecture test green; `npm test`, `npm run build` green.
- Shared files (main.ts, game.ts, town exit, end screens, i18n) edited minimally and additively; new i18n keys in one contiguous block per language.
- Never name Necrozma; the Sword King is only the first guardian.
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- ~400 authored lines per task is advisory only.

## Tasks
- [x] T1 Dungeon framework + Crypt port + select/unlock + entry card + per-dungeon records (route: inline writer, this agent; trigger: core run/dungeon, data, app, adapters)
  - `src/data/dungeons.ts` (`DungeonDef`, `CRYPT`, `DUNGEONS`, `dungeonById` with the Crypt for unknown ids, `musicFor`, `TilePalette`); `SpawnEntry`/`SpawnTuning`/`CRYPT_SPAWNS` and `FloorPlan.role: 'midboss'` in `src/data/dungeon.ts`; `generateFloor(seed, depth, spawns)` with depth weights and packs; `RunState.dungeon`, `startRun(..., dungeon)`, `floorKind(seed, floor, dungeon)` (one draw against the cumulative urgent chances), `floorCount`, `dungeonOf`; `src/core/dungeon-select.ts` (unlock rules); `cleared` per dungeon and `clearedDungeons` in `src/town/records.ts`; net `start.dungeon` (host options, `begin(dungeon)`, election); app: dungeon select after the loadout (`src/app/dungeon-select.ts`, only when more than one is open), town exit lists the open dungeons, lobby host row to pick one, retry keeps the dungeon, dev `?dungeon=` and `?screen=dungeons`; `src/adapters/intro-card.ts` (floor-1 title with subtitle, "♪ title" note on every music change), floor card shows the dungeon name, renderer palette per dungeon.
  - Decisions: the Crypt keeps `RUN_PLAN`/`URGENT` and its RNG draw order (one pick per spawn; packs only add tiles), so its floors are identical; legacy records (victories but no `cleared`) count as a cleared Crypt, since every old victory was there; the select is skipped while only one dungeon is open; floor 1 shows the dungeon title instead of the floor card (presentation change for the Crypt too: its floor cards now say "Cripta del Rey de las Espadas" instead of the game title).
  - Evidence: characterisation tests (`tests/core/dungeons.test.ts`: Crypt floors identical with the explicit table for 60 seeds x 3 depths, collapse rolls identical to the M2 formula for 400 seeds x 4 floors, same music per floor) passed on the first run (refactor, no RED expected); new behaviour tests for per-depth weights, packs, unlocks, the `cleared` reducer and the lobby dungeon were written alongside the code, so no RED was observed for them. Two existing expectations updated (run state carries `dungeon`, a victory record carries `cleared: true`). `npm test` 67 files / 639 tests passed, `npm run build` ok.
- [ ] T2 Misty Forest content: enemies, mid-boss, Decidueye, Niebla, palette, sprites (route: same)
- [ ] T3 Music + lore + GDD (route: same)
- [ ] T4 Guardian cinematics for Aegislash and Decidueye (route: same)

## Acceptance criteria
- Crypt runs with a given seed produce the same floors, spawns, urgent floors and outcomes as before (existing run/dungeon/collapse tests unchanged and green).
- The Forest is listed only after a Crypt victory; a forest run plays 8 floors and ends on Decidueye.
- Decidueye's three spell cards each have a telegraph of at least 500 ms and a dodge window a roll covers; its dive leaves a punish window.
- Niebla: the vision radius shrinks monotonically to a floor, the minimap reveals only what is in sight.
- Shared runs: the guest plays the dungeon the host sent.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 6 | grep -ic co-authored` = 0, headless screenshots in `/tmp/forest/`.

## Forecast
About 2000 authored lines over 4 tasks (T1 ~600, T2 ~800, T3 ~250 plus assets, T4 ~350). Above the ~400 slice budget; delivery decision (chain or single PR) stays with the parent.

## Progress
Created 2026-10-25 on `feat/dungeon-misty-forest` from `main` d3d4f9a.
