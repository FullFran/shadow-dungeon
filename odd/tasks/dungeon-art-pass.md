Objective: an original art pass on dungeon floors so maps feel fuller and closer to the PMD DX look (textured floors, readable walls, themed props).
Branch: feat/dungeon-art-pass (from origin/main 243777d). Delivery: work-unit commits, no push. Test runner: vitest.

## Specs

- S1. Owner request (verbatim): "construir nuevos sprites para las mazmorras para mejorar los mapas de las mazmorras y que se sientan mejor los sitios mas bonitos, menos vacios y mas dentro del mundo de pokemon mundo misterioso pero mas como el remake pokemon mundo misterioso DX". All art original pixel art drawn in code; nothing copied, traced or downloaded.
- S2. Per dungeon theme: floor tile variation (variants picked by a seeded hash, stable), wall tops and faces with depth and edge/corner pieces, transitions (floor-wall shadow, water and sludge banks), decorative props on the floor placed from the floor itself so every co-op peer sees the same.
- S3. Props are decoration only: no collision changes, never on stairs, start, spawn points or chokepoints (doorways, corridors), never on water; low contrast, under every gameplay layer (telegraphs, bullets, sprites).
- S4. Performance: floor layers prerendered to an offscreen canvas once per floor (and per fixed arena size); no per-frame cost growth. Frame time measured before/after with `?perf=1`.
- S5. Every dungeon gets its set: main dungeons, challenge dungeons and Senda roads (they reuse their base's decor), the tutorial, every Sima band (crypt, forest, caves, swamp, abyss), fixed arenas.
- S6. Tests: every dungeon id and Sima band resolves to a decoration set; placement deterministic for a floor; props never on non-walkable or reserved tiles; the simulation never reads decoration.
- S7. GDD (Spanish): a short section on the dungeon art pass.
- S8. Before/after screenshots in a mktemp -d directory (not committed).

## Parity checklist

- [ ] Crypt of the Sword King (crypt theme)
- [ ] Misty Forest (forest theme)
- [ ] Flooded Caves (caves theme, water banks)
- [ ] Toxic Swamp (swamp theme, sludge banks)
- [ ] Sunken Way tutorial (crypt decor, its own palette)
- [ ] Eclipse Chasm / Sima: crypt, forest, caves, swamp bands and the abyss band
- [ ] Challenge dungeons and Senda roads (reuse their base decor)
- [ ] Fixed arenas (boss and mid-boss rooms): floor variation, no props
- [ ] Solo and co-op: placement is a pure function of the floor grid, rooms and water, which every peer shares
- [ ] Save/net/i18n: no new fields or strings (presentation only); GDD section added

## Tasks

- T1 (S2, S3, S5, S6) placement module + tests: inline
- T2 (S2, S4, S5) prerendered floor layer, wall/floor/prop art per theme, renderer wiring: inline
- T3 (S4, S8) perf and screenshots before/after: inline
- T4 (S7) GDD section: inline

## Log

- L1 (2026-11-12) Owner request via the coordinator: see S1; brief task_edf54587f2aa.
