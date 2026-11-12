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

- [x] Crypt of the Sword King (crypt theme): screenshot crypt, vault arena
- [x] Misty Forest (forest theme): screenshot forest, test arena
- [x] Flooded Caves (caves theme, water banks): screenshot caves; props never on water (test)
- [x] Toxic Swamp (swamp theme, sludge banks): screenshot swamp; props never in pools (test)
- [x] Sunken Way tutorial (crypt decor, its own palette): screenshot sunken
- [x] Eclipse Chasm / Sima: crypt, forest, caves, swamp bands and the abyss band: test over SIMA_BANDS, screenshots sima-f1, sima-abyss
- [x] Challenge dungeons and Senda roads (reuse their base decor): test over CHALLENGES and SENDA_ROADS, screenshot challenge-abra. Their own per-road look (research Q5) is pending.
- [x] Fixed arenas (boss and mid-boss rooms): floor variation, no props (paintArena)
- [x] Solo and co-op: placement is a pure function of the floor grid, rooms, water and pools, which every peer shares (determinism and no-mutation tests)
- [x] Save/net/i18n: no new fields or strings (presentation only); GDD section "Arte de las mazmorras" added

## Tasks

- T1 (S2, S3, S5, S6) placement module + tests: inline, done (bcb9aac)
- T2 (S2, S4, S5) prerendered floor layer, wall/floor/prop art per theme, renderer wiring: inline, done (897bdd8)
- T3 (S4, S8) perf and screenshots before/after: inline, done (scratch /tmp/sd-art-ckIK)
- T4 (S7) GDD section: inline, done (3867ea5)

## Log

- L1 (2026-11-12) Owner request via the coordinator: see S1; brief task_edf54587f2aa.
- L2 (2026-11-12) Coordinator forwarded the research (docs/research/dungeon-map-look.md): E1, Q1+Q2, Q3+Q4 done here; Q5 (own look per Senda road), Q6, Q7, B1/B2 listed as pending.
- L3 (2026-11-12) Perf (headless Chromium, 1440x900, 5 s per dungeon): render mean ms before -> after: crypt 2.84 -> 1.01, forest 2.13 -> 1.50, caves 1.39 -> 0.95, swamp 1.97 -> 1.32, sunken 1.67 -> 1.03, challenge 1.29 -> 0.92, Sima crypt band 1.79 -> 1.28, abyss 1.44 -> 1.76. One-off layer paint per floor: 17-28 ms (CPU x1), 65-115 ms (CPU x4); entering a floor on main already shows 150-235 ms long tasks at CPU x4. Painting in a worker is pending.
