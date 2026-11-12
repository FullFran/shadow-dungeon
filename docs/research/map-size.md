# Floor and room size: Mystery Dungeon vs ours

Owner request (2026-11-12): floors feel too small; harder tiers should be bigger; wave rooms need a minimum size (players complain). Implementation: `odd/tasks/map-size.md`.

## 1. Pokémon Mystery Dungeon (public knowledge, not measured here)

Figures come from community documentation of the Explorers-era generator (pmdsky-debug and fan write-ups) and play experience. They are approximate; Rescue Team DX keeps the same structure.

| Aspect | Mystery Dungeon |
|---|---|
| Floor size | Fixed 56 x 32 tiles; small layouts use only part of it. |
| Layout | A grid of cells (up to about 6 x 4); each cell holds a room or a corridor junction ("dummy room"). Layout types: large, medium, small, one big room, "outer ring", "cross", and so on. |
| Rooms per floor | Usually 2 to 9; a "room density" parameter per dungeon floor range. |
| Room size | Random inside its cell, roughly 5 x 4 up to 15 x 10 or so; the cell bounds cap it. |
| Corridors | 1 tile wide, L-shaped or with a bend, from a few tiles to about 20+; extra connections add loops; dead ends exist. |
| Monster House | A normal room flagged as the house, chosen among the existing rooms; bigger rooms make it more dangerous because more enemies fit. Its size is not guaranteed. |
| By depth / dungeon | Each floor range of a dungeon has its own layout type, density, item and trap counts; later and harder dungeons tend to use larger layouts and more rooms. Floor size grows with the dungeon, not with a difficulty setting (there is none). |
| Scale | One Pokémon is one tile, turn-based. A floor is about 30 to 60 tiles from start to stairs. |

## 2. Ours, before this change (measured)

Generator: `src/core/dungeon.ts:110` `generateFloor` with `DUNGEON` (`src/data/dungeon.ts:11`): 40 x 28 tiles, 3 x 2 cells (cells 12 x 13), 4 to 6 rooms, rooms 5-9 x 4-8, 2-tile L corridors (`src/core/dungeon.ts:169`), 1-2 extra loops. One size for every tier.

Measured over 2000 seeds (floors 1-8, Crypt pool):

| Metric | min | median | p90 | max |
|---|---|---|---|---|
| Walk start to stairs (tiles) | 16 | 36 | 45 | 67 |
| Walkable tiles | 220 | 313 | 362 | 443 |
| Rooms | 4 | 5 | 6 | 6 |
| Room width x height | 5 x 4 | 7 x 6 | 9 x 8 | 9 x 8 |
| Wave room (as chosen) | **5 x 4** | 7 x 6 | 9 x 8 | 9 x 8 |

