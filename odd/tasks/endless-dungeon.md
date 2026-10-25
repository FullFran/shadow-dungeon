# Return to town + endless dungeon (Sima del Eclipse)

## Objective
(A) After a run ends, the end screen leads back to the town (the hub), not the title. (B) Add an endless, timed challenge dungeon in the spirit of Mystery Dungeon's Zero Isle: the Sima del Eclipse (Eclipse Chasm), the dungeon meant to be played most on streams.

## Problem
Every finished run drops the player on the title screen, so the town never feels like home. And every dungeon has a fixed plan that ends on its guardian: there is nothing to replay for a score, nothing comparable between players, and nothing for a stream audience to play along with.

## Why
User requests of 2026-10-25: "en vez de volver al menú, que vuelva al pueblo" and an endless timed dungeon, "esa es la que se jugará más en los streams".

## Design (provisional; every number lives in data)
- Return to town: the end screen's action is "Volver al pueblo" (retry stays for solo runs); quitting a run from the Esc menu and "the host left" during a run also go to the town. The title still opens on launch and its first entry (Enter) still starts the adventure. Online guests go to their own town; the lobby flow (create/join, host Start) is unchanged.
- Dungeon `eclipse-chasm`, "Sima del Eclipse" / "Eclipse Chasm", open from the start (`unlockedBy: null`), so the dungeon select and the town exit list it from the first run.
- Floors: infinite. Every 5th floor is a guardian echo (rotating Aegislash, Trevenant, Decidueye in their arenas, scaled, a short name card, an exit at the top once it falls); every other floor is generated. Enemy pool mixes the Crypt and Forest enemies by depth; HP +8 % and damage +5 % per floor past the first (caps x4 and x3); echoes take 60 % of that HP. Urgent floors: collapse and Niebla, rising with depth.
- Clock: 8:00 at the start, counts down in simulated time (stands still only when the solo run is paused: menu, item pick; a shared run never pauses). Descending adds 40 s, 2 s less per floor, never under 15 s; leaving a felled echo adds 60 s more. At 0:00 the eclipse swallows the floor: the run ends as a score ("eclipse" end), not a defeat (no defeat share on coins). HUD: large clock at the top centre, red and pulsing under 30 s, a tick every second under 30 s, "+40 s" when time is added.
- Modo puro (Zero Isle rule): level 1, no held items, permanent shop upgrades off in this dungeon; the entry card says so. Items, levels and berries found in the run work as usual.
- Score: deepest floor, tie-break by time left. Local leaderboard (top 10) in the records, shown on the town notice board and the end screen.
- Modes on the entry card: "Reto diario" (seed from the UTC date, the same layout for everyone that day) and "Libre" (random seed). The end screen shows the seed, the mode and the date.
- Coins: the normal rules, x0.5 (the end screen's multiplier line), so the endless dungeon is not the best farm.
- Music: rotates the existing floor tracks by depth band (Crypt, Forest) every 5 floors; echoes play their guardian's track; the entry card shows "♪ title".
- Co-op: shared runs supported; the host picks mode and seed (the seed already goes in `start`); the host owns the clock and sends it (reliable `clock` message once a second and on every floor change); guests display it and end when the host's clock reaches 0.

## Scope
- T1 Return to town (pure routing `src/app/after-run.ts`, main.ts wiring, i18n).
- T2 Endless core + data: `DungeonDef.endless`, plan by floor, echoes, depth scaling, clock rules, daily seed, modo puro, coin scaling, music bands.
- T3 Clock HUD, entry card, end screen (score, rank, seed, date, mode), leaderboard reducer and board lines, daily/free modes; screenshots.
- T4 Co-op clock + docs (GDD section, README).

Out of scope: an online leaderboard, new enemies or tracks, balance by hand.

## Constraints
- Core pure and deterministic; architecture test green; `npm test` and `npm run build` green.
- Another writer is remastering the Crypt in parallel: shared files (main.ts, game.ts, dungeons.ts, i18n, town) edited additively; new i18n keys in one contiguous block per language; no edit to the Crypt's data, enemies, tiles or rooms.
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- ~400 authored lines per task is advisory only.

## Tasks
- [x] T1 Return to town after a run (route: inline writer, this agent; one pure module and its wiring)
  - `src/app/after-run.ts`: `endActions({ online })` (retry + town solo, town only online) and `returnPlace(reason)` (end, quit, hostLeft -> town; lobby -> title). `main.ts`: the end screen's actions come from `endActions` ("Volver al pueblo" opens the town), the Esc menu's quit opens the town, "the host left" during a run offers the town (in a lobby still the menu). The town's own Esc still goes to the title; the title's first entry still starts the adventure. New key `screen.town` (es/en).
  - Evidence: `tests/app/after-run.test.ts` RED observed (module missing), then GREEN. `npm test` 87 files / 786 tests passed, typecheck ok.
- [x] T2 Endless core + data (route: inline writer, this agent; core run/world/hits, data, minimal game wiring)
  - Data: `src/data/endless.ts` (`ENDLESS` tuning, `ENDLESS_POOL`, `isEchoFloor`, `echoAt`); `ECLIPSE` in `src/data/dungeons.ts` (`unlockedBy: null`, empty `plan`, eclipse palette, urgent chance tables built from the endless formula) with `planAt` and `floorsOf`; `FloorPlan.role: 'echo'`; lore entry `eclipse-chasm`.
  - The pool is one flat list `{ species, minDepth, weight, pack? }` (coordinator request: the parallel enemies writer only appends entries; `endlessSpawns` turns it into the generator's tuning per depth).
  - Core: `src/core/endless.ts` (`depthScale`, `endlessSpawns`, `tickClock`, `addTime`, `descendBonusMs`, `clockPaused`, `utcDateKey`, `dailySeed`, `runUpgrades`, `scaleCoins`, `clockText`); `RunState.clockMs`/`echoPaid` (endless only, absent elsewhere, so other runs' state is unchanged); outcome `eclipse` (host/solo when the clock is 0; a guest waits for the host); echo bonus once on felling it, descend bonus on every new floor; echo way on at the top centre (`roomExit`, no new rooms, the Crypt's arena data is untouched); `WorldState.enemyScale` applied at spawn (HP) and in `landHitOnPlayer` (damage).
  - Game: modo puro via `runUpgrades`, clock ticked per simulation step on the host/solo, music by band, echo name card ("Eco del guardián"), coins x0.5 (HUD count too), result `eclipse` (end screen plays the victory stinger).
  - Numbers: start 8:00; descend +40 s, -2 s per floor, min 15 s; echo +60 s; low under 30 s; echoes every 5 floors (Aegislash, Trevenant, Decidueye); HP +8 %/floor (cap x4), damage +5 %/floor (cap x3), echo HP x0.6; spawns 1 + 0.34/floor + jitter 1, max 5; collapse from floor 2 at 8 % (+1 %/floor, max 22 %), Niebla from floor 3 likewise; music bands Crypt/Forest every 5 floors; coins x0.5.
  - Decisions: "Restart floor" does not rewind the clock (no free time); the echo bonus is paid when the echo's room is cleared, the descend bonus when the next floor loads.
  - Evidence: `tests/core/endless.test.ts` (18 tests) written before the run changes: 10 failed RED (plan, urgent rates, scaling, clock, modo puro), the helper tests for `core/endless.ts` passed at once since that module was written first. GREEN after the run/world/hits changes. Mutation check: dropping the `echoPaid` guard fails the echo test. Crypt characterisation tests unchanged and green. `npm test` 88 files / 804 tests passed, typecheck ok.
- [x] T3 Clock HUD, entry card, end screen, leaderboard, daily seed (route: inline writer, this agent; app, adapters, town)
  - `src/town/leaderboard.ts`: its own key `mazmorra-sombria.endless` (the run records' shape and tests stay as they were), `recordScore` (floor desc, time left desc, a full tie keeps the older ahead, top 10, rank or null), tolerant `parseBoard`, `saveScore`, `scoreLine`, `leaderboardLines` (two scores per board page so the dialog never overflows; top 5). The town notice board appends its pages.
  - `src/adapters/clock-hud.ts`: clock at the top centre, red with a pulse under 30 s (`clockLook`), a `click` tick per whole second while low (`tickDue`), "+40 s" under it when time is added; drawn by the renderer from `RenderFrame.clock`.
  - `src/app/endless-entry.ts`: entry card (subtitle, modo puro, clock rules, today's daily seed and UTC date, best mark, "♪ title") with Reto diario / Libre / Volver. `main.ts`: `enterDungeon` (select, town exit and retry go through it for the Sima), `endlessSeed(mode, day, random)`, `endlessScore` records every peer's score (mode read back from the seed with `modeOfSeed`), end screen column "Sima del Eclipse" (mode + date, time left, rank, top 3 with this run highlighted) plus the existing seed line; the coins multiplier line reads "Tarifa de la sima" there. Dev: `?screen=endless`, `?screen=eclipse`, `?clock=ms`.
  - Echo floors: the echo name card ("Eco del guardián · Planta N") replaces the floor card; `isBossFloor` is false on echoes, so no guardian cinematic plays there (bug found in the screenshots: the full Aegislash cinematic opened on floor 5).
  - Evidence: `tests/town/leaderboard.test.ts` RED observed (module missing) then GREEN; board paging test changed first and RED, then GREEN; `isBossFloor` echo assertion RED then GREEN; `tests/adapters/clock-hud.test.ts` and the `endlessSeed`/`modeOfSeed` test were written with their code (no RED). Screenshots (headless Firefox, `media.volume_scale` 0 and `muted: true` stored before load) in `/tmp/endless/`: `01-end-screen` (dev eclipse end with score column), `02-town-after-run` ("Volver al pueblo" opened the town, not the title), `03-entry-card`, `04-hud-clock-a/low-b/low-c` (red 0:29), `05-board-leaderboard`, `06-eclipse-end-real` (a real run with `?clock=3000` ended as an eclipse, score #1 stored), `07-echo-name-card`, `07-echo-fight`. `npm test` 90 files / 814 tests passed, typecheck ok.
  - Not verified: the tick sound and the pulse by ear/eye in motion (muted runs, stills only); the end screen at 1024x640 pushes its buttons under the footer notice (same as other long end screens; `index.html` is outside this writer's edit surface).
- [x] T4 Co-op clock + docs (route: inline writer, this agent; net, game, lobby, docs)
  - Net: reliable `{ t: 'clock', ms, floor }` (protocol), `sendClock` (host only) and `takeClock` (guest; only from the roster's p1, finite and >= 0, latest wins); `begin(dungeon, runSeed)` lets the host fix the seed at Start.
  - Game: the host sends its clock every 1000 ms of simulated time, on every floor change and when it reaches 0; a guest ticks its own copy for a smooth display, takes the host's when it arrives and ends with `eclipse` when the host's reaches 0 (its own reaching 0 never ends it). Lobby: with the Sima picked, a "Modo" row (Reto diario / Libre) appears for the host; Start sends the daily seed or the room's random seed. Guests record their own score; its mode is read back from the seed.
  - Docs: GDD §3 "Sima del Eclipse" and a §10 bullet (Spanish, provisional values, no em dashes); README: the Sima, return to town, `?clock=`, `?screen=endless|eclipse`.
  - Evidence: `tests/net/endless-clock.test.ts` RED observed (3 failing: no `clock` message, `begin` ignored the seed, no `takeClock`), then GREEN. Two-tab `?net=local` run in headless Firefox (`/tmp/endless/08-coop-*`): the guest joined the host's Sima run and showed the clock, but headless Firefox stops `requestAnimationFrame` in the background tab, so the host's simulation (and its clock messages) stood still once the guest tab opened; the host-to-guest clock sync was therefore not observed in a browser, only in the session tests. `npm test` 91 files / 817 tests passed, `npm run build` ok.

## Acceptance criteria
- Every end screen leads to the town; quitting a run leads to the town; the title still starts the adventure.
- The Sima del Eclipse is listed from the first run; its floors never run out; every 5th floor is an echo.
- The clock never goes negative, only stands still in a paused solo run, gains time on descending and on echoes, and ends the run as an eclipse at 0.
- The daily seed depends only on the UTC date.
- The leaderboard keeps the best 10 by floor then time left.
- Modo puro: no upgrade bonus in the endless dungeon; other dungeons keep them.
- Coins x0.5 in the endless dungeon.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 5 | grep -ic co-authored` = 0, headless screenshots in `/tmp/endless/`.

## Forecast
About 1300 authored lines over 4 tasks (T1 ~120, T2 ~500, T3 ~500, T4 ~200). Above the ~400 slice budget; the delivery decision stays with the parent.

## Progress
Created 2026-10-25 on `feat/endless-dungeon` from `main` 4c90a5d.
- Engram mirror: pending (this writer has no Engram session; the parent owns the mirror).
