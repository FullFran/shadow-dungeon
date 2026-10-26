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
- [x] T Turn windows ("ritmo por turnos") (route: inline)
  - `TierDef.turnMs` (1600/1300/1000/800) + `TURN_FLOOR` (700 ms; last spell ×0.75 ≥ 600 ms; no turn in survival cards; shots fade within 350 ms). `core/cards.ts` `turnMsFor`/`startTurn`/`inTurn` (`recover` + `ai.attack = 'turn'`, event `bossTurn`).
  - Pattern cards: a turn after every pass of a card's moves, two moves at most (`COMBO_STEPS`). Hosted cards: after each of the boss's own moves, absorbing its own rest. Heralds: after every cycle. Sima pacts that speed up enemies lengthen the turn in enemy time, so it lasts the same in real time.
  - Tests: `tests/core/turn-windows.test.ts` (8 bosses × 3 tiers × every card, plus a herald). guardian-cards `loopMs` now counts turns (cap 20 s).
  - Evidence: `npm test` 1714 passed, `npm run build` ok, `npm run balance -- --quick` 0 failures.
- [x] C Sima echoes on cards by depth (route: inline; committed before D because the proof covers echoes)
  - `ECHO_CARDS`: phase 2 from floor 25, everything from 35 or on a second encounter, timers ×0.8.
  - `core/cards.ts` gains `echoStageAt`, `echoCards`, `echoShare` and `fightFor`. `run.ts` sets `EnemyScale.echoStage`.
  - An echo keeps only the HP of the cards it plays. Every card engine reads `fightFor`. Easy keeps the duel.
  - Tests: `tests/core/echo-cards.test.ts`. Tests that reached the native duel through an echo now drive the native engine directly.
- [x] D Proof pipeline + solver bot + GDD guarantee (route: inline; the searches ran as parallel `npm run prove` workers)
  - `src/sim/prove.ts`:
    - walk-only witness search on the real engine (depth-first, then beams of 24/96/192, one state per 16 px cell) and witness replay;
    - `turnPunish` probe (melee within 34 px, line of fire within 200 px, windows of at least 600 ms);
    - reference DPS at `expectedLevel` and the kill margin;
    - the solver bot, `solveFight`.
  - `tools/prove.ts` runs it as `npm run prove` (flags `--judge`, `--fresh`, `--boss`). Witnesses go to `reports/proof/witnesses.json` and the table to `reports/proof/latest.md`.
  - CI replays every witness: `tests/sim/prove-witness-{1,2,3}.test.ts`. The liveness invariants and the falsification test live in `tests/sim/prove-invariants.test.ts`.
  - Fixed by the proof:
    - mark locks: Tajo Real 520→760 ms, Picado 520→700 ms, Corriente 760 ms through `markLockMs`;
    - the turn now opens at the end of the attack and lasts at least as long as the recovery (`COMBO_STEPS` 1);
    - the boss's own rest is kept after the turn (`BossState.restMs`);
    - HP shares and `hpScale` for Aegislash (Normal), Sableye, Lanturn, Dhelmise (Nightmare), Salazzle and Nihilego;
    - echoes at 60 % of the guardian's HP, with no growth from depth.
  - Known damage gaps: 23, each with its reason, in `src/sim/kill-gaps.ts`. Most are Aegislash's Shield cards, Decidueye's volleys and Nihilego's shard rings, where a melee starter cannot reach the boss within its turn. The tests fail on any new gap and on any stale entry.
  - Result: all 166 cards survivable from 3 starts (498 witnesses). The solver clears 24/24 Nightmare fights without a hit, in 78–262 s. It breaks 0–4 cards per fight; the rest time out.
- [x] B Presentation pass + screenshots (route: inline)
  - Declaration (`drawCardDeclaration`): the screen darkens, the card's name shows big with the small Touhou line above it, and the `cardDeclare` sting plays.
  - Capture: «¡Técnica dominada!» and its reward, with a flourish and the `cardCapture` sound.
  - Bar: the timer is a ring next to it. Notches read as phases: passed ones dim, and the live one turns gold and pulses during the turn.
  - Turn: a breathing halo and the `turnOpen` sound.
  - The banner waits while the game is paused. New dev param: `?cardHp=`.
  - Screenshots (silent headless Firefox over BiDi), in `/tmp/boss-cards-all/`: `01-declaration-dhelmise-nightmare.png`, `02-tecnica-dominada-lanturn.png`, `03-dhelmise-segmented-bar.png`, `04-salazzle-segmented-bar.png`, `05b-sima-echo-nightmare-playing.png`.

## Progress / evidence
- `npm run build`: ok.
- `npm run balance -- --quick`: 0 failures, 39 warnings (report not committed).
- `npm run prove -- --judge`: 166 cards, all survivable; 24/24 solver fights cleared.
- Next: close the 23 known damage gaps (longer turns, or openings closer to the boss, for melee starters on the Shield cards and volleys). Decide whether the solver bot should attack more.
