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
- [ ] C3 Cooldown sweep / rank pips on buttons; HUD clear of thumbs (route: inline).
- [ ] C4 Touch button size / opacity / left-handed settings (route: inline; settings parse test-first).
- [ ] M3 Every-screen pass, portrait + landscape, before/after (route: inline; screenshot-driven).
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
