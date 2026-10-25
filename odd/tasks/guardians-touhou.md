# Guardians Touhou remaster (Aegislash, Decidueye)

## Objective

Turn the Crypt and Misty Forest guardians into real spell-card (danmaku) fights on the harder tiers, the way Dhelmise already works on nightmare, without touching Easy.

## Problem

User feedback 2026-10-25: "Aegislash necesita remasterizarse para ser más difícil en las dificultades difíciles, es un chiste, no es touhesco; el segundo jefe igual, aunque está un poco mejor logrado." On Hard and Nightmare Aegislash is the same melee duel with three light phase-2 cards; Decidueye has a few patterns but no spell-card structure.

## Why

docs/souls-difficulty-research.md P4 (cards with an HP segment and a timer, capture reward, survival cards from Hard, nightmare adds a card or a last spell, per-tier knobs with caps) and P5 (fairness: safe path, telegraph floors 280/400 ms, at most two aimed threats per player, one-hit cap 35 %).

## Scope

- T1 Card framework (minimal) in `src/core/cards.ts` + `src/data/cards.ts` (same file names as the procedural-boss writer so the integration can unify them): a fight is a sequence of spell cards; each owns an HP segment and a timer; the card ends when its segment is depleted or it times out; capture (no hit during the card) gives a small per-player reward (coins and a heal); the card name is announced (banner); the boss bar shows the segments.
- T2 Aegislash Touhou-ized on Normal/Hard/Nightmare (cards; Easy keeps the shipped duel).
- T3 Decidueye upgraded the same way (cards from Normal; new cards and survival on Hard/Nightmare), trees still cover.
- T4 Guardian damage raised on Hard/Nightmare within the 35 % one-hit cap (data), Easy unchanged; docs (GDD Spanish, README).

## Constraints

- Deterministic core; Easy golden digest (tests/core/difficulty-tiers.test.ts) unchanged.
- Same card gains density/speed/layers/aim per tier, never density and speed both above x1.3 on one card.
- pierceRoll cards keep a >= 400 ms choice telegraph after tier scaling; every telegraph >= 280 ms.
- Projectile cap per fight (`maxShots`); pillars and trees (cover) still stop shots.
- Sima echoes stay phase-1-only/lighter (the card fight never runs in an echo).
- Snapshot protocol unchanged: card id in `boss.stance`, pattern in `ai.attack`, part in `boss.comboIndex`.

## Tasks

- [x] T1 Card framework (cards, segments, timer, capture, banner, bar segments) (route: inline in the bounded writer)
  - `src/data/cards.ts`: `SpellCardDef` (id `sc-…` = the boss stance, `nameKey`, `hpShare`, `timerMs`, `survival`, `lastSpell`, `guard: 'front'`, `phase2`, `restMs`, `steps` = danmaku patterns plus `layers`), `CardFightDef` (cards, aggro, `breakMs`/`phase2BreakMs` declarations, `maxShots`, drift, `power`), `CAPTURE` (8 coins, 12 % max HP), `registerCards`/`cardInfo` (name, guard and survival from the id alone, for guests).
  - `src/core/cards.ts`: `updateCardFight` (declare → moves looped → end on floor or timer; ending clears enemy shots; timeout loses the segment; last-card timeout defeats), `cardFloors`, `cardHpFloor` (combat.ts and sync.ts claims clamp to it), `cardGuard` (blocksHit: all while declaring or surviving, front for Shield cards), `cardMelee`, `cardTimeLeftMs`, `updateCapture` (each peer for its own player; outcome read from the declaration's `ai.attack`), danmaku.ts refactor (`firePattern`, `patternParts`, `patternAttackMs`, `patternMelee` exported, behaviour identical).
  - Wiring: `updateBoss`/`updateArcher` delegate when `def.spellCards` and not in a Sima echo; `step` runs `updateCapture`; coins count `cardCaptured` (guardian line); `bossBar` adds segments and the host clock; HUD notches and seconds; `spellCardKey` names cards; renderer draws declarations and move telegraphs (`drawCardFight`); guest contacts and pierce zones know cards.
  - Decision: capture is per player on each peer (research P4.5 "por jugador, no por grupo"), not party-wide: it needs no protocol change and a guest heals itself victim-side.
  - Evidence: `tests/core/cards.test.ts` 12 tests green (written alongside the engine, RED not observed separately); full suite 142 files / 1380 tests green, golden digest unchanged.
- [ ] T2 Aegislash spell cards Normal/Hard/Nightmare
- [ ] T3 Decidueye spell cards Normal/Hard/Nightmare
- [ ] T4 Guardian damage on Hard/Nightmare + docs

## Acceptance criteria

- Normal+ Aegislash and Decidueye fight as spell cards; Easy plays exactly as shipped (golden digest).
- Tests: card sequencing, segment/timer/capture, per-tier modifications, fairness (safe path by simulation per card, telegraph floors, caps).
- `npm test` and `npm run build` green; screenshots of Aegislash on Pesadilla and Decidueye on Difícil mid-card in `/tmp/guardians-touhou/`.

## Checks

`npm test`, `npm run build`, headless Firefox screenshots.

## Delivery

Strategy: ask-on-risk (default). Forecast: well above 400 authored lines (engine + data + tests); one work-unit commit per task on `feat/guardians-touhou`; push/PR are the user's decision.

## Progress

(updated per task)
