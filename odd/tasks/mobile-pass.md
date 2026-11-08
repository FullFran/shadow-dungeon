# Mobile pass, mission board, sealed bosses, walk sprite flash

Branch: `feat/title-hub`. Runner: `npx vitest run --testTimeout=30000`. Design contract: `.agents/DESIGN.md`.
Screenshots: `node tools/mobile/hub-shots.mjs --sizes=844x390,1440x900` (Playwright Chromium against the dev server; `HUB_URL=...?unlock=all` for an open save).

## Specs (owner, 2026-11-08)

- S1: "para móvil hay que hacer que solo se pueda jugar en horizontal por lo que hay que poner un aviso de alguna forma"
- S2: "para móvil hay que rehacer los menús para que se vean mejor el móvil, por el hecho de que hay demasiado botón y en móvil se ve todo demasiado pequeño y sobrecargado, además, en móvil debe verse todo sin hacer scroll"
- S3: "el menú tablón de misiones no se ven fácilmente, ahí hay que hacer scroll y los nombres se cortan"
- S4: "los jefes que salga la silueta en negro y mejor diseñado" (shrine, sealed bosses)
- S5: "los pokemon al empezar a andar por un segundo hay un salto visual donde se ven como un cuadrado rosa"

## Findings

- S5: the town draws a magenta 12x16 rect whenever a sheet is not in the cache (`src/town/render.ts` drawCharacter, no `pending` check), and the hub only preloads the Idle sheet (`hubKeys`), so the first steps hit a Walk sheet that is still loading. The run renderer skips pending sheets but draws nothing (the creature vanishes for a frame).
- S3: board cards are 176 px high with a 92 px art box; a two-line title does not fit and the second line is cut. The sheet's rules block scrolls (`.hl-rules { overflow-y: auto }`) under a 156 px stage.
- S4: a sealed boss shows the seal icon and "???"; the sprite is withheld.
- S1: a small rotate hint shows in portrait only over a canvas; menus work in portrait.
- S2 (844x390, `?unlock=all`): hub carries 28 controls; tutor list, achievements, gallery, picker, evolve/challenges scroll; the shrine window overflows (its Volver is off-screen) and the touch "Atrás" covers its title.

## Tasks

- T1 inline: S5. A creature whose animation sheet is not here yet is drawn with its Idle sheet (town and run), never a magenta rect while loading; the town preloads the partner's Walk. RED: tests/town/render-fallback.test.ts.
- T2 inline: S3. Board cards become row cards (icon, full title on up to two lines, reward and tier), 2 columns, no truncation; the sheet fits without scrolling (smaller stage, no scrolling rules block). RED: tests/app/board-layout.test.ts (titles of every dungeon fit the card's line budget).
- T3 inline: S4. Sealed boss cards and sheet show the boss's black silhouette (the real sprite, brightness 0, ember rim) with "???"; the model keeps the species for the silhouette. RED: tests/app/shrine-hall.test.ts.
- T4 inline: S1. On touch in portrait a full-screen blocking notice (rotating phone pixel icon, "Gira el dispositivo") covers every screen; a run pauses under it. RED: tests/ui/orientation-gate.test.ts.
- T5: S2 hub on phones: at most ~12 visible controls (Pokémon and World groups open as sheets, secondary actions under one "More" button). RED: tests/app/title-hub.test.ts.
- T6: S2 windows on phones without scroll: lists and grids page instead of scrolling; the shrine fits. Gate: hub-shots audit reports no scrollers at 844x390 and 740x360.

## Parity checklist

- [ ] T1: town characters, run player, enemies, bosses, co-op peers
- [ ] T2: every mission kind (floor, clear, defeat, species), daily and weekly, es/en
- [ ] T3: every shrine boss (`SHRINE_BOSSES`), every tier
- [ ] T4: title, every window, town, run, shrine, Sima, co-op
- [ ] T5/T6: every hub entry still reachable on touch; keyboard and pad unchanged on desktop
- [ ] i18n es/en for new strings; DESIGN.md decision log; GDD if gameplay-facing

## Design pipeline

```
[design-pipeline]
0. laws-of-ux    → laws: Hick (phone hub at rest: 6 controls: Más, Tu Pokémon, El mundo, Cambiar, JUGAR, En línea), Fitts (group slabs 124-148 px, tiles >= 84 px tall, every target >= 44 px), Jakob (group sheet reuses the relic window and the town menu's grouped disclosure, DESIGN.md §8 2026-11-04), Miller (services chunked into the existing Tu Pokémon / El mundo rails, <= 6 per sheet, Más <= 10), Von Restorff (JUGAR stays the only ember surface), Doherty (sprite fallback within the frame)
1. direction     → .agents/DESIGN.md §1 (silhouettes), §3 (touch + short landscape compresses rails), §4 picker pattern and Town map menu grouped disclosure, §8 2026-11-04; new phone layout, board rows, sealed silhouettes and rotate notice logged in §8 in the same change
2. gates         → design-gates contrast for .hub-tile-label, .hub-sheet-note, .rotate-gate-text, .bd-card-title on relic slab; hardcodes lint on src/styles/hub-phone.css, mobile.css, hall.css; tools/mobile/hub-shots.mjs audit (no scrollers, nothing outside, nothing cut) at 844x390, 740x360, 667x375, 1440x900
```
