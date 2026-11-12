No hold on a boss's last card, and a clear, well-shown spell card timer. Branch `feat/last-phase-and-timer` (from local `integrate/content-batch` 0055ea8b).
Delivery: work-unit commits on the branch; push/merge/deploy are the owner's. Runner: vitest (`npx vitest run --testTimeout=30000 --maxWorkers=3`), proof `npm run prove`, band `npx vite-node tools/nightmare-band.ts --write`.

## Specs

- S1 Last phase: "y la franja de vida de la ultima fase... tenemos que quitar que si le das el golpe de que apenas le queda vida que no aguante. en le resto de fases si". On a boss's LAST card, a hit that would take its remaining HP kills it (no floor, no pace hold, no "¡Aguanta!"); every earlier card keeps its floor and hold exactly as today. For every card boss: guardians, hosted bosses, Senda shadows and wounds, heralds, Sima echoes, shrine fights; solo and co-op (a guest's claimed hit on the last card kills on the host).
- S2 Research: "busca referencias de otros juegos que lo hagan y ponlo que se vea bien". docs/research/boss-timer.md (short): what makes each reference readable, and our design.
- S3 Timer: "hay que hacer que se entienda y se vea muy bien la mecanica del tiempo". At a glance: what happens when the clock runs out, what breaking the card before wins (the capture), how much time is left (bigger hourglass, centred/tied to the card, red in the last 5 s, a tick sound in the last seconds), a clear "¡Carta superada!"/"¡Tiempo!" result banner, and a first-time tip stored like `bossPhaseTipSeen`. Original art and text. Readable at 568x320 and for colour-blind players; same for a co-op guest.
- S4 Proofs: `npm run prove` keeps every card survivable; prove, re-run the Nightmare band (`--write`), prove again (a known failure on sc-dhe-chain `kill margin > 1.8` is reported, not fixed here).
- Mapped today (code): a timed-out card loses the rest of its segment (HP drops to the floor, core/cards.ts `endCard`), gives no capture, and the next card is declared; on the last card the timeout fells the boss. A capture needs the card broken (or survived) without the player being hit: +`CAPTURE.healShare` max HP now and `CAPTURE.coins` at the end (core/cards.ts `updateCapture`).
- Assumption (A1): "last card" is the card whose segment floor is 0 (the last card of the fight that is played: an echo's last kept card, a herald's last card). Every hold path (`holdBoss`) reads it the same way.
- Assumption (A2): the guest learns the card clock from a new optional snap side channel (older guests ignore it), which also carries `held` and the hosted `spell` id (the wire dropped both before).

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S1 | inline | done | 56e82b13; RED 67/68 tests/core/last-card-kills.test.ts + 3 card-floor (last spell held), GREEN 77/77 |
| T2 | S4 | inline | done | a733c08e; prove 1: 33 Nightmare `kill margin > 1.8` (no other failure); band --write; prove 2: 217/217 survivable, only sc-dhe-chain 1.91 > 1.8 (known, another worker) |
| T3 | S2 | inline | done | bef81c72 docs/research/boss-timer.md |
| T4 | S3 | inline | done | 39edc386; RED module missing, GREEN 9/9 tests/ui/card-clock.test.ts |
| T5 | S3 | inline | done | 200f08c8; 5/5 tests/net/card-clock-wire.test.ts (RED was a type error on `cardTimerMs`/`clock`, not a separate run) |
| T6 | S3 | inline | done | 392abfaa; RED combat-hud-model clock share/seal, settings 5 failing, hud-layout `cardClockRect` missing; GREEN; screenshots below |

## Parity checklist

