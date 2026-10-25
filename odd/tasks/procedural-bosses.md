# Procedural bosses for the Sima del Eclipse ("Heraldos del Eclipse")

## Objective

Many bosses for the Sima del Eclipse, one at random per boss floor: a procedural generator of Touhou-structured bosses (spell cards with their own HP segment and timer, layered parametric bullet patterns, movement, a phase-2 rule, an original name, epithet and card names) whose every card is proven fair before it can be played, plus a short epic intro cutscene composed from the generated boss.

## Problem and why

The Sima has five guardian echoes and the Eclipse Echo: a long run sees the same bosses again and again. The user (2026-10-25): "necesitamos muchísimos jefes para la Sima del Eclipse, que salga uno aleatorio; podemos inspirarnos en patrones de Touhou y generar jefes proceduralmente", and then "pero to épico" for an intro cutscene. Design inputs: `docs/souls-difficulty-research.md` §3 (Touhou) and P4/P5 (fairness rules). Bullet geometry may be inspired by Touhou; spell-card names, art and music are never copied (all names are composed from our own word lists).

## Scope and constraints

- Branch `feat/procedural-bosses` from `main` d2dd71d. Two other writers work in parallel (balance sim in `src/sim`, co-op `partyScaling(n)`): boss generation lives in new modules; shared edits are additive.
- Deterministic core (seeded RNG); `src/core` and `src/data` stay pure (architecture test).
- Fairness (hard, checked on every generated card, rejection sampling): a walkable safe path exists for a player of the real radius and speed (roll ignored: conservative), telegraph >= 400 ms for choice/pierce cards and >= 280 ms otherwise after the tier's scaling, shots <= the boss's cap (under `ENEMY_SHOT_CAP`), at most 2 aimed threats per card, density x speed capped and never both above x1.3.
- Co-op: host-authoritative; every peer regenerates the boss from the run seed and floor; the snapshot only carries the existing boss fields (stance, comboIndex, ai).
- Allowed edit surfaces: `odd/tasks/procedural-bosses.md`, `src/**`, `tests/**`, `tools/**`, `public/sprites/**`, `CREDITS.md`, `README.md`, `docs/gdd.md`.
- One work-unit commit per task, Conventional Commits, no AI attribution, no push.
- Existing tests stay green without editing them.

## Decisions

- **Where heralds fight (T3, revised by user feedback)**: the first strata (floors 1-20) keep only the hand-made guardian echoes and the Eclipse Echo. From stratum III on, every floor ending in 2 (22, 32, 42, ...) is a herald floor, an echo-like boss floor in a new arena with cover (`abyss`), mixed with the later echoes (25 guardian, 30 Echo, 32 herald, 35 guardian...). Guardian echoes keep 5, 15, 25... and the Eclipse Echo 10, 20, 30... (their rotation and the tests pinning floors 5-65 stay valid).
- **Shared card framework**: HP segments per card, card timer, capture detection and reward, card banner events live in `src/data/cards.ts` + `src/core/cards.ts` with a small API that hand-authored bosses can use too (another writer is Touhou-izing Aegislash and Decidueye on hard tiers with the same file names).
- **Eclipse Echo escalation (user feedback)**: every encounter makes it stronger: one more card (a new pattern family, as before), denser volleys within the fairness caps, shorter rests between cards, and an escalating epithet «Eco del Eclipse · III».
- **Boss identity**: one technical species `sima-herald` (kind `herald`) carries the runtime; the enemy's `herald: { seed, depth }` regenerates the full def (memoised pure function) on every peer; the drawn sprite, types and theme come from the generated def.
- **Fairness method**: space-time reachability on an 8 px grid at 50 ms steps over each card's attack window, with every shot's swept capsule rasterised (inflated by the player radius), from 9 sampled start positions (aimed layers re-aimed at each start); a card passes only if every start keeps a survivable cell for the whole window. Tracking streams and homing orbs are checked analytically (sidestep time < flight time; orb speed < 0.6 x player speed, <= 3 orbs).
- **Card structure**: HP split into equal segments, one per card; a card ends when its segment is emptied (capture if no hit) or its timer runs out (no capture; the HP drops to the segment's floor). Inside a card the pattern repeats: telegraph, attack, opening, move.

## Checklist

- [ ] T1 Pattern grammar + fairness checks (route: delegated-direct writer = this worker; new modules `src/data/herald.ts`, `src/core/herald/patterns.ts`, `src/core/herald/fairness.ts`)
- [ ] T2 Generator `generateBoss(seed, depth, tier)` with rejection sampling, names, theme (route: this worker; `src/core/herald/generate.ts`, `src/data/herald-words.ts`)
- [ ] T0 Shared card framework `src/data/cards.ts` + `src/core/cards.ts` (route: this worker)
- [ ] T3 Sima integration: herald floors, runtime behaviour, banner, capture bonus, co-op, bestiary (route: this worker)
- [ ] T3b Eclipse Echo escalation per encounter (route: this worker)
- [ ] T4 Epic intro cutscene composed from the boss def (route: this worker)
- [ ] T5 Docs + dev tools: `?boss=<seed>`, GDD section, README, screenshots (route: this worker)

## Acceptance criteria

- `generateBoss` is deterministic (same seed, depth, tier -> deep-equal def), and over thousands of seeds no card that fails a fairness check survives (the checker is shown able to fail on hand-made unfair cards).
- Daily seed: two peers on the same day and floor get the same herald and the same intro composition.
- Guest snapshot round-trip keeps the herald's card (stance) and its def on the guest.
- `npm test`, `npm run build` green; `git log --format=%B | grep -ic co-authored` = 0.

## Progress

(updated per task)
