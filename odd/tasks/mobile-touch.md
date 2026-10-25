# Feature: mobile-touch

## Objective
Make Mazmorra Sombría playable on phones and tablets (user request 2026-10-25), and installable as a PWA (scope addition, same day).

## Problem / why
The game is keyboard + mouse only: menus need Esc, the run needs WASD/mouse, the canvas does not fill a phone screen and the page scrolls/zooms under the thumb.

## Scope
- T1 Layout + detection: responsive canvas (fit-to-screen, DPR capped at 2), viewport meta without zoom, safe-area insets, portrait rotate hint, no scroll/zoom/long-press/selection during play, guarded wake lock, touch mode Auto/On/Off (auto on first `pointerType === 'touch'`), large tap targets (>= 44 px), on-screen "Atrás", soft-keyboard friendly room code input.
- T2 In-run touch controls: floating left joystick (dead zone, analogue), Roll / Fast / Heavy (hold to charge) / Lock (tap toggles, swipe switches target) / Pause / Minimap buttons, auto-aim cone toggle (default on), tap-on-enemy click-to-lock, multi-touch with pointer capture, pressed states, haptics toggle. Pure touch state -> PlayerInput mapping; core untouched.
- T3 Town + online + cinematics: joystick walking and a "Hablar" button in the town, lobby/online by tap, prologue hold-to-skip by touch hold.
- T4 PWA: manifest (relative start_url/scope, fullscreen, landscape, token colours, 192/512/maskable icons from a code-drawn eclipse, reproducible script), versioned service worker (precache shell from the Vite manifest, runtime cache-first for sprites/tiles/music/fonts, old caches dropped, "new version" toast, not registered in dev, never caches cross-origin), install invitation (beforeinstallprompt entry + one-time dismissible banner, iOS instructions, hidden when standalone, "don't show again").

## Constraints
- `src/core` stays pure and unchanged; desktop behaviour unchanged.
- Touch code in new modules (`src/adapters/touch.ts`, `src/ui/touch-controls.ts`, ...); shared files edited minimally and additively; new i18n keys in one contiguous block.
- Two parallel writers (dungeon framework, shop): keep diffs to main.ts / game.ts / settings small.
- One Conventional Commit per task, no AI attribution; no push.

## Tasks
- [x] T1 Layout, detection, settings, menus by tap (route: inline, single writer; pure parts test-first). RED observed for `fitCanvas`/`touchActive`/touch settings, then GREEN; full suite green; title/loadout screenshots at 844x390 and 390x844 checked (title switched to a row layout in low landscape, notice moved into the flow on touch).
- [x] T2 In-run touch controls (route: inline; mapping/joystick/aim/swipe test-first). RED (missing modules) then GREEN for joystick dead zone, swipe steps, auto-aim cone, touch->PlayerInput, keyboard merge, haptics; screenshots show joystick moving the player (two fingers at once) and Pausa opening/closing the menu. Decision: Lock tap = press edge under `toggle`, button level under `hold` (keeps the lock-type setting meaningful).
- [x] T3 Town, online, prologue by touch (route: inline). No meaningful runnable RED (DOM wiring over already-tested pure parts): checked by screenshots — joystick walks to the shop NPC, "Hablar" appears in range and opens the dialog (844x390 and 390x844), online screen tappable with the code field (soft keyboard attributes set in T1). Prologue: a touch hold anywhere is the held skip key; "Saltar" taps.
- [ ] T4 PWA manifest, service worker, install invitation (route: inline; manifest/precache/banner logic test-first)

## Acceptance
- `npm test` and `npm run build` green, architecture test green.
- Phone-viewport screenshots (844x390, 390x844) of title, loadout, in-run controls, town with Hablar in /tmp/mobile/.
- dist/ holds manifest, icons and sw.js with relative paths.

## Checks
`npm test`, `npm run build`, screenshots via headless Firefox BiDi, `git log --format=%B | grep -ic co-authored` = 0.

## Progress
(updated per task)

## Unverified
- Real device test (iOS Safari, Android Chrome): multi-touch feel, haptics, wake lock, install prompt.
