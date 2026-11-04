# Town map menu (parchment map, owner 2026-11-04)

Owner: "esto debe ser un mapa que se vea completo lo máximo posible, bien detallado tipo pixel art, y lo quiero mapa tipo envejecido roto irregularmente por los alrededores. El menú debe salir de abajo animado, debe ser mucho más grande, al hacer hover por los sitios te muestra qué hay ahí, y luego a la derecha todas las opciones del menú mejor presentadas, estructuradas y posicionadas".

Branch: feat/title-hub (worktree). Design: `.agents/DESIGN.md` §4 "Town map menu", §5, §8.

## Tasks

- [x] T1 RED then GREEN: `sheet-model` (geometry, fit, timing, torn mask, card placement), `menu-groups`, `place cards`, `sheet-paint`, icons.
- [x] T2 Painter: `src/town/sheet-raster.ts`, `src/town/sheet-paint.ts` (parchment, ink, ageing, torn edge, compass, cartouche).
- [x] T3 View: `src/town/town-map-view.ts` + `src/styles/town-map.css`; scene wiring in `src/town/scene.ts`; old plan CSS removed from `index.html`.
- [x] T4 i18n es + en (`townMenu.group.*`, `townMenu.place.waystone`, card strings).
- [x] T5 Docs: DESIGN.md, GDD.
- [x] T6 Gates: typecheck, vitest, build, prove; Playwright at five sizes; touch; reduced motion.

## Parity checklist (every existing area the change must reach)

- [x] All six maps (refugio, ruinas, mirador, crater, lago, cienaga) paint a sheet: `tests/town/sheet-paint.test.ts` iterates `WORLD` (size, determinism, transparent corners, opaque inside).
- [x] Every prop kind of `TOWN_PROPS` has a painter: `PAINTED_PROPS` equals `Object.keys(TOWN_PROPS)` (same test).
- [x] Every ground character (grass, path, water, bridge, chasm, rock, forest, sky) is drawn (`drawGround`); the road maps' links draw roads running off the sheet.
- [x] Every map fits whole at 1920x1080, 1440x900, 1366x768, 1280x720, 844x390: `tests/town/sheet-model.test.ts` (30 cases).
- [x] Every service pin of every map has a card with name, who, what in es and en and an existing pixel icon: `tests/town/place-cards.test.ts` iterates `WORLD` x `townMapMarkers`.
- [x] No pin sits under the cartouche or the compass on any map (same test).
- [x] Every current option kept: every `TownService` is in exactly one of four groups, `groupOptions` of (loose services + end rows) loses and doubles nothing on any map (`tests/town/menu-groups.test.ts`); Seguir stays outside the groups.
- [x] No option list needs a scroll on any map at the five sizes (`optionsLayout`, same test) and none did in the browser (`/private/tmp/claude-501/-Users-alvaroofernaandez-Proyectos-shadow-dungeon/cf36c00c-e912-4f77-a851-9885b7b0fde5/scratchpad/tmenu-shots.mjs`: `pageScroll:false`, `probs:[]`).
- [x] Solo and room: the room's rows (`lobby.menu`) use the `room` glyph and file under Sistema; the room code is on the ribbon; the online window is still dropped inside a room (`townMenuServices`).
- [x] Net protocol, save, sim/prove: not touched (UI only).
- [x] i18n es and en: `tests/i18n.test.ts` parity.
- [x] Touch: first tap shows the card, second opens, options on one tap, the touch Back chip hidden while the menu is open; measured with Playwright touch (`tmenu-touch.mjs`).
- [x] Reduced motion: `menuTiming(true)` is a fade; CSS uses `tm-fade`; measured (`animationName: tm-fade`).
- [x] Quick wheel (Tab) untouched: same `glyphSvg` and `TownMapEntry`.
- [ ] Unseen badge: the view and the card support `entry.badge`, but no town service has a cheap source of "unseen content" today, so nothing sets it. Pending until one exists (no fake badges).
- [ ] Per-map hand-placed cartouche art variants (cartouche is one ribbon): not needed.
