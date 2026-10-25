# Hub town

## Objective
Turn the start of the game into a small walkable town (in the spirit of Treasure Town / Pokémon Square, no copied assets): the player walks around a plaza under the red eclipse, talks to NPCs, reads a notice board and leaves by a route to the dungeon.

## Problem
The title menu is a list of windows. The user (2026-10-25) wants a starting town: "a route out to the dungeons, an NPC for the gacha, the upgrade shop, a notice board with records, a storyteller NPC; under the red eclipse sky; online lobby later becomes walking together in town". Enter on the title must still play directly.

## Scope
- T1 Tiles: Ninja Adventure (pixel-boy, CC0, 16 px, drawn at 2x = one 32 px world tile). License confirmed on the page itself, only the PNGs used copied to `public/tiles/town/` with a LICENSE note; CREDITS.md gets a Tiles section.
- T2 Town map: hand-authored map in `src/data/town.ts` (plaza, gacha stall, shop, notice board, storyteller spot, trees, paths, a route exit at one edge), collision through the core `TileGrid`, the player's species sprite walking with WASD, camera follow, global red tint, eclipse sky band, ambient embers.
- T3 Interaction: NPCs from the existing sprites (Gastly storyteller placeholder), "E / Enter: hablar" prompt, MD-style dialog box with typewriter text (es/en placeholder lines); gacha and shop say "Próximamente"; notice board shows local records from localStorage if present (read-only, guarded); the route exit opens a destination window (Cripta del Rey Espada) that starts the run through the same flow as "Jugar".
- Title menu: one new entry "Pueblo" / "Town" (not first, so Enter still plays).

Out of scope: gacha and shop logic, story text, online walking together, new sprites.

## Constraints
- New modules only (`src/town/**`, `src/data/town.ts`, `public/tiles/**`); one small hook in `src/app/main.ts`. Other writers work in parallel.
- Core stays pure; the architecture test stays green. i18n keys in one contiguous block, es and en.
- Downloaded packs are untrusted data, kept outside the repo; only PNGs are extracted.
- CREDITS.md: the credits screen test counts every `| ` row as a sprite artist, so the Tiles section must not be a table. `tools/fetch-sprites.mjs` rewrites CREDITS.md whole (noted, out of surface).
- Conventional Commits, one work-unit commit per task, no AI attribution.

## Tasks
- [x] T1 Tiles: confirm license, fetch, copy used PNGs + LICENSE, CREDITS.md section (route: inline in this writer)
- [ ] T2 Town map and walking scene (route: inline in this writer)
- [ ] T3 NPCs, dialog, notice board, exit window, title entry (route: inline in this writer)

## Acceptance criteria
- Every walkable tile is reachable from spawn; every NPC and the exit are reachable and no NPC stands on a wall (tests).
- Dialog typewriter timing and interaction range are covered by tests.
- Title: "Pueblo" opens the town, "Jugar" still first; the town exit starts a run.
- Tiles at 2x read at the same scale as the PMD sprites (screenshots).

## Checks
`npm test`, `npm run build`, headless Firefox screenshots in `/tmp/hub-town/` (spawn, NPC dialog, exit window).

## Progress
Created 2026-10-25. Forecast ~900 authored lines. Delivery strategy: ask-on-risk (parent decides).

### T1 Tiles
- License re-read on https://pixel-boy.itch.io/ninja-adventure-asset-pack (2026-10-25): "Creative Commons Zero v1.0 Universal"; "Made by Pixel-Boy and AAA" (confirms the co-author the research doc had from memory).
- The 89 MB pack zip lives on an R2 storage host that this machine cannot reach (connect timeout, also outside the sandbox). Fallback: the author's Godot 4 project on GitHub (linked from the page, also offered there as "Godot Project V4.zip"), sheets `content/map/tileset_floor.png` and `tileset_village_abandoned.png`, fetched to `/tmp/hub-town-dl/` (outside the repo). The GitHub repo itself has no LICENSE file; the CC0 grant comes from the itch.io page. Sha256 of both sheets recorded in `public/tiles/town/LICENSE.txt`.
- Only 11 crops copied (ground 9-patch + grass, three houses, hut, stall, signpost, two trees, bush, stump), ~6 KB in total; crop rectangles listed in the LICENSE note.
- CREDITS.md: Tiles section as prose (a table row would be counted as a sprite artist by the credits screen test). Check: `tests/app/credits.test.ts` 2 passed.
- The repository pack has no dedicated notice board, gacha machine or market stall beyond a raised orange platform; the signpost and platform stand in.
