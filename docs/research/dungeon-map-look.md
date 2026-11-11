# Dungeon map look: research and plan

Owner request (2026-11-12): dungeon maps should feel nicer, less empty and closer to the Mystery Dungeon world, more like the Rescue Team DX remake. Reference from player ticket SD-LUI1QL: https://pokedive.com/ ("Mejora los graficos como en pokedive.com").

Scope: research only. No game code changed. Screenshots are kept out of the repo (internal analysis only).

## 1. References

### 1.1 PokeDive (pokedive.com)

What was reachable: the landing page only. "Play as guest" sits behind a Cloudflare Turnstile human check, so no automated capture of an actual dungeon run was possible (not bypassed, no account created). Seen: the live map rendered behind the login card (a forest route with a path and stairs) and three 300x200 cover thumbnails ("Rescata", "Construye", "Explora").

What makes it look good:

- **Tile scale.** Characters are about 1 tile tall and the camera shows roughly 30x17 tiles on a 1080p screen. Tiles are small relative to the screen, so the screen is full of detail instead of a few big flat squares.
- **No visible grid.** Grass is a noisy two to four tone dither with darker blotches a few tiles wide; the eye never sees a checkerboard. Paths are irregular dirt ribbons with ragged edges and pebble specks, not tile-aligned rectangles.
- **Walls are scenery, not blocks.** The "wall" between walkable areas is a dense canopy of round tree crowns, each crown shaded (light top-left, dark bottom-right) with a dark shadow band where the canopy meets the ground. Cliff edges have a visible earth face several pixels tall with a grass lip on top, and they meander instead of following tile edges.
- **Decoration density.** Every few tiles there is something: flower clusters (yellow, pink, blue), berry bushes, stumps, rocks, tall-grass patches the player walks through, roots. Decoration also sits on the edges (flowers at the base of the canopy).
- **Palette.** Mid-saturation greens with a cool shadow tone and warm earth; strong value contrast between walkable ground (lighter) and walls (darker but textured), so layout reads instantly.
- **Ambient effects.** One cover shows rain streaks over the whole scene; tall grass partly covers sprites.
- **Room shapes.** Organic: rounded clearings, winding paths, diagonal-looking cliff steps built from small tiles.

### 1.2 Pokemon Mystery Dungeon: Rescue Team DX (general public knowledge, no assets used)

- **Painterly, soft look.** Hand-painted textures with soft gradients and visible brush texture; no hard pixel checker. Light falls softly; corners and wall bases are darkened (ambient occlusion feel).
- **Per-dungeon identity.** Each dungeon has its own floor material, wall material, palette and props: forest floors with leaf litter and roots, caves with wet rock and puddles, volcanic floors with glowing cracks, icy floors with reflective sheen. You can tell which dungeon you are in from a single screenshot.
- **Walls with depth.** Walls are drawn as raised masses with a lit top and a darker front face, with irregular silhouettes (rocks, roots, tree trunks) instead of straight lines.
- **Water and hazards blended.** Water, lava and chasms have shaded edges, shorelines and gentle animation; they read as part of the terrain, not overlays.
- **Readable layout.** Despite the decoration, walkable space is always clearly lighter and calmer than walls; decoration stays low-contrast on the floor and high-detail on the walls.
- **Atmosphere.** Light haze, drifting particles (leaves, snow, embers), a slight vignette.
- **Minimap.** Clean flat overlay of explored rooms and corridors, items and stairs marked with simple icons.

## 2. What we have

Captured on the dev server (`?screen=run&dungeon=<id>&seed=3`, floor 1 and floor 4, 1280x720 and 844x390) for Crypt, Misty Forest, Flooded Caves, Toxic Swamp, two challenges (Abra, Piplup) and the Sima herald arena (`?boss=7`, floor 22). A generated Sima floor (`dungeon=eclipse-chasm`) could not be captured headless: skipping its intro cinematic returned to the title screen, so the Sima notes below come from the code (`abyssWallTile`, `abyssRim`).

Common to every dungeon (`src/adapters/renderer.ts` `tiles()`, TILE = 32, drawn at 2x):

