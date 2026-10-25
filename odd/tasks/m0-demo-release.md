# M0 demo release

## Objective
Ship the M0 combat prototype as a public, playable demo on GitHub Pages after the first playtest, with the lock-on controls the playtester asked for.

## Problem
Playtest feedback (2026-10-25): combat feels great ("va duro"), but holding Shift to lock on is very uncomfortable. The playtester wants lock-on on the middle mouse button, press-and-release (toggle) only, and an option to lock onto the enemy clicked with the cursor (LoL-style). The demo must be deployable with no saving or backend.

## Scope
- Lock-on: remove the `hold` mode; Shift and middle mouse button toggle lock; option (default on) where clicking an enemy under the cursor locks onto it (and switches to it while locked); hover highlight for the enemy under the cursor.
- GitHub Pages deploy workflow; README play link and controls.
- Push and deploy, only after the user authorizes destination and credentials.

Out of scope: sound and music, procedural dungeons (M2), accounts and saves.

## Constraints
- Core stays pure and deterministic; moving the mouse alone never switches target.
- No AI attribution in commits; Conventional Commits.
- Stored settings with the old `hold` value must load as `toggle` (implemented as: the `lockMode` field is dropped, since toggle is the only behaviour).

## Tasks
- [x] T1 Lock-on rework (route: delegated writer; trigger: 4+ non-trivial files across core, adapters, app, i18n, tests). Commit `6462946`.
- [x] T2 GitHub Pages workflow and README (route: same writer). Commit `511eee3`.
- [ ] T3 Create remote, push, deploy (route: parent; blocked on user authorization)

## Acceptance criteria
- Tapping Shift or middle mouse locks the enemy nearest the cursor; tapping again releases.
- With click-to-lock on, a left click whose cursor is over an enemy locks onto that enemy (and still attacks).
- Settings menu offers click-to-lock on/off; no hold option remains.
- `npm test` and `npm run build` pass; workflow builds `dist/` and deploys it to Pages.

## Checks
`npm test`, `npm run build`.

## Progress
Created. Delivery strategy: ask-on-risk; forecast ~300 authored lines.

### T1 evidence (`6462946`, 18 files, +241/-101)
- RED: after writing tests first, `npx vitest run` showed 13 failing tests (settings defaults/round-trip/legacy load, click-to-lock, simulation click, input mapping for middle button and `click`).
- GREEN: `npm test` 134/134 passed; `npm run build` (typecheck app + DOM-free core, vite build) passed.
- Decisions:
  - `LockMode` removed from core; `LockState` now holds `clickToLock` and `clickHeld` (press-edge detection lives in core, like `keyHeld`).
  - `PlayerInput.click` is a new level flag fed only by LMB (button 0), so Q fills the fast slot but never click-locks.
  - Hit test for click-to-lock and hover: cursor within the enemy hurt circle (`pos`, `radius`) plus `TUNING.lockOn.clickMargin` = 6 px, among lock candidates (alive, in range, on screen); closest wins on overlap.
  - Same tick: a lock-key press edge takes precedence over a click edge. A click on the current target or on empty ground emits no event.
  - Click on an enemy with no lock emits `lockAcquired`; with another target locked emits `lockSwitched`.
  - Hover marker: `app/game.ts` computes `enemyUnderCursor` (the same core rule) from the last `PlayerInput` and passes `hoverId` to the renderer, which draws a faint dashed ellipse under the enemy; hidden when click-to-lock is off or the enemy is already the target.
  - Middle button: `mousedown` preventDefault already covered autoscroll; added an `auxclick` preventDefault on the canvas.
  - Menu: the hold/toggle select became a "click-to-lock" checkbox; i18n keys `lockMode.*`/`menu.lockMode` replaced by `menu.lockOn`, `menu.clickToLock`, `menu.controls.clickLock`.

### T2 evidence (`511eee3`)
- `.github/workflows/deploy.yml`: push to `main` + `workflow_dispatch`; build job (checkout@v4, setup-node@v4 Node 22 npm cache, `npm ci`, `npm test`, `npm run build`, configure-pages@v5, upload-pages-artifact@v3 `dist`) and deploy job (deploy-pages@v4); permissions contents:read, pages:write, id-token:write; concurrency group `pages`. Action versions not checked online (pinned to the known majors).
- Asset paths: `loadSheets` uses `import.meta.env.BASE_URL`; with `base: './'` the built bundle fetches `./sprites/...` (verified in `dist/assets/*.js`), and `dist/sprites/` contains all four dex folders. No change needed.
- README: demo description, credits pointer, play URL placeholder, updated controls table, deploy note.
- `npm test` 134/134 passed; `npm run build` passed. The workflow itself has not run yet (needs a remote, T3).

## Next step
T3: user authorizes the GitHub destination and credentials; create the remote, push, enable Pages (source "GitHub Actions"), then fill the play URL in README.
