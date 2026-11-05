# Evolución and Mejoras as card grids

Owner, 2026-11-03: "lo mismo que hemos hecho con los menús, botones y selector de pokemon, para Evolución y Mejoras".
Pattern source: `src/app/species-picker.ts`. New: `src/app/window-nav.ts` (grid keys), `src/styles/evolve-shop.css`,
`src/ui/icons/evolve-shop-icons.ts` (essence per tier, chain arrow, awakening spark).

## Tasks

- [x] T1 Pure helpers with tests (chain, silhouettes, stage dots, evolve block; upgrade effect now to next, buy state; icons)
- [x] T2 Mejoras window: five upgrade cards plus the focused sheet, ember Buy button
- [x] T3 Evolución window: line cards plus the chain sheet, needs vs owned, one primary action
- [x] T4 i18n es/en, screenshots at 1440x900, 1000x750, 844x390

## Parity checklist

- [x] Every species Phantump lists (starters, gacha lines, evolved forms, Mimikyu awakenings): `evolveRows` unchanged, one card each
- [x] Every upgrade (`UPGRADE_IDS`): card, icon, effect label `shop.stat.*` in es and en (tests iterate `UPGRADE_IDS`)
- [x] Rules, persistence and sounds unchanged (`evolveAt`, `purchase`, `coin`/`denied`)
- [x] Settle achievements on close, challenges link, shiny skin toggle, bond line: kept
- [x] Town overlay, title menu entry and dev `?screen=evolve`: same entry points (`sheets` passed in both)
- [x] Touch: first tap shows the sheet, second acts
- [ ] Pending: GDD (`docs/gdd.md`) wording for the new windows
