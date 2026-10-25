# Dungeon 3: Flooded Caves (Cuevas Inundadas)

## Objective
Add the third story dungeon, the Flooded Caves ("Cuevas Inundadas", Touhou subtitle "Donde la campana ahogada aún llama a los suyos"), at the bar of the Crypt remaster: per-floor lore, code-drawn water and crystal atmosphere, an urgent floor of its own (Inundación), new enemies with distinct behaviours, a bullet-hell leaning mid-boss and guardian with named spell cards, phase 2 and arena cover, its own music, and full integration (coins, records, unlock chain, co-op, overworld entrance, waystone, difficulty hooks).

## Problem
After the Misty Forest the story stops: the experimental water species only live in the Sima, the GDD's Inundación floor does not exist, and the lake map has no dungeon.

## Why
User request 2026-10-25: "build the next dungeons, more epic, bosses leaning bullet hell, more variety".

## Scope
- T1 Dungeon: 10 floors (1-4 generated, 5 Lanturn mid-boss grotto with an exit, 6-9 generated, 10 Dhelmise's wreck); unlock after clearing the Misty Forest; water/crystal palette and decoration drawn in code (dripping water, glowing crystals, shallow water pools that slow non-Water walkers, deep water edges); per-floor lore lines; urgent floor Inundación (the water rises over the floor and slows non-Water players more and more; find the stairs); pool with the roster water species (Zubat, Tentacool, Chinchou, Corphish, Clauncher, Wooper) plus Krabby, Shellos and Remoraid (tracker-verified Core 6 sprites) with distinct behaviours.
- T2 Bosses: Lanturn mid-boss and guardian Dhelmise «el Ancla de los Juramentos Hundidos»; one data-driven bullet-hell kind (`danmaku`) with named spell cards (bubble rings with a gap, whirlpool spirals, kelp lanes with a safe lane, anchor sweeps, a riptide that surfaces under you), phase 2 at 50 %, arena cover (rock pillars in the grotto, the sunken ship's hull in the wreck), a safe path in every pattern, a projectile cap; guardian lore and cinematics (never Necrozma; oaths; something deeper devours the light).
- T3 Music: "Underwater" (Cleyton Kauffman, CC0) for the floors through the pipeline (-18 LUFS, sample-accurate seam check); the flood floor reuses it with a low-pass; a CC0 guardian track for Dhelmise by the same research rules, or reuse; credits.
- T4 Integration: coins (Lanturn 25 as a mid-boss), records and the unlock chain, co-op (dungeon id in `start`, new enemy state only through existing or optional snapshot fields), an entrance in the `lago` map (a sunken stair by the pier), waystone quick travel lists it when unlocked; difficulty hooks (each new enemy and boss: one extra trick on hard and nightmare, an extra card on nightmare; `minDifficulty` + `atLeast`); GDD and README.

Out of scope: other dungeons (forest remaster, swamp, Sima remaster run in parallel), balance by hand.

## Constraints
- Core pure and deterministic; architecture test green; `npm test` and `npm run build` green.
- Shared files edited additively (i18n one contiguous block per language; `world.ts` only the entrance in `lago`).
- No protocol break: card, wave and aim travel in `boss.stance`, `boss.comboIndex`, `ai.attackDir`, `ai.aimPoint`, `ai.modeMs`.
- Telegraphs >= 500 ms on easy for every new attack; every bullet pattern leaves a gap a player fits through.
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Tasks
- [x] T1 Dungeon data, flood floor, water tiles, atmosphere, enemies, sprites (route: inline writer, this agent; core, data, adapters, tools)
  - Data: `CAVES` (`flooded-caves`) in `src/data/dungeons.ts`: 10 floors (1-4 generated, 5 `grotto` Lanturn mid-boss with an exit, 6-9 generated, 10 `wreck` Dhelmise), `unlockedBy: 'misty-forest'`, listed between the Forest and the Sima; pool by floor (Krabby, Zubat packs of 3, Remoraid, Tentacool from 1; Shellos and Corphish from 2; Chinchou and Wooper from 3; Clauncher from 6), 1-2 per room on floor 1 rising half a step per floor, max 4; urgent Inundación 25-50 % from floor 2, a rare collapse 8-12 % from 4; blue-teal palette; `decor: 'caves'`; `water: { poolChance: 0.55 }`. Rooms `grotto` (four crystal rocks, `cover`) and `wreck` (bow and stern of the hull plus two rocks, `cover`). Lore: name, subtitle, two lines, ten floor lines (es+en). Music placeholders until T3.
  - Water (`src/core/water.ts`): seeded pools (own salt, so the generator's draws are unchanged), never in the start room or on the stairs; `wadeFactor` slows non-Water walkers to 0.7 (player through a new optional `wade` argument of `updatePlayer`, enemies in `moveEnemy`; floaters pass over; never below 0.4 combined). `Arena.water` is set in `enterFloor` from the floor itself, so every peer lays the same pools.
  - Flood (`src/core/flood.ts`, `FLOOD` in `src/data/dungeon.ts`, `FloorKind` `'flood'`): 4 s grace, smoothstep rise over 45 s, a non-Water player walks up to 45 % slower; once risen a 2 % chill every 2 s, never below 1 HP; Water types untouched. Card "¡El agua sube!".
  - Enemies: Krabby (lunger with `scuttle`: closes in sideways; hard+ adds a re-aimed second pincer), Remoraid (caster with `burst`: 3 shots down the lane locked at the end of the wind-up, 5 on hard+), Shellos (mortar; hard+ `splash` throws 6 droplets from the landing). Sprites via the pipeline (0098, 0422 West, 0223, 0171, 0781; tracker 2026-10-25: all Core 6; CREDITS sprite section regenerated).
  - Difficulty seam: `DifficultyTrick` (`minDifficulty` + `set`) in `src/data/enemies.ts`, `withTricks`/`trickedDef` (`src/core/tricks.ts`, read through `atLeast`), applied once in `updateEnemies`; easy plays the data as written.
  - Atmosphere (`src/adapters/cave-decor.ts`): pools with moving glints and a darker deep edge against the rock, pulsing cyan/violet crystals on 16 % of lit wall faces, drops that fall and ripple on 9 %, ankle-deep water with caustics in the arenas, hull planks and crystal-capped rocks for cover, a flood veil that deepens with the level.
  - Overworld: entrance in `lago`, a sunken stair at the far end of the pier (23,6), back on the pier (pulled forward from T4: the world test asks every registry dungeon to have an entrance).
  - Evidence: `tests/core/caves.test.ts` (18) and `tests/adapters/caves-atmosphere.test.ts` (3); RED observed only as a load failure (modules missing), then GREEN. `npm test` 107 files / 1039 tests passed; `npm run build` ok.
- [ ] T2 Lanturn and Dhelmise (danmaku kind, cards, phase 2, cover, cap), guardian lore and cinematic (route: same)
- [ ] T3 Music: Underwater + guardian track, credits (route: same)
- [ ] T4 Integration: coins/records/unlock, co-op checks, lake entrance, waystone, difficulty hooks, GDD/README (route: same)

## Acceptance criteria
- The caves are listed only after a Forest victory; a caves run plays 10 floors, the mid-boss floor exits, the run ends on Dhelmise.
- Inundación: the water level rises monotonically to a cap; a non-Water player walks slower as it rises, a Water-type player does not; never on floor 1 or arenas.
- Shallow water tiles are deterministic per floor seed, never on the start or stairs tile, and slow non-Water walkers only.
- Every new enemy behaviour and every spell card is covered by a deterministic test; every telegraph >= 500 ms on easy; rings and spirals leave a gap; kelp lanes always leave a safe lane; enemy projectiles never exceed the cap.
- Dhelmise enters phase 2 once at <= 50 % HP; Lanturn pays 25 coins; beating Dhelmise marks the caves cleared.
- Hard+ adds a trick per new enemy/boss, nightmare an extra card; easy is unchanged by the hooks.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 5 | grep -ic co-authored` = 0, silent headless screenshots in `/tmp/caves/`.

## Forecast
About 2400 authored lines over 4 tasks (T1 ~900, T2 ~900, T3 ~150 plus assets, T4 ~450) plus sprites and music. Above the ~400 slice budget; the delivery decision stays with the parent.

## Progress
Created 2026-10-25 on `feat/dungeon-flooded-caves` from `main` 043cb02. Engram mirror: pending (writer has no Engram session; parent owns it).
