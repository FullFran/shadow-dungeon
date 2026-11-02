# Tutorial dungeon: the way down to the town

Objective: the first run walks a short tutorial dungeon down to the town (Hollow Knight's opening path), ending with the player's own shadow as its boss. Branch `feat/tutorial-dungeon` (from `feat/menu-redesign`), delivery `ask-on-risk`, runner Vitest.

## Specs

- S1. Route: "haz una mini mazmorra que sea para llegar al pueblo como en hollow knight que esa sea el tutorial!!!". A fresh profile goes from the starter choice into the tutorial dungeon, not the Crypt; clearing it opens the town; a Crypt clear or town traces keep the town open (nobody is locked out). The Crypt stays the first real dungeon.
- S2. Length and difficulty: about 2 short floors plus the boss room; the weakest regulars, few per room, generous healing, fixed forgiving tier regardless of the setting.
- S3. Tutorial signs (src/app/tutorial.ts) run in the tutorial dungeon. Choice: they also stay in the Crypt for players who never walked the tutorial dungeon; each sign shows once per device, so nobody sees them twice.
- S4. Boss: "y que el jefe sea tu sombra (version sombra de el personaje tuyo)". "Tu Sombra" / "Your Shadow": an original creature (not a recoloured, tinted or silhouetted Pokémon sprite, not shaped like one), drawn procedurally (dark mass of smoke and ink, two pale eyes, an ember rim, breathing and flicker, eclipse palette). It mirrors the player's current loadout moves, telegraphed and fair, low HP, gentle damage.
- S5. Closing beat after the boss (one or two original lines), then the town with its normal arrival; the Sima pleas still wait for the Crypt clear.
- S6. Solo only; rooms cannot pick it; never offered in the dungeon select, the challenges or the town exit (choice: not replayable once cleared).
- S7. Integration: GDD section, i18n es/en (peninsular, no em dashes), records, sim/prove harness, no new assets.

## Tasks

- T1 (S1, S3, S6) route, signs and the dungeon definition: inline, commit "feat(tutorial): walk the first run down the Sunken Way to the town".
- T2 (S4) the shadow boss (brain, procedural view, telegraph): inline, commit "feat(tutorial): add Your Shadow, the boss that mirrors the player's moves".
- T3 (S2, S5, S7) i18n, GDD, balance harness test, browser check: inline, commit "docs(tutorial): document the Sunken Way and Your Shadow".

## Parity checklist

- [x] Route: `nextPlayScreen` and `townOpen` (tests/app/title-menu.test.ts)
- [x] Tutorial signs: tutorial dungeon and Crypt (tests/app/tutorial.test.ts)
- [x] Dungeon invariants: generated floors, spawn caps, no urgent floors, lore keys, closing line (tests/core/tutorial-dungeon.test.ts); excluded from `DUNGEONS` and `CHALLENGES` on purpose (select, rooms, balance sweeps)
- [x] Boss: kit mirrors the loadout, telegraph floor, power cap, HP below Sableye (tests/core/tutorial-dungeon.test.ts)
- [x] Solo and co-op: solo only (not in any room list); guest contact path kept consistent in core/victim.ts
- [x] Save/records: no new save field; records use the dungeon id `sunken-way` (parseRecords accepts it; the town board does not list it)
- [x] i18n es/en for every new string, no em dash
- [x] GDD (docs/gdd.md, Mazmorras and Menús)
- [x] Sim/prove: `npm run prove` green (the shadow has no spell cards, so the card proof does not cover it); balance harness test in tests/core/tutorial-dungeon.test.ts
- [x] Credits: no new assets
- [ ] PENDING: Engram mirror `odd/tutorial-dungeon/tasks` (written by the parent session)

## Log

- L1 (2026-11-02): "vale que la cripta se a lo primero es duro de cojones, haz una mini mazmorra que sea para llegar al pueblo como en hollow knight que esa sea el tutorial!!! y que el jefe sea tu sombra (version sombra de el personaje tuyo) no he llegado al pueblo porque he muerto xd"
- L2: decisions handed down with the request (route, signs, original procedural boss, ~2 floors, closing beat, solo only, integration rule) recorded as S1-S7.
- L3: balance probe (src/sim bots, Easy, seeds 1-4): every bot (novice, average, masher) clears the whole dungeon; the shadow falls in about 9 s to the average bot and 17-27 s to the novice, which it hits rarely (at most 11 % of max HP per hit). HP raised from 320 to 400 after a first probe at 7 s.
- L4: browser check (fresh profile, port 5181): Jugar, prologue skipped, quiz answered, landed on floor 1 of the Camino Hundido with the move sign; the shadow fight (dev `?floor=3`) shows the ink mass, eyes, ember rim and the mirrored swing telegraph. A scripted player that never dodges lost twice and dealt about 8 per light hit at level 1, so the shadow was softened to 240 HP and hits of 40 % power within 16-32. The victory screen offered "Volver a intentarlo": a won tutorial run now only offers the town (`endActions` `tutorialWon`). With the tutorial cleared in the records, Jugar opens the town with no plea.
