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
- [x] T2 Town map and walking scene, title entry "Pueblo" (route: inline in this writer; one module group plus a 9-line hook, no delegation trigger)
- [x] T3 NPCs, dialog, notice board, exit window (route: inline in this writer; new modules under src/town, no delegation trigger)

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
- Only 11 crops copied at first (ground 9-patch + grass, three houses, hut, stall, signpost, two trees, bush, stump), ~6 KB in total; crop rectangles listed in the LICENSE note. Revised in T3: 10 crops (see T3).
- CREDITS.md: Tiles section as prose (a table row would be counted as a sprite artist by the credits screen test). Check: `tests/app/credits.test.ts` 2 passed.
- The repository pack has no dedicated notice board, gacha machine or market stall beyond a raised orange platform; the signpost and platform stand in.

### T2 Town map and walking
- Data `src/data/town.ts`: 32x22 tiles (`F` forest ring two tiles thick, `.` grass, `,` road), props with bottom solid rows (stall, shop, notice board, storyteller tree with stumps, three houses, trees, bushes), three NPC spots, spawn on the plaza, exit on the east edge (31, 10-11).
- Pure `src/town/map.ts` (TileGrid, flood fill, path 9-patch cell) and `src/town/interact.ts` (walk step with the core `confineCircle`, same speed and radius as the run; interaction range 48 px; exit test).
- Scene `src/town/scene.ts` + `src/town/render.ts`: own canvas and rAF loop that stops when the page replaces the canvas; WASD/arrows, camera follow (`followCamera`, `cameraView`); ground at 2x, y-sorted props and characters, red multiply tint, fixed sky band at the top of the view with the eclipse, far ruins and a fade, embers (`emberAt`, `hash01` from `src/ui/eclipse.ts`).
- Decision: a following camera only shows a north sky when the player stands at the north edge, so the sky is a fixed band at the top of the view (the camera may scroll 64 px up under it so the north edge is never hidden).
- Hook in `src/app/main.ts`: "Pueblo"/"Town" appended as the last title entry (indices of the other entries unchanged, Enter still plays), `townScreen` (route exit -> `loadout`, the same function as "Jugar"; Esc -> title), dev `?screen=town`. i18n: `town.menu` starts the `town.*` block at the end of both catalogs.
- Checks: RED observed (modules missing), GREEN 17 town tests (map validity: every floor tile reachable from spawn, NPCs off walls and reachable within range, board readable, exit on the edge and reachable, a sealed-pocket map is detected; walking speed, forest stop, exit reached; interaction range). Full suite 445 passed except the two T3 RED files (dialog, records) not yet implemented; typecheck clean.
- Screenshots (headless Firefox over WebDriver BiDi, 1024x640, pixel scale 2): `/tmp/hub-town/spawn.png`, `/tmp/hub-town/north.png`. Fixed after looking: tint too strong (grass read orange), notice too large (now the in-game size), road too wide (now two rows with spurs). Scale: one 16 px tile at 2x = 32 world px; Mimikyu (32x48 frame) stands about one tile tall next to 3-tile houses.

### T3 Interaction
- NPCs from existing sheets only: gacha stall Mimikyu, upgrade shop Poochyena, storyteller Gastly (floats, bobbing). Aegislash was not used for the shop: it is the dungeon boss. NPCs face the player within four tiles.
- Prompt "E / Enter: hablar" ("leer" at the board) over the nearest target within 48 px; E, Enter or Space opens the dialog; MD-style dialog box on the canvas (`drawPanel`, gold speaker name, word wrap, blinking "more" marker) with a typewriter at 40 characters/s (`src/town/dialog.ts`): first confirm finishes the line, next goes on, last closes; Esc closes. Movement stops while a dialog is open.
- Gacha and shop: one placeholder line, then "Próximamente." Storyteller: three placeholder lines about the eclipse and the Cripta del Rey Espada (es/en).
- Notice board: reads `mazmorra-sombria.records` (`{bestFloor, runs}`) through the storage port, read-only; missing, broken or hostile values read as "no records" (`src/town/records.ts`). Nothing writes the key yet: the run flow should record it later.
- Route exit: the destination window (DOM `mdWindow` + `cursorList`, "Cripta del Rey Espada" / "Quedarse en el pueblo"); the crypt calls `loadout` (same as "Jugar"); staying or Esc steps the player back off the exit.
- i18n: `town.*` block (21 keys) contiguous at the end of es.json and en.json.
- Visual fixes after screenshots: the signpost crop read as a grave cross, replaced by two posted planks (`144,176,32,16`, a 2x1 board); the orange hut was a slice of a larger ruin (a sign leaked in), dropped for a second wooden house; dialog lifted clear of the fan notice; board text on one line; camera centres the player below the sky band and the spawn moved to the shop door so the NPC row is on screen on arrival.
- README: a Town paragraph (controls, NPCs, exit, `?screen=town`).
- Checks: RED observed for dialog and records (modules missing), GREEN: 26 town tests (adds typewriter timing, time-split independence, confirm flow, word wrap, records parsing). `npm test` 54 files / 454 tests passed; `npm run build` ok (tiles copied to `dist/tiles/town`).
- Screenshots `/tmp/hub-town/`: `spawn.png` (NPCs, board and shop in view), `prompt.png` (talk prompt over Gastly), `dialog-typing.png` and `dialog.png` (storyteller, Spanish), `board.png` (records typing), `exit.png` (destination window), `after-depart.png` (loadout reached). BiDi check: the title lists Play|Play online|Settings|Credits|Town; Up from Play wraps to Town; choosing the crypt removes the town canvas and opens the loadout.

## Next steps
- The run flow should write `mazmorra-sombria.records` (best floor, run count) so the board has data.
- Real NPC species and story text (prologue writer), gacha and shop logic.
- `tools/fetch-sprites.mjs` regenerates CREDITS.md whole and would drop the Font and Tiles sections.
- Online: walking together in town (later).
