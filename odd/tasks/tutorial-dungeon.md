# Tutorial dungeon: the way down to the town

Objective: the first run walks a short tutorial dungeon down to the town (Hollow Knight's opening path), ending with the player's own shadow as its boss. Branch `feat/tutorial-dungeon` (from `feat/menu-redesign`), follow-up `feat/tutorial-ending` (S8-S11), delivery `ask-on-risk`, runner Vitest.

## Specs

- S1. Route: "haz una mini mazmorra que sea para llegar al pueblo como en hollow knight que esa sea el tutorial!!!". A fresh profile goes from the starter choice into the tutorial dungeon, not the Crypt; clearing it opens the town; a Crypt clear or town traces keep the town open (nobody is locked out). The Crypt stays the first real dungeon.
- S2. Length and difficulty: about 2 short floors plus the boss room; the weakest regulars, few per room, generous healing, fixed forgiving tier regardless of the setting.
- S3. Tutorial signs (src/app/tutorial.ts) run in the tutorial dungeon. Choice: they also stay in the Crypt for players who never walked the tutorial dungeon; each sign shows once per device, so nobody sees them twice.
- S4. Boss: "y que el jefe sea tu sombra (version sombra de el personaje tuyo)". "Tu Sombra" / "Your Shadow": an original creature (not a recoloured, tinted or silhouetted Pokémon sprite, not shaped like one), drawn procedurally (dark mass of smoke and ink, two pale eyes, an ember rim, breathing and flicker, eclipse palette). It mirrors the player's current loadout moves, telegraphed and fair, low HP, gentle damage.
- S5. Closing beat after the boss (one or two original lines), then the town with its normal arrival; the Sima pleas still wait for the Crypt clear.
- S6. Solo only; rooms cannot pick it; never offered in the dungeon select, the challenges or the town exit (choice: not replayable once cleared).
- S7. Integration: GDD section, i18n es/en (peninsular, no em dashes), records, sim/prove harness, no new assets.
- S8. Boss cinematic: "hace falta que el jefe final tenga cinematica". Before the fight (on crossing the fog) and after the victory, on the guardians' cinematic player (played in full once per device, then the name card; skippable; Auto by default). The shadow is drawn with the original procedural ink mass of src/adapters/shadow-view.ts, never a Pokémon sprite. It speaks a few original lines in first person (it is the part of you that stays when you fall and brings you back; docs/lore/lore.md). After the victory it dissolves and the way opens towards the town.
- S9. Arrival: "y veas como llegas al pueblo". The first town after the tutorial fades in at the hub's spawn under the town's name banner, and an existing villager (Gastly the storyteller, its own town sprite) comes to meet the player.
- S10. Tour: "y que ahi te hagan un tour o algo, tienes que hacer que lo lleven a las mazmorras". The villager leads the player to the shop, the move tutor, the notice board, the Santuario and last the waystone, one or two original lines per stop; it ends opening the waystone's dungeons window with the Crypt first. Esc skips it whole (still ending in that window). Once per device, solo only, only the first time the town opens after the tutorial; never for a player who had the town before (Crypt cleared or town traces); rooms never play it.
- S11. The Sima pleas still wait for the Crypt clear (unchanged).

## Tasks

- T1 (S1, S3, S6) route, signs and the dungeon definition: inline, commit "feat(tutorial): walk the first run down the Sunken Way to the town".
- T2 (S4) the shadow boss (brain, procedural view, telegraph): inline, commit "feat(tutorial): add Your Shadow, the boss that mirrors the player's moves".
- T3 (S2, S5, S7) i18n, GDD, balance harness test, browser check: inline, commit "docs(tutorial): document the Sunken Way and Your Shadow".
- T4 (S8) the shadow's cinematic (data, shade scenes, gallery unlock, i18n): inline, commit 84348c0 "feat(tutorial): give Your Shadow a cinematic before and after the fight".
- T5 (S9, S10, S11) arrival and welcome tour (data/town-tour.ts, town/tour.ts state machine, scene wiring, `townTourDue`, dev `?screen=town&tour=1`, i18n): inline, commit "feat(town): welcome the player with a tour that ends at the dungeons".
- T6 (S8-S11) GDD, this document, browser check: inline, commit "docs(tutorial): document the shadow cinematic and the town tour".

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
- [x] Shadow cinematic: data, length, scenes only `shade-*` (no sprite), once per device, es/en lines (tests/app/guardian-cinematic.test.ts); gallery lists it with the guardians and unlocks it on a Sunken Way clear (tests/app/gallery-seen.test.ts, tests/app/lore-gallery.test.ts)
- [x] Shadow cinematic in a shared run: not applicable (the tutorial is solo only); `guardianMoment` would show the name card as for the guardians
- [x] Tour: stops in order, ends at the waystone, Esc skips, routes on open ground, guide is the hub's Gastly, lines es/en (tests/town/tour.test.ts)
- [x] When the tour plays: fresh tutorial clear yes; seen no; room no; start window no; legacy player (Crypt or town traces) no; dev query forces it solo; the waystone window lists the Crypt first; only the solo town hands it over (tests/app/town-tour-due.test.ts)
- [x] Esc menu and quick wheel never open over the tour (tests/town/town-menu.test.ts)
- [x] Save/migrate/sanitize: no save field; the tour's seen flag is a device key (`mazmorra-sombria.townTourSeen`) like the prologue, cinematics and pleas flags
- [x] Net protocol: none (solo only)
- [x] Sima pleas unchanged (still `pleaReady` on the Crypt clear; tour and pleas are mutually exclusive by their conditions)
- [x] GDD (docs/gdd.md, Camino Hundido, Tu Sombra)
- [ ] PENDING: Engram mirror `odd/tutorial-dungeon/tasks` (written by the parent session)

## Log

- L1 (2026-11-02): "vale que la cripta se a lo primero es duro de cojones, haz una mini mazmorra que sea para llegar al pueblo como en hollow knight que esa sea el tutorial!!! y que el jefe sea tu sombra (version sombra de el personaje tuyo) no he llegado al pueblo porque he muerto xd"
- L2: decisions handed down with the request (route, signs, original procedural boss, ~2 floors, closing beat, solo only, integration rule) recorded as S1-S7.
- L3: balance probe (src/sim bots, Easy, seeds 1-4): every bot (novice, average, masher) clears the whole dungeon; the shadow falls in about 9 s to the average bot and 17-27 s to the novice, which it hits rarely (at most 11 % of max HP per hit). HP raised from 320 to 400 after a first probe at 7 s.
- L4: browser check (fresh profile, port 5181): Jugar, prologue skipped, quiz answered, landed on floor 1 of the Camino Hundido with the move sign; the shadow fight (dev `?floor=3`) shows the ink mass, eyes, ember rim and the mirrored swing telegraph. A scripted player that never dodges lost twice and dealt about 8 per light hit at level 1, so the shadow was softened to 240 HP and hits of 40 % power within 16-32. The victory screen offered "Volver a intentarlo": a won tutorial run now only offers the town (`endActions` `tutorialWon`). With the tutorial cleared in the records, Jugar opens the town with no plea.
- L5 (2026-11-02): "y el prologo esta bien, pero hace falta que el jefe final tenga cinematica y veas como llegas al pueblo y que ahi te hagan un tour o algo, tienes que hacer que lo lleven a las mazmorras"
- L6: decisions handed down with the request recorded as S8-S11: the shadow's cinematic on the guardians' player with its procedural drawing; an arrival beat and a scripted tour (the pleas' pattern) by an existing villager, ending at the waystone's dungeons window with the Crypt first; once per device, solo, only for players new to the town. Guide: Gastly the storyteller (a hub NPC, floats, tells the town's stories). The shadow's lines avoid "the voice is your shadow" (docs/lore/lore.md M1: never said in the game).
- L7: browser check (port 5182): `?screen=guardian&species=shadow-self` both phases; a real run (`?floor=3`, fresh profile with the starter chosen) plays the cinematic on crossing the fog and marks `shadow-self:pre` seen; `?screen=town&tour=1` walks the whole tour (38 key presses) to the dungeons window with the Crypt under the cursor; Esc mid-tour ends at the same window; with only the Sunken Way cleared in the records `?screen=town` plays it, and after it is seen it does not.