- **Floor:** a two-colour checker (`tileFloorA`/`tileFloorB`), which differ by about 2% lightness (Crypt `#2a2731` vs `#2e2b36`). On screen it reads as a flat grey slab with a faint grid. No texture, no variation, no edge darkening except a 6 px shadow under walls.
- **Walls:** one flat top colour with two dark blocks per tile, a 12 px front face and a 1 px lip. The void beyond the wall top is a darker checker, so walls and void blur together; walls look like UI frames rather than terrain.
- **Shapes:** `src/core/dungeon.ts` places rectangular rooms in a 3x2 cell grid (40x28 map, rooms 5-9 wide) joined by L-shaped corridors. Every room is an axis-aligned rectangle; all dungeons share the same shapes for the same seed.
- **Scale:** at 2x, the 1280x720 view shows about 20x11 tiles; the player is about a third of a tile. Large flat floor areas dominate the screen.
- **Decoration per dungeon** (`*-decor.ts`): Crypt has candles on wall faces with warm glows, gravestones and cross marks; Forest has glowing mushrooms, fireflies, a few dead branches and logs; Caves has a handful of crystals and drips; Swamp has toxic pools, reeds, dead trees and spores. Density is low: two to five props per screen, mostly on wall faces.
- **Challenges:** all 24 Senda roads (8 lines x 3 chapters, `src/data/story/*.ts`) reuse one of four base looks (`base: 'crypt' | 'forest' | 'caves' | 'swamp'`, `BASES` in `src/data/dungeons.ts`). "The Path of the Frozen Lake" (Piplup chapter I, base `crypt`) looks exactly like the Crypt (candles, graves) while its text talks about ice: the theme and the art disagree.
- **Sima:** walls become an abyss (`abyssWallTile`) with floating islands; it is the one dungeon whose silhouette differs.
- **Herald arena (Sima, floor 22):** one large rectangle of blue checker, four plain pillars, a fog-wall band and a bonfire. The emptiest screen in the game: about 60% of the view is untextured floor.
- **Minimap:** shows explored rooms as flat blue blocks; fine, low priority.

Per dungeon, the gap in one line:

| Dungeon | Today | Gap vs references |
|---|---|---|
| Crypt | grey checker, candles, graves | no stone texture, no cracks/moss, walls flat, big empty rooms |
| Misty Forest | green checker, mushrooms, fireflies | no grass texture, walls are flat bands instead of trees/bushes, no flowers or paths |
| Flooded Caves | blue checker, few crystals | no wet rock, no water on the floor despite the name, walls flat |
| Toxic Swamp | olive checker, pools, reeds | best decorated; floor still flat, pools are perfect ellipses |
| Sima | abyss islands | silhouette is good; floors are the same checker |
| Herald arena | big checker square, 4 pillars, bonfire | no floor texture, no ruins or debris, pillars are flat boxes |
| Challenges / Sendas | base dungeon look | look contradicts their theme (ice, etc.) |

## 3. Recommendations

All art is our own pixel art, drawn with the `pixel-craft` rules (palette keys, prerendered static layers, ≤ 3 full-layer `drawImage` per frame). Impact is how much it closes the gap on screen; cost is rough engineering plus art time.

### 3.0 Enabler (do first)

**E1. Prerender the floor layer once per floor.** Today `tiles()` issues several `fillRect` per visible tile every frame. Bake the static floor, walls and static decor into an offscreen canvas (chunked, e.g. 16x16 tiles per chunk) when a floor starts, then `drawImage` the visible chunks per frame. Only collapse rubble, cracks, glows and animated props stay per frame.
- Impact: none visible by itself, but it makes every texture idea below free at runtime.
- Cost: S-M (1-2 days). Files: `src/adapters/renderer.ts` (`tiles`), the `*-decor.ts` static parts.
- Perf: a 40x28 map at 32 px is 1280x896 px (about 4.6 MB RGBA); fine on phones. Must be rebuilt on collapse (only the changed tiles) and freed between floors.

### 3.1 Quick wins (days each, big visual payoff)

**Q1. Textured floor instead of the checker.** Replace the A/B checker with 3-4 floor tones per palette, drawn as noise blotches spanning several tiles (seeded by `tileHash`), plus per-tile speckles (pebbles, grass blades, cracks) chosen from a small per-dungeon set. Kill the visible grid.
- Impact: very high; it is the single biggest "flat and empty" cause.
- Cost: S. Files: `renderer.ts`, palettes in `src/data/dungeons.ts` (new keys such as `floorC`, `floorSpeck`), a test that every dungeon and challenge palette defines them.
- Perf: zero per frame with E1; without E1, keep to 2-3 extra `fillRect` per tile.

**Q2. Contrast budget: light floor, dark textured walls.** Raise floor/wall value contrast (floor lighter, wall tops darker but textured) and add a soft ambient-occlusion band along every wall base and inner corner (2-3 graded rows, not one 6 px band).
- Impact: high; layout reads at a glance, like both references.
- Cost: S. Files: palettes, `tiles()`.
- Perf: none with E1.

**Q3. Wall tops as terrain per dungeon.** Draw wall-top masses with dungeon-specific motifs: Forest = round shaded tree crowns and bushes; Caves = rounded wet rock with highlights; Crypt = cut stone with cracks and moss; Swamp = mud banks with roots. Break the straight edge with 1-3 px irregular overhangs.
- Impact: very high; turns "rooms in a void" into "clearings in a forest".
- Cost: M (art per dungeon, 2-4 days each including the face). Files: `renderer.ts`, a new `src/adapters/wall-styles.ts` keyed by dungeon, palettes.
- Perf: none with E1.

