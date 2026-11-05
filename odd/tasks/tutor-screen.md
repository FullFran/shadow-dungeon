# Move tutor screen

Owner (2026-11-03): "lo mismo que hemos hecho con los menús, botones y selector de pokemon, para Maestro".
The tutor becomes a card screen with the Pokémon picker's pattern (`src/app/tutor-screen.ts`, `src/styles/tutor.css`,
`src/ui/icons/tutor-icons.ts`; pure rules in `src/app/tutor.ts`: `tutorCards`, `cardBlock`, `nextRankText`).

## Tasks
- [x] T1 RED tests: `tests/app/tutor-cards.test.ts`, `tests/ui/tutor-icons.test.ts`.
- [x] T2 Pure card state (learned / buy / locked + reason / maxed), next-rank text, slot filter.
- [x] T3 Icons (all, fast, heavy, boost, area, power, stamina, cooldown, rankup).
- [x] T4 Screen: portrait chips + balance chip, icon tabs, card grid, sheet with one primary action, keys (arrows, Enter, Q E, Esc), touch two-tap.
- [x] T5 i18n es/en under `tutor.*`.
- [x] T6 Screenshots 1440x900, 1000x750, 844x390; fixed sizes measured across hovers and filters.

## Parity checklist
- [x] Every playable line with an offer (starters and gacha lines): cards come from `knownMoves` plus `tutorOffer` (test iterates `TUTOR_OFFER`/kit).
- [x] Every slot filter has cards for a starter and an icon (`SLOT_FILTERS` loops in both tests).
- [x] Prices, Maestro locks (`tutorLock`), rank costs and purchases persisted through `tutorPurchase` unchanged.
- [x] Both entries (title hub and town overlay) use the same `tutorWindow`; sounds (coin, denied) kept; achievements settle on close as before.
- [x] i18n es/en parity (test), no em dash.
- [x] GDD (`docs/gdd.md`, "Movimientos y maestro"): the tutor window paragraph is added.
