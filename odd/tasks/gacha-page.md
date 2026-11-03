# Gacha page (/gacha)

Objective: the gacha becomes a full-screen visual page at `/gacha`, Mimikyu's stall as the scene. Every rule stays the window's (`src/core/gacha.ts`, `src/data/gacha.ts`). Branch: `feat/gacha-page` (from `feat/title-hub`). Delivery: work-unit commits, never push. Runner: `npx vitest run --testTimeout=30000`. Design contract: `.agents/DESIGN.md`.

## Specs

- S1: owner (2026-11-03): "Gacha lo haremos todo completamente visual en una pagina aparte /gacha".
- Rules kept exactly: 100 P a pull, rare 15 % (sure at the 10th pull since the last rare), shiny 2.5 % (sure at the 80th), a duplicate line refunds 40 P (the GDD rule: Pokémonedas, not materials), the shiny skin unlocks even on a duplicate, sounds `coin` and `denied`, achievements settle on leaving.
- Ethics (DESIGN.md §7): odds beside the pull buttons, the pity counters shown flat, no countdown, no fake scarcity, no pressure copy, skip always available.
- Route: found by the END of the path (Vite builds with a relative base), pushed with `history.pushState({ gacha: origin })`, so Esc, "Volver" and the browser back button return to the hub or the town. A direct visit goes to the title on Back; it redirects to the title while the town is closed (the hub button is locked until then).
- Production: GitHub Pages (`.github/workflows/deploy.yml`) has no rewrites; the build copies `dist/index.html` to `dist/404.html` so `/<repo>/gacha` loads the app. `server/` is only the PocketBase API and does not serve the game.

## Tasks

- T1 done: `src/app/gacha-route.ts` (path detection, urls). RED: tests/app/gacha-route.test.ts.
- T2 done: `src/app/gacha-model.ts` (reveal plan, pity bars, collection strip, pull state). RED: tests/app/gacha-model.test.ts.
- T3 done: `src/ui/icons/gacha-icons.ts` (capsule and its two halves, pulls, back, skip, sparkle, owned, unknown). RED: tests/ui/gacha-icons.test.ts.
- T4 done: `src/ui/gacha-stall.ts` (prerendered 320x200 stall, camera). RED: tests/ui/gacha-stall.test.ts.
- T5 done: `src/app/gacha-page.ts` + `src/styles/gacha-page.css` (page, dock, collection strip, reveal overlay).
- T6 done: wiring in `src/app/main.ts` (hub button, town via `openGachaPage`, popstate, boot) and `src/town/scene.ts` (`openGachaPage`: alone the stall leaves the town like the shrine; a room keeps the window).
- T7 done: i18n `gacha.page.*` es/en, GDD gacha section, deploy 404 fallback.

## Parity checklist

- [x] Every gacha line (`GACHA_POOL`: Piplup, Shinx, Abra, Axew): odds rows, collection strip (owned or silhouette, shiny mark), reveal cards (`tests/app/gacha-model.test.ts` iterates the pool).
- [x] Shiny skins: unlocked skins show a sparkle in the strip; a shiny pull reveals the shiny sheet with a sparkle and the "Shiny" label.
- [x] Solo hub and solo town: both open the page and return to where they came from. Online room: keeps the existing window (leaving the page would drop the room); pending: a page-less room flow if the owner wants one.
- [x] Save/migrate/sanitize: no new fields (`pity`, `shinyPity`, `owned`, `shinies` are read as before).
- [x] Net protocol: untouched.
- [x] i18n es/en: `gacha.page.*` in both, tested for presence and no em dash.
- [x] GDD: gacha section mentions the page.
- [x] Sim/prove harnesses: rules untouched, `tests/app/gacha-stall.test.ts` still covers the pull.
- [x] Dev screen `?screen=gacha` keeps the old window for smoke tests (`&coins=`); the new page is `/gacha`.
