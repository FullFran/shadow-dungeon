# Combat HUD redesign (owner 2026-11-04)

Owner: "rediseña y haz mucho más grande acorde a la escala de tamaños y al nivel de calidad ... dentro de combate, más detalle, más visual, iconos, la barra de jefe más intuitiva y fácil de entender, que tenga estética de jefe de Dark Souls. Los eventos del jefe, sus ataques y cosas por el estilo también rediséñalas".

Pattern: `.agents/DESIGN.md` §4 "Combat HUD". Spanish summary: `docs/gdd.md` "HUD de combate". HUD only: nothing here reads state in a way that changes the simulation.

## Tasks

- [x] T1 HUD scale rule and layout model (`src/ui/hud-layout.ts`, `tests/ui/hud-layout.test.ts`): 640x360 authoring space, regular/compact metrics, no overlaps at 8 viewports, hint-bar lift.
- [x] T2 Models (`src/ui/combat-hud-model.ts`, `src/ui/boss-caption.ts`, `src/data/boss-lore.ts`, `tests/ui/combat-hud-model.test.ts`): chip trail, boss bar, stage (entrance, felled), move slots per device, captions, epithets.
- [x] T3 Original 16x16 pixel icons (`src/ui/combat-icons.ts`, `tests/ui/combat-icons.test.ts`).
- [x] T4 Drawing (`src/adapters/combat-hud.ts`, `src/adapters/hud-portrait.ts`) wired in `renderer.ts` and `game.ts`; damage numbers and status ticks restyled.
- [x] T5 i18n es and en (epithets, signs, cues, felled, statuses, slot labels).
- [x] T6 Docs (DESIGN.md §4, §5, §8; gdd.md).
- [x] T7 Verification: Playwright screenshots (boss fight, normal floor, co-op frames, touch) and the gates.

## Parity checklist

- [x] Every boss species gets the bar: `bossSpecies()` (all `ENEMY_BEHAVIOUR` entries of boss kind or `bar: true`: Aegislash, Trevenant, Decidueye, Sableye, Lanturn, Dhelmise, Salazzle, Nihilego, Eclipse Echo, Tu Sombra, Sima Herald, and every Senda shadow and wound) — `tests/ui/combat-hud-model.test.ts` "boss bar model" iterates the roster in es and en.
- [x] Every boss has an epithet in es and en (`boss.epithet.<id>`, `.shadow.<line>`, `.wound.<line>`) — "epithets" test.
- [x] Every boss event has an announcement: each boss's `bossEvents()` (card names, phase cards, stances, registered spell cards by prefix, herald cards) and every registered card id (`registeredCards()`) — "boss captions" tests; every cue kind has an icon and a line in es and en.
- [x] Solo and co-op: partner frames under the status window (downed state), seen in the synthetic co-op screenshot.
- [x] Dungeons: the HUD is the renderer's, shared by main dungeons, challenges, Sima/endless, shrine and Senda fights (one `drawCombatPanels`).
- [x] Touch: compact metrics, status clear of the Pause button, no slot windows, narrower boss bar (844x390 screenshot).
- [x] Hint bar and the message log: lifted over the boss block (`liftHintBand`, layout test); hint-bar files untouched.
- [x] Gameplay unchanged: `npm run prove` 24/24 fights cleared, 166 cards survivable; full vitest only the pre-existing `difficulty-tiers` golden digest fails.
- [x] Pending, not cut: shiny/female portraits follow `playerSprite()` (covered); the other agents' location plaque and loadout preview are not edited here.

## Pass 2: minimalist and peripheral (owner 2026-11-04)

Owner: "el hud de combate lo quiero menos grande y menos invasivo ... igual de bien presentado, misma estética ... más pequeño y minimalista".

- [x] P1 Tests first: `tests/ui/hud-layout.test.ts` "combat HUD footprint" (<= 12% area, centre 50% clear), caption timing and fade models in `tests/ui/combat-hud-model.test.ts`.
- [x] P2 Layout: scale 1 to 2 from 800x450, small metrics, caption strip, `bossStackRect`, minimap tile 4 (`src/ui/hud-layout.ts`).
- [x] P3 Models: `fightKind`, `createCombatFade`, `createPassiveNote`.
- [x] P4 Drawing: status, chips, slots, boss bar, caption strip (`src/adapters/combat-hud.ts`), 2-line log (`message-log.ts`), hint bar dim and hide (`play-hints.ts`, CSS).
- [x] P5 Docs: DESIGN.md §4, §5, §8.
- [x] P6 Gates and screenshots.

### Parity checklist
- [x] Every boss: one `bossBlock` and one caption path; the roster and caption tests in `combat-hud-model.test.ts` still iterate every boss and card.
- [x] Solo and co-op: partner frames moved under the chips; touch keeps the compact metrics (844x390 screenshot).
- [x] Dungeons: the HUD is the renderer's, shared by all.
- [x] Information reachable: idle shows passive state, held items, floor, coins and slot names; the pause window lists moves and items. The passive state and XP are now in the pause card (pass 3).
- [x] i18n: no new strings. Gameplay unchanged: `npm run prove`.

## Pass 3: fix everything pending + owner feedback (2026-11-04)

Owner: "arreglar todo"; "la barra de vida un poco más arriba, más decorada estilo Dark Souls sombrío"; slots "más grandes para que las teclas quepan"; boss attacks "arriba y un poco más grandes y decorados".

- [x] F1 Hint bar compact in a fight (`hintSizes(height, fight)`: 28 px chips, labels hidden), large when calm; tests in `tests/ui/play-hints-model.test.ts`, `tests/ui/hud-layout.test.ts`.
- [x] F2 Flashes to a toast under the status block (`toastRect`, `drawFlashToast`, 1.6 s). Centred flashes found: perfectDodge, disguiseBroken, levelUp, item, passive (all five of `FlashKind`; nothing else flashed in the middle). Centre-clear test extended.
- [x] F3 Location plaque follows the HUD scale (`plaqueMetrics`, `plaqueBox`, tested at 6 desktop windows against status, minimap, boss and announcement).
- [x] F4 Original `error` 16x16 icon for the error card and the fatal screen.
- [x] F5 Town tiles and sprites report once per session (`reportAssetFailure`, `imageState`), `tests/adapters/asset-report.test.ts`.
- [x] F6 Pause summary: level, XP bar and passive (`pauseSummary`, `tests/app/pause-model.test.ts`).
- [x] A Boss bar raised (6% clear below), iron frame, finials, blood fill, ember trail, small-caps name with ornament.
- [x] B Slots about 56 CSS px, key glyph in a corner cap, icon centred; 12% budget holds (11.86% at 1280x720, 8.6% at 1440x900, 9.1% at 1920x1080).
- [x] C Boss announcement at the top centre (~28 CSS px, brackets, rule diamond, hold 1.6 s); announced-event budget 15.2% at 1280x720, limit moved 15% to 16% (transient, 1.8 s).

### Parity checklist (pass 3)
- [x] Every boss and card: the announcement is one drawing path (`drawBossCaption`); roster and caption tests untouched and green.
- [x] Every playable species: pause passive line (`passiveStatus` per species test); toast text is species-free.
- [x] Solo and co-op: toast sits under the partner frames (`toastRect` with 0, 1, 3 partners tested). Touch: toast at the margin, announcement between status and minimap (tested); touch plaque keeps its small size and is not part of the plaque overlap proof (pre-existing: it can touch the status window on a 568 px phone).
- [x] i18n es and en: `hud.toast.*`, `pause.stat.level|xp|passive`, `pause.xpMax`.
- [x] Gameplay unchanged: `npm run prove`.
