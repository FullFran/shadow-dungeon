# Town and dungeon tilesets: shortlist

Research date: 2026-10-25. Every license below was read on the linked page on that date. The quotes come from the page itself (the itch.io "More information" row, the OGA license badge, or the description). Nothing has been downloaded. File contents (like tile inventories and palettes) are **not** verified unless a row says so.

Constraint: no ripped Nintendo or PMD tiles. Characters are PMDCollab SpriteCollab sprites, about 24–48 px, drawn in a soft 3/4 top-down view.

## Recommendation

**Main pack: Ninja Adventure (pixel-boy), CC0, 16 px.** It gives the town and most props. Two more packs fill specific gaps:

| Role | Pack | License | Why |
|---|---|---|---|
| Hub town (plaza, houses, stalls, trees, paths, UI) | Ninja Adventure | CC0 | It is the largest single CC0 16 px pack with exterior and interior tiles, autotiled floors, UI and effects. Its soft, rounded palette sits close to PMD. It also has villages (Desert Village, Ruin Village), so one artist covers several areas. |
| Alternate town (if Ninja Adventure looks too chibi) | Serene Village Revamped (LimeZu) | CC BY 4.0 | The soft 16 px pastel style is the closest to Treasure Town. Credit is required. |
| Crypt, flooded caves, toxic swamp (backup or variety) | Dungeon Crawl 32x32 tiles | CC0 | It has 3000+ tiles in a 3/4 view and covers every dungeon theme. The catch is the style, see below. |
| Swamp props | The Magic Market (GFragger) | CC0 | A swamp-themed 16 px bazaar with animated water and 200+ props. It also suits the gacha and shop stalls. |
| Misty or dead forest | Eman Quest forest & dungeon (Night Blade) | CC0 | Includes "Death forest", "Ice forest" and "Cave lava". The files are stored at 64 px but drawn at 16 px. |

Reasons:
- **Everything above is CC0 except LimeZu.** No share-alike rules reach the game code or the PMDCollab-sprite credits, and the web build can serve the PNGs without legal worry.
- **Use 16 px tiles drawn at 2x (32 px on screen).** At that scale a 24–48 px PMD sprite stands about 1–1.5 tiles tall, which matches PMD's proportions. 32 px source tiles (LPC, Dungeon Crawl) make PMD sprites look small, unless the map is drawn at 1x and the sprites at 1x.
- **Red eclipse sky.** None of these packs has an eclipse. The plan is to tint each layer with a global red multiply/overlay (a shader or a canvas `globalCompositeOperation`) and draw the sky separately. This also hides small palette differences between packs.
- **Dungeon gap.** None of the packs covers crypt, misty forest, flooded cave and toxic swamp in one consistent 16 px soft style. Plan to recolor Ninja Adventure floors and walls per biome, which CC0 allows: green-toxic, blue-flooded, gray-crypt. Use Dungeon Crawl or Szadi only where something is missing.

## Per-need tables

### Town (plaza, houses, stalls, notice board, trees, paths, route exit)

