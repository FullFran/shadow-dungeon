# Consumables, a 3-slot bag before runs, and an item gacha

Objective: consumable items packed in a 3-slot bag before a run (species > moves > bag), a persistent stock, an item gacha and fixed-price rows to fill it. Branch `feat/items-bag` (from origin/main, with `docs/items-prep-research` merged), delivery `ask-on-risk`, runner Vitest.

## Specs

- S1. Owner's request (L1): "luego hay que añadir gacha de objetos y objetos consumibles y demas que te puedas preparar antes de la mazmorra o los desafios". Design: docs/research/items-and-prep.md §2 and §4.
- S2. Decision 1(a): the item gacha unlocks consumable KINDS (pity 5/30 as proposed) and the shop sells unlocked kinds at fixed prices.
- S3. Decision 2(a): only used units are spent, the rest returns to stock.
- S4. Decision 3(b): the revive consumable is allowed everywhere except Nightmare.
- S5. Decision 4(a): no bag in the Shrine.
- S6. Nightmare numbers belong to another worker: untouched here.
- S7. Consumable data (original names and effects from the doc) and their effects in the core.
- S8. The stock in the save (optional fields, version 4 kept; migrate/sanitize), profile merge rules, cloud payload.
- S9. The bag as the third loadout step for dungeons, challenges and the Sima, never the Shrine.
- S10. Using a consumable in a run on keyboard (rebindable `item` and `itemNext` actions in src/adapters/bindings.ts), touch and gamepad.
- S11. Co-op: each peer its own bag; effects through the existing hit and claim paths, no protocol change.
- S12. The item gacha in town next to the Pokémon gacha; shop rows; i18n es/en; GDD; tests; `npm run prove` stays consumable-free.

## Tasks

- [x] T1 (S2, S3, S7, S11) data/consumables.ts, core/consumable-stock.ts, core/consumables.ts, step/playerStats/toxic hooks: inline, e0bdd08 (RED: module missing; GREEN 29 tests).
- [x] T2 (S3, S8) save fields, sanitize, buy/pull/spend on the store, profile-merge economy rules, cloud round trip: inline, 68dd474 (RED 8 failed, GREEN 9).
- [x] T3 (S9, S10) settings `bag`, run-resume `bag`, bindings `item`/`itemNext` (G, X), pad RT and D-pad up/down: inline, 3d37658.
- [x] T4 (S9, S10, S11) loadout bag step, bag HUD (tap select/use), game wiring (use before the step, sprout armed, exit cord retreat, lamp reveals the map), main wiring: inline, bec013a.
- [x] T5 (S2, S12) item stall (pull + fixed-price rows), town menu `items` next to the gacha, title hub button, i18n es/en: inline, 0cc3298.
- [x] T6 (S12) GDD, prove guard, runner `bag` option with a bot policy: inline, a22480b.

## Parity checklist

- [x] Every playable species: the bag has no species rule (no per-species code path; bag step and HUD read only the bag).
- [x] Main dungeons, challenges (Senda roads included), Sima: the bag step sits in `loadout()` before `enterDungeon`/`chooseDungeon` for all of them; `play()` passes the bag for every non-trial run.
- [x] Shrine: no bag (owner 4a): `bagAllowed({ trial })` (tests/core/consumable-stock.test.ts) and the shrine loadouts have no bag stage.
- [x] Every boss: spore bomb never stuns a boss and never takes a card below its floor, iterating `bossSpecies()` (tests/core/consumables.test.ts; it caught `shadow-self`).
- [x] Every tier: the revive is barred on Nightmare only, iterating `DIFFICULTIES` (stock and bag-step tests). Nightmare numbers untouched.
- [x] Solo and co-op: per-peer bag (room "Cambiar Pokémon" has the bag step before "Listo"); spore bomb through hit claims; guest lantern through `spentShots`; exit cord refused in shared runs; player snapshot unchanged, PROTOCOL_VERSION unchanged.
- [x] Save/migrate/sanitize, profile merge, cloud payload (tests/app/save-consumables.test.ts); run resume validates the bag (tests/app/bag-model.test.ts).
- [x] Input: keyboard (rebindable, panel lists the actions with es/en names), pad (tests/adapters/gamepad-bag.test.ts), touch and mouse (HUD tap select, tap again to use).
- [x] i18n es/en for every consumable, refusal and stall line (tests/app/consumables-i18n.test.ts); GDD §3, §4 controls, §3 Santuario, §5.
- [x] Sim/prove: proof worlds carry no consumables (tests/sim/prove-no-bag.test.ts); runner `bag` option and bot policy (tests/sim/bag-policy.test.ts).
- [x] Art: an original 12x12 icon per consumable and a 16x16 bag icon for the stall service (pixel-icons test).
- [ ] Pending (not dropped): bag skins (the doc's cosmetic for rare pulls once all rares are unlocked); the sprout used on a fallen ally in co-op (needs a message to the fallen peer, so a protocol change); a walkable stall NPC on the Refugio map (today: town menu, quick access and hub); the ~500 ms rooted use animation of the design; Sima merchant selling tonics; balance report columns with and without the bag.

## Log

- L1 2026-11-12: the Orca coordinator's brief (task_faa27c29d1c4) for `feat/items-bag`, quoting the owner's approved options 1(a), 2(a), 3(b), 4(a); option 5 belongs to the Nightmare worker.
- L2 2026-11-12: browser check on the dev server (Playwright, scratch /tmp/items-bag-xhDB): bag step lists stock and packs; in the Crypt the HUD shows 3 slots, X selects the spore bomb, G uses it, the log says so and the stored stock goes 2 -> 1.
