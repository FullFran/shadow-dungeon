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
- [ ] T5 Silent screenshots in `/tmp/integrate-roster/`

## Acceptance criteria

- `npm test` and `npm run build` green after each task.
- Pool test: every roster species present, min depth respected, seeded floors show new species by floor 5.
- Self-destruct test: no XP and no coin tally for a self-kill.
- End screen buttons visible above the footer at 1280×720, 1024×640 and 844×390.

## Progress and evidence

(updated per task)
