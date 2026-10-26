# Roll direction and font legibility (playtest 2026-10-26)

## Objective
Fix two playtester reports from a new player on Easy: (1) "al esquivar solo vas hacia la derecha" while aiming; (2) the lowercase "e" on the results screen is illegible in white heavy Pixelify Sans on the blue window.

## Problem
1. A roll with no direction held goes along `player.facing`, which is `(1,0)` on room entry (`src/core/rooms.ts`) and only changes while walking. Mouse aim and attacks never change it, so a player who aims with the mouse and presses Space rolls along the last walk direction (right in a guardian room). A Space pressed a step before the direction key also commits to the facing. Arrow keys do not move in the dungeon.
2. Heavy (bold/faux-bold) Pixelify Sans at small sizes closes the counter of the "e".

## Why
The roll is the core defensive verb; a roll that ignores where the player is aiming reads as broken. Results text must be readable.

## Scope
- T1 core: neutral roll aims at the lock target, else the mouse cursor (new optional `PlayerInput.aimPointer`), else the facing; a direction pressed within the first ~100 ms of a neutral roll redirects it; arrow keys move in the dungeon. Tests first (core, input adapter, touch merge), real headless browser key events, docs (GDD, README, in-game help).
- T2 font: find bold/faux-bold text, use real weights or none, `font-synthesis: none`, pixel-grid sizes; screenshots before/after at DPR 1 and 2 in `/tmp/roll-font/`.

Out of scope: a roll buffer during move recovery (a roll pressed during an attack is dropped, unchanged); `src/adapters/hud.ts`; enemy movement files.

## Constraints
- `src/core` pure and deterministic; protocol stays compatible (no new wire field needed: guests send state, not input).
- One Conventional Commit per task, explicit paths, no AI attribution, no push.
- Headless browsers silent.

## Tasks
- [x] T1 Roll direction: tests, fix, arrows, docs (route: inline inside the delegated writer)
  - Root cause, reproduced in headless Firefox with real key events on main b9c1cdf (`/tmp/roll-font/roll-check-5318.txt`): holding A then Space rolls left (the developer's case), but (1) Space then A within 30 ms rolls RIGHT (+110 px): the roll commits on the Space tick to `facing`, (1,0) in a room or test arena just entered; (2) ArrowLeft + Space rolls RIGHT: arrows did not move in the dungeon, so the roll was neutral; (3) mouse at the left edge + Space rolls RIGHT: the cursor never steered a roll. Touch (joystick held + Roll tap, two touches) rolled left on both builds: the second touch does not reset the joystick (`/tmp/roll-font/touch-check-*.txt`).
  - Fix: neutral roll goes at the lock, else the live mouse cursor (`PlayerInput.aimPointer`, optional; live = mouse moved after the last direction key), else facing; a direction pressed in the first `TUNING.roll.redirectMs` (100 ms) of a neutral roll redirects the whole roll from its start (`RollState.from`, swept against walls); arrows move. After: Space then A = -110 px, ArrowLeft = left, mouse left = -110 px (`/tmp/roll-font/roll-check-5317.txt`).
  - RED observed: 7/22 core tests and 7/8 adapter tests failed before the fix. A roll pressed during a move's recovery is still dropped (documented by a test; no buffer added).
  - Golden digest unchanged (scripted rolls always hold a direction); balance `--quick --slots` byte-identical to the HEAD run. Protocol unchanged: guests send state, `from` is not encoded (only the local simulation needs it).
- [x] T2 Font legibility: audit, fix, screenshots (route: inline inside the delegated writer)
  - Finding: the results stat lines were already 400, but Pixelify Sans' real 700 fills the "e" counter at every size (a dot even at 33 px x DPR 3), and the UA makes h1-h6/strong 700; 500-600 keep the counter but blur 1-unit strokes at DPR 1. Off-grid sizes on the results screen: 16/14/13 px labels, 28/26 px titles, 16 px touch stats.
  - Fix: `font-synthesis: none` on body; h1-h6, strong, b, th at 400; the 700s removed (window titles, logo, start label) except the room code (capitals and digits only); canvas emphasis `EMPHASIS_WEIGHT = 400` (`src/ui/tokens.ts`, HUD callers untouched); results sizes on the grid (labels 11 px, short/touch titles 22 px, touch stats 16.5 px = whole at DPR 2). No font swap: at 400 on the grid the "e" stays open.
  - RED: `tests/ui/font-legibility.test.ts` 5/5 failed on main b9c1cdf, green after. Screenshots: `/tmp/roll-font/{before,after}-{victory,defeat,town}-{dpr1,dpr2,dpr1.25,dpr1.5,phone-dpr3,phone-touch-dpr2}.png`, weight/size samples `sample-*.png`. Main has no town coin label; the town shots show the canvas place banner instead.

## Checks
- `npm test`, `npm run build`, `npm run balance -- --quick --slots` (equal to baseline unless explained), no co-authored lines.

## Progress
- T1 done (ee8004b). T2 done. Checks: `npm test` 198 files / 2425 tests green; `npm run build` ok; balance byte-identical to the HEAD run (the committed `reports/balance/latest.md` predates HEAD and was not regenerated).
