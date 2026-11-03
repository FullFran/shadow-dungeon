# Title hub redesign

Objective: the title becomes a souls-dark game hub (PokéIsaac + PokéSurvivor layout patterns), every menu window gets the relic look, all icons custom and in colour. Branch: `feat/title-hub`.
Delivery: work-unit commits, never push. Runner: `npx vitest run --testTimeout=30000`. Design contract: `.agents/DESIGN.md`.

## Specs

- S1: owner (2026-11-03): "Vamos a rediseñar por completo la página de inicio basandonos en pokesurvivor y Pokeisaac. Pero que visualmente todos los iconos, botones, menú, todo esté ambientado en la estética oscura, souls y demás."
- S2: owner: "El fondo vamos a rediseñarlo de forma que se vean pokemon también y añadas más detalle al escenario, eclipse y demás."
- S3: owner: "Los menús vamos a ambientarlo mejor con overlays mejores y con todo mucho más ambientado al tono oscuro, sombrío y tipo souls. Los menús mejoralos absolutamente todos a nivel UI/UX, los iconos todos custom completamente y a color, Y todo muchísimo más visual e intuitivo."
- S4: owner: "Me gusta una mezcla entre PokeIsaac y Pokesurvivor, con pequeños botones visuales alrededor de la pantalla, olvida la regla de pocos botones, hazlo estética juego." Supersedes the 2026-10-26 three-entry title.
- Constraint: town services stay locked on the title until the town opens (tutorial dungeon cleared), exactly as the route does today; the town keeps every way in.
- Constraint: patterns only from the references, no assets; icons are original pixel art.

## Tasks

- T1 inline: `src/ui/pixel-icons.ts`, original 16x16 colour pixel icons for every town service and hub action, rendered as SVG rects. RED: tests/ui/pixel-icons.test.ts.
- T2 inline: `src/app/title-hub.ts`, the hub model (zones, locks, badges) and spatial focus step. RED: tests/app/title-hub.test.ts.
- T3 inline: relic palette (`PALETTE` window, border, cursor, text) and window chrome in `index.html`: every window and overlay.
- T4 inline: hub view and wiring in `src/app/main.ts` (service windows open as overlays over the title; same openers as the town).
- T5 inline: eclipse backdrop with Pokémon silhouettes, graves, dead trees, fog and a larger corona (`src/ui/eclipse.ts`).
- T6 inline: i18n es/en, GDD title section, README title paragraph, touch layout (844x390), gamepad focus.
- T8 done: S5 (owner, 2026-11-03: no scroll, the stone slab did not read, icons in every menu, Play and online side by side, more legible text, town backdrop in perspective from the lore, free-moving Pokémon).
- T9 inline: backdrop at cobbleverse craft (cell grid + palette keys, timber cottages with tiled gables and mullioned windows, shaded dark trees, lamps that return their light), static layers prerendered once per resize, only lights/fx/residents per frame; residents stand on surfaces. Skill `.claude/skills/pixel-craft` records the rules.
- T10 delegated (worktree `wt-achievements-news`): Achievements and News screens redesigned: icons per category, progress, cards; news readable at a glance with an icon per item.
- T11 delegated (worktree `wt-credits-controls`): Credits with icons and roles (adds Álvaro as "Diseñador y Desarrollador Frontend"); gamepad controls as a pad diagram with button glyphs.
- T12 delegated (worktree `wt-report-dismiss`): report form per type with custom dropdowns and icons; every menu, dialog and overlay closes on a click outside.
- Dev: `?unlock=all` (dev server only, src/app/dev-unlock.ts) opens everything for local review; the owner asked to unlock all options locally (L4).
- T7 pending (next pass): per-screen UI/UX pass on shop, tutor, gacha, loadout, settings, board, shrine, gallery, end screens with pixel icons.

## Parity checklist

- [x] Every town service, upgrade and settings tab has a pixel icon (tests/ui/pixel-icons.test.ts iterates them)
- [x] Hub entries named in es and en (tests/app/title-hub.test.ts iterates `LANGUAGES`)
- [x] Locked state before the town opens, unlocked after (test)
- [x] No scroll and nothing clipped at 1440x900, 1366x768, 1280x720, 1024x768, 844x390, 667x375 (Playwright audit)
- [ ] Keyboard spatial focus coded (arrows/WASD); gamepad sends arrow keys: NOT tried on a real pad
- [x] Every `.md-window` and `.town-shop` overlay uses the relic chrome (shared CSS); pause and end screens not re-captured
- [x] GDD and README updated; typecheck, build, prove green; vitest green except `difficulty-tiers` golden digest, which also fails on `main` (pre-existing)

## Log

- L1 (2026-11-03): S1–S3 above, with screenshots of the current title, PokéSurvivor and PokéIsaac.
- L2 (2026-11-03): S4, answer to the scope question.
- L3 (2026-11-03): "no quiero que haya scroll... esto no se que es [the altar slab]... añade también iconos custom iguales en cada menú... jugar y jugar en línea uno al lado de otro... letra más legible... el fondo... dibuja el pueblo con el eclipse... en base al lore"; "aplica skills de sprites para la movilidad libre de los pokemon".
- L4 (2026-11-03): "desbloqueame todas las opciones, mejora más la calidad de detalle de las casas, las posiciones pokemon, el horizonte, más arboles oscuros, casas más grandes y muy detalladas... basarte en cobbleverse-platform, y haz skills... optimizado para que sea muy ligero"; logros, créditos ("incluyeme a mi como Diseñador y Desarrollador Frontend"), reportes con desplegables y un form por tipo, "Todos los menús deberían poder cerrarse pinchando fuera", controles del mando con iconos o un mando, novedades legibles con iconos/capturas.
