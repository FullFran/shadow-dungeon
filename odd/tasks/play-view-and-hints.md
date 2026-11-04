# Full-bleed play view, no sky, control hints

Objective (owner, 2026-11-04): "Quita los márgenes, añade ayudas visuales de controles, y para abrir menú y demás, ponlo a pantalla completa y quita lo del eclipse puesto en la parte de arriba, porque en cuanto a perspectiva 2D no tiene sentido que esté ahí".
Branch: `feat/title-hub`. Runner: `npx vitest run --testTimeout=30000`. Design contract: `.agents/DESIGN.md` (§3 full-bleed play view, §4 hint bar).

## Tasks

- T1 view size: `src/adapters/viewport.ts` (`playViewport`): the canvas fills the window; the logical view follows the window aspect at the old pixel scale. RED: `tests/adapters/viewport.test.ts`.
- T2 no sky: town sky band, birds and the Sima eclipse disc and spires go; dungeon renderer never had one. RED: `tests/town/no-sky.test.ts`.
- T3 hints: pure model `src/ui/play-hints-model.ts` (bindings from `src/adapters/bindings.ts`, pad rows from `gamepad-help-data.ts`), DOM bar `src/ui/play-hints.ts`, device tracker `src/adapters/last-device.ts`, setting `showHints`. RED: `tests/ui/play-hints-model.test.ts`.
- T4 fullscreen: in-game toggle (button in the bar, F11 and Alt+Enter; F is the area slot).
- T5 footer: legal notice hidden while a canvas game runs (title, hub, credits keep it).
- T6 docs: DESIGN.md §3, §4, §8; GDD controls.

## Parity checklist

- [ ] Every dungeon (`DUNGEONS`, challenges, Sima, shrine arenas) and the town maps fill the viewport (one view function; tests iterate viewports, renderer fills with each dungeon's `palette.wall`)
- [ ] Solo and co-op share `startGame`; spectating hints covered by the model test
- [ ] Gameplay independent of the view size: lock-on gets a fixed 512x320 rect around the camera centre; sim/prove never read the display view
- [ ] Hints: keyboard and pad glyphs for every context from the real bindings; touch hides the bar
- [ ] es/en strings for every new label
- [ ] Legal footer kept on title/hub/credits, hidden in play
- [ ] GDD controls, DESIGN.md
