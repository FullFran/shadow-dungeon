# Integrate hub town

## Objective
Bring `feat/hub-town` onto `main` (starters, quiz, prologue, licensed music) on `feat/integrate-hub-town`, then close the town's open ends: real run records for the notice board, NPC lines that match the lore, and the title music carried into the town.

## Scope
- M1 Merge `feat/hub-town` (`--no-ff`), resolve conflicts, town exit through `newAdventure`.
- R1 Record every solo or hosted run in `mazmorra-sombria.records` (pure reducer + guarded storage write); the board shows it.
- L1 NPC lines (es+en) aligned with docs/gdd.md §3 "Prólogo y trasfondo".
- A1 Town music: same title track (Lonely Village) so title -> town is seamless.

Out of scope: gacha and shop logic, online walking together.

## Constraints
- Allowed surfaces: `src/**`, `tests/**`, `public/tiles/**`, `CREDITS.md`, `README.md`, `docs/gdd.md`, `odd/tasks/**`.
- CREDITS.md: no Markdown table outside Sprites (the credits test counts `| ` rows).
- Never name Necrozma; the Sword King is only the first dungeon's guardian (nothing "sleeps under the Crypt").
- Conventional Commits, one commit per task, no AI attribution, no push.

## Tasks
- [x] M1 Merge and resolve (route: inline; conflict resolution in 4 files, mechanical)
- [x] R1 Run records (route: inline; one module + one hook)
- [x] L1 Lore lines (route: inline; i18n strings plus a small rotation helper)
- [ ] A1 Town music (route: inline; one call)

## Acceptance criteria
- `npm test` and `npm run build` pass after every task.
- Title: Play first (Enter plays), Prologue, Town last; the town crypt exit runs `newAdventure` (prologue/quiz if due, then loadout).
- After a run the board shows best floor, runs, victories and best level.

## Checks
`npm test`, `npm run build`, `git log --format=%B main..HEAD | grep -ic co-authored` = 0.

## Progress
Created 2026-10-25. Forecast ~250 authored lines beyond the merge. Delivery: one PR (parent decides).

### M1 Merge
- Conflicts: `src/app/main.ts` (title entries: kept Prologue at index 4 and appended Town at index 5; dev `?screen=` keeps both `quiz` and `town`), `src/i18n/es.json` and `en.json` (both blocks kept: main's prologue/dungeon keys, then the `town.*` block; JSON valid), `CREDITS.md` (Font, Music, Audio, then Tiles as prose; `| ` row count stays 10 as on main). README auto-merged; title list now names Town and the exit text says it goes on like Play.
- Semantic fixes: the hub branch passed a removed `SPECIES` constant to `openTown`, now `settings.species` (the quiz starter walks the town); exit `onDepart` now `newAdventure(root)` instead of `loadout(root)`; town Esc returns to title index 5 (Town).
- Checks: `npm test` 64 files / 613 tests passed; `npm run build` ok. Commit 428c521.

### R1 Run records
- Shape of `mazmorra-sombria.records`: `{runs, victories, bestLevel, lastSpecies, dungeons: {<dungeon id>: {bestFloor}}}`; dungeon id from `DUNGEON_LORE` (`crypt-of-the-sword-king`). The hub branch's `{bestFloor, runs}` was never written, so no migration.
- `src/town/records.ts`: pure `recordRun` reducer, tolerant `parseRecords` (ids `[a-z0-9-]{1,40}`, at most 32 dungeons, so `__proto__` and markup are dropped), `readRecords`/`saveRun` that swallow store failures, pure `boardLines(records, dungeon, tr)`.
- Hook: `play()` `onEnd` calls `saveRun` unless this peer is a guest (solo, `?net=local` host and online host record; a guest's run is the host's), then shows the result screen.
- Board: "Récords de este dispositivo: Mejor planta en la cripta: N · Expediciones: N · Victorias: N · Mejor nivel: N" (new keys `town.board.victories`, `town.board.level`, contiguous in the `town.*` block).
- Checks: RED observed (8 failing, exports missing), GREEN 8 records tests; `npm test` 64 files / 618 tests passed; typecheck clean.

### L1 Lore lines
- Storyteller (Gastly) now rotates: `TownNpc.rotate` + pure `npcLines(npc, talks)` in `src/town/dialog.ts`; one line per talk, in turn, counted per visit. Four lines (Crimson Eclipse; Shadow Dungeons and the shadows; guardians bound to a forgotten oath, the Sword King only the first; something deeper devouring the light). The old line that put "whoever took the sun" asleep under the Crypt is gone; Necrozma is never named.
- Gacha (Mimikyu) and shop (Poochyena): one flavour line each, then "Próximamente." (unchanged flow).
- `town.exit.crypt` aligned with `dungeon.crypt.name` ("Cripta del Rey de las Espadas"; en already matched).
- Checks: RED observed (`tests/town/lines.test.ts` 3 failing: no `npcLines`, no `rotate`, "duerme" in the old line), GREEN 3; `npm test` 65 files / 621 tests passed.
