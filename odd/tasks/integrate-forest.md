# Integrate the Misty Forest into main

## Objective
Merge `feat/dungeon-misty-forest` (based on d3d4f9a) into `main` 0ef2e6f (Pokémonedas + shop, mobile touch + PWA, starter polish) on `feat/integrate-forest`, keeping every feature of both sides.

## Constraints
- Coins earned in the Forest with the same rules; records `cleared` per dungeon and the coin save both kept.
- Touch works in the forest, during guardian cinematics, in the dungeon select (>= 44 px); fog floor works with touch.
- Forest enemy attacks use the shared type colour table; telegraphs keep their red edge.
- Title indices stable (Play, Online, Settings, Credits, Prólogo, Pueblo, Tienda, [Instalar juego]); town exit lists unlocked dungeons, works by touch.
- i18n keeps every key, valid JSON; the service worker still caches the new music.
- No push, no AI attribution.

## Tasks
- [x] M1 Merge with conflict resolution (route: inline, this writer; conflicts are small hunks in known files) — `e22f672`
  - README: forest paragraph kept, Shop entry, Pokémonedas line and `town|shop` dev screens re-added.
  - `src/core/state.ts`: both imports (`ArcherCard`, `UpgradeLevels`).
  - `src/town/scene.ts`: exit window keeps `touch.setSuspended(true)` and the per-dungeon `depart(id)`.
  - `src/app/main.ts`: imports of both; town gets `dungeons` + `onDepart(id)` + `openShop`; end saves `summary.dungeon` and earns coins; dev summary has `dungeon` and `coins`; `DUNGEON_LORE` import dropped (unused).
  - `src/app/game.ts`: `finish()` carries `dungeon` and `coins`, the guardian post moment stays; render state has `coins`, `palette`, `intro`, `nowPlaying`, `spell`.
  - `src/adapters/renderer.ts`: RenderState has both sides' fields; telegraphs use `telegraphFill(enemyAttackType(enemy))` with the forest's behaviour-kind branches; `projectile(p: DrawnProjectile)` from main plus the forest's `groundCircle`, `enemyShot`, `fogVeil`.
  - i18n es/en: both blocks concatenated (441 keys each, no duplicates, valid JSON).
  - Compile fix: `TYPE_COLORS` gains grass, bug, flying (the forest added those types).
- [x] F1 Fixes after the merge (route: inline) — `2a45ebc`
  - Coins: `CoinTally.midbosses`, `tallyFloor(..., midboss)`, `COINS.midboss = 25` (half a guardian) on the guardian line, kept on defeat with the share; game passes the left floor's `role === 'midboss'`. GDD §11 table row.
  - VFX: `enemyAttackType` reads the behaviour (Hoothoot Flying, Foongus Poison, Spinarak Bug, Decidueye ghost/grass/flying per card); `enemyShotLook`/`drawEnemyShotVfx` in `move-vfx.ts` draw threads, arrows, leaves as streaks in `TYPE_COLORS` and the spore cloud as Poison puffs with Grass specks.
  - End screen: victory names the dungeon's guardian (`guardianOf`), defeat the player's species (were fixed "Aegislash"/"Mimikyu"); floating damage numbers rounded (collapse/fog fractions showed `3.9999999999`).
  - Touch: dungeon select at <= 480 px height lays the two windows side by side without the heading, clear of "Atrás"; the "♪ title" note goes above the message log in touch mode (it sat under the Fuerte button).

## Evidence
- RED observed before F1: coins mid-boss test (`midbosses` undefined), move-feel forest tests (`expected 'normal' to be 'flying'`, `enemyShotLook is not a function`), `guardianOf is not a function`; GREEN after.
- `npm test`: 86 files, 782 tests passed. `npm run build`: ok (typecheck both configs + vite). `dist/music/cathedral-forest.{ogg,mp3}` present; `public/sw.js` caches `music/` cache-first at runtime.
- Screenshots (`/tmp/integrate-forest/`, headless Firefox BiDi, profile user.js `media.volume_scale` 0.0, settings `muted: true` stored on a non-game URL before load): `01-dungeon-select`, `01b-dungeon-select-touch-844x390` (min target 44 px), `02-forest-floor-5-4-*` (Trevenant slam telegraph in Ghost purple with red edge, Grass leaf ring), `03-decidueye-*` (spell card banners, Ghost arrow), `04-forest-end-coins` (real forest defeat, coins block), `04b-forest-victory-dev` ("Has derrotado a Decidueye", coin breakdown), `05-forest-touch-844x390-*` (Niebla floor, joystick moves the player), `06-cinematic-touch-844x390` + hold anywhere skipped it.

## Not verified / follow-ups
- Spinarak threads and Hoothoot dives not caught on a screenshot (covered by unit tests only).
- Touch mode still shows the desktop key hints ("Clic izq. / Q") and the fan-disclaimer footer over the game canvas at 844x390; not touched by either branch diff here, not checked against main, left as is.
- Nobody listened (all runs muted on purpose).

## Progress
Branch `feat/integrate-forest` from `main` 0ef2e6f. Engram mirror: pending (writer has no Engram session; parent owns it).
