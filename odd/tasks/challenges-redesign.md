# Desafíos redesign and spend confirmations (2026-11-03)

Owner: "Los desafíos también, esto queda demasiado saturado" and "haz confirmación para evolucionar ... de un click te lo gastas".

## Tasks
- [x] Desafíos as a card grid plus sheet in the Pokémon picker's mould (`src/app/challenges.ts`, `src/styles/challenges.css`).
- [x] `confirmedEvolve` and `confirmedPurchase` (spend only after Confirm) wired to the shared `confirmDialog` in Evolución (evolve and awaken) and Mejoras.

## Parity checklist
- [x] All 8 Sendas listed (tests iterate `CHALLENGES`; hook clamp test covers es and en for each).
- [x] Evolve and awaken both confirm (tests: cancel, confirm, never asks when blocked, Mimikyu awakening).
- [x] Mejoras buy confirms (test: cancel, confirm once, never asks when maxed or short).
- [x] Three entry points of the challenges window unchanged (dungeon select, town exit, Phantump); `onChoose`/`requireFit` rules kept.
- [x] i18n es and en: `challenges.*`, `evolve.confirm.*`, `shop.confirm.*`.
- [x] Touch: the first tap shows the sheet, the second opens the confirmation (never the spend).
- [ ] Gacha and Maestro windows keep their own flows (out of this task).