- [x] Guardians (pattern cards), all tiers: last-card-kills data test (every tier) + world test aegislash, decidueye (nightmare)
- [x] Hosted bosses (moves cards): world test sableye, trevenant, lanturn, dhelmise, salazzle, nihilego
- [x] Senda shadows and wounds: data test over every card boss (`CARD_BOSSES`, 50+ Senda) x tiers through `holdCard` (the same path `updateCardFight` uses)
- [x] Heralds (core/herald/brain.ts own hold path): world test, last card dies, card 0 holds
- [x] Sima echoes: data test over echo stages 1-3 of every fight (the last kept card is the last)
- [x] Shrine fights: trials run the same species fights (no hold path of their own: `hpFloor`/`holdBoss` only in core/cards.ts and core/herald/brain.ts)
- [x] Co-op: the guest's claimed hit (applyHitClaims, p2) kills on the last card; guests get clock, hosted card and hold over the wire (tests/net/card-clock-wire.test.ts); banner, ticks and tip run from each peer's own world
- [x] Save/settings: `cardTimerTipSeen` sanitised like `bossPhaseTipSeen` (tests/app/settings.test.ts)
- [x] i18n es/en: `card.clock.*` (tests/ui/card-clock.test.ts checks both catalogs)
- [x] GDD §9 (suelo de carta: la última carta no aguanta) and guardians' presentation (reloj de la carta)
- [x] Proofs and Nightmare band (T2)

## Decisions for the owner

- D1 Timeout rule unchanged: a timed-out card still loses its segment and gives no capture (the clock is a deadline for the reward, not a threat). The banner says so: "¡TIEMPO!" / "La carta pasa sin premio".
- D2 "Last card" = the last card the fight plays (floor 0): a Sima echo's last kept card also kills without hold (a stage-1 echo ends on its last phase-1 card).
- D3 The last card's end shows the existing "¡JEFE DERROTADO!" notice, not a result band.
- D4 The wire now carries a hosted card's id and the hold flag (they were dropped before, so a real-network guest never captured hosted cards nor saw "¡Aguanta!"): optional snap field `c`, older guests ignore it.

## Log

- L1 (2026-11-12, owner, verbatim): "y la franja de vida de la ultima fase... tenemos que quitar que si le das el golpe de que apenas le queda vida que no aguante. en le resto de fases si, y hay que hacer que se entienda y se vea muy bien la mecanica del tiempo. busca referencias de otros juegos que lo hagan y ponlo que se vea bien".
- L2 Map: every card boss clamps hits with core/cards.ts `cardHpFloor` = max(`hpFloor`, `holdFloor`). `holdFloor` (`HOLD_HP` above the segment floor until `CARD_FLOOR` x timer) is set by `holdBoss`, called from `holdCard` (guardians, hosted, Senda, echoes, shrine) and core/herald/brain.ts. On the last card `hpFloor` is 0, so only the hold kept the boss at 1 HP ("¡Aguanta!"). The clock (`cardLeftMs`) is host-only today; the wire drops `boss.held` and `boss.spell`.
- L3 T1 done: `isLastSegment(floor)` in core/cards.ts `holdBoss`; earlier cards unchanged (data test). Stale comments fixed (juice.ts `paceFloor`).
- L4 T2: prove before the band had 33 Nightmare kill-margin failures, many on cards that are not last (the content batch had moved margins too); after `nightmare-band --write` only sc-dhe-chain remains (1.91 > 1.8), the known convergence problem.
- L5 T6 screenshots (headless Firefox, tools/mobile/bidi.mjs, script ~/.cache/sd-last-phase/shots/card-clock-shots.mjs, PNGs in ~/.cache/sd-last-phase/shots/out): 568x320 touch and 1280x720 desktop; tip, calm, urgent, seal lost, "¡TIEMPO!", "¡CARTA SUPERADA!", last card at 2 HP then one hit: boss dead on both. Layout fixes found by them: plate and band left-aligned on touch (thumb buttons), tip under the card announcement and after the location plaque, boss stack makes room so the hint bar never covers the plate.
- L6 Verification: `npm run typecheck`: exit 0. `npx vitest run --testTimeout=30000 --maxWorkers=3`: 6476/6477, the one failure is tests/sim/prove-witness-2.test.ts dhelmise nightmare sc-dhe-chain kill margin 1.91 > 1.8 (known). `npm run build`: exit 0. `npm run prove`: 217/217 survivable, same sc-dhe-chain failure only. package-lock.json left uncommitted (npm ci).
