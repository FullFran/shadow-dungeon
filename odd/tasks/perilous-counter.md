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

- T1 (S2) inline: pure counter rule (core/counter.ts), tuning, landHitOnPlayer outcome, combat/brain wiring, stagger strike, tests. Status: pending.
- T2 (S1) inline: perilous mark and rim (pure geometry + pixel art), renderer, sound. Status: pending.
- T3 (S3) inline: tip flag, sign, i18n, GDD, boot tip. Status: pending.

## Parity checklist

- [ ] Every `pierceRoll` source shows the "!" (cards, brain telegraph, bosses' own wind-ups, Sima elites, heralds, Senda kit)
- [ ] Every perilous shot in flight shows the rim (host and guest snapshots)
- [ ] Counter: shots and melee, solo, host and guest (claim path)
- [ ] Every tier has a window (data-driven)
- [ ] Settings flag: default, sanitize, migrate
- [ ] i18n es/en, device wordings keys/touch/pad
- [ ] GDD §9 and combat section
- [ ] sim/prove untouched by counters (measured)

## Log

- L1 (2026-11-12, owner, verbatim): "los proyectiles de algunos jefes que no se pueden rodar, quiero que se note que no se puede, como en sekiro que tengan una esclamacion o algo y si se pudiese hacer como el contraataque mikiri seria una locura".
