# Feature: integrate-mobile

## Objective
Bring `feat/mobile-touch` (T1 layout/detection, T2 touch controls, T3 town touch, T4 PWA; based on d3d4f9a) onto `main` (da80001, which gained Pokémonedas, the save facade and Poochyena's upgrade shop) on branch `feat/integrate-mobile`, keeping both features whole, and make the shop and the coin end screen, which did not exist when touch was written, usable on a phone.

## Scope
- M1 Merge `feat/mobile-touch` with `--no-ff`, resolve conflicts keeping both sides.
- M2 Touch pass over the shop window and the end screen; PWA precache check against the current build.

## Constraints
- `src/core` untouched; desktop behaviour unchanged (keyboard confirm still buys at once, mouse click still buys at once).
- Title indices stay stable: Play 0, Online 1, Settings 2, Credits 3, Prólogo 4, Pueblo 5, Tienda 6, then "Instalar juego" only when installable.
- No AI attribution in commits; no push.

## Tasks
- [x] M1 Merge (route: inline; conflicts are mechanical unions). Conflicts and resolution:
  - `src/i18n/es.json`, `src/i18n/en.json`: both appended a block at the end; kept main's coin/shop/upgrade keys and the branch's touch/pwa keys (389 keys each, valid JSON).
  - `src/app/main.ts`: imports from both (save/shop/coin-lines and touch-mode/touch-chrome/pwa); title items keep "Tienda" at index 6 and append "Instalar juego" after it only when `pwa.offer() !== 'none'`.
  - `src/town/scene.ts`: talk target is null while the exit window or the shop is open; "Hablar" is hidden in both cases; stop() closes the shop and disposes the touch layer. Main's `e.defaultPrevented` Esc guard kept (auto-merged).
  - `README.md`: `src/app` row keeps the save facade and shop; `src/pwa` row added.
  - Auto-merged without conflict: `src/app/settings.ts` (main never touched it), `index.html`, `docs/gdd.md`, `src/app/game.ts`.
  - Evidence: merge commit 5d65bf2; `npm run typecheck` clean; `npx vitest run` 77 files / 694 tests passed.
- [x] M2 Touch shop and end screen, PWA check (route: inline; 4 small files plus CSS). Test-first for the pure decision: `tapAction` in `src/ui/nav.ts` (RED: 2 failing tests, missing export; then GREEN).
  - Shop rows are `tapToSelect`: on touch the first tap moves the cursor and shows the effect, the second buys; the hint reads "Toca una mejora para verla y otra vez para comprarla." on touch (`shop.hint.touch`).
  - Found by screenshot (390x844): the tap that closed Poochyena's last dialog line fired its click on the shop row that had just appeared under the finger and bought it. Fix: a pointer click not pressed on the row (`pressedBy === null`, `detail > 0`) only selects, never confirms. Keyboard confirm (`row.click()`, detail 0) still buys at once.
  - Town: the touch layer is suspended while the shop is open and resumed when it closes; "Atrás" (Escape) closes the shop and stays in the town (cursor list handles Esc first; the town's `defaultPrevented` guard keeps it from also leaving).
  - CSS (touch only): title menu in two columns in low landscape (7-8 entries at 44 px, DOM order kept); shop in two columns (text/balance/effect left, rows right), clear of the fixed "Atrás"; town shop overlay scrolls instead of the window (no clipped title tab); end screen side by side with both actions on one row and no "Atrás" (its own "Volver al menú" is the way back); shop/result `min-width` lifted for portrait.
  - PWA: built dist served under `/mazmorra-sombria/` in headless Firefox: SW active with scope `/mazmorra-sombria/`, script `sw.js?v=index-<hash>.js`; shell cache holds `''`, index.html, manifest, 3 icons, the font and the current bundle (which carries the shop). Music stays runtime cache-first under `music/`; no new static files on main (the coin sound is synthesised).

## Acceptance
- `npm test` and `npm run build` green.
- Screenshots in /tmp/integrate-mobile/: title 844x390 touch, shop by touch in the town (844x390 and 390x844), end screens with coins at 844x390; silent (user.js `media.volume_scale` 0.0, stored `muted: true` before the game first loads).

## Progress / evidence
- M1: merge commit 5d65bf2.
- M2: `npm test` 77 files / 697 tests passed; `npm run build` built; screenshots: every visible tap target in title, shop and end screen measured at >= 44 px; no horizontal or vertical page overflow at 844x390 in the town shop or the defeat screen (victory 401/390 px: its 3-line item list leaves an 11 px scroll); title shop at 844x390 412/390 (the notice under it).

## Unverified
- Real devices (iOS Safari, Android Chrome); the ghost click behaviour is browser-specific and was observed in Firefox only.
- "Instalar juego" in the two-column title grid was not re-shot (needs a faked `beforeinstallprompt` on a build).

## Next step
Human decision on push / PR for `feat/integrate-mobile`.
