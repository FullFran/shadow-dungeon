# Integrate feat/sima-remaster into main

## Objective

Merge `feat/sima-remaster` (from 043cb02: 9863f5e, 41a92d5, e620782, 182e93d, 07bd8ad) onto `main` at 7814930 (difficulty tiers, forest remaster, Flooded Caves, Toxic Swamp), keeping the remaster whole and unifying the shared mechanisms: elites, set-piece encounters, `pierceRoll`, difficulty tricks, shot caps, and the new dungeons' content in the Sima.

## Scope and constraints

- Branch `feat/integrate-sima-remaster` from `main`; one `git merge --no-ff` commit, then work-unit commits.
- One elite system (one trait table, one seeded draw, one snapshot/wire field).
- Sima events read the tier's set-piece multipliers (`encounterChance`, `encounterWaves`); at most one event per floor.
- Eclipse Echo corona and noose and deep elites use main's `pierceRoll` rule and `PierceZone` (telegraph shown); tests solo and guest.
- Eclipse Echo tricks through `behaviourFor` (`src/data/sima-tricks.ts`); its cap 110 as `maxShots`.
- Caves and swamp regulars in `ENDLESS_POOL`; Dhelmise and Nihilego as guardian echoes (phase 2 off); mid-bosses stay out.
- 3-per-room cap kept; leaderboard per tier untouched. No push; `main` untouched; no AI attribution.

## Checklist

- [x] T1 Merge and resolve (route: inline; conflicts in 17 files; the elite unification had to happen inside the resolution because both sides rewrote `EnemyState.elite`, `loadFloor` and `enterFloor`) - `3c041db`
- [x] T2 Caves/swamp in the Sima, echoes, strata, integration tests (route: inline) - `2b76f1b`
- [x] T3 Docs (GDD §3/§9, README) (route: inline) - `35673b8`
- [x] T4 `npm test`, `npm run build`, silent screenshots (route: inline)

## Step 1: merge `3c041db`