**Q4. Decoration density pass.** Scatter low-contrast floor props (flowers, leaf litter, bones, puddles, pebbles) at 1 per 3-6 floor tiles, seeded, never on corridors' centre line or spawn/stairs tiles; add edge props hugging wall bases (grass tufts, rubble, roots). Reuse the `*-decor.ts` modules and add more kinds per dungeon.
- Impact: high; "menos vacíos".
- Cost: S-M. Files: `*-decor.ts`, `renderer.ts`; test that every dungeon has at least N decor kinds and that props never sit on stairs/spawn tiles.
- Perf: static props baked (E1); only animated ones per frame (cap per screen).

**Q5. Give challenges their own look.** Each Senda road declares its own palette and decor set instead of inheriting the base dungeon's (e.g. the Frozen Lake road gets an ice floor, frosted walls, snow motes).
- Impact: medium-high; fixes the art/text mismatch players will notice.
- Cost: S per road for palette + props reuse, M if new props. Files: `src/data/dungeons.ts` (`challenge`, `BASES`), story data, decor modules; a test iterating `CHALLENGES` and `SENDA_ROADS` that each has a palette distinct from its base.
- Perf: none.

**Q6. Ambient particles per dungeon.** Falling leaves (Forest), drips and light shafts (Caves), dust motes (Crypt), spores already exist (Swamp), ash (Sima). Pooled, fixed count (≤ 40 on screen), drawn as 1-2 px rects.
- Impact: medium; adds life.
- Cost: S. Files: decor modules, `renderer.ts`.
- Perf: low; cap count, skip on reduced-motion setting.

**Q7. Soft vignette and light pools.** A cached radial vignette sprite over the view, and cached glow sprites under torches, crystals and mushrooms (already partly done for candles). No full-canvas gradient per frame.
- Impact: medium; gives the soft DX mood.
- Cost: S. Files: `renderer.ts`.
- Perf: one extra `drawImage` per frame; within the pixel-craft budget.

### 3.2 Bigger work (weeks)

**B1. Organic room shapes.** Post-process `generateFloor`: round room corners, carve 1-2 tile bulges and notches, occasionally merge two rectangles (L or T rooms), add short pillars or rock islands inside big rooms, and widen corridors irregularly. Keep the cell graph (connectivity and spawn logic stay valid).
- Impact: very high; the strongest single change toward "real place" feel.
- Cost: M-L. Files: `src/core/dungeon.ts`, `src/data/dungeon.ts`; tests: connectivity, stairs reachable, spawns on floor, determinism per seed; `npm run prove` and sim harnesses must stay green.
- Perf: generation only; none at runtime. Risk: changes gameplay (lines of sight, kiting space); tune with the sim.

**B2. Terrain features per dungeon.** Non-walkable or slowing terrain with proper shorelines: water channels and pools in Flooded Caves, ponds in Forest, toxic mud in Swamp, chasm cracks in the Sima, frozen water in ice roads. Needs an autotile (47-tile or simplified 16-tile) edge set per feature.
- Impact: very high; matches the dungeon names and the references.
- Cost: L. Files: `src/core/dungeon.ts` (feature carving), tile grid type (new tile kinds), collision (`core/`), renderer autotiler, net snapshot if tiles are not derived from the seed, GDD.
- Perf: baked edges (E1); animated water as a small tiled overlay per visible water tile.

**B3. Smaller tile scale / camera.** Consider 24 px or zoom 1.5x on desktop so more of the room is visible and the player is closer to a full tile. This is a gameplay and UI decision (hitboxes, readability on phones), so prototype first.
- Impact: medium-high on desktop; must stay readable at 844x390.
- Cost: M. Files: camera/view in `renderer.ts`, HUD layout.
- Perf: more tiles per frame, fine with E1.

**B4. Full per-dungeon tile sets.** Replace procedural fills with authored 32x32 tiles (floor variants, wall autotile, props) drawn on the pixel-grid with dungeon palettes, following `.claude/skills/pixel-craft`. This is Q1-Q3 done as hand-drawn art instead of procedural noise.
- Impact: highest, but only after Q1-Q4 prove the direction.
- Cost: L (art heavy).
- Perf: none with E1.

**B5. Minimap polish.** Corridors as thin lines, rooms with rounded outline, icons for stairs, items and the merchant; dungeon tint.
- Impact: low-medium. Cost: S-M. Perf: draw to its own cached canvas, update on reveal only.

### 3.3 Suggested order

1. E1 (prerendered floor), then Q1 + Q2 on all dungeons in one pass (integration rule: every dungeon, challenge and Senda road, Sima, shrine/herald arena).
2. Q3 + Q4 per dungeon, Forest first (closest to the PokeDive reference), then Caves, Crypt, Swamp, Sima.
3. Q5 for every Senda road, Q6, Q7.
4. B1, then B2 starting with Flooded Caves water; B3 and B4 after playtests.

Each step: screenshots at 1440x900 and 844x390, frame time check on a mid phone (no frame over 16 ms, no long task over 8 ms), and a test iterating `DUNGEONS`, `CHALLENGES` and `SENDA_ROADS` so no dungeon is left with the old look.
