# Pause menu in the relic look

Objective: the in-run pause menu leaves the old cursor list ("the old list" of odd/tasks/title-hub.md) for the relic window: actions, a real floor plan, a run summary card. Branch: `feat/title-hub`. Design contract: `.agents/DESIGN.md` §4 "Pause window".

## Specs

- S1 owner (2026-11-04): redesign the pause menu in the relic look, every action kept.
- S2 owner (2026-11-04, scope extension): "Rediseña también el menú de pausa y esto, y sea un mapa mucho más realista y visible": the floor map as a prominent readable panel (tiles, fog, pixel-icon markers, legend), "Objetos equipados" merged into the summary card, every action kept (disabled ones say why), rendered over the dimmed frozen game.

## Tasks

- T1 done: model `src/app/pause-model.ts` (actions, confirms, summary). RED: tests/app/pause-model.test.ts.
- T2 done: floor plan `src/app/pause-map.ts` (tiles, fog, markers, crop, scale, paint). Written before its test file (tests/app/pause-map.test.ts), so no recorded RED run for it.
- T3 done: icons `src/ui/icons/pause-icons.ts`. RED: tests/ui/pause-icons.test.ts.
- T4 done: view `src/app/pause-view.ts`, `src/styles/pause.css`, wiring in `src/app/menu.ts`, `game.ts`, `main.ts`; i18n es/en; DESIGN.md §4/§8; GDD.

- T5 done (owner follow-up 2026-11-04, screenshot pause-1440): frozen game visible under one veil (52-64% ink; the confirm stacks no second one), plan scaled to fill the panel (`planScale`, RED tests in tests/app/pause-map.test.ts) and drawn as a dungeon (lit wall tops, shaded faces, checker, grid, dithered fog), Salir al menú a quiet row (one ember per window), Pantalla completa row (RED tests in tests/app/pause-model.test.ts).

## Actions before / after

Before (`pauseEntries`): resume, restart (with uses left), quick settings, report, copy technical report, quit. After: the same six plus Pantalla completa (only where the browser allows it), same order, same logic. Restart and quit now confirm; settings open the full settings window over the pause.

## Parity checklist

- [x] Every action of the old list present (tests/app/pause-model.test.ts iterates the old list)
- [x] Confirm before restart and quit; no confirm on a disabled restart
- [x] Solo and co-op: summary flag and note, quit consequence line; the run still does not freeze in co-op (`simulationPaused(menuOpen, !net)` untouched)
- [x] Every playable species renders a summary (test iterates `PLAYABLE_SPECIES`, es and en)
- [x] Floor plan renders every tile kind, every dungeon and challenge floor, every shrine arena, every Sima band palette (tests/app/pause-map.test.ts)
- [x] Sprite fit rule: `.pz-sprite` declared in `SPRITE_BOXES`
- [x] Playwright (Brave): 1440x900, 1366x768, 1280x720, 844x390 (touch), no page scroll, card and actions not clipped, Esc/arrows/Enter, confirm, settings and back
- [x] Contrast measured with design-gates `contrast.py`: all text pairs on the slab pass AA (lowest: disabled 5.26:1, text on the ember top 5.60:1)
- [ ] Co-op pause not seen in a real second tab (model and flag tested only)
- [ ] Gamepad Start/B not tried on a real pad (the pad sends Escape and arrow keys, as elsewhere)
- [ ] Item chips with many items checked only with injected DOM, not with a real inventory
