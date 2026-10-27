# Lore residents: every Senda has its neighbour

Branch: `fix/lore-coherence` (continues after d2d0a15). Owner decisions of 2026-10-27.

## Objective

"The Sendas are the residents' wounds" must hold for all eight lines. Today only Cubone (fisher), Litwick (keeper) and Mimikyu (gacha stall) live in the world. Add the five missing residents with the existing NPC system, give all eight a before/after recognition line driven by `save.story`, and close the lore decisions C4, C5 and C6.

## Owner decisions applied

1. **C4**: a shadow is what remains once your shadow no longer needs you; slowly (each descent), or all at once to those in the plaza on the night of the Eclipse. No text contradicts it.
2. **C5**: Litwick is female. Fix the masculine forms that refer to Litwick herself (es only; en uses "it").
3. **Residents**: Abra (Refugio corner, asleep, the blanket), Zorua (moved by the owner to the Lago Negro village square, its Senda's fountain; disguised as a quiet child, Zoroark once its Senda is done), Piplup (Lago Negro pier, next to Cubone, refusing), Shinx (crater rim, looking down), Axew (outskirts, a tree of marks, training alone).
4. `sima.plea.hermit.2` unchanged; open nuance in the bible.
5. **C6**: the sun has never risen since the Eclipse; time passes (winters counted by the ice), the moon rises. No player text changes; GDD, bible and graph.
6. **C7 + C9**: the Lago Negro is Piplup's lake, frozen black; the fisher keeps a hole open by the pier; the lake drains to the sea, where the others went.
7. **C8**: the child of the big house went down into the Sima already old.
8. **C17**: a misreading, no change. **C20**: a mystery, answered internally in M8 (Zorua's pack kept by the white fog; the mark is its mother's).

## Design

- `TownNpc.resident` (src/data/town.ts): `{ line, after, disguise?: { species, nameKey }, revealed? }`.
- Pure `npcView(npc, story)` (src/town/residents.ts): recognised (`chaptersCleared >= 1`, chapter I closed) → `after` lines; disguise shown while the Senda is not complete (`< 3`); complete → true species, own name and `revealed` lines.
- `TownOptions.story` getter; both `openTown` calls (solo and room) pass `loadSave(store).story`. Each client reads its own memory (house rule: the narrative comes from your memory).
- No save field, no migration: the state derives from `save.story`.

## Tasks

- [x] T1 Feature document (this file). Route: inline.
- [x] T2 Tests first (RED): every Senda line has exactly one resident with before/after keys in es+en; Zorua disguise; npcView thresholds; positions (existing world tests cover walkability, reachability, sealed pockets). Route: inline (one test file).
- [x] T3 Data + view + scene wiring (town.ts, world.ts, residents.ts, scene.ts, main.ts) + i18n es/en. Route: inline (mechanical once designed).
- [x] T4 Litwick feminine forms (C5).
- [x] T5 Bible (C4, C5, C6, residents table, world rules, registro), GDD (§1 scope line, world, Sendas rule), graph (resident and endless-night nodes/edges, re-mapped sources).
- [x] T6 Verification and headless screenshots.

## Parity checklist

- [x] All 8 Senda lines have a resident (`tests/town/residents.test.ts` iterates `CHALLENGES` lines).
- [x] All 8 have before and after lines, es + en (same test).
- [x] Solo town and room town both receive `story` (main.ts, both `openTown`).
- [x] Save/migrate: not needed (derived from `save.story`).
- [x] Net protocol: not needed (NPC dialog is local; each player reads its own memory).
- [x] Sprites: all resident species and the disguise ship in `sprite-meta.json` (loadSheets loads every sheet; test asserts SPRITE_KEYS).
- [x] GDD and bible updated; graph rebuilt and checked.
- [ ] Pleas (`sima-plea.ts`): the five new residents do not plead. Pending owner decision, not dropped.

## Checks

`node tools/lore-graph-check.mjs`; `npm run typecheck`; `npx vitest run --testTimeout=30000 --maxWorkers=4`; `npm run build`; `npm run prove`; `node tools/mobile/menu-geometry.mjs`; headless screenshots of Refugio and Lago Negro.

## Progress

- 5c6a09d feat(town): residents + recognition (RED first: residents.test.ts failed on the missing module).
- 99722d7 fix(i18n): Litwick feminine (C5).
- 46265dd fix(i18n): frozen lake and fishing hole (C7), child went down old (C8).
- 63d3833 docs(lore): GDD, bible, graph for C4-C9, C17 and residents.
- 4d19df5 docs(lore): C20 to M8.
- 5a5cbb4 fix(town): fisher and Piplup reachable (RED: the new world test failed for lago with the fisher past the cave stair).

Verification (2026-10-27): lore-graph-check OK (228 nodes, 466 edges); typecheck ok; vitest 261 files / 3269 tests passed; build ok; prove 166/166 cards, 24/24 fights; menu-geometry OK; headless screenshots of Refugio, Lago Negro and the crater before / recognised / done.

Review: RDD not run by this worker (parent decides).

## Open

- The five new residents do not take part in the pleas (owner decision).
- Residents keep their base sprite after their Senda (Marowak, Chandelure, Alakazam...), except Zorua, who shows as Zoroark as the owner asked: evolving the others is an owner decision (their names would change).
- The Lago Negro map still draws the lake as water, not black ice (art).
- `sima.plea.hermit.2` stays as an open nuance (C4 row).
- Engram mirror `odd/lore-residents/tasks`: pending (worker had no session id).
