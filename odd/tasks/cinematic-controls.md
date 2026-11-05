# Cinematic controls (owner 2026-11-04)

"los botones de saltar y el badge de auto en las cinemáticas ponlos un pelín más grandes y rediséñalos también"

## Tasks
- [x] T1 RED: `tests/ui/cinematic-controls.test.ts` (hold model, ring steps, wake timer, glyph, entry points, copy)
- [x] T2 GREEN: `src/ui/cinematic-controls-model.ts`, `src/ui/cinematic-controls.ts`, `src/styles/cinematic-controls.css`, i18n es/en
- [x] T3 wire into `src/app/prologue.ts`, drop the old rules from `index.html`
- [x] T4 DESIGN.md §4 / §8, Playwright screenshots, gates

## Parity checklist
- [x] Prologue, guardian (pre/post), Sima, Senda (story), herald intro and gallery replays: all call `prologueScreen`, which mounts the shared controls (test iterates the six entry points)
- [x] Keys unchanged (Esc/Enter held 0.8 s, touch hold on the picture, pad bridge B/A), Auto toggle and its storage key unchanged
- [x] i18n es + en (`cinematic.skip.hold`, `cinematic.skip.holdKey`, `cinematic.auto.on/off`)
- [x] DESIGN.md §4 and §8
- [ ] Pending: nothing cut
