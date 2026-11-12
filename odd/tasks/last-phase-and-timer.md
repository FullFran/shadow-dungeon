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
| T1 | S1 | inline | todo | |
| T2 | S4 | inline | todo | |
| T3 | S2 | inline | todo | |
| T4 | S3 | inline | todo | pure model: clock plate, tick, result banner, tip |
| T5 | S3 | inline | todo | net: card clock to guests |
| T6 | S3 | inline | todo | render, audio, settings, i18n, GDD, screenshots |

## Parity checklist

- [ ] Guardians (pattern cards), all tiers
- [ ] Hosted bosses (moves cards)
- [ ] Senda shadows and wounds
- [ ] Heralds (core/herald/brain.ts own hold path)
- [ ] Sima echoes (echo stages: last kept card)
- [ ] Shrine fights
- [ ] Co-op: guest claim on the last card kills on the host; guest sees the clock, banner and tip
- [ ] Save/settings: tip flag sanitised like `bossPhaseTipSeen`
- [ ] i18n es/en
- [ ] GDD §9 (suelo de carta) and boss presentation
- [ ] Proofs and Nightmare band

## Log

- L1 (2026-11-12, owner, verbatim): "y la franja de vida de la ultima fase... tenemos que quitar que si le das el golpe de que apenas le queda vida que no aguante. en le resto de fases si, y hay que hacer que se entienda y se vea muy bien la mecanica del tiempo. busca referencias de otros juegos que lo hagan y ponlo que se vea bien".
- L2 Map: every card boss clamps hits with core/cards.ts `cardHpFloor` = max(`hpFloor`, `holdFloor`). `holdFloor` (`HOLD_HP` above the segment floor until `CARD_FLOOR` x timer) is set by `holdBoss`, called from `holdCard` (guardians, hosted, Senda, echoes, shrine) and core/herald/brain.ts. On the last card `hpFloor` is 0, so only the hold kept the boss at 1 HP ("¡Aguanta!"). The clock (`cardLeftMs`) is host-only today; the wire drops `boss.held` and `boss.spell`.
