# Overworld

## Objective
Grow the hub town into a small walkable overworld: several connected maps with two settlements, routes with scenery, the dungeon entrances placed in the world, ambient life and lore that grows with progression. Later (T5) the online lobby becomes that town, with players walking together under nicknames.

## Problem
User (2026-10-25): "¿podemos poner varios pueblos y hacerlo más duro de cojones? Que haya sitio por donde andar y ver el mundo." The town is a single 32x20 plaza whose east edge opens a destination list; there is nothing to walk to. Scope addition (same day): the online lobby should be the town (players walk together, the host enters a dungeon for the group) and players get nicknames drawn over their heads.

## Design
- World = connected maps authored as data (`src/data/world.ts`), each with the town's row format plus links, entrances, lore points, wanderers and a look (ground sheet, tint, eclipse size, fog, particles). The existing `TOWN` stays the hub ("Refugio del Ocaso") with its data untouched; its east route `exit` becomes the link to the first route.
- Maps: Refugio del Ocaso (hub) - Camino de las Ruinas (Crypt entrance among graves) - Paso del Mirador (chasm, bridge, watchtower viewpoint, Misty Forest entrance at the southern treeline) - north: Cráter del Eclipse (Sima del Eclipse entrance, guarded by the dungeon registry) - east: Aldea del Lago Negro (second settlement: black lake, pier, three NPCs).
- Transitions: edge links paired both ways; a short fade; the arrival keeps the lateral offset and lands one tile inside the edge. Map name banner on arrival.
- Entrances: walking onto a threshold opens an MD window "¿Entrar en …?"; a locked dungeon shows a sealed line; a dungeon missing from the registry shows a "not yet" line. Quick travel: a waystone in the hub opens the old destination window (all unlocked dungeons).
- Ambience: depth-sorted props (culled to the view), water shimmer, drifting fog, embers, falling leaves near forests, birds in the sky band, per-map tint and eclipse size. Wandering harmless Pokémon (existing sprites only) on deterministic random walks.
- Lore points: statues, signs and idols whose lines grow after clearing each dungeon (local records).
- No combat in the overworld. Music: Lonely Village everywhere (shipped; no download).
- New tiles: more crops from the same two CC0 Ninja Adventure sheets; every crop rectangle and sha256 in `public/tiles/town/LICENSE.txt`.

