# Map size by difficulty and a minimum wave room

Objective: bigger generated floors on harder tiers and a minimum size for wave rooms, data-driven. Branch `feat/map-size` from `integrate/content-batch`; delivery: two commits (research+data/generator, docs). Runner: `npx vitest run`.

## Specs

- S1 (research): "manda un worker a investigar el tamaño de las salas en pokemon mundo misterioso y de los mapas" → `docs/research/map-size.md` with Mystery Dungeon figures, our measurements with path:line, what size touches, recommended numbers.
- S2: "los mapas de cada piso se me hacen muy pequeños, a mas dificil deberia ser mas grande el mapa no?" → floor shape per tier (Easy as today, Normal slightly bigger, Hard and Nightmare bigger), same seed same floor for every co-op peer, distance-dependent clocks scaled, shrine and fixed arenas unchanged.
- S3: "y las salas de oleadas hay que poner norma de un tamaño minimo... mas grande que el de ahora que la gente se esta quejando" → every wave room at least 11x9 floor tiles (today's minimum measured: 5x4) in every dungeon, challenge, Senda road and Sima stratum.
- S4: tests iterating DUNGEONS, CHALLENGES, Senda roads and the Sima: wave room minimum, floors grow with tier, connected, stairs reachable, determinism, timers scale; GDD and minimap updated.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1 | inline | done | docs/research/map-size.md |
| T2 | S2, S3 | inline | done | src/data/dungeon.ts `FLOOR_SHAPES`, `WAVE_ROOM`; src/core/dungeon.ts hall; src/core/floor-spawns.ts `holdsWaveRoom`; src/core/sima-events.ts `simaEventKind` |
| T3 | S2 | inline | done | fog/flood `scale`, `descendBonusMs(walkScale)`, minimap `minimapTilePx(touch, cols, rows)` |
| T4 | S4 | inline | done | tests/core/map-size.test.ts (RED observed: hall off → "crypt easy floor 4 seed 14: expected 9 to be >= 11") |
| T5 | S2, S3 | inline | done | docs/gdd.md §3 Plantas normales |

## Parity checklist

- [x] Every dungeon (Crypt, Forest, Caves, Swamp), the Sima, every challenge and every Senda road: wave rooms checked by `tests/core/map-size.test.ts` (232 wave rooms in 29 dungeons, every one whose rules can roll waves; the tutorial has none).
- [x] Every tier: shapes, connectivity, stairs, determinism, clocks, minimap footprint.
- [x] Solo and co-op: the shape comes from the host's tier (`worldDifficulty`), generation is a pure function of seed, depth, shape and hall; the net protocol never carries tiles.
- [x] Urgent floors: collapse and gas follow walking distance (test on every tier); fog and flood stretch by `walkScale`.
- [x] Sima clock: descent bonus stretched by `walkScale`.
- [x] Shrine and fixed arenas: unchanged (test).
- [x] Save/migrate/sanitize: no new save field (fog/flood `scale` is per-floor world state, optional).
- [x] i18n: no new player-facing string.
- [x] GDD (Spanish) updated; research doc in English.
- [x] Sim/prove: `npm run prove -- --judge` gives the same failure set as the base (L4); the fairness yardstick is identical to the base (Easy's shape, L3); real levels within one of it on every tier (tests/core/fairness-floors.test.ts now iterates DIFFICULTIES).
- [ ] Monster house, nest and ambush rooms still use any room (not asked; candidate follow-up).

## Log

- L1 (2026-11-12, owner, verbatim): "manda un worker a investigar el tamaño de las salas en pokemon mundo misterioso y de los mapas. los mapas de cada piso se me hacen muy pequeños, a mas dificil deberia ser mas grande el mapa no? y las salas de oleadas hay que poner norma de un tamaño minimo... mas grande que el de ahora que la gente se esta quejando".
- L2: the 2026-10-25 rule "harder rooms never have more enemies" kept per room; `tests/core/difficulty-tiers.test.ts` now checks enemies per room instead of per floor (bigger floors have more rooms by request). Easy's golden digest re-recorded ('5011c078'): with `holdsWaveRoom` forced off it gives the old '6434cee9', so only wave floors changed.
- L3: decisions for the owner: the tier numbers, Normal slightly bigger (not identical to Easy), same 4-6 rooms on every tier (more rooms deferred: they raised Nightmare XP and boss kill margins), minimap kept at Easy's footprint, and the expected-level yardstick (core/fairness.ts) measured on Easy's shape on every tier (identical to the base; on the new geometry its 8 seeds drifted by noise).
- L4: tests/sim/prove-witness-{1,2} fail 14 Nightmare cases on the base integrate/content-batch too (same list, run in a scratch worktree), and `npm run prove -- --judge` fails 33 Nightmare kill margins on the base: pre-existing, the Nightmare band work. With extra rooms the branch failed 37 (4 new lastword cards); with 4-6 rooms on every tier the list matches the base (salazzle sc-sal-dance 2.20 to 2.06).
