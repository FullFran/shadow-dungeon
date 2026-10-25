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
- [x] T2 Aegislash spell cards Normal/Hard/Nightmare (route: inline in the bounded writer)
  - New danmaku pattern kinds (data/enemies.ts, core/danmaku.ts): `fan` (alternating gaps, aimed each fan or static), `walls` (shields closing from both sides with one gap row), `turrets` (floating swords at the corners, `atOnce` aimed sources), lanes `snake` (gap walks along) and `alternate` (odd waves from the other end, so no pillar shadow lasts). Telegraphs drawn in danmaku-vfx.ts.
  - Cards (data/aegislash-cards.ts, patched per tier in data/guardian-tricks.ts): Normal 4 (Muralla Cerrada [guard front], Abanico de Medianoche [fans, midnight spin, blade rings, Tajo Real zone at target], Espadas Flotantes [phase 2, guard front, turrets + sword spiral], Cien Espadas [snaking alternating curtain, positional + aimed fans]); Hard 5 (+ survival Corona de Espadas 16 s; walls x1.15 speed, fans x1.22 density + ring layer, swords +2 volleys + ring layer, curtain x1.1 speed); Nightmare 7 (Hard + aimed layers, Juicio del Rey, last word Rey sin Reino at 12 %).
  - Old duel tests in difficulty-content.test.ts now drive the duel in a Sima echo / through `updateBoss` directly (Normal+ plays cards).
  - Evidence: tests/core/guardian-cards.test.ts (structure, names, telegraph floors incl. zone lock >= 400 ms scaled, <= 2 aimed threats, <= 3 layers, density/speed knobs, simulated safe path per card, no safespot beside any pillar, shot cap, in-run declaration/segments, Easy and echo unchanged). Gate can fail: a gapless curtain in a bare room fails, a one-way curtain leaves a pillar safespot (both asserted); the first data had pillar safespots on Abanico and Cien Espadas, fixed by Tajo Real and alternating curtains. Full suite 143 files / 1407 tests, build ok.
- [x] T3 Decidueye spell cards Normal/Hard/Nightmare (route: inline in the bounded writer)
  - data/decidueye-cards.ts, patched in data/guardian-tricks.ts. Normal 4: Signo Sombra «Andanada del Arquero» (aimed arrow fans, then the four clones two at a time over leaf rings), Signo Hoja «Abanico del Claro» (shifting leaf fans, then the dive onto a locked mark, positional), Signo Pluma «Plumas en Espiral» (phase 2: feather spiral, then clone crossfire from the four corners), Signo Niebla «Lluvia del Arquero» (snaking rain from above then below, positional, then aimed arrows). Hard 5: arrows x1.15, leaf fans x1.22 + ring layer, counter-rotating feather layer + 2 clone volleys, rain x1.1, plus survival Signo Bosque «Bosque de Flechas» (15 s). Nightmare 7: aimed clone layers, Signo Sombra «Costura de Sombras» and Última Flecha «Noche sin Luna» (last 12 %).
  - The pillar-safespot check found tree shelters (below and beside the trunks against patterns from the boss); fixed by firing the clones from all four corners in turn.
  - forest-difficulty.test.ts changed on purpose: normal Decidueye only gains `spellCards`; the hard card rotation is checked in a Sima echo.
  - Evidence: guardian-cards.test.ts now covers both guardians (49 + 1 tests); full suite 150 files / 1470 tests green.
- [x] T4 Guardian damage on Hard/Nightmare + docs (route: inline in the bounded writer)
  - `CardFightDef.power`: Normal 1, Hard 1.12, Nightmare 1.22 for both guardians (on top of the tier's damage); every shot and melee move of a card carries it. Main's one-hit cap (35 % of the reference max HP, core/fairness.ts) bounds the result; Easy unchanged.
  - Dev `?card=N` (core/cards.ts `atCard`): starts a spell-card guardian on card N with its segment full.
  - Tests: guardian-cards.test.ts damage block (power per tier, shots carry it, the strongest card hit on every starter stays under the cap); cards.test.ts `atCard`.
  - Screenshots (silent: profile user.js volume 0, localStorage muted): `/tmp/guardians-touhou/aeg-nightmare-{0..6}-*-{a,b}.png` (Muralla closing walls, swords + rings, Cien Espadas curtain with its lane, Rey sin Reino spiral) and `dec-hard-{0..4}-*-{a,b}.png` (counter-rotating feather spirals, snaking rain). Readable; the player camera (512x320 of the room) hides the corner turrets and the boss in some shots.
  - Docs: GDD (Spanish) section on spell cards, README dev `?card=`.

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
