# Move tutor: live preview, confirmation, calmer screen

Owner feedback (2026-11-03): show each move as a video with the chosen Pokémon, confirm before learning or ranking up, and make the screen easier to read and less saturated.

## Tasks

- [x] T1 `src/app/move-preview.ts`: isolated preview room (species, move in its slot, dormant dummy), cast schedule, looping sim, frame loop (tests: `tests/app/move-preview.test.ts`).
- [x] T2 `src/adapters/renderer.ts`: `RenderFrame.bare` draws the world only (no HUD).
- [x] T3 `src/app/move-preview-view.ts`: canvas, fitted camera, pause when hidden, still frame under reduced motion, self-dispose when the screen is replaced.
- [x] T4 `src/app/tutor.ts`: `confirmCopy`, `spendAfterConfirm` (tests: `tests/app/tutor-confirm.test.ts`); learn and rank-up go through the shared `confirmDialog`.
- [x] T5 `src/app/tutor-screen.ts`, `src/styles/tutor.css`: three quiet cards per row, sheet ordered preview, name, three numbers, description, next rank, action.

## Parity checklist

- [x] Every playable species and every move the tutor shows (kit and offer) sets up a preview and lands a hit on the dummy within two loops (`move-preview.test.ts`, iterates `PLAYABLE_SPECIES` and `tutorCards`).
- [x] Learn and rank-up both ask first; cancel and Esc spend nothing (Playwright run, coins unchanged after cancel and Esc).
- [x] Locked, for-sale, learned and maxed cards keep their rules (prices, locks, persistence, coin and denied sounds, Esc, Q E, arrows via `hubStep`).
- [x] es and en strings under `tutor.*` (`tests/i18n.test.ts`).
- [ ] Pending: rank preview shows the owned rank, not the next one (a "see next rank" toggle was not added).
- [ ] Pending: shiny and female skins are not applied to the preview sprite (cosmetic).
