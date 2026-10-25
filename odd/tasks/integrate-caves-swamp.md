# Integrate feat/dungeon-flooded-caves and feat/dungeon-toxic-swamp into main

## Objective

Merge `feat/dungeon-flooded-caves` (from 043cb02: 0bbc922, b3b6fcd, 51314ff, 22d54f4) and then `feat/dungeon-toxic-swamp` (from 043cb02: cd68c2c, 38b8480, c3be74d, 6411ec1) onto `main` at 916245e (difficulty tiers + forest remaster), keeping all four features whole and unifying the shared mechanisms.

## Scope and constraints

- Branch `feat/integrate-caves-swamp` from `main`; two `git merge --no-ff` commits, one per dungeon.
- One `pierceRoll` field and rule (main's `boolean`, its snapshot slot, violet "!" and `zoneWarning`); the caves' and swamp's positional cards use it solo and on guests, with pierce telegraphs.
- One difficulty-trick mechanism: main's `behaviourFor(species, tier)` with per-dungeon data patches, gated hard+ via `atLeast`; the tier telegraph scaling (with its floor) reaches the new bosses through `tickAiAt`.
- One global `ENEMY_SHOT_CAP` (160) plus per-boss caps (Lanturn 90, Dhelmise 110, Salazzle/Nihilego 140).
- No push; `main` and other branches untouched; no AI attribution.

## Checklist

- [x] T1 Merge the Flooded Caves (route: inline; conflicts in 22 files, already-understood shapes)
- [x] T2 Merge the Toxic Swamp (route: inline; conflicts in 31 files)
- [x] T3 Integration tests for both (route: inline)
- [x] T4 `npm test`, `npm run build`, silent screenshots (route: inline)

## Step 1: Flooded Caves (`ff05c03`)

Conflicts and resolutions:
- `src/data/enemies.ts`: `pierceRoll?: boolean` and `TierGate` kept from main (the caves' `pierceRoll?: true` and `DifficultyTrick<D>` dropped); `scuttle`, `burst` (caster) and `splash` (mortar) added beside main's tier fields; every `tricks:` list removed from KRABBY, REMORAID, SHELLOS, LANTURN, DHELMISE; `LANTURN_PATTERNS`, `DHELMISE_PATTERNS` and `BUBBLE` exported; `EnemyDef` = main's union + `DanmakuDef`; `ENEMY_BEHAVIOUR` holds both sets.
- `src/core/tricks.ts` (add/add): main's `behaviourFor` kept; it now concatenates per-dungeon tables (`TRICK_TABLES`). The caves' `withTricks`/`trickedDef` removed; their tricks ported verbatim to the new `src/data/caves-tricks.ts` (`CAVES_TRICKS`: Krabby second pincer, Remoraid 5-shot burst, Shellos splash on hard; Lanturn 3 spiral arms on hard and `deep` on nightmare; Dhelmise 3 whirlpool arms on hard and `maelstrom` in phase 2 on nightmare).
- `src/core/enemies.ts`: `updateEnemies` uses `behaviourFor` + `tickAiAt` (one tier read); treant and danmaku dispatch; caster `attack`: Gastly's second ball, Remoraid's burst, then Drifloon's ring waves.
- `src/core/victim.ts`: `guestEnemyContacts` gets the `danmaku` branch reading `behaviourFor` at the world tier; `pierceZone` gains a danmaku branch (`sweep` and `zone at: 'self'` -> `circle`, `zone at: 'target'` -> new `{ kind: 'mark', center, radius }`).
- `src/core/danmaku.ts`: `enemyTelegraph` carries `pierceRoll` for sweep/zone cards (so audio plays the zone warning); `cardDef` exported. Its `maxShots` check stays, under `spawnShot`'s global cap.
- `src/core/brain.ts`, `state.ts`, `boss.ts`, `roster.ts` (Shellos splash then Slugma's repeat), `run.ts` (tiered spawns + wisp + shallow water), `world.ts`, `dungeons.ts` (`decor` union, `wisp` + `water`), `renderer.ts` (forest + caves decor, `currentTier` + `currentTimeMs`, pierce `mark` drawn at its centre), species/sprites/progression/sprite-anim/fetch-sprites (union), i18n (both blocks), README (caves text over main's paragraph).
- `sprite-meta.json` and CREDITS sprite rows regenerated with `node tools/fetch-sprites.mjs` (SpriteCollab only); no existing sheet changed (`git diff -- public/sprites` empty). CREDITS music: caves lines re-added after regeneration took main's.
- Caves tests switched from `withTricks(DEF, tier)` to a local helper over `behaviourFor`.
- GDD: caves positional attacks now point to §9's rule; new paragraph "Las Cuevas según la dificultad".
- New `tests/core/caves-tiers.test.ts` (12): Descarga, Resaca and Corriente hit a rolling player solo and as a guest through `hostSnapshot` -> encode/decode -> `applyHostSnapshot`, each with a negative control (flag temporarily off: dodged); `pierceZone` circle/mark/null and the real `surge` wind-up event carries `pierceRoll`; Lanturn and Dhelmise nightmare telegraphs equal `scaledTelegraphMs` within one tick and never under `TELEGRAPH_FLOOR`; `behaviourFor` serves forest and caves tables (normal none, hard tricks); per-boss caps (95 shots: Lanturn adds none, Dhelmise fills to 110) and the global 160.
- Evidence: `npx tsc --noEmit` clean; `npm test` 124 files / 1178 tests passed; `npm run build` ok.

## Step 2: Toxic Swamp (`c67ece8`)

Conflicts and resolutions:
- `FloorKind` = `normal | collapse | fog | flood | gas`; every dungeon's urgent music map has `flood` and `gas` (caves `gas: 'collapse'`, swamp `flood: 'swamp'`).
- `DungeonId` union; `DUNGEONS = [CRYPT, FOREST, CAVES, SWAMP, ECLIPSE]`; `decor` = `crypt | forest | caves | swamp`; `wisp`, `water`, `toxicPools` all kept. Swamp `unlockedBy: 'flooded-caves'` (now a real dungeon).
- `src/data/world.ts`: `lago` keeps the caves' pier entrance (23,6) and gains the swamp's east link (35,18) to `cienaga`; the Ciénaga crystal's second line now `after: 'flooded-caves'`.
- Tricks ported into `behaviourFor`: inline gates removed from `swamp-enemies.ts` (`extraBounce`, `returnDash.minDifficulty`, `fan.minDifficulty`, `dance.extraDash`, `escort.minDifficulty`, `nightmareCard`, `tendrils.extraWave`, `shards.extraRing`); `returnDash` and `fan` optional; `SALAZZLE.cards` without `escort`. New `src/data/swamp-tricks.ts` (Venipede +1 bounce, Salandit return dash, Skrelp fan of 3, Salazzle 4th dash on hard + escort on nightmare, Nihilego 3rd tendril wave + 4th shard ring on hard + downpour on nightmare). Helpers (`rollerBounces`, `dashesBack`, `sniperShots`, `queenCards`, `danceDashes`, `tendrilWaves`, `shardRings`, `ultraCards`) read the def only; swamp tests use a `behaviourFor` helper.
- Cap: `maxShots: SWAMP_SHOT_CAP` (140) on `QueenDef`/`UltraDef`; `spawnCapped(..., cap)` uses it, `spawnShot` still applies the global 160.
- Pierce: Salazzle's haze, Nihilego's wormhole and flood wind up with `telegraph(..., pierceRoll)`; `PierceZone` gains `{ kind: 'pockets', centers, radius }`; `pierceZone(enemy, tier, arena)` returns pockets for haze/flood and the wormhole `mark`; the renderer draws the double edge around each pocket.
- `guestEnemyContacts`: swamp branch (`isSwampDef` + `swampAttack` over `behaviourFor`); with the danmaku and swamp branches every kind is narrowed before the Aegislash shield-bash fallback (the type checker proves only `boss` reaches it).
- `step.ts`: wormhole pull, then collapse, fog, flood, gas, toxic. `state.ts`: `BossStance` and events/world fields unioned (`flood`, `gas`, `pools`; `poisoned` event and main's `enemyTelegraph.pierceRoll`).
- `main.ts`: one dev `?screen=run&dungeon=` route (the swamp's, which waits for the sheets).
- Music: contexts union (`caves`, `caves-flood`, `caves-guardian`, `swamp`); planned list now hub, necrozma, prologue; LICENSES and CREDITS list both.
- i18n: both blocks; duplicate `boss.stance.spiral` (identical) dropped once.
- `renderer.ts`: forest, caves and swamp decor and arenas; danmaku and queen/ultra telegraphs; Dhelmise's sinking and Nihilego's wormhole vanish; telegraphs read `behaviourFor(species, currentTier)` so tiered patterns draw.
- Sprites regenerated again (union in TARGETS order, existing sheets byte-identical).
- GDD: swamp positional attacks point to §9; "El Pantano según la dificultad"; Gas tóxico row after Inundación. README: swamp text, `?dungeon=` list, music, licenses.
- New `tests/core/swamp-tiers.test.ts` (12): Haze, Flood and wormhole bite hit a rolling player solo and as a guest, each with a negative control; pockets/mark zones and the real wind-up events (haze, wormhole, flood flagged; dance, tendrils not); Salazzle and Nihilego nightmare telegraphs scaled and floored; `behaviourFor` swamp tricks (normal none, hard tricks, nightmare cards); 140 per-boss cap under the global 160.
- Evidence: `npx tsc --noEmit` clean; `npm test` 130 files / 1256 tests passed; `npm run build` ok (existing chunk-size warning only).
- Test-first: integration tests written after the resolution (no RED); each pierce test carries a negative control.

## Step 3: screenshots

Headless Firefox over WebDriver BiDi (`--remote-debugging-port 9611`, own profile whose `user.js` has `user_pref("media.volume_scale", "0.0");`), settings stored with `muted: true` and all volumes 0 on a same-origin non-game URL before the game loads; dev server 4611; both stopped after (only the PIDs started here). In `/tmp/integrate-caves-swamp/`:
- `dhelmise-undertow-pierce.png`: Resaca wind-up, white/violet double edge on the sweep's reach, violet "!" over Dhelmise.
- `nihilego-p2-flood-pocket.png`: phase-2 Marea, the arena flooded violet, the safe pocket with the double edge and the "!".
- `nihilego-wormhole-pierce.png`: wormhole mouth with the pierce mark.
- `lago-pier-caves-entrance.png`, `lago-east-exit-cienaga.png`: the lake map around the pier (caves stair) and its east edge (the camera cannot frame both at once).
- `cienaga.png`: Ciénaga del Cielo Roto with the Croagunk hermit.
- `caves-hard-elite-krabby.png`: Difícil, caves floor 2 seed 64, a tough Krabby elite with the amber ring.

## Not verified

- Balance by hand; music by ear (muted runs); the east-exit gap on `lago` is only checked by the map tests (pairing, reachability), not visually obvious in the screenshot.

## Next step

Human decision: merge `feat/integrate-caves-swamp` into `main`.