The wave room was any room but the start and the stairs room (`src/core/sima-events.ts:127` before the change; the gate's fallback `src/core/run.ts` `waveRoomOf` took the first such room), so it could be a 5 x 4 room: 3 x 2 inner tiles for 2-4 waves of 2-3 enemies.

At 140 px/s (`src/data/tuning.ts:14`, 4.4 tiles/s) the median straight walk to the stairs is 8 s. Our floor is 64 % of a Mystery Dungeon floor's area, and our bodies are about one tile (player radius 10 px, tile 32 px), so the room counts are comparable but the walk is short.

## 3. What size touches

| System | Depends on size? | Where |
|---|---|---|
| Threat budget | Per room (`src/core/dungeon.ts` `budgetedRoom`, `roomBudget`): more rooms, more enemies per floor; room density unchanged. | `src/data/encounters.ts`, dungeon `spawns.budget` |
| Enemy counts | 0-3 per room by budget; per floor = rooms x budget. | |
| Berries | Per room chance (`src/core/berries.ts:22`): healing grows with rooms. | |
| Collapse, gas | Fronts advance along the walking distance at a fixed speed (`src/core/collapse.ts:33`, `src/core/gas.ts:28`): they scale with any floor size by construction. | `COLLAPSE`, `GAS` |
| Fog, flood | Fixed clocks (`FOG.closeMs` 50 s, `FLOOD.riseMs` 45 s): a longer walk means more time under them. | `src/core/fog.ts`, `src/core/flood.ts` |
| Sima clock | Fixed bonus per floor (`descendBonusMs`, 40 s shrinking to 15 s): a longer floor costs more clock. | `src/core/endless.ts:78` |
| Minimap | 4 HUD px per tile (3 on touch): 160 x 112 px for 40 x 28; the touch caption and the location plaque assume 40 columns. | `src/ui/hud-layout.ts` |
| Floor layer | One canvas of cols x rows x 32² px painted once per floor. | `src/adapters/floor-layer.ts:626` |
| Net snapshot | Tiles are never sent (every peer generates the floor from the seed and the host's tier); only entity count grows. | `src/net/protocol.ts` |
| Expected level (one-hit cap, boss bands) | Measured on generated floors through `generatedFloor`; kept on Easy's shape after this change so the bands do not move. | `src/core/fairness.ts:44` |
| Fixed arenas, shrine | Not generated: unaffected. | `src/data/rooms.ts` |

## 4. Recommendation (implemented, provisional)

Floor shape by tier (`FLOOR_SHAPES`, `src/data/dungeon.ts`), Easy unchanged:

| Tier | Map | Cells | Rooms | Room size | Median walk | walkScale | Walkable tiles (median) | Enemies / floor (mean) |
|---|---|---|---|---|---|---|---|---|
| Easy | 40 x 28 | 3 x 2 | 4-6 | 5-9 x 4-8 | 36 | 1 | 315 | 5.7 |
| Normal | 44 x 30 | 3 x 2 | 4-6 | 5-10 x 4-9 | 41 | 1.15 | 366 | 5.7 |
| Hard | 52 x 38 | 4 x 3 | 5-7 | 5-10 x 4-9 | 52 | 1.45 | 551 | 7.2 |
| Nightmare | 58 x 40 | 4 x 3 | 6-8 | 5-11 x 4-9 | 60 | 1.65 | 636 | 8.7 |

(1000 seeds per tier, floors 1-6, Crypt pool; `tests/core/map-size.test.ts` re-measures walkScale.)

- More cells than rooms on Hard and Nightmare: the extra cells are junctions, so the floor is longer to cross, like Mystery Dungeon's dummy rooms, without crowding it.
- Rooms keep their density (the 2026-10-25 rule "harder rooms never have more enemies"); the floor has 1-2 more rooms.
- Clocks: fog closing, flood rise and the Sima's descent bonus stretch by `walkScale`. Collapse and gas need nothing.
- Minimap: keeps Easy's footprint; the tile shrinks (2.76 HUD px on Nightmare).

Wave room (`WAVE_ROOM`): a floor that will hold one (its wave gate or its rolled event, known from the seeds before generating, `holdsWaveRoom` in `src/core/floor-spawns.ts`) gets a hall of 11-14 x 9-10 floor tiles, spanning two cells where one is too narrow (Easy, Hard), never the start or the stairs room. Floors without a wave room keep exactly their old draws (Easy's golden digest only changes on wave floors).

## 5. Costs measured

Floor-layer paint (`paintFloor`, Chromium headless, desktop, Crypt floor 2, median of 12 seeds):

| Tier | Size | Before | After | Layer memory |
|---|---|---|---|---|
| Easy | 40 x 28 | 33-47 ms | 47 ms | 4.4 MB |
| Normal | 44 x 30 | 33 ms | 39 ms | 5.2 MB |
| Hard | 52 x 38 | 33 ms | 62 ms | 7.7 MB |
| Nightmare | 58 x 40 | 37 ms | 74 ms | 9.1 MB |

One-off per floor, roughly proportional to area; a slow phone may take 3-4x (a hitch of about 0.25 s on Nightmare at floor entry). Generation itself stays under 0.3 ms.