| Pack | Tile | License (quoted) | Covers | Style fit |
|---|---|---|---|---|
| [Ninja Adventure](https://pixel-boy.itch.io/ninja-adventure-asset-pack) | 16 | "Creative Commons Zero v1.0 Universal"; "Attribution is not required but appreciated." | "Tilesets ( Floor autotilling, exterior and interior element etc )", "UI element", villages (devlog Update #4: Desert Village, Ruin Village) | Good: soft and rounded |
| [Serene Village Revamped](https://limezu.itch.io/serenevillagerevamped) (LimeZu) | 16 | "Creative Commons Attribution v4.0 International" | Village exterior, Construct 3 autotiles, works with Modern Interiors | Very good: pastel, closest to PMD towns |
| [Kenney Tiny Town](https://kenney.nl/assets/tiny-town) | 16 | "Creative Commons CC0"; Kenney support: "Attribution is not required" | Town, overworld (tags) | Fair: flat and very simple, looks small next to PMD |
| [Kenney Roguelike/RPG pack](https://kenney.nl/assets/roguelike-rpg-pack) | 16 | "Creative Commons CC0" | Town, furniture, panels (1700 files) | Fair: flat, harder outlines |
| [Zelda-like tilesets](https://opengameart.org/content/zelda-like-tilesets-and-sprites) (ArMM1998) | 16 | "CC0" | "Overworld tileset including castle, houses and some decoration", Indoors, Cave, UI | Good: GBC/GBA-like |
| [Tiny 16: Basic](https://opengameart.org/content/tiny-16-basic) (Sharm) | 16 | "CC-BY 4.0", "CC-BY 3.0", "OGA-BY 3.0"; "Please credit Lanea Zimmerman." | Overworld, basic dungeon, shop signs | Fair: DB16 palette, harsher |
| [Town tiles](https://opengameart.org/content/town-tiles) (surt) | 16 | "CC0" | Small "Fantasy town tiles" sheet (2.9 KB) | Filler only |

### Crypt

| Pack | Tile | License (quoted) | Notes |
|---|---|---|---|
| [Dungeon Crawl 32x32](https://opengameart.org/content/dungeon-crawl-32x32-tiles) | 32 | "CC0"; "No attribution is required." | "orthogonal (overhead) three-quarters perspective". The theme coverage (crypt, tomb, swamp, cave floors) comes from DCSS and is **unverified** in this zip. The look is darker and more detailed than PMD. |
| [0x72 DungeonTileset II](https://0x72.itch.io/dungeontileset-ii) | 16 (walls 16x32) | "Creative Commons Zero v1.0 Universal"; "You can use this tileset for whatever you like" | A stone dungeon with tall walls. The tall walls suit a 3/4 view. It is saturated and has hard outlines. |
| [Kenney Tiny Dungeon](https://kenney.nl/assets/tiny-dungeon) | 16 | "Creative Commons CC0" | Dungeon and sewer tags. Flat. |
| [Rogue Fantasy Catacombs](https://szadiart.itch.io/rogue-fantasy-catacombs) (Szadi) | 16 | "Public domain and free to use, personal or commercial." "Credit is not required but appreciated." "...but not resell the asset pack (original or changed)." | A custom license, not CC0. The no-resale rule is fine for a game. It has an animated torch and candle and fits a crypt best. |
| [Tiny Top Down Pack](https://opengameart.org/content/tiny-top-down-pack) (Screaming Brain) | 32 | CC0 (per search result; **page not opened**) | Walls, floors, doors. |

### Misty forest

| Pack | Tile | License (quoted) | Notes |
|---|---|---|---|
| Ninja Adventure (nature tileset) | 16 | CC0 (above) | Fog comes from an overlay. |
| [Eman Quest forest & dungeon](https://opengameart.org/content/forest-and-dungeon-tilesets-from-eman-quest) (Night Blade) | 16 (stored at 64) | "CC0" | "Death forest", "Ice forest", recolored trees, skull. |
| [Hyptosis tiles](https://opengameart.org/content/lots-of-free-2d-tiles-and-sprites-by-hyptosis) | 32 (batch5 is 16) | "CC-BY 3.0"; "Please credit Hyptosis and Zabin" | Rich painterly forest, cave, castle and house tiles. 32 px. Unfinished. |

### Flooded caves

| Pack | Tile | License (quoted) | Notes |
|---|---|---|---|
| Zelda-like tilesets (ArMM1998) | 16 | "CC0" | Has a "Cave tileset". Recolor it blue and add a water layer. |
| Ninja Adventure (water tileset) | 16 | CC0 | Water and autotile floor. |
| Eman Quest | 16 | "CC0" | "Cave lava (auto-tiles)". Recolor it to water. |
| Dungeon Crawl 32x32 | 32 | "CC0" | Has deep and shallow water (**unverified** in this zip). |

### Toxic swamp

| Pack | Tile | License (quoted) | Notes |
|---|---|---|---|
| [The Magic Market](https://gfragger.itch.io/the-magic-market) (GFragger) | 16 | "Creative Commons Zero v1.0 Universal"; "You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission." | A swamp bazaar with animated water and 200+ props. |
| Dungeon Crawl 32x32 | 32 | "CC0" | Has swamp/bog floors (**unverified**). |
| Recolored Ninja Adventure water and grass | 16 | CC0 | Green-purple palette swap. |

### UI-ish props (notice board, stall, gacha machine, signs, chests)

| Pack | License | Notes |
|---|---|---|
| Ninja Adventure | CC0 | "UI element", "60+ Items", "30+ visual effect", "2 Font", facesets. |
| The Magic Market | CC0 | Over 200 market props, which suit the gacha stall and upgrade shop. |
| Kenney Roguelike/RPG pack | CC0 | Panels and buttons (tags). |
| Tiny 16: Basic | CC BY | Shop signs, treasure. |

## Attribution lines (put them in the credits screen)

CC0 needs no credit. Crediting anyway is good practice and was asked for on several pages.

- Ninja Adventure Asset Pack by Pixel-boy & AAA — https://pixel-boy.itch.io/ninja-adventure-asset-pack — CC0 1.0. (The co-author credit "AAA" is from memory and is **unverified**. The page shows only pixel-boy.)
- Serene Village Revamped by LimeZu — https://limezu.itch.io/serenevillagerevamped — licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). (Required if used. State any modifications.)
- The Magic Market by GFragger — https://gfragger.itch.io/the-magic-market — CC0 1.0.
- Forest and dungeon tilesets from Eman Quest by Night Blade — https://opengameart.org/content/forest-and-dungeon-tilesets-from-eman-quest — CC0.
- Zelda-like tilesets and sprites by ArMM1998 — https://opengameart.org/content/zelda-like-tilesets-and-sprites — CC0.
- Dungeon Crawl 32x32 tiles, Chris Hamons and the Crawl tile artists — https://opengameart.org/content/dungeon-crawl-32x32-tiles — CC0.
- 16x16 DungeonTileset II by 0x72 — https://0x72.itch.io/dungeontileset-ii — CC0.
- Kenney (Tiny Town / Tiny Dungeon / Roguelike RPG) — https://kenney.nl — CC0.
- Tiny 16: Basic by Lanea Zimmerman (Sharm) — https://opengameart.org/content/tiny-16-basic — CC BY 4.0. (Required if used.)
- Tiles by Hyptosis and Zabin — https://opengameart.org/content/lots-of-free-2d-tiles-and-sprites-by-hyptosis — CC BY 3.0. (Required if used.)
- Rogue Fantasy Catacombs by Szadi art — https://szadiart.itch.io/rogue-fantasy-catacombs — custom license (free use, no resale).

## Copyleft (flagged, not rejected)

| Pack | License (quoted) | What it means |
|---|---|---|
| [LPC base assets](https://opengameart.org/content/liberated-pixel-cup-lpc-base-assets-sprites-map-tiles) / [LPC Tile Atlas](https://opengameart.org/content/lpc-tile-atlas) | "CC-BY-SA 3.0", "GPL 3.0"; "Images are copyright their respective authors, as listed in CREDITS.TXT." | You may pick either license. Under CC BY-SA, any **modified** tiles (recolors, eclipse versions) must be released under CC BY-SA too. The credits must name every artist in CREDITS.TXT, and there are many. GPL is a poor fit for art in a web bundle. The tiles are 32 px, so PMD sprites look small next to them. A commenter reports misaligned door ornaments and windows. Sharm's and Redshrike's pieces are also offered under OGA-BY 3.0, which has no share-alike rule. |
| CodeSpree "Seamless 64px RPG Tiles" / "Top-down RPG Assets" (OGA) | CC BY-SA 4.0 (per search result; **page not opened**) | 64 px with a swamp tag. Share-alike, and the scale does not match. |

## Rejected

| Pack | Reason (quoted) |
|---|---|
| [Pipoya Free RPG World Tileset](https://pipoya.itch.io/pipoya-free-rpg-world-tileset-32x32-40x40-48x48) | "Not redistribute or resell this assets." A web game serves the PNGs publicly. Commercial use is allowed, but the no-redistribution clause is unclear for an open web build, so it is rejected to be safe. |
| [Mystic Woods](https://game-endeavor.itch.io/mystic-woods) (Game Endeavor) | Free tier: "You can only use these assets in non-commercial projects." and "You can not redistribute or resale, even if modified." NC-only plus no redistribution. |
| [Cainos Pixel Art Top Down Basic](https://cainos.itch.io/pixel-art-top-down-basic) | "You may not redistribute it or resell it." It is a custom license, mainly for Unity, and 32 px. |
| [Anokolisa free topdown pack](https://anokolisa.itch.io/free-pixel-art-asset-pack-topdown-tileset-rpg-16x16-sprites) | The license is only in a linked Google Drive "Terms" document that could not be read. The page itself has no license text. |
| inkBubi forest sample (OGA node/180257) | Tagged CC0, but its License.txt reportedly adds redistribution limits (per search snippet). The license is contradictory. |
| Any PMD/Nintendo rip (Spriters Resource, etc.) | Out of scope by project rule. |

## Style-match notes

- PMDCollab sprites use soft shading, few dark outlines, and pastel-to-mid saturation. Ninja Adventure and LimeZu fit best. 0x72, Kenney and Sharm (DB16) are harsher or flatter and need a palette pass. Dungeon Crawl is detailed and dark: it works for dungeon floors under fog and darkness, but looks off in the town.
- Mixing packs: keep one pack per scene (the town is Ninja Adventure only), and change packs only at scene cuts. The global eclipse tint makes these changes less noticeable.
- Ninja Adventure characters are chibi 16 px ninjas. Use only its tiles and props, and leave out its characters, so PMD sprites stay the only cast.

## Unverified (check before use)

- The full Ninja Adventure tile inventory, in particular whether a dungeon/cave tileset is included. A page comment speaks of a dungeon as a *future* addition. Verify after download.
- Whether Dungeon Crawl 32x32 actually holds crypt, swamp and water floors (inferred from DCSS).
- Tiny Top Down Pack and the CodeSpree licenses (search snippets only).
- Whether the LimeZu Serene Village license row is the only term that applies. No extra restrictions were seen, but LimeZu's other packs use custom licenses. Re-check the downloaded zip for a license file.
- Palettes and visual fit are judged from page descriptions only. No previews have been composited next to PMD sprites yet.

## Key Learnings

1. Ninja Adventure (pixel-boy) is a 16x16 asset pack with town tiles, interiors, UI and effects, licensed CC0 1.0 per its itch.io "More information" row.
2. LimeZu's Serene Village Revamped is listed under CC BY 4.0 on itch.io, unlike LimeZu's other packs, which use custom licenses.
3. Pipoya's free RPG World tileset forbids redistribution ("Not redistribute or resell this assets"), which conflicts with serving PNGs from a public web build.
4. Mystic Woods' free tier is non-commercial only and forbids redistribution, so it fails a redistribution-in-web-game requirement.
5. No single free pack found covers town plus crypt, misty forest, flooded caves and toxic swamp in one consistent soft 16 px style. Recoloring a CC0 base pack per biome is the practical route.
