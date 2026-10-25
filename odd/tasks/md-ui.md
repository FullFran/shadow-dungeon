# Mystery Dungeon-style UI

## Objective
Give every screen one coherent look inspired by Pokémon Mystery Dungeon (dialog windows, cursor-driven menus, compact HUD line and message log), without copying any Nintendo asset.

## Problem
Menus, overlays and the HUD were built piecemeal (plain DOM controls, canvas text). The user asked for a proper UI pass in this release: "el menú y todo vamos a dejarlo bien, inspirado en Mundo Misterioso".

## Scope
- Design tokens (colours, borders, spacing, font) in one place; a reusable window component (rounded border, dark blue gradient fill, inner highlight) and a cursor list component (▶ marker, keyboard up/down/enter/escape plus mouse hover/click).
- Pixel font under the SIL Open Font License, self-hosted with its license file and credited.
- Screens: title/main menu (title over an animated red-eclipse backdrop drawn in code, entries Play, Play online, Settings, Credits), loadout picker (Mimikyu sprite, move cards with type, power, description), settings, credits (CREDITS content), online lobby, Esc menu, item pick cards, floor title card, victory/defeat screens.
- HUD: MD-style top line "Planta 2 · Nv. 5 · PS 52/100" with HP bar, stamina, Disguise, held items; message log box at the bottom-left ("¡Mimikyu subió al nivel 5!", item picked, berry eaten, enemy defeated) with a few lines that fade.
- Full keyboard navigation of every menu; focus never steals gameplay keys during a run.

Out of scope: hub town, new art beyond code-drawn UI, story text.

## Constraints
- No ripped assets or exact replicas of MD UI; inspired only.
- Core untouched except pure helpers if needed; architecture test green; i18n complete in es/en.
- No AI attribution in commits; Conventional Commits.

## Tasks
- [x] T1 UI foundation: tokens, font, window and cursor-list components, keyboard navigation (route: delegated writer; trigger: new UI modules, index.html, app)
- [x] T2 Menus: title with eclipse backdrop, loadout, settings, credits, lobby, Esc menu, item pick, end screens (route: same writer)
- [ ] T3 HUD line and message log, floor card restyle (route: same writer)
- [ ] T4 Deploy (route: parent; standing OK for intermediate releases)

## Acceptance criteria
- Every menu is usable with keyboard only and with mouse only.
- One visual language across all screens (screenshots of each).
- `npm test` and `npm run build` pass; existing behaviour unchanged.

## Checks
`npm test`, `npm run build`, headless screenshots of each screen.

## Progress
Created 2026-10-25. Forecast ~1200 authored lines.

### T1 UI foundation (delegated writer)
- Design tokens in `src/ui/tokens.ts` (palette with eclipse red, window gradient, border, text, disabled, rarity; font; motion), applied to `:root` as `--md-*` custom properties by `applyTokens` and imported directly by the canvas HUD (`RARITY_COLORS` is now the token object).
- Font: Pixelify Sans (SIL OFL 1.1, from google/fonts `ofl/pixelifysans`), `public/fonts/PixelifySans.ttf` + `PixelifySans-OFL.txt`, `@font-face` with a page-relative URL (follows the `./` base; Vite warns it resolves at runtime, which is intended). Has ñ, á..ú, ü, ¡, ¿, ·, ×; lacks ▶ ◀ ■ and arrows, so the cursor and value arrows are CSS shapes. Its pixel is about 1/11 em: sizes in multiples of 11 px (22 body, 33, 66).
- Components: `src/ui/window.ts` (`h`, `mdWindow`, `statLine`), `src/ui/cursor-list.ts` (keyboard ↑/↓/W/S, ←/→/A/D adjust, Enter/Space confirm, Esc back; hover moves, click confirms; only the newest connected list takes keys; text fields keep their letters; `setUiSound` hook wired to the existing menu click), pure `src/ui/nav.ts`.
- Architecture test: core, data and net may not import `src/ui`.
- Checks: `tests/ui/nav.test.ts` + `tests/ui/tokens.test.ts` RED (modules missing) then GREEN (11 tests). `npm test` 413 passed, `npm run build` ok.
- CREDITS.md: font section added. Note: `tools/fetch-sprites.mjs` regenerates CREDITS.md whole and would drop it (tools/ was outside this writer's edit surface).

### T2 Menus (delegated writer)
- Title screen over a code-drawn eclipse backdrop (`src/ui/eclipse.ts`: black sky, stars, pulsing red corona and ring, two-layer ruined skyline rim-lit red, rising embers; low-res canvas scaled ×3 pixelated, stateless in time, runs only while on the page and is shared by every menu screen). Entries Jugar / Jugar en línea / Ajustes / Créditos; fan notice kept.
- Loadout (`src/app/loadout.ts`): Mimikyu idle animation from the sprite sheets (×3), type badges, Disguise, goal; move cards per slot with type, power and a short description (new i18n keys), Equipado tag; cursor starts on Empezar.
- Settings rows (`src/app/settings-panel.ts`): pure `settingRows` model (cycle language / lock type, toggles, volumes in 5 % steps with a 10-segment meter; click-to-lock greyed and skipped where it does not apply), shared by the Settings screen and the Esc menu's quick-settings view; key list window beside it.
- Credits (`src/app/credits.ts`): artists read from CREDITS.md at build time (`?raw`), plus font and audio lines, localized.
- Online: create / join-with-code row (the code input keeps its letters; up/down/Esc leave it) / back; lobby window with the big code, Start (host), Copy, Hide/Show code, Leave, and a players window.
- Esc menu: cursor menu (resume, restart floor, quick settings, quit) beside the held items in rarity colours; Esc stays the game's close key.
- Item pick: three rarity-framed cards in a horizontal cursor list (solo: left/right/A/D + Enter/Space, 1/2/3 still via the game); the shared strip is mouse-only (`keyboard: false`, mousedown prevented, rows are `tabIndex -1`), so it never takes focus.
- End screens: result window with floor, level, seed and items (`RunSummary` gained `level` and `items`).
- Dev only: `?screen=loadout|settings|credits|online|lobby|victory|defeat` (lobby preview over BroadcastChannel, no Trystero) for screenshots. README updated.
- Fix found by looking: Pixelify Sans' `fi`/`fl` ligatures read as other letters ("Ajar" for "fijar"), so ligatures are off page-wide.
- Checks: `tests/app/settings-panel.test.ts` (5) and `tests/app/credits.test.ts` (2) RED (missing exports/module) then GREEN; i18n key test for the new strings written with the strings (not run RED). `npm test` 423 passed; `npm run build` ok. Headless Firefox screenshots (same-origin wrapper proxying the dev server, scripted key presses into the iframe, Spanish via stored settings): `/tmp/md-ui/{title,loadout,settings,credits,online,lobby,victory,defeat,esc-menu,item-pick}.png`, checked by eye; the Esc menu and item pick were reached by keyboard only (Enter, Enter, Escape / ArrowRight).
- Not verified: mouse hover/click in a real browser (headless screenshots cannot move a mouse), clipboard copy, a real Trystero lobby.
