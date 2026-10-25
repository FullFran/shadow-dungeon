# Dungeon 4: the Toxic Swamp (Pantano Tóxico)

## Objective
Add the fourth story dungeon, the Pantano Tóxico, as epic as the remastered Crypt: about ten floors with a code-drawn swamp atmosphere, toxic pools that poison on contact, a new urgent floor (Gas tóxico), a mixed enemy pool (roster poison species plus new ones with their own behaviours), the Salazzle mid-boss and the guardian Nihilego with bullet-hell leaning spell cards and a phase 2, its own music, and a new overworld map that holds its entrance.

## Problem
After the Crypt and the Forest (and the Flooded Caves in parallel) there is no fourth dungeon. The GDD plans a Toxic Swamp with Nihilego, the first clear sign of what came through the eclipse; the roster's poison species live only in the Sima so far.

## Why
User request 2026-10-25: build the next dungeons, more epic, bosses leaning bullet hell, more variety.

## Scope
- T1 Dungeon: id `toxic-swamp`, "Pantano Tóxico" with a Touhou subtitle; 10 floors (1-4 generated, 5 Salazzle mid-boss, 6-9 generated, 10 Nihilego); code-drawn swamp decor (sludge, bubbles, toxic mist, dead trees, glowing spores); toxic pools on generated floors that poison on contact; per-floor lore lines; urgent floor `gas` (Gas tóxico): a cloud advances from the entrance and drains HP slowly (never the last HP); pool of roster poison species (Grimer, Koffing, Ekans, Croagunk, Stunky, Tentacool) plus Venipede, Salandit and Skrelp with new behaviours.
- T2 Salazzle mid-boss (two cards) and Nihilego guardian («...» epithet), bullet-hell leaning named cards (neurotoxin tendril lanes, spore spirals with gaps, rock-shard rings, Ultra wormhole teleports, poison downpour on nightmare), phase 2 at 50 %, arena cover, safe paths always, an enemy projectile cap; cinematics hinting the eclipse came from beyond this world (Necrozma never named).
- T3 Music: "Swamp Theme Loop" (beardalaxy, CC0) after re-verifying the page, pipeline to -18 LUFS with a loop-seam check; guardian track: a CC0 eerie boss track or a reused one; credits.
- T4 Integration: coins (mid-boss 25), records and the unlock chain (after the Flooded Caves), co-op (dungeon id in `start`, optional snapshot fields only), new overworld map east of `lago` with the entrance, NPC and lore points, waystone, difficulty hooks (one extra trick per new enemy/boss on hard+, an extra card on nightmare via `minDifficulty` + `atLeast`); GDD and README.

Out of scope: the difficulty framework itself (another writer), the Flooded Caves (another writer), Forest and Sima remasters.

