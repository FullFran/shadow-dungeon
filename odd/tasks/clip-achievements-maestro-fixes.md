# Sprite clipping, achievements overlap and Maestro accordions (2026-11-04)

Branch: `feat/title-hub` (worktree). Runner: `npx vitest run --testTimeout=30000`. Design contract: `.agents/DESIGN.md` §4 (Accordion list, Sprite fit rule), §8.

## Specs (owner, verbatim)

- S1: "Los pokemon se cortan, que no pase en ningún otro sitio." (shrine sheet and cards first, then every sprite box)
- S2: "la descripción tapa cosas" (achievements: date label over the row above, description panel over the grid)
- S3: "Sigue pareciéndome demasiado saturado, pon los acordeones con scroll interno y que se vea en una sola columna hacia abajo" (Maestro)

## Tasks

- T1 done: `spriteFit` + `.sprite-box` + `SPRITE_BOXES`; `portrait()` crops to the real opaque bounds inside a box. RED: `tests/ui/sprite-fit.test.ts`.
- T2 done: achievements tiles 160 px (date inside), window rows fixed, grid scrolls inside. Checked by Playwright at 1440x900, 1366x768, 1280x720, 844x390.
- T3 done: Maestro accordions, tabs dropped (the groups are the filter). RED: `tests/app/tutor-groups.test.ts`.

## Parity checklist

- [x] Shrine sheet and cards (every `SHRINE_BOSSES` species fits every box: test)
- [x] Species picker stage and cards, Maestro chips, evolution cards and chain, challenge cards and stage, loadout head, gacha collection (`SPRITE_BOXES`, test iterates every `PLAYABLE_SPECIES` base/shiny/female sheet)
- [x] No stylesheet crops a sprite canvas (test scans `src/styles/*.css` and `index.html`)
- [x] Maestro groups every move of every `PLAYABLE_SPECIES` in exactly one group (test)
- [x] es/en for every new string (test) and GDD (`docs/gdd.md` Maestro paragraph)
- [x] Keyboard (arrows, Enter/Space, Left/Right, Q/E) and aria-expanded/aria-controls
- [ ] Pending: title hub altar and profile face still use their own scale rules in `index.html` (no clipping seen; not moved to `sprite-box`); `src/adapters/portrait.ts` (`idlePortrait`, used by the quiz) not cropped.
