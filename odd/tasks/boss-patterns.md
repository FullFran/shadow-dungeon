Boss pattern engine and new spell cards. Branch `feat/boss-patterns` (from origin/main 5c76039 + docs/boss-pattern-research).
Delivery: work-unit commits on the branch; push/merge are the owner's. Runner: vitest (`npx vitest run`), proof `npm run prove`.

## Specs

- S1 Engine batch 1(b): "E1 port the herald primitives to every boss + E2 accel/curve/gravity + E3 orbiting familiars/turrets + E4 bounce (E5 hold/relaunch and E6 split stay pending)". Deterministic, unit-tested, in pure `core/` modules.
- S2 Net: "net sync of the new bullet kinematics (bump the protocol version once if needed and keep old-version peers refused cleanly, as the repo already does)".
- S3 Cards 2(b): "for the 8 dungeon bosses one new card also on Normal replacing that boss's weakest card, the rest on Hard/Nightmare; for the 48 Senda bosses, new templates only on Hard/Nightmare". Spanish and English names, telegraphs per GDD §9, fairness, co-op scaling.
- S4 Hitbox 3(a): "the bright core is the hitbox, the glow is harmless" (another worker draws the art; this feature owns kinematics and hitbox sizes).
- S5 Lasers 4(a): "lasers are lines of fast shots with a warning, as the heralds do".
- S6 "Also fix: Aegislash Nightmare maxShots 170 exceeds the global ENEMY_SHOT_CAP 160."
- S7 "`npm run prove` must keep every card survivable (add the new ones to it); GDD boss sections; i18n."
- Assumption (A1): "weakest card" = the Normal card with the lowest HP share; ties broken by the highest Normal kill margin in reports/proof/latest.md. The replaced card stays on Hard and Nightmare (no content is lost).
- Assumption (A2): extra cards go on Hard and Nightmare; a card the research marks "(Nightmare)" goes on Nightmare only unless the existing rule "Nightmare adds 1-2 cards over Hard" (tests/core/guardian-cards.test.ts, hosted-cards.test.ts) forces it onto Hard too (Aegislash's edict, Nihilego's neurotoxin); Lanturn's bolt stays Nightmare-only.
- Assumption (A3): the research's Senda `hang` template needs E5 (pending); Ghost/Dark/Poison (and any other unmapped type) Senda bosses get a `curl` template (curving veils, E2) instead, `hang` stays pending. There are 50 Senda bosses in the data (the research counted 48); all 50 get their extra card.

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1 S4 | inline | done | 47c3491; RED 3 world tests failing, GREEN 15/15 tests/core/kinematics.test.ts |
| T2 | S1 S5 | inline | done | c569499; RED missing exports, GREEN 13/13 tests/core/pattern-kinds.test.ts, 15/15 tests/adapters/danmaku-vfx.test.ts |
| T3 | S2 | inline | done | 47c3491; RED 6/7 failing (version 5, kin undefined), GREEN 7/7 tests/net/kin-wire.test.ts |
| T4 | S3 | inline | done | c569499 + 15c4fd0; RED shots 0 / phase undefined, GREEN 2/2 tests/core/hosted-pattern-cards.test.ts |
| T5 | S3 S6 S7 | inline | done (proof pending) | 15c4fd0; card-fairness 8 i18n RED then GREEN; guardian safespot RED then GREEN |
| T6 | S3 S7 | inline | todo | Senda templates orbit, beam, curl on Hard/Nightmare |
| T7 | S7 | inline | todo | telegraphs (danmaku-vfx), GDD, i18n |

## Parity checklist

- [ ] Every dungeon boss (Aegislash, Decidueye, Sableye, Trevenant, Lanturn, Dhelmise, Salazzle, Nihilego): new card on Normal + extras on Hard/Nightmare.
- [ ] Every Senda boss (48, roads of 8 lines incl. wounds): extra template on Hard and Nightmare.
- [ ] Sima echoes (`ECHO_CARDS`) and challenge dungeons / shrine reuse the fights: new cards reach them.
- [ ] Heralds: generator rolling kinematic shots (needs closed forms in core/herald/fairness.ts) — pending.
- [ ] Solo and co-op: aims only at the current target; party scaling unchanged (HP/damage); no per-player bullets.
- [ ] Net protocol: kinematics on the wire, version bumped once, old peers refused.
- [ ] Save/migrate/sanitize: no save field changes (cards are not saved) — n/a, checked.
- [ ] i18n es/en: banner `spell.*` and stance `boss.stance.*` for every new card.
- [ ] GDD (`docs/gdd.md`) boss sections.
- [ ] Prove: witnesses for every new card, all survivable, all fights cleared.
- [ ] Telegraphs drawn from snapshot fields for every new pattern kind.

## Log

- L1 (2026-11-12, coordinator brief): "Task: boss pattern engine and new spell cards (branch `feat/boss-patterns`) ... Owner-approved options: 1(b) engine batch = E1 port the herald primitives to every boss + E2 accel/curve/gravity + E3 orbiting familiars/turrets + E4 bounce (E5 hold/relaunch and E6 split stay pending); 2(b) for the 8 dungeon bosses one new card also on Normal replacing that boss's weakest card, the rest on Hard/Nightmare; for the 48 Senda bosses, new templates only on Hard/Nightmare; 3(a) hitbox convention: the bright core is the hitbox, the glow is harmless (another worker draws the new bullet art; you own kinematics and hitbox sizes); 4(a) lasers are lines of fast shots with a warning, as the heralds do. Also fix: Aegislash Nightmare maxShots 170 exceeds the global ENEMY_SHOT_CAP 160."
