# four-slots

## Objective
Players get four move slots: fast, heavy, a BOOST slot (self-buff on a cooldown) and an AREA slot (cone / ring / line wave on a cooldown and stamina), on keyboard, touch and the HUD, chosen in the loadout and used by the balance bots.

## Problem
The model allowed up to 4 slots and a `boost` kind, but the layout, input, touch, HUD, loadout UI and bots only knew two slots, and no species had boost or area moves.

## Why
More attack choices per starter without trivialising the souls feel: boost and area moves are gated by cooldowns (and area moves by stamina), not spammable.

## Scope
- T1 Model + input: `SlotKind` 'area'; layout [fast, heavy, boost, area]; keys boost R / 1, area F / 2; touch two extra buttons; four compact HUD slot windows; `PlayerInput.slots` length 4 with back-compat (missing entries = not held); old 2-entry loadouts padded with the species defaults.
- T2 Boost moves (cooldown, no stamina): Mimikyu Danza Espada, Zorua Maquinación, Litwick Fuego Fatuo, Cubone Corpulencia; visual aura + sound; cooldown in the HUD slot.
- T3 Area moves: two per species, longer cooldowns + stamina, type-coloured VFX, heavy juice; loadout UI with four slots, persisted.
- T4 Balance (bots optionally use boost/area) + GDD §4 + README.

## Constraints
- Allowed surfaces: odd/tasks/four-slots.md, src/**, tests/**, tools/**, index.html, README.md, docs/gdd.md, reports/**.
- Other writers run in parallel: edits scoped and additive.
- Solo golden digest (tests/core/difficulty-tiers.test.ts) must keep its behaviour: its scripted inputs never press slots 3–4.
- One work-unit commit per task, Conventional Commits, no AI attribution; no push/merge.

## Tasks
- [x] T1 Model + input + touch + HUD layout (route: inline in this bounded writer; trigger evidence: one writer owns the whole feature).
- [ ] T2 Boost moves + buffs + cooldowns + HUD cooldown + sound/VFX.
- [ ] T3 Area moves + VFX + loadout UI (4 slots).
- [ ] T4 Bots use boost/area, balance before/after, GDD §4, README, screenshots.

## Acceptance
- `npm test`, `npm run build` green; architecture test green.
- Golden digest unchanged once the two new slots are projected out (same behaviour).
- Touch buttons ≥44 px and non-overlapping (test); four HUD slots inside the HUD space with no overlap at 1280x720, 1920x1080, 1024x640 and touch 844x390 (test).

## Checks
npm test, npm run build, npm run balance -- --quick.

## Progress
- Created on branch feat/four-slots from main 868530d.
- Balance before: `npm run balance -- --quick` → 60 runs, 72 arena fights, 0 failures, 49 warnings, 64 passes (saved to /tmp/four-slots/before/latest.md).

- T1: RED observed (tests/core/four-slots.test.ts, tests/adapters/four-slots-input.test.ts: 12 failures, missing layout/keys/buttons/compact slots), then GREEN. `PLAYER_SLOT_LAYOUT` = [fast, heavy, boost, area]; `padLoadout` fills a two-move save or an older peer's hello with the species defaults (createPlayer and loadSettings). Keys: boost R / Digit1, area F / Digit2 (keys only; mouse unchanged: middle stays the lock). Touch: `small` 52 px Boost/Area buttons left of Heavy (cluster 232x170), hidden while their slot is empty. HUD: more than two slots are 88 px compact, one row when clear of the message log (desktop), else 2x2 (touch 512x320). HUD keeps the two-window M0 look while boost/area are empty. Golden digest: unchanged (bebcc214) with the two new loadout/held entries projected out (`twoSlots` in tests/core/difficulty-tiers.test.ts).
- T1 checks: npm test 148 files / 1403 tests passed; typecheck clean.

## Next step
T2.