## Scope / allowed surfaces
`odd/tasks/overworld.md`, `src/town/**`, `src/data/town.ts`, `src/data/world*.ts`, `src/app/main.ts`, `src/core/**`, `src/adapters/**`, `src/ui/**`, `public/tiles/**`, `src/i18n/{es,en}.json` (new keys in one contiguous block), `tests/**`, `CREDITS.md`, `README.md`, `docs/gdd.md`. T5 additionally needs `src/net/**` and `src/app/**` (named by the coordinator's scope addition).

## Constraints
- Town API used by main.ts (`openTown`, `onDepart`, `openShop`) stays compatible; new options are optional.
- Three other writers in parallel (endless dungeon + return to town, Crypt remaster, enemy roster): additive edits only in shared files.
- Core pure, architecture test green. Silent headless browsers only.
- One work-unit commit per task, Conventional Commits, no AI attribution.

## Tasks
- [x] T1 World model + transitions: map types, links paired both ways, generalised grid/ground (water, bridge, chasm, rock), per-map ground sheet, fade transition, map banner, hub waystone quick travel, first route map, all new crops + LICENSE (route: inline, single writer of src/town)
- [x] T2 Second town + routes + entrances: Mirador, Cráter, Lago Negro, entrance windows (registry-guarded) (route: inline)
- [x] T3 Ambience + lore points + wanderers: fog, leaves, birds, water shimmer, lore lines by progression, wandering Pokémon (route: inline)
- [x] T4 Docs: README, docs/gdd.md, CREDITS.md (route: inline)
- [x] T5 Online lobby in town + nicknames (route: inline)

## Acceptance criteria
- Every map is a rectangle of known characters; every floor tile of a map is reachable from its arrival points; every map is reachable from the hub spawn through links; links pair both ways with equal spans; arrivals land on floor outside any trigger.
- Every NPC, lore point, waystone and entrance is reachable; no NPC or wanderer home in a wall; entrances name the Crypt and the Misty Forest from the registry and the Sima only through the registry guard.
- Lore lines grow with cleared dungeons (tests).
- Esc and touch (joystick + Hablar) work in every map; only visible tiles and props are drawn.
- T5: nickname sanitising, presence encode/decode, host-only start, protocol back-compat covered by tests.

## Checks
`npm test`, `npm run build`, headless silent Firefox screenshots in `/tmp/overworld/` (each map, a transition, a lore stone, an entrance window, touch 844x390).

## Progress
Created 2026-10-25 on branch `feat/overworld` from main 4c90a5d. Forecast ~1800 authored lines (T1-T4) + ~700 (T5); delivery strategy: ask-on-risk (parent decides slicing). Engram mirror `odd/overworld/tasks`: pending (worker has no session id; parent mirrors).

### T1 World model + transitions
- `src/data/world.ts`: `WorldMap` (rows, props, npcs, links, look, optional spawn/board/waystone), `paintRows` (fill + rectangle strokes), hub `REFUGIO` = the untouched `TOWN` plus a waystone signpost at (28,8), first route `RUINAS` (40x20, Crypt gate = house-stone crop reused).
- `src/town/overworld.ts` (pure): `linkEdge`, `arrival` (one tile inside, lateral offset kept, snapped to a lane), `linkAt`, `offsetAlong`, fade and banner alpha. `src/town/map.ts` generalised to `MapShape` and the new ground characters (`~ = C #`).
- Render: per-map ground sheet and tufts (dark/ash crops have a blank and a path cell where the light sheet has tufts: first screenshot showed black squares, fixed with `GROUND_TUFTS`), water/chasm/rock/bridge drawn by code, decal props, prop culling to the view, per-map tint and eclipse size, banner + fade overlay.
- Scene: map switch at the darkest point of a 2x220 ms fade, arenas cached per map, waystone opens the old destination window (quick travel). `TownOptions.at`/`tile` optional; dev `?screen=town&map=…&tile=x,y`.
- Crops: 16 new files (2 ground sheets, 14 props) from the same two sheets; rectangles and sha256 in LICENSE.txt.
- Checks: `npx vitest run` 803 passed (21 new in tests/town/world.test.ts); `npm run build` ok; screenshots `/tmp/overworld/t1-*.png` (hub, ruins, transition mid-fade and after).

### T2 Second town + routes + entrances
- Maps: `MIRADOR` (44x24: chasm with a 4-wide bridge, rock ledge, statue viewpoint, watchtower, eclipse x2.4, north path to the crater, Misty Forest mouth at the southern treeline by a hollow trunk), `CRATER` (32x26 ash and rock, rounded pit with jagged rim, eclipse x3.4, Sima mouth at the rim), `LAGO` (36x22: black lake, pier, two big houses, fisher Cubone on the pier, keeper Litwick (rotating lines), seer Phantump by a stall hinting the gacha). Ruins gain the east link and the Crypt mouth.
- Entrances: `DungeonEntrance` (trigger tiles + way back); `entranceState` = open / locked / missing against `options.dungeons` and the `DUNGEONS` registry. Open: MD window "¿Entrar en …?" (Entrar / Todavía no); locked: sealed line naming the dungeon whose guardian unlocks it; missing (Sima until the endless dungeon lands with id `sima-del-eclipse`): "not yet" line. Mouths glow red on the ground.
- Checks: `npx vitest run` 829 passed (+8 entrance tests); typecheck ok; screenshots `/tmp/overworld/t2-*.png` (three maps, bridge, entrance window, sealed forest, missing Sima).
- Fixed from screenshots: bridge planks left dark gaps between rows; crater pit hid under the sky band (moved 4 rows down) and read as a flat rectangle (jagged lit rim).

### T3 Ambience + lore points + wanderers
- Lore points (`LorePoint`, lines with optional `after: <dungeon id>`; pure `loreLines`): faceless knight statue and road sign (ruins), lookout statue (pass), burnt statue (crater), frog idol (lake). Lines grow after clearing the Crypt and the Misty Forest (local records via `clearedDungeons`).
- Wanderers (pure `stepWander`, 35 % of the player's speed, rests 0.8-3 s, deterministic per id/step, gives up when snagged): Pumpkaboo (ruins), Hoothoot and Foongus (pass), Spinarak (lake). Not solid, no combat.
- Ambience (pure positions in `src/town/ambience.ts`): fog banks with parallax (ruins, pass, crater smoke, thick on the lake), falling leaves (ruins, pass), birds in the sky band (hub, ruins, pass, lake), water shimmer, embers everywhere.
- Checks: `npx vitest run` 843 passed (+14: lore progression, wanderers on floor within radius and moving, particles in bounds); screenshots `/tmp/overworld/t3-*.png` (lore stone dialog, pass with Hoothoot, lake fog, touch 844x390).
- Fixed from screenshots: the lake plaza read empty (rocks, a broken pillar and rubble added).

### T4 Docs
- docs/gdd.md §3 "El mundo (provisional)": the five maps, entrances, lore growth, wanderers, looks, music; §15 outlook updated. README Town paragraph rewritten (maps, dev `map`/`tile` query, entrances, waystone). CREDITS Tiles prose kept (no table rows), now mentions overworld crops, hashes and code-drawn water/bridges/chasms/rock.
- Checks: `npx vitest run` 843 passed (credits test included).

### T5 Online lobby in town + nicknames
- Net (additive, back-compatible): `hello.name?`, `RosterEntry.name?` (sanitised by the host and again by guests), new unreliable `town` presence `{at, m, p:[x,y,fx,fy,moving]}` decoded strictly (finite numbers, map id <= 24 chars) and ignored by older peers as unknown. Session: `sendPresence`, `townWalkers` (interpolation buffers reused, 150 ms delay, no extrapolation, jump on map change), `canLead` (host in lobby only), `reopenLobby(seed)` (host) and `onLobby` (guest resets the run state and waits for the next `start`), walkers dropped on leave.
- `src/net/nickname.ts`: trim, whitespace runs to one space, strip Cc/Cf/Cn/Co/Cs (control, zero-width, bidi overrides), 16 code points; fallback "Jugador-XYZ" hashed from the peer id. Setting `nickname` (default empty) in Settings and the online screen.
- Town lobby (`TownOptions.lobby`, `src/town/lobby.ts`): other walkers on the same map with names (own name dimmer, outlined pixel font), corner room window (code or dots, players with host/you tags), Esc opens the room menu (copy, hide/show code, leave, stay), presence at 10 Hz, guests at an open mouth or the waystone get "only the host…", host's window reads "¿Entrar en …? (todo el grupo)" and `onDepart` begins the run for everyone.
- App: `openLobby` now ends in `townLobby` (single entry point: create/join and after every shared run); room session kept across runs (`GameOptions.net.keepSession`, `show()` keeps `current` for the room); end screen of a room run shows the party and "Volver al pueblo" (host reopens the lobby with a new seed, guests follow via `onLobby`). Dungeon name tags use nicknames (`RenderFrame.names`).
- Checks: `npx vitest run` 865 passed (+22: nickname 6, town presence/lobby session 11, lobby rules 4, settings nickname 1); `npm run build` ok; two silent Firefox windows on `?screen=lobby` / `&guest=1`: both see each other with names, room window, room menu, guest host-only dialog, host waystone starts the Crypt for both, guest's run shows "Anfitriona" over the host (`/tmp/overworld/t5-*.png`).
- Not verified in a browser: "Volver al pueblo" after a finished shared run (covered by the session test `reopenLobby` / `onLobby`), Trystero rooms (only the BroadcastChannel preview was driven).
