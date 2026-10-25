# Integrate the experimental roster

## Objective

Bring `feat/enemy-roster` (14 experimental species, behaviours in `src/core/roster.ts`, `?spawn=` arena, balance budget) onto `main`, which gained the endless Sima del Eclipse, and let the roster loose in the Sima.

## Scope

- Merge `feat/enemy-roster` into `feat/integrate-roster` (from `main` 411ddaa).
- Append every `EXPERIMENTAL_ENEMIES` species to `ENDLESS_POOL`.
- No rewards for an enemy killed by its own explosion (Koffing).
- End-screen buttons stay above the fan-notice footer at small viewports.

## Constraints

- No push, no edits to `main` or other branches; no AI attribution in commits.
- Silent screenshots only (headless Firefox, `media.volume_scale` 0, `muted: true`).

## Tasks

- [x] T1 Merge `feat/enemy-roster` (route: inline; mechanical conflict resolution)
- [x] T2 Roster in the Sima pool (route: inline; one data file + one test file)
- [x] T3 Koffing self-destruct gives no XP/coins (route: inline)
- [x] T4 End-screen buttons above the footer (route: inline; `index.html` CSS)
- [x] T5 Silent screenshots in `/tmp/integrate-roster/`
- [x] T6 (found by T5) Firefox: a music switch mid-fade threw and aborted the run start (route: inline; `src/adapters/audio.ts` + its test)

## Acceptance criteria

- `npm test` and `npm run build` green after each task.
- Pool test: every roster species present, min depth respected, seeded floors show new species by floor 5.
- Self-destruct test: no XP and no coin tally for a self-kill.
- End screen buttons visible above the footer at 1280×720, 1024×640 and 844×390.

## Progress and evidence

- T1 `chore(merge): integrate feat/enemy-roster`. Conflicts: `README.md` (kept main's Sima paragraph and screen list, added the `?spawn=` sentence), `docs/gdd.md` (kept both the Sima section and "Plantel experimental"), `src/app/game.ts` (imports of both; `startClockMs` and `testSpawns` options both; run keeps `setClock`, world keeps `loadTestFloor`), `src/app/main.ts` (`devStartClock` and `devSpawns` both; `shared` keeps `seed ?? runSeed()` and adds `testSpawns`). i18n auto-merged, both JSON files parse. `npm test` 889/889, build green.
- T2 `feat(endless): unleash the experimental roster in the Sima del Eclipse`. All 14 `EXPERIMENTAL_ENEMIES` appended to `ENDLESS_POOL` with their suggested min depth and packs (Zubat 3, Stunky 2) and lower weights (Zubat 2, the rest 1) so the regulars and the roster weigh about the same by floor 5 (test: ratio between 0.5 and 2). RED observed (3 new tests failing), then GREEN. Seeded floors 1-4 of seed 4242 show at least 3 roster species, each at or below its floor. `npm test` 892/892, build green.
- T3 `fix(enemies): no rewards for Koffing's self-destruct`. RED observed (`spent` undefined), then GREEN. New `EnemyState.spent`; `creditDefeats` skips spent enemies, so neither XP nor the coin tally (which counts `credited`) pays; the flag rides the host snapshot and the wire (optional trailing slot) so guests credit nothing either. A kill during the fuse still pays. Per-species coin values: not wired, Pokémonedas stay flat (`COINS.perEnemy`); the tally stores only depths, so per-species pay would change the tally shape and the end-screen lines, not cheap. `npm test` 893/893, build green.
- T4 `fix(app): keep end-screen buttons above the footer`. Before: at 1024×640 the Sima end screen was 751 px tall and its buttons (570-642) sat under the fixed notice (570-634). After: the notice flows under the end-screen window, and short viewports (max-height 760px) tighten the lines and put both actions on one row: 1024×640 actions 493-528, notice 553-617, no scroll; 1280×720 actions 542-578, notice 603-647; 844×390 touch: the window scrolls inside with the actions pinned at its bottom (321-383 of 390), the Sima's notice below it. `npm test` 893/893, build green.
- T5 Screenshots (headless Firefox 158 over WebDriver BiDi, own profile with `media.volume_scale` "0.0", settings `muted: true` written to localStorage before load, own dev server on 4531): `/tmp/integrate-roster/sima-floor6-1024x640.png` (Sima floor 6, seed 231: Tentacool, Wooper, Grimer and Litleo near the start), `end-1024x640.png`, `end-1280x720.png`, `end-844x390-touch.png`, `defeat-844x390-touch.png`, and `before-end-1024x640.png` (the bug).
- T6 `fix(audio): let a track switch mid-fade on Firefox`. Firefox has no `cancelAndHoldAtTime`, cannot cancel a value curve already under way, and throws on any event inside it; `setMusic` mid-fade threw out of `startGame`, leaving a black canvas. Without `cancelAndHoldAtTime`, fades now use plain linear ramps (which cancel cleanly). RED observed with a Firefox-like fake param, then GREEN. `npm test` 894/894, build green.

## Next step

Human review of `feat/integrate-roster`; push, PR and merge are the user's decisions.
