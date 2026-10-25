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
- [x] T2 Boost moves + buffs + cooldowns + HUD cooldown + sound/VFX.
- [x] T3 Area moves + VFX + loadout UI (4 slots).
- [x] T4 Bots use boost/area, balance before/after, GDD §4, README, screenshots.

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
- T2: RED observed (tests/core/boost-moves.test.ts: 12 of 13 failed), then GREEN. New `self` hitbox, `MoveDef.cooldownMs` + `buff` (power / haste / guard / kindle), core/boosts.ts (cooldowns and buff live on the player only while running; ticked on the player clock). Moves: Mimikyu Danza Espada (next 3 hits x1.5, 9 s, CD 15 s), Zorua Maquinación (walk x1.3 + 35% crit, 5 s, CD 14 s), Litwick Fuego Fatuo (Flash Fire lit at once, CD 16 s), Cubone Corpulencia (damage taken x0.6, 6 s, CD 16 s); no stamina; equipped by default in slot 3. VFX: type-coloured burst on cast + pulsing aura while the buff runs (blinks the last 1.2 s); sound `buff` on buffStarted; HUD slot shows seconds left + emptying bar, border in the type colour while the buff runs; loadout card shows the cooldown and no power for boosts.
- T2 checks: npm test 150 files / 1425 tests passed; typecheck clean; golden digest unchanged (projection).
- T3: RED observed (tests/core/area-moves.test.ts: 10 of 10 failed), then GREEN. Eight area moves, two per starter, tap-only, juice heavy, stamina 30–40, cooldown 6–10 s: Mimikyu Brillo Mágico (Fairy ring, default) / Golpe Umbrío (Ghost 120-power cone, 520 ms wind-up); Zorua Pulso Umbrío (Dark ring, default) / Alarido (Dark wide cone); Litwick Lanzallamas (Fire line wave, pierces, never returns: new `wave` projectile flag, default) / Onda Ígnea (Fire cone); Cubone Terremoto (Ground big ring, default) / Terratemblor (Ground small quick ring). Night Daze stays heavy (moving it would change Zorua's default heavy slot; Pulso Umbrío fills the ring role). Bomba Fango not added (would need a burst-on-impact projectile). VFX reuse the type-coloured arc/ring/fire orb; sound `area` on press; loadout lists boost/area cards (persisted through settings), cards show cooldown and the new `cone` / `wave` shapes.
- T3 checks: npm test 152 files / 1446 tests passed; typecheck clean; content.test.ts now lets area moves pay stamina (with a cooldown).
- T4: RED observed (tests/sim/bot-slots.test.ts: 2 of 4 failed), then GREEN. `BotOptions.slots` (off by default) + `RunOptions.slots` + `npm run balance -- --slots`: perfect/average bots cast the boost before a boss (220 px) or a crowd of 3, and the area move on 2+ enemies (or a boss) in its reach, never into a wind-up; novice/masher never. Without the option the bot input stays the two-entry one. Observation `self` gains loadout, per-slot cooldowns and `buffed`.
- Balance: default `npm run balance -- --quick` after the change is byte-identical to before (0 failures, 49 warnings, 64 passes). With `--slots`: 0 failures, 53 warnings, 60 passes; enemy TTK slightly down on Easy (perfect Crypt 7 → 5 s, Forest 4 → 3 s, Swamp 7 → 5 s), boss TTK about the same (median ratio 1.06 over 21 arenas). Table: reports/balance/four-slots-ttk.md. The sweep plays Mimikyu only.
- Docs: GDD §4 (keys, the four-slot table, touch buttons, stamina, kit tables per starter, harness limits) and README (controls, loadout, touch, `--slots`).
- Screenshots (silent: profile user.js volume_scale 0, localStorage muted): /tmp/four-slots/hud-4-slots.png, hud-4-slots-boost-cooldown.png (cooldown "15 s" + aura), area-mimikyu-*.png (Brillo Mágico ring), area-litwick-3.png (Lanzallamas), area-cubone-3.png (Terremoto ring), loadout-4-slots.png + loadout-4-slots-area.png, touch-844x390.png. Zorua's Pulso Umbrío ring was caught in a first batch that was later overwritten; the retakes land just before or just after its 260 ms window (screenshots ~300 ms apart), so the current zorua files do not show it.
- Known, pre-existing: on touch the HUD slot windows sit under the Heavy/Fast buttons (they did with two slots too; now 2x2 so a little more is covered).
- T4 checks: npm test 153 files / 1450 tests passed; npm run build ok.

## Next step
None in scope; push/PR are the user's decision.
