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
- [ ] T2 Endless core + data
- [ ] T3 Clock HUD, entry card, end screen, leaderboard, daily seed
- [ ] T4 Co-op clock + docs

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
