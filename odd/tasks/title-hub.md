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
- T7 pending (next pass): per-screen UI/UX pass on shop, tutor, gacha, loadout, settings, board, shrine, gallery, end screens with pixel icons.

## Parity checklist

- [ ] Every town service has a pixel icon (test iterates `TOWN_SERVICES`)
- [ ] Hub entries named in es and en (test iterates `LANGUAGES`)
- [ ] Locked state before the town opens, unlocked after (test)
- [ ] Desktop 1440x900 and touch 844x390 screenshots
- [ ] Keyboard (arrows + Enter), mouse, touch; gamepad maps to the same keys
- [ ] Every window (title overlays, town windows, pause, end screens) uses the relic chrome
- [ ] GDD and README updated; typecheck, vitest, build, prove green

## Log

- L1 (2026-11-03): S1–S3 above, with screenshots of the current title, PokéSurvivor and PokéIsaac.
- L2 (2026-11-03): S4, answer to the scope question.
