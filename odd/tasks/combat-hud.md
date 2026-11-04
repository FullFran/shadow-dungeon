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
