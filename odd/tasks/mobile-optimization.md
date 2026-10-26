# Feature: mobile-optimization

## Objective
"Optimiza bien para móviles" (user request 2026-10-26): make the live game (https://www.fullfran.com/shadow-dungeon/) feel right on phones. Priority update (same day): the main goal is reviewing every view on phones and making touch COMBAT comfortable (Genshin Impact-style layout, ideas only); performance is secondary (short M1, only clear hotspots).

## Problem / why
Touch controls, PWA and a fit-to-screen canvas landed in `mobile-touch` / `integrate-mobile`, but: the in-run buttons are a fixed CSS cluster (no layout model, no aiming per skill, no cooldown on the buttons, the HUD's slot windows sit under the thumbs), nothing was measured for frame time on a phone-class CPU, and no real device has been tested.

## Scope
- M1 Short performance baseline: dev perf probe (`?perf=1`), headless Firefox bench at phone viewports, canvas call census, bundle size.
- C1 Combat layout model (pure, test-first): Genshin-style right-thumb arc — main Fast button 80-96 px, Heavy beside it, Roll prominent in the arc, Boost/Area smaller on the arc, Lock small near the arc; Pause and Map top corners; safe areas; all >= 44 px, no overlaps, all on screen; left-handed mirror; size/opacity scale. Hit testing.
- C2 Drag-to-aim (pure mapping test-first + DOM): a tap uses auto-aim; dragging from a slot button aims it along the drag (aim preview drawn on the canvas), releasing casts; charged moves charge while held and aim while dragged.
- C3 Button state: cooldown sweep and rank pips on the slot buttons; the canvas HUD keeps clear of the thumbs on touch (compact top corners).
- C4 Settings: button size, opacity, left-handed (touch section).
- M3 Every screen at 390x844 and 844x390: before/after screenshots to /tmp/mobile/, fix clipping, tap targets, safe areas.
- M2 (secondary) only clear render hotspots found in M1.
- M4 (secondary) load/PWA checks: first-load bytes, audio unlock, wake lock, fullscreen offer.

## Constraints
- `src/core` and simulation results unchanged: golden digest test and `npm run balance -- --quick --slots` byte-identical to HEAD 31e3404 (baseline in /tmp/mobile/base/balance).
- Desktop unchanged.
- Headless browsers silent (fresh profile user.js `media.volume_scale` 0.0, stored `muted: true`); kill only PIDs started here (process groups of the spawned vite/firefox).
- One Conventional Commit per task on `perf/mobile`, no AI attribution, no push/merge. ~400 changed lines per task is advisory only.

## Tasks
- [x] M1 Benchmark + baseline (route: inline; small tooling + a dev-only probe; percentile helper test-first: RED missing module, then GREEN 4 tests).
- [x] C1 Combat layout model (route: inline; pure, test-first). RED: missing module; GREEN 9 tests (5 viewports x 3 scales x 2 hands: on screen inside safe insets, >= 4 px apart, >= 44 px, main 88 px, mirror, Talk in the main spot, hit test). touch-controls places buttons and the joystick/tap halves from it (relayout on resize and on preference change; insets read from an `env()` probe). The old CSS-regex layout test read NaN from the removed `.touch-cluster` rule and still passed (a gate that could not fail): it now checks the model's buttons against the HUD slot windows. In-run fan notice hidden on touch (it sat under the thumbs). Screens: /tmp/mobile/c1/.
- [x] C2 Drag-to-aim + aim preview (route: inline; pure mapping test-first). RED: `dragAim`/`AIM_DRAG`/`slotCastMode` missing (5 of 6 failing), then GREEN 7 tests (dead zone, unit direction, dragged slot aims at playerPos + dir x 140 as a mouse-aimed move, a held charge counts as aimed before any drag, tap = auto-aim, cast modes). Cast modes: a charged move charges while held and a drag steers it; the main attack (slot 0) fires on press; the other uncharged slots fire on release (drag first). Aim preview: dashed line + chevron from the player (hidden while locked: the lock wins in the core). Real multi-touch via BiDi (`node tools/mobile/combat-check.mjs`): 8/8 at 844x390 and 390x844 (joystick + main attack at once, tap casts with auto-aim, drag on a charged move aims it up, release-cast casts on lift towards the drag). Found by that check: Firefox drops the second pointerdown when two synthetic fingers land in the same tick, and a pointerup when two lift in the same tick (Rápido stayed pressed): the controls now route every finger by where it lands (layout hit test with 6 px slop) and follow it by pointer id on the window, and a `touchend` with no touches left releases everything. The bench helper staggers the second finger by 120 ms. Screens: /tmp/mobile/c2/combat-aim-*.png.
- [x] C3 Cooldown sweep / rank pips on buttons; HUD clear of thumbs (route: inline; `slotButtonState` test-first: RED missing module, GREEN 6 tests). The slot buttons now show the move name, a dark conic cooldown sweep with whole seconds, rank diamonds, a red name when stamina cannot pay, a gold rim while the move runs and a gold charge ring while charging; the canvas slot windows (desktop key hints like "Clic izq. / Q") are not drawn on touch, so the top-left status window is the only HUD panel by the left thumb's reach. Labels: 10-11 px, hyphenated (no mid-word breaks like "Fija r"). Combat check 8/8 again; screens /tmp/mobile/c3/combat-*.png.
- [x] C4 Touch button size / opacity / left-handed settings (route: inline; test-first: RED 9 failing in settings / panel / touch-settings tests, then GREEN). Settings `touchSize` (0.85 / 1 / 1.2), `touchOpacity` (50 / 75 / 100 %), `touchLeftHanded`; only offered values load. Rows after Vibración; `setTouchPrefs` on load and on every change, the controls relayout live. Left-handed BiDi combat check 8/8 (/tmp/mobile/c4/). Known: in the mirrored layout the canvas message log (bottom-left of the canvas) sits under the Heavy button.
- [x] M3 Every-screen pass, portrait + landscape, before/after (route: inline; screenshot-driven, no meaningful runnable RED for CSS: `node tools/mobile/shots.mjs <label>` audits page overflow, tap targets < 44 px and controls off screen for 19 screens x 2 viewports). Before (/tmp/mobile/before/) -> after (/tmp/mobile/after/):
  - Settings 390x844: labels and values overlapped and the page scrolled 175 px sideways -> rows wrap, the value drops under its label (right-aligned, wraps when long); no sideways scroll. Same for the in-run quick settings.
  - Shrine 390x844: the window (min-width 36rem) overflowed both edges (87 px) -> no window wider than the screen on touch.
  - Rotate hint covered menus in portrait (settings, shrine, title) -> only shown where there is a game (run, town).
  - Online code / nickname fields and the settings nickname were 36 px tall -> 44 px.
  - Tutor 844x390: the whole page scrolled 1825 px, taking the text and balance out of view -> the move list scrolls inside the window (page 32 px).
  - End screens 390x844 (victory, eclipse): actions below the fold -> summary scrolls inside the window with the actions pinned at its foot.
  - Run: in-run fan notice hidden on touch (C1); keyboard-hint slot windows gone (C3).
  - Unchanged and fine: title, loadout, dungeons, endless, town, shop, online, lobby, item pick, pause menu, credits (only vertical page scroll on long lists, reachable; "Atrás" fixed top-left).
- [ ] M2 Clear render hotspots only (route: inline).
- [ ] M4 Load/PWA checks (route: inline).

## Checks
`npx vitest run --testTimeout=30000`, `npm run build` (sizes), `npm run balance -- --quick --slots --out=<dir>` diffed against /tmp/mobile/base/balance, `node tools/mobile/bench.mjs` before/after, `git log --format=%B -n 4 | grep -ic co-authored` = 0.

## Progress / evidence
### M1 baseline (HEAD 31e3404 + probe; this machine, Firefox 1xx headless, DPR 3; frame interval is vsync-capped at 60 Hz)
`node tools/mobile/bench.mjs --seconds=5` → reports/perf/before.json. ms p50/p95:

| scene | viewport | sim | render | bullets |
|---|---|---|---|---|
| boss-card (Decidueye card 2, Nightmare) | 844x390 | 0.26/0.52 | 3.80/4.96 | 66 |
| crowd-12 (12 enemies) | 844x390 | 0.02/0.56 | 1.88/2.60 | 2 |
| floor (Crypt 3, Hard) | 844x390 | 0.20/0.48 | 1.70/2.28 | 0 |
| town | 844x390 | - | 3.44/3.80 | - |
| boss-card | 390x844 | 0.20/0.38 | 3.74/5.02 | 66 |
| town | 390x844 | - | 3.38/3.70 | - |

- Canvas backing store is already capped (MAX_DPR 2 → 1024x640 at both phone sizes), so fill rate is not the issue.
- Census (`node tools/mobile/calls.mjs`, 844x390): boss-card ~480 `fillRect`/frame (~2.4 ms incl. instrumentation), floor ~580, town ~290 `fillRect` + ~210 `drawImage`; no `filter` or `shadowBlur` in these scenes. The per-tile floor drawing is the one clear hotspot.
- With a 4-6x phone budget the boss card and the town are at or over 16.7 ms on a mid-range phone; sim (<0.6 ms p95) is not a concern.
- Build: `index-*.js` 950.57 kB (270.22 kB gzip), trystero chunk 80.49 kB, index.html 33.31 kB; dist 37 MB (sprites 13 MB, music 23 MB runtime-cached). Sprite sheets (727 files, 11.5 MB) load on the first run/town, not on the title.

## Unverified
- Real iOS Safari / Android Chrome devices; CPU throttling (Firefox headless cannot throttle; numbers are this machine's).
