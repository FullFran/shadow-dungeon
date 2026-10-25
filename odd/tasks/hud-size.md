# hud-size

## Objective
On desktop the in-game HUD is small and readable; held items no longer show as badges in the HUD (they are listed in the Esc menu).

## Problem
The status window grew one badge per held item (12+ badges covered about a third of the play area). Every HUD panel was drawn in view space (512x320) times the full canvas pixel scale, so at 1920x1080 (scale 3) 11 px text became 33 px and the status window was ~38% of the canvas width.

## Scope
- Remove held-item badges; keep a one-line count chip ("Objetos equipados x12 · Esc").
- Desktop: HUD drawn at its own integer scale chosen from the viewport, in a HUD space of canvas/hudScale. Touch keeps hudScale = pixelScale (unchanged sizes).
- Pure layout module `src/ui/hud-layout.ts` (scale + rects), unit-tested.
- Esc menu items window fits/scrolls with many items.

## Constraints
- Allowed surfaces: hud.ts, minimap.ts, card.ts, renderer.ts, view.ts, src/ui/**, menu.ts, game.ts, index.html, tests/**.
- message-log.ts, clock-hud.ts, intro-card.ts are not editable: they receive the HUD-space size from the renderer; the log rect is mirrored in the layout.

## Tasks
- [x] T1 Layout + scale tests (RED), `hud-layout.ts` (GREEN), HUD/minimap/renderer/game wiring, chip, Esc menu scroll. Route: inline (bounded writer worker; files already understood).
- [x] T2 Silent screenshots at 1280x720, 1920x1080, Esc menu 12+ items, touch 844x390 in /tmp/hud-fix/.

## Acceptance
- Status window <= 22% width and <= 14% height of the viewport at 1280x720 and 1920x1080; no overlap among status, minimap, log, move slots, boss bar.
- Touch layout identical to before.

## Checks
npm test, npm run build.

## Progress
- Created; branch fix/hud-size from main 043cb02.
- T1: RED observed (tests/ui/hud-layout.test.ts failed: module missing), then GREEN. hudScaleFor = floor(min(vw/960, vh/540)) clamped to [1, pixelScale] on desktop; pixelScale on touch.
- Sizes (CSS px, status window): before 1280x720 392 wide and ~300 tall with 12 badges; 1920x1080 588 wide and ~450 tall. After: 1280x720 196x69 (15% x 10%); 1920x1080 392x138 (20% x 13%). Touch unchanged (view space 512x320).
- T2: screenshots /tmp/hud-fix/run-1280x720.png, run-1920x1080.png, menu-1280x720.png, menu-1920x1080.png (12 distinct items, 26 stacks, two columns, fits), run-touch-844x390.png (unchanged, chip without Esc). Taken with a temporary uncommitted `?items=all` dev patch, reverted.
- Checks: npm test 107 files / 1030 tests passed; npm run build ok.
- Next: none; push/PR are the user's decision.
