# Meta progression: Pokémonedas and the upgrade shop

## Objective
Give runs a permanent reward (docs/gdd.md §11): every run pays Pokémonedas into a local save, and Poochyena's stall in the town (also on the title menu) sells permanent upgrades applied at run start.

## Problem
Everything resets when a run ends; there is no reason to come back besides the records board. The GDD plans a currency multiplied by difficulty and permanent upgrades; the shop NPC still says "Próximamente".

## Scope
- T1 Save facade (`src/app/save.ts`: versioned schema, `migrate()` and `sanitize()`, guarded store, never crashes on corrupted data) holding the balance and upgrade levels. Earning rules in data (`src/data/coins.ts`), pure tally and breakdown reducer in core (`src/core/coins.ts`). HUD shows coins earned this run; end screens show the breakdown and the new balance. Each peer of a shared run earns for itself (guests too); no network change.
- T2 Upgrade data (`src/data/upgrades.ts`) and pure purchase rules (`src/core/upgrades.ts`); bonuses folded into `playerStats` and `createPlayer` (every species). Shop window (`src/app/shop.ts`, MD window + cursor list) opened by Poochyena in the town and by a "Tienda" entry appended last to the title menu. Purchase sound.
- T3 Docs: GDD §11 (Spanish, earning and upgrade tables marked provisional), README.

Out of scope: gacha (stays "Próximamente"), difficulty selection (the multiplier table is in data, the game runs on normal), network sync of coins, cloud saves.

## Constraints
- Core pure and deterministic; architecture test green; all existing tests green.
- Shared files (main.ts, game.ts, end screens, town, i18n) touched minimally and additively: another writer works on a dungeon framework in parallel. New i18n keys in one contiguous block at the end of each catalog.
- Conventional Commits, one commit per task, explicit paths, no AI attribution, no push.

## Tasks
- [x] T1 Save facade + Pokémonedas earning, HUD and end screen (route: delegated writer, this worker; trigger: 2+ non-trivial files)
- [ ] T2 Upgrades + shop window (town and title) (route: same writer)
- [ ] T3 Docs: GDD §11 and README (route: same writer)

## Acceptance criteria
- Corrupted, hostile or missing save data reads as an empty save and never throws; a failing store never throws.
- Same run events give the same coin total; a defeat keeps 75 %; coins grow with floors, enemies and minutes played.
- Buying deducts the exact cost, raises the level by one, refuses when unaffordable or maxed.
- Upgrades change the run-start player for every species (max HP) and the stats pipeline (stamina regen, floor heal, perfect dodge window, XP gain).
- `npm test` and `npm run build` pass after every task.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 4 | grep -ic co-authored` = 0. Screenshots (headless Firefox, WebDriver BiDi) to `/tmp/meta/`: shop window in the town, end screen with the coin breakdown, HUD with coins.

## Delivery
Forecast ~900 authored lines over three tasks (T1 ~450, T2 ~400, T3 ~60). Strategy `ask-on-risk`; the parent decides PR slicing.

## Progress
Created 2026-10-25 on `feat/meta-pokemonedas` from `main` d3d4f9a.

### T1 Save facade + Pokémonedas (done)
- Save facade `src/app/save.ts`, key `mazmorra-sombria.save`, schema v1 `{version, coins, upgrades}`; read = JSON -> `migrate()` (object without `version` -> v1; non-objects -> null; a newer version is kept and sanitized best-effort) -> `sanitize()` (whole non-negative safe-integer coins, known upgrade ids only, whole levels clamped to the table). `loadSave`/`writeSave`/`earnCoins` swallow every store failure.
- Decision: settings and the notice board records stay on their own keys (they predate the facade, have their own tolerant parsers and the other writer touches the town); the facade only owns what is new. Moving them later is a v2 `migrate()` step.
- Earning (data `src/data/coins.ts`, provisional): 6 per floor cleared times its depth; 1 per enemy times (1 + 0.5 (depth - 1)); collapse escape 20 within 30 s, 12 within 60 s, else 6; guardian 50; 2 per full minute of simulated play (pauses excluded); defeat keeps 75 % (floored); difficulty multiplier table from GDD §9 (game runs on normal, x1).
- Core `src/core/coins.ts`: `tallyStep` (newly credited enemies, the same rule that pays experience, so solo kills, host claims, guest snapshots and collapse deaths each pay once) + `tallyFloor` (floor cleared, escape ms from `run.escape`) + `coinBreakdown(tally, outcome, difficulty)`.
- Game: tally per peer in `game.ts`; "Restart floor" restores the tally of the floor start (no double pay). Quitting from the Esc menu forfeits the run's coins (no end screen). HUD: "N P" right-aligned on the passive row of the status window. End screens: lines that paid, share kept on defeat, total and new balance (`src/app/coin-lines.ts`). Every peer (guests too) adds its own total to its own save; no network change.
- i18n: one contiguous block appended at the end of es/en (`hud.coins`, `screen.coins.*`).
- Checks: RED observed (coins/save/coin-lines modules missing), GREEN 9 + 7 + 2 tests; typecheck clean; `npm test` 68 files / 639 tests passed.