## Constraints
- Core pure and deterministic; architecture test green; `npm test`, `npm run build` green.
- Shared files edited additively; new i18n keys in one contiguous block per language; in `world.ts` only a new map plus the one east edge link on `lago` (and the border tiles it needs to be walkable).
- No protocol break: new boss state through `boss.stance`/`comboIndex`, `ai.attackDir`/`ai.aimPoint`; new world/player fields optional and per peer (pools from the run seed, gas and poison per peer like the fog).
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Tasks
- [x] T1 Dungeon, pools, gas floor, enemies, atmosphere, lore, overworld map (route: inline writer, this agent; core, data, adapters, tools)
  - Data: `SWAMP` (`toxic-swamp`) in `src/data/dungeons.ts`: 10 floors (1-4 generated, 5 `den` Salazzle mid-boss with an exit, 6-9 generated, 10 `rift` Nihilego), pool by floor 1..9 (Venipede packs of 3, Stunky pairs, Ekans, Tentacool, Skrelp from 1; Salandit and Koffing from 2; Grimer from 3; Croagunk from 4), urgent gas 25-45 % and collapse 8-12 % from floor 3, swamp palette, `decor: 'swamp'`, `toxicPools`, `unlockedBy: 'flooded-caves'` (that id is added to `DungeonId` here; the Caves writer registers the dungeon). Ten floor lore lines. Species Venipede (0543), Salandit (0757), Skrelp (0690), Salazzle (0758), Nihilego (0793) from the sprite pipeline (tracker 2026-10-25: all six core animations; CREDITS sprite section regenerated). New `rock` type (Nihilego is Rock/Poison) with its chart row, the rock column on attackers, colours and names.
  - Toxic pools (`src/core/toxic.ts`, `TOXIC` in `src/data/swamp.ts`): placed from the floor seed in rooms (not the start room, clear of start and stairs), also fixed ones in the arenas (`RoomDef.pools`); wading in (not rolling, not on the rim) poisons for 3.2 s after the last contact, 2 % of max HP every 0.7 s, never the last HP; `poisoned` event and a log line. Cleared on every new floor.
  - Gas tóxico (`src/core/gas.ts`, `GAS`): new `FloorKind` `gas`; after 4 s the cloud spreads from the start along the walking distances at 1 tile/s (front reaches the stairs no sooner than 3x the walk); inside it drains 3 % every 0.8 s, roll or not, never the last HP. Every dungeon's urgent music map got a `gas` entry (the collapse track).
  - Enemies (`src/data/swamp-enemies.ts`, `src/core/swamp-brains.ts`): Venipede `roller` (curl with locked lane, roll at 250 px/s that bounces off a wall once, dizzy 1.1 s; hard+: one more bounce), Salandit `dasher` (circles, locked lane, dash past leaving smoke puffs every 55 px; hard+: re-aimed dash back), Skrelp `sniper` (keeps 190-300 px, 1 s aim that locks for the last 350 ms, one fast ink bolt then a hop back; hard+: fan of 3). Guests land rolls and dashes victim-side.
  - Atmosphere (`src/adapters/swamp-decor.ts`): dead trees on lit wall faces, reeds, bubbling glowing pools, drifting spores and toxic mist bands, the gas cloud thickening behind its front, crystal spires (cover) and root knots in the arenas; telegraphs for the three new kinds.
  - Overworld (moved here from T4 so the registry test stays green): new map `cienaga` "Ciénaga del Cielo Roto" east of `lago` (lago got the east link and the two border tiles it needs), the swamp entrance between two broken pillars, a Croagunk hermit (`hermit` role) with three lines, a fallen-crystal lore point, two wanderers.
  - Evidence: `tests/core/swamp.test.ts` (16) RED first (modules missing), then GREEN. `tests/core/swamp-enemies.test.ts` (9) written after the brains, so no RED; mutation checks instead: no bounce, no aim lock, no smoke puffs each fail their test. `tests/town/cienaga.test.ts` (3) plus the generic map tests (pairing, reachability, entrance). `npm test` 109 files / 1056 tests passed; `npm run build` ok.
- [ ] T2 Salazzle + Nihilego, cards, phase 2, arena, projectile cap, cinematics (route: same)
- [ ] T3 Music (route: same)
- [ ] T4 Integration: coins, unlock, co-op, overworld map, waystone, difficulty hooks, docs (route: same)

## Acceptance criteria
- Swamp plan: 10 floors, mid-boss on 5 (exit), Nihilego on 10; the gas never takes the last HP and reaches the stairs no sooner than its safety factor; pools poison on contact, poison never kills.
- Every new enemy behaviour and every boss card covered by a deterministic test; every card leaves a safe path (gap test per card); phase 2 starts once at <= 50 % HP; enemy projectiles never exceed the cap.
- Unlocks after `flooded-caves` is cleared; Salazzle pays 25 coins; the new map is connected both ways and its entrance reachable.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 5 | grep -ic co-authored` = 0, silent headless screenshots in `/tmp/swamp/`.

## Forecast
About 2400 authored lines over 4 tasks (T1 ~1000, T2 ~900, T3 ~150 plus assets, T4 ~350). Above the ~400 slice budget; the delivery decision stays with the parent.

## Progress
Created 2026-10-25 on `feat/dungeon-toxic-swamp` from `main` 043cb02. Baseline `npm test`: 106 files / 1018 tests passed. Engram mirror: pending (writer has no Engram session; parent owns it).
