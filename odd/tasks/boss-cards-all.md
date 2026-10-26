# Boss cards for every boss, provable beatability

## Objective
Every boss with a card cycle (Sableye, Trevenant, Lanturn, Dhelmise, Salazzle, Nihilego) fights on the unified spell-card framework from Normal on, with their patterns unchanged; every card boss gets a readable "your turn" beat; Sima echoes play their tier's cards by depth; card presentation reads "Touhou inside, souls/MD outside"; and a proof pipeline shows that every card can be survived and broken.

## Problem
Only Aegislash, Decidueye and the heralds use `core/cards.ts`. The other six bosses run their own cycles with no HP segments, timers, declarations or captures. Echoes skip cards. Nothing proves a fight can be won: the guardian simulation in tests checks one loop against a still player.

## Why
User decisions 2026-10-26 (A, B, C, D), plus two additions during the work: the proof must also show that the boss can be damaged (punish windows, kill feasibility), and the "ritmo por turnos" principle (a TU TURNO window after every combo).

## Scope
- A: hosted spell cards. A card can hold `moves` (the boss's own moves, played by its own engine) instead of `steps`. The card owns the HP segment, timer, declaration, capture. The native engine runs restricted to the card's moves. Easy keeps the native fight.
- T: "ritmo por turnos". After every combo, a turn window per tier from data, with floors. During it the boss starts no new threats and the remaining enemy shots fade quickly.
- D: proof pipeline in `src/sim/prove.ts`. (1) A walk-only witness search per card, tier and start position, run against the real engine. (2) Framework invariants that give liveness. (3) A solver bot that clears whole fights on Nightmare. (4) Punish windows and kill feasibility. GDD section "Garantía de que todo se puede pasar".
- C: echoes play the tier's cards by depth, at a lower HP share.
- B: presentation pass (declaration moment, capture flourish, ring timer, notch pulses).

## Constraints
- Core stays pure and deterministic. The architecture test, `npm test` and `npm run build` stay green.
- The golden digest stays unchanged (Easy is untouched).
- Another writer adds evolved enemies in parallel, so edits stay in boss and card files.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is a planning heuristic only.

## Tasks
- [x] A Hosted cards for the six bosses (route: inline, this writer is the delegated agent)
  - `SpellCardDef.moves` + `BossState.spell` (synced) + `core/cards.ts` `updateHostedCardFight`/`spellOf`/`isDeclaring`. Each native engine (thief, treant, danmaku, queen, ultra) is restricted to the card's moves and never awakens on its own. A `phase2` card sets phase 2. `CardFightDef.dismiss` removes Salazzle's court at a card's end. Party area moves go into `partyMoves` (once per loop).
  - Data in `src/data/hosted-cards.ts` (table in GDD). Easy is unchanged (`behaviourFor(easy)` is the same object).
  - Tests: `tests/core/hosted-cards.test.ts` (41). Existing tier tests now ignore `declare` telegraphs and compare normal as `{...def, spellCards}`. The Trevenant hard-rotation test drives its native engine directly.
  - Evidence: `npm test` 1688 passed; `npm run build` ok; `npm run balance -- --quick` 0 failures (the report was not committed, the full sweep stays the committed one).
- [ ] T Turn windows ("ritmo por turnos")
- [ ] D Proof pipeline + solver bot + GDD guarantee
- [ ] C Sima echoes on cards by depth
- [ ] B Presentation pass + screenshots

## Progress / evidence
(filled per task)
