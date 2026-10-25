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

Route for every task: this worker (a delegated bounded writer) inline; no further delegation.

- [x] T0 Shared card framework `src/data/cards.ts` + `src/core/cards.ts` (HP segments, timer, capture judge, reward; API documented for hand-authored bosses) - `e5a0482`. Test-first: `tests/core/cards.test.ts` RED (module missing) then GREEN.
- [x] T1 Pattern grammar + fairness checks (`src/data/herald.ts`, `src/core/herald/patterns.ts`, `src/core/herald/fairness.ts`) - `02011fd`. Mutation: path check disabled -> 2 tests fail.
- [x] T2 Generator `generateBoss(seed, depth, tier)` with rejection sampling, names, theme (`src/core/herald/generate.ts`, `names.ts`, `rand.ts`, `src/data/herald-words.ts`) - `0a7cc37`.
- [x] T3 Sima integration: herald floors 22, 32, 42..., runtime (`src/core/herald/brain.ts`, `floor.ts`), banner, HUD, capture coins, co-op, bestiary - `fedd5b6`.
- [x] T3b Eclipse Echo escalation per encounter (`src/core/eclipse-escalation.ts`) - `83f1452`. Mutation: escalation unwired -> the fight test fails.
- [x] T4 Epic intro cutscene (`src/ui/herald-intro.ts`, `src/adapters/herald-scenes.ts`) + `?boss=<seed>` dev route; anchors moved off the HUD corners after screenshots - `5b5c223`.
- [x] T5 Docs (GDD Sima section, README), this document, screenshots - this commit.

## Acceptance criteria

- `generateBoss` is deterministic (same seed, depth, tier -> deep-equal def), and over thousands of seeds no card that fails a fairness check survives (the checker is shown able to fail on hand-made unfair cards).
- Daily seed: two peers on the same day and floor get the same herald and the same intro composition.
- Guest snapshot round-trip keeps the herald's card (stance) and its def on the guest.
- `npm test`, `npm run build` green; `git log --format=%B | grep -ic co-authored` = 0.

## Progress and evidence

- Primitives: aimed and tracking streams, gapped rings (static/aimed), 1-4 arm spirals (+mirror), sine waves (+mirror), lane walls with a safe lane (+flip from the side), closing ring with a gap, seeded scatter, homing orbs, laser lines with warnings (fast lanes), pierce pockets, summons.
- Fairness method: analytic rules (tier-scaled wind-up floors 400/280 ms, laser warning >= 400, <= 2 aimed threats, <= 3 layers, density/speed never both > x1.3 and product <= 1.95, homing <= 0.6 x player speed and <= 3 orbs, tracking streams beaten by a sidestep, peak shots <= cap) plus a space-time reachability walk on an 8 px grid (dt = cell / player speed, 4-neighbour, swept shot capsules inflated by player radius + half a cell, pockets burn everything outside them) from 9 starts per attack anchor; the anchor-only shots are rasterised once per anchor and shared by the starts. The recover window lasts until the cycle's shots are gone, so cycles never overlap.
- Audit: 240 seeds per `npm test` (about 1500 cards); deep audit `HERALD_AUDIT_SEEDS=420` = 2520 seeds passed (all phase-1 and phase-2 cards re-proved). Rejection rate about 12 %.
- Generation cost: about 80 ms per herald on this machine (node); the floor load only computes its look and HP, the full def is generated the first time it acts.
- Decisions: herald floors 22, 32, 42... (after strata I-II; user feedback); one technical species `sima-herald` with the def regenerated from `EnemyState.herald`; no new snapshot field (guests regenerate from the run seed and floor); captures pay 6 coins per player through the guardian line (`CoinTally.captures`, optional field); shared card framework in `src/core/cards.ts` for the other writer; Echo escalation density capped at the fairness knob limit x1.3, speed unchanged.
- Screenshots (silent: headless Firefox over WebDriver BiDi, profile `user.js` with `media.volume_scale` 0.0, settings `muted: true` stored before load; dev server 4631, BiDi 9631, both stopped after) in `/tmp/procedural-bosses/`: `boss-vaelorion-seed1234-floor32.png` (closing ring), `boss-savrax-seed4242-floor32.png` (rings, Decidueye), `boss-vaelaeyss-seed77-floor42.png` (Salandit, poison streams), `boss-omaemor-seed9001-floor42.png` (Aegislash, ghost darts), `boss-kaelekar-seed31337-floor42-pockets.png` (pockets + fire stream, banner «Signo Ígneo «Ocaso Ahogado»»); intros `intro-vaelorion-title.png`, `intro-vaelaeyss-arrive.png`, `intro-vaelaeyss-title.png`, `intro-kaelekar-title.png`. Rejected and fixed from screenshots: heralds hidden under the HUD's top-left status panel (anchors moved to the centre band), the title text over the herald's silhouette (herald raised, sheet-relative scale).

## Not verified

- Shared run with a real second peer on a herald floor (covered by the snapshot round-trip and followToFloor tests only).
- Touch hold-to-skip on a real device; the generated sting through the real speakers (screenshots were silent by design).
- Generation time on slow phones (about 80 ms here; the first step of a herald floor pays it).
- No extra species were fetched (the optional curated download was not done): the pool is the 25 curated sheets already in `public/sprites` without fallbacks.
- Guests see the card's time left only as the card number (the timer is host-side state).