Conflicts and resolutions:
- `src/data/difficulty.ts` + `src/data/sima.ts` (the elite decision): one `EliteTrait` = `tough | frenzied | swift | volley | armored | enrage` and one `ELITE_TRAIT_DEFS` table (hp, cooldown, `pace`, `enrage`, `volley`, `onlyKind: 'caster'`, `armor`, tint, nameKey). `ELITE_TRAITS` (tough, frenzied) is the tier draw pool for regular dungeons; `SIMA_ELITES.traits` lists all six. `SIMA_ELITES` keeps only its ramp (fromFloor 6, 6 %, +1.5 %/floor, max 40 %), `hpScale` 1.35 and `pierceRoll` (from 21, 30 %); swift/enrage/volley numbers and tints moved into the table. New `EliteRule { chance, traits, hpScale, pierceRollChance }`.
- `src/core/difficulty.ts`: `drawElite(floorSeed, index, rule, species)` is the one seeded draw (main's draw order kept, so tier elites on regular dungeons are byte-identical to main; a third draw for pierce); `eliteFor` wraps it; `tierEliteRule`, `fittingTraits`, `eliteTimeScale` (from the table). `src/core/sima.ts`: `eliteRuleAt(elites, floor, tier)`; the Sima's `rollElites`, `eliteTraitFor`, its own `eliteTimeScale` removed.
- **Decision (elite chance)**: in the Sima the chance is `max(tier chance, depth ramp)`, not the sum: Nightmare gets its 30 % from floor 1, depth still climbs to 40 %, and deep floors are not almost all elites. Every Sima elite gets `hpScale` on top of the trait's HP (a tough Sima elite is ×1.35×1.5). Tested in `sima-integration.test.ts`; mutation (ramp only) fails 2 tests.
- `src/core/floor.ts` `loadFloor(state, floor, kind, elites?)` draws for every spawn (tier rule by default); `spawnEnemy` options `elite`, `eliteHp`, `pierceRoll` (armor from the table). `src/core/run.ts`: tiered spawns, then Sima squads, berries, wisp, the elite rule, water, pools, then the Sima event (with the tier).
- Snapshot/wire: the one `EnemyState.elite` (+ `armor`, `pierceRoll`) rides the Sima's existing trailing slot; `isEliteTrait` now accepts all six traits from the table (main's elites, previously only seed-derived, now also travel; nothing duplicated).
- `src/core/enemies.ts`: `ems = ms * eliteTimeScale(enemy)` then `tickAiAt(ai, ems, tier, elite)`; every brain gets `ems`; the `eclipse` kind dispatched beside danmaku/treant/swamp.
- `src/core/brain.ts`: global `ENEMY_SHOT_CAP` and the volley elite (degrees from the table); deep elites: `contactPlayer`, `spawnShot` and `telegraph` set `pierceRoll` when `enemy.pierceRoll`.
- `src/core/hits.ts`: tier damage then the pact's curse. `src/core/step.ts`: main's chain + `simaEventStep`. `boss.ts`: `eclipse` in `initialBoss`/`hasBossState`. `state.ts`: imports and `BossStance` union + `EclipseCard`; world fields union (`wisp`, `simaEvent`, `simaPact`).
- Sima events: `simaEventChance(def, floor, d)` = `encounterChance(ramp, d)`; `simaWaves(def, d)` = `encounterWaves(3, d)` (Nightmare 4, the extra wave repeats the last size, `simaWaveSize`); `chooseSimaEvent(..., difficulty)`; HUD counter "Oleada n/4" from the tier. Still one `simaEvent` per floor.
- Eclipse Echo: `hardExtra`/inline `atLeast` replaced by `extraCards: 0` + `src/data/sima-tricks.ts` (hard: +1) in `TRICK_TABLES`; `eclipseCardCount(def, floor)`; `projectileCap` -> `maxShots` 110 (under the global 160); its corona/noose wind-up events carry `pierceRoll`.
- `src/core/victim.ts` `pierceZone`: eclipse corona -> `pockets` (its three refuges), noose -> new `{ kind: 'ring', center, radius, width }` (closing radius while attacking), any enemy with `pierceRoll` -> `shape`. Renderer draws the ring's double edge, draws the Echo's zones under the pierce marks, tints elites from the table (both main's aura and the Sima's filter), passes the tier to the Sima HUD.
- Data unions: species, progression XP, `ENEMY_BEHAVIOUR`, `EnemyDef` (+ `EclipseEchoDef`), `RoomId` (+ `eclipse`), sprite-anim, i18n (both blocks; the duplicate `boss.stance.spiral` dropped once; `elite.swift/volley/armored/enrage` added). `game.ts`: both feature sets; coins `coinBreakdown(..., difficulty)` inside the merchant's `spendCoins`/`coinsInHand`. README: main's paragraph with the Sima text.
- Existing tests changed on purpose: `eclipse-echo.test.ts` (card count via `behaviourFor`, `maxShots`), `sima-ramp.test.ts` (trait helpers from the table; HP includes the trait's).

## Step 2: content `2b76f1b`

- `ENDLESS_POOL` += Krabby 6, Remoraid 7, Shellos 8, Venipede 9 (pack 2), Salandit 10, Skrelp 11, all growing with depth; Lanturn and Salazzle stay out. Squads += Krabby+Remoraid (12), Shellos+Krabby+Tentacool (16), Salandit+Skrelp (18), Venipede+Skrelp+Salandit (22). 3-per-room cap untouched (sima-ramp test green to floor 45).
- `ENDLESS.echoes` += `wreck` (Dhelmise, caves-guardian) and `rift` (Nihilego, forest-guardian, the swamp's guardian track); echo rotation now 5 guardians. Phase 2 disabled in echoes: `danmaku.ts` `awakens` and `swamp-bosses.ts` `startUltraCard` check `enemyScale.echo` (mutation removing the danmaku gate fails the test).
- Strata (cheap, done): 21-30 "Estrato III · La Campana Ahogada" (caves palette and decor), 31-40 "Estrato IV · El Cielo Envenenado" (swamp), abyss moved to 41+ ("Estrato V"); the forest stratum now also gets main's forest decor. New band i18n keys appended at the end of each catalogue. Deep-elite pierce still from floor 21. Music band rotation kept (crypt/forest) - not extended.
- Existing tests changed on purpose: echo order (`endless`, `eclipse-echo`), bands (`sima-bands`), the tough-share set includes the new depth-growing species (`sima-ramp`).
- New `tests/core/sima-integration.test.ts` (19): trait table and pools; `eliteRuleAt` = max for every tier and depth; Nightmare elites on shallow Sima floors (none on easy) with HP = species x depth x tier x trait x 1.35; Caves elites only tough/frenzied; same elites on two peers and tier traits over the wire; event chance scaled and capped, more events on Nightmare, a wave room playing 4 waves on Nightmare; corona and noose hit a rolling player solo and as a guest through encode/decode, each with a negative control (flag off: dodged); corona/noose wind-up events and zones (pockets, ring), bullet cards none; deep elite shots pierce solo and on guests (negative controls), its telegraph flagged and zone `shape`; `behaviourFor('eclipse-echo')` same object on easy/normal, +1 card on hard; `maxShots` 110 < 160; caves/swamp in the pool from depth 6 and met on deep floors; Dhelmise (35) and Nihilego (45) echoes stay in phase 1 at 20 % HP for 20 s while the same boss outside an echo awakens (control).
- Mutations run: max -> ramp only (2 fail), danmaku echo gate removed (1 fails), elite pierce on shots removed (2 fail); all restored.
- Test-first: integration tests written after the resolution (no RED); negative controls and mutations instead.

## Step 3: docs `35673b8`

GDD §3 Sima (echoes with Dhelmise/Nihilego, pool additions, unified elites and the max decision, new squads, five strata, tier-scaled events, fourth wave, the Echo's hard card and `maxShots`, positional cues) and §9 (one trait table, events read the tier). README: strata list.

## Evidence

- `npx tsc --noEmit`: clean.
- `npm test`: 137 files / 1319 tests passed.
- `npm run build`: ok (existing chunk-size warning only).
- `git log --format=%B main..HEAD | grep -ic co-authored`: 0.

## Screenshots (silent)

Headless Firefox over WebDriver BiDi (`--remote-debugging-port 9621`, own profile `/tmp/integrate-sima-remaster/prof` whose `user.js` has `user_pref("media.volume_scale", "0.0");`), settings with `muted: true` and all volumes 0 stored on a same-origin non-game URL before the game loads; dev server 4621; both stopped after (only the PIDs started here, plus the vite child they spawned). Script `/tmp/integrate-sima-remaster/shoot.mjs` (adapted from `/tmp/integrate-caves-swamp/`), seed finders `find.ts`/`find2.ts`. In `/tmp/integrate-sima-remaster/`:
- `sima-shrine-pact.png`: floor 13 seed 1, the eclipse altar's pact window (Sangre de Luna).
- `pesadilla-wave-room.png`: Pesadilla, floor 7 seed 1, sealed doorways, "Oleada 1/4".
- `eclipse-echo-corona-pierce.png`: floor 20, Signo Corona, the refuges with the white/violet double edge and the violet "!" over the Echo.
- `sima-floor29-caves-stratum-elites-salandit-skrelp.png`: Difícil, floor 29 seed 1 (caves stratum): Salandit frenzied elite and Skrelp armored elite.
- `sima-floor31-swamp-stratum-elite-grimer.png`, `sima-stratum-iv-card.png`: floor 31 (swamp stratum card), an armored Grimer elite.
- `dhelmise-echo-floor35.png`: "Dhelmise · Eco del guardián · Planta 35" with the Resaca pierce circle.

## Not verified

- Balance by hand; music by ear. The deep-elite "!" (pierce) on screen was not caught (those elites were asleep in the frames). The run clock stayed at 8:00 in the `nearEvent` frames (it ran in the Echo frames); not investigated. Co-op only through unit tests over the wire codec, not two browsers.

## Next step

Human decision: review and merge `feat/integrate-sima-remaster` into `main`.
