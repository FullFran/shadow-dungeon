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

- T1 (S2, S3, S7, S8) data/consumables.ts, core/consumables.ts (bag, use, effects, pull, buy), save fields: inline.
- T2 (S7, S11) effects in the step (tonic, salt, dust, feather, sprout), spore bomb claims, lantern on the guest's own shots: inline.
- T3 (S9, S10) loadout bag step, run wiring, HUD, keyboard/pad/touch input, run resume: inline.
- T4 (S2, S12) item stall window (gacha + buy rows), town menu and hub entry: inline.
- T5 (S12) i18n, GDD, prove guard, sim runner: inline.

## Parity checklist

(ticked with evidence at the end)

## Log

- L1 2026-11-12: the Orca coordinator's brief (task_faa27c29d1c4) for `feat/items-bag`, quoting the owner's approved options 1(a), 2(a), 3(b), 4(a); option 5 belongs to the Nightmare worker.
