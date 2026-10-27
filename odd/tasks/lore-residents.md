# Lore residents: every Senda has its neighbour

Branch: `fix/lore-coherence` (continues after d2d0a15). Owner decisions of 2026-10-27.

## Objective

"The Sendas are the residents' wounds" must hold for all eight lines. Today only Cubone (fisher), Litwick (keeper) and Mimikyu (gacha stall) live in the world. Add the five missing residents with the existing NPC system, give all eight a before/after recognition line driven by `save.story`, and close the lore decisions C4, C5 and C6.

## Owner decisions applied

1. **C4**: a shadow is what remains once your shadow no longer needs you; slowly (each descent), or all at once to those in the plaza on the night of the Eclipse. No text contradicts it.
2. **C5**: Litwick is female. Fix the masculine forms that refer to Litwick herself (es only; en uses "it").
3. **Residents**: Abra (Refugio corner, asleep, the blanket), Zorua (Refugio, disguised as a quiet child, revealed once its Senda is done), Piplup (Lago Negro pier, next to Cubone, refusing), Shinx (crater rim, looking down), Axew (outskirts, a tree of marks, training alone).
4. `sima.plea.hermit.2` unchanged; open nuance in the bible.
5. **C6**: the sun has never risen since the Eclipse; time passes (winters counted by the ice), the moon rises. No player text changes; GDD, bible and graph.

## Design

- `TownNpc.resident` (src/data/town.ts): `{ line, after, disguise?: { species, nameKey }, revealed? }`.
- Pure `npcView(npc, story)` (src/town/residents.ts): recognised (`chaptersCleared >= 1`, chapter I closed) → `after` lines; disguise shown while the Senda is not complete (`< 3`); complete → true species, own name and `revealed` lines.
- `TownOptions.story` getter; both `openTown` calls (solo and room) pass `loadSave(store).story`. Each client reads its own memory (house rule: the narrative comes from your memory).
- No save field, no migration: the state derives from `save.story`.

## Tasks

- [x] T1 Feature document (this file). Route: inline.
- [ ] T2 Tests first (RED): every Senda line has exactly one resident with before/after keys in es+en; Zorua disguise; npcView thresholds; positions (existing world tests cover walkability, reachability, sealed pockets). Route: inline (one test file).
- [ ] T3 Data + view + scene wiring (town.ts, world.ts, residents.ts, scene.ts, main.ts) + i18n es/en. Route: inline (mechanical once designed).
- [ ] T4 Litwick feminine forms (C5).
- [ ] T5 Bible (C4, C5, C6, residents table, world rules, registro), GDD (§1 scope line, world, Sendas rule), graph (resident and endless-night nodes/edges, re-mapped sources).
- [ ] T6 Verification and headless screenshots.

## Parity checklist

- [ ] All 8 Senda lines have a resident (test iterates `CHALLENGES` lines).
- [ ] All 8 have before and after lines, es + en.
- [ ] Solo town and room town both receive `story` (main.ts, both `openTown`).
- [ ] Save/migrate: not needed (derived from `save.story`).
- [ ] Net protocol: not needed (NPC dialog is local).
- [ ] Sprites: all resident species and the disguise ship in `sprite-meta.json` (loadSheets loads every sheet).
- [ ] GDD and bible updated; graph rebuilt and checked.
- [ ] Pleas (`sima-plea.ts`): the five new residents do not plead. Pending owner decision, not dropped.

## Checks

`node tools/lore-graph-check.mjs`; `npm run typecheck`; `npx vitest run --testTimeout=30000 --maxWorkers=4`; `npm run build`; `npm run prove`; `node tools/mobile/menu-geometry.mjs`; headless screenshots of Refugio and Lago Negro.

## Progress

(filled per task)
