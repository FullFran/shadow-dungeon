# Perilous cue and counter

Objective: every attack a roll does not avoid (`pierceRoll`) reads at a glance, and rolling into one at the right moment counters it. Branch: `feat/perilous-counter` (from `integrate/content-batch`).
Delivery: `ask-on-risk`, work-unit commits; push, merge and deploy are the owner's call. Test runner: `npx vitest run --testTimeout=30000 --maxWorkers=3`.

## Specs

- S1 (cue): "los proyectiles de algunos jefes que no se pueden rodar, quiero que se note que no se puede, como en sekiro que tengan una esclamacion o algo". Every `pierceRoll` source (brain `spawnShot`, `contactPlayer`, spell cards, Sima elites, heralds, Senda bosses) shows, while it winds up, a big red "!" mark of our own pixel art over the attacker, with its own sound; perilous shots in flight carry a red rim with spikes that pulses on top of the bullet art (core = hitbox, the idle-chunk bake untouched). Readable at 568x320, colour-blind safe (shape, not only colour), derived from snapshots for a guest.
- S2 (counter): "y si se pudiese hacer como el contraataque mikiri seria una locura". Rolling TOWARDS an incoming perilous shot or perilous melee strike, with the hit landing within a short window from the roll's start (data/tuning, shorter on Hard/Nightmare), counters it: no damage, the shot is destroyed, a flash and a sound, the attacker is staggered and takes a hit scaled like the perfect dodge reward. Mistimed: the full hit as today. Our own name (no Sekiro names, kanji, sounds or art). Available on every tier. Solver proofs do not depend on it. Tests: window edges, direction, each perilous source, co-op victim side (guest counters on its screen, its hit goes through the claim path), determinism.
- S3 (teach): a one-time tip the first time a perilous attack appears (settings seen flag like `bossPhaseTipSeen`), tutorial/help text, GDD §9 and a combat section, i18n es/en, keyboard/touch/pad wordings through src/ui/device-wording.ts.
- Assumption: zones away from the attacker (pockets, target marks, lanes, rings) are ground, not strikes: they show the cue but cannot be countered; a strike is counterable only within melee reach of its attacker.
- Assumption: a countered shot's attacker is the shot's shooter as every peer can tell it from the world (the nearest living enemy behind the shot, a boss first), so no new wire field.

## Tasks

- T1 (S2) inline (no writer reason: one behaviour, ~450 lines): pure counter rule (core/counter.ts), tuning, landHitOnPlayer outcome, combat/brain wiring, stagger strike, tests. Status: done, 96ada4c0. RED: tests/core/counter.test.ts 7 failed before wiring (outcome, events, counterDue, claim); GREEN 23/23.
- T2 (S1) inline: perilous mark and rim (pure geometry + pixel art), renderer, sound, counter flash/haptics. Status: done, b6293f58. Art tests written with the module (no separate RED observed); audio/haptics cases RED-free additions.
- T3 (S3) inline: tip flag, sign, i18n, GDD, boot tip. Status: done, 4992168c. RED: settings 3 failed and perilous-tip module missing before implementation; GREEN.

## Parity checklist

- [x] Every `pierceRoll` source shows the "!": the renderer draws it wherever `pierceZone` (core/victim.ts) names a perilous wind-up, which covers spell cards, brain telegraphs, Aegislash/Sableye/Trevenant/Decidueye/swamp bosses/Eclipse Echo, deep Sima elites, heralds' pockets and the Senda kit cards (tests/ui/perilous-tip.test.ts: elite and Midnight on Hard)
- [x] Every perilous shot in flight shows the rim: `enemyShot` reads `pierceRoll`, which host and guest projectiles carry (snapshot flag already on the wire)
- [x] Counter: shots and melee, solo, host and guest claim path (tests/core/counter.test.ts, every-source block and co-op block)
- [x] Every tier has a window (`TUNING.counter.windowMs`, test iterates `DIFFICULTIES`)
- [x] Settings flag `perilousTipSeen`: default, sanitize, older saves (tests/app/settings.test.ts)
- [x] i18n es/en, device wordings keys/touch/pad (`tutorial.perilous.*`, `hud.counter`, `boot.tip.9`)
- [x] GDD §9 rule 5 and §4 «Contrapaso»
- [x] sim/prove untouched: the solver only walks (src/sim/prove.ts header), so no counter can happen in a proof; failure set compared with the base run
- [ ] PENDING: the balance bots (src/sim/bots.ts) do not try to counter (kept as is by the brief); a real two-peer session not run
- [ ] PENDING: the FX director (baked pixelfx) has no dedicated counter effect; the flash, toast, hitstop and sound carry it

## Log

- L1 (2026-11-12, owner, verbatim): "los proyectiles de algunos jefes que no se pueden rodar, quiero que se note que no se puede, como en sekiro que tengan una esclamacion o algo y si se pudiese hacer como el contraataque mikiri seria una locura".
- L2 (2026-11-12): base `integrate/content-batch` @215bf4f1 `npm run prove` fails 33 Nightmare kill-margin band checks, not only sc-dhe-chain (log ~/.cache/perilous.uMbc/prove-base.log); this branch is judged by the same failure set.
- L3 (2026-11-12): checks. typecheck exit 0; full vitest 14 failed / 6412 passed, the 14 are tests/sim/prove-witness-{1,2} Nightmare band and solver-fight checks that fail identically on the base with its committed witnesses; build exit 0; prove 33 FAIL lines, the same set as the base (diffed), 217/217 cards survivable, 24/24 solver fights. Browser (dev server, scratch copy with an inject hook, ?spawn=poochyena, 844x390 and 1280x720): mark, tip sign, rims and a counter (player 100/100, enemy 70 to 53, stagger); shots in ~/.cache/perilous.uMbc/shots.
