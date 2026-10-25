# Difficulty tiers

## Objective
Four difficulty tiers (Fácil, Normal, Difícil, Pesadilla). The current balance becomes Fácil exactly; the harder tiers add new attacks and longer combos on top of modest stat changes, and pay more.

## Problem
The game has one balance. The GDD §9 table (telegraph ×1.4 on easy, damage ×2 on nightmare) predates the remasters and treats difficulty as stat scaling, which in a souls-like mostly makes fights longer or less readable.

## Why
User request 2026-10-25: the current balance becomes EASY; add harder modes that also add new attacks and longer combos; "busca formas de hacerlo más difícil pero que sea divertido y justo".

## Design study (summary; full text in docs/gdd.md §9)
Sources are design knowledge of the games named, not fetched pages (no research tool was used; claims are about well-known, documented mechanics).
- Dark Souls NG+ and Elden Ring: higher HP/damage, but the memorable part of later cycles is new enemy placements and invaders (the same moves in a new context). Lesson: change the situation, not only the numbers.
- Hades, Heat (Pact of Punishment): opt-in, named, stackable modifiers; many add behaviour (Extreme Measures gives bosses new attacks and phases) rather than only HP; rewards scale with Heat. Lesson: name the tier, add patterns to bosses, pay for it.
- Touhou rank (Easy to Lunatic): more bullets and faster waves, but the same readable shapes per spell card and extra spell cards on higher ranks; the dodge is always possible. Lesson: density and extra cards, never unreadable shapes.
- Enter the Gungeon: Jammed enemies (red tint, more damage) and harder floors; elites are visible at a glance. Lesson: an elite must be tinted and have one clear extra trait.
- Elden Ring Nightreign Depths: deeper tiers with stronger enemy mixes and more aggressive bosses, rewards scale with depth. Lesson: mixed packs and aggression.
- Hollow Knight Radiant (Hall of Gods): one-hit deaths but the same patterns with tightened, still readable timings; Pantheons add bosses in sequence. Lesson: tighter timings only to a readable floor.

User feedback during the work (2026-10-25), applied: (1) more enemies per room is not fun, so no tier adds enemies (the count bonus stays in the data at 0); difficulty goes into elites, patterns, combos, AI and moderate HP/damage. (2) Set-piece encounters (nests, wave rooms, ambushes, hunter floors; built by the Sima writer as data-driven events) are a valid lever: each tier carries an encounter frequency and extra waves that content reads through a pure helper. (3) The roll is "super roto": positional attacks (`pierceRoll`) go through the i-frames on every tier, with their own telegraph and sound, and hard and nightmare shorten the i-frame window and raise the roll's stamina cost.

Principles applied here: never shorten a telegraph below a readable floor (max of 0.75× its base, and 280 ms unless the base was already shorter); prefer more patterns, denser but readable shapes, smarter AI (shorter cooldowns), mixed packs (more enemies per room), extra spell cards and combo extensions over HP sponges (HP rises at most ×1.45); every new attack has a telegraph above the floor and a punish window; harder tiers pay more coins (per minute too) and keep their own records.

## Scope
- T1 Framework: data table per tier, selector (solo in the loadout; room: host-only row in the town entrance and waystone windows, tier shown to guests in the room window), persisted last choice (settings), co-op `start` and `lobby` messages carry it (additive; old peers read easy), `WorldState.difficulty` set at run start on every peer. Stat effects: HP and damage multipliers, telegraph scale with the floor, enemy count bonus, aggression (cooldown scale), elites (tinted, one extra trait), solo floor restarts per tier, coin multiplier. Easy identical to the current game (characterisation tests).
- T2 Content (hard+): `minDifficulty` in data, `atLeast(worldDifficulty(state), …)` in core. Crypt: Aegislash 4th Blade blow with a delayed feint (hard), extra phase-2 card (nightmare); Sableye extra gem ring (hard) and a fourth Glint (nightmare); Duskull, Golett, Pawniard, Poochyena, Gastly one trick each (hard+); at least 6 roster (Sima) species with a hard+ variant.
- T3 Records: best floor and clears per dungeon per tier; Sima leaderboard per tier (old entries are easy); town board shows the selected tier; end screen shows the tier. Docs (GDD §9 rewrite, README).

Out of scope: Misty Forest enemies and bosses (another writer owns their hard+ patterns; they only get the global stat effects), new dungeons, Sima atmosphere.

## Constraints
- Core pure and deterministic; architecture test green; `npm test`, `npm run build` green.
- Easy equals the current behaviour exactly (multipliers 1, no extra spawns, no elites, unlimited restarts, coins ×1).
- Shared files edited additively; new i18n keys in one contiguous block per language.
- No protocol break: optional fields only; elites are derived from the floor seed on every peer (no new snapshot field).
- Conventional Commits, one work-unit commit per task, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Tier table (data/difficulty.ts `TIERS`)
| | Fácil | Normal | Difícil | Pesadilla |
|---|---|---|---|---|
| Enemy HP | ×1 | ×1.15 | ×1.3 | ×1.45 |
| Enemy damage | ×1 | ×1.15 | ×1.3 | ×1.5 |
| Telegraph | ×1 | ×0.95 | ×0.9 | ×0.85 (floor: max(0.75× base, min(base, 280 ms))) |
| Extra enemies per room | 0 | 0 | 0 | 0 (user feedback: tougher, not more) |
| Cooldowns (aggression) | ×1 | ×0.9 | ×0.8 | ×0.7 |
| Elite chance per floor enemy | 0 | 10 % | 20 % | 30 % |
| Set-piece encounters (frequency, extra waves) | ×1, +0 | ×1.2, +0 | ×1.5, +0 | ×2, +1 |
| Roll (i-frame window kept, stamina cost) | ×1, ×1 | ×1, ×1 | ×0.9, ×1.1 | ×0.8, ×1.2 |
| Solo "Restart floor" per floor | unlimited | unlimited | 1 | 0 |
| Pokémonedas (whole run, so per minute too) | ×1 | ×1.3 | ×1.7 | ×2.2 |
| New attacks | none | none | hard patterns | hard + nightmare patterns |

Elite traits (data-driven `ELITE_TRAIT_DEFS`, to unify with the Sima writer's elites): `tough` (HP ×1.5, amber tint), `frenzied` (cooldowns ×0.65, red tint).

## Tasks
- [x] T1 Framework (route: inline writer, this agent; core, data, net, app, town, adapters; trigger evidence: one coherent framework across layers, the writer is already the delegated agent)
  - Data `src/data/difficulty.ts`: `TIERS` (table above), `scaledTelegraphMs` with `TELEGRAPH_FLOOR`, `stepDifficulty`, `toDifficulty`, `ELITE_TRAIT_DEFS`. Core `src/core/difficulty.ts`: `tierOf`, `tieredSpawns` (identity while the bonus is 0), `eliteFor` (pure draw from the floor seed: every peer makes the same elites, nothing new on the wire), `tickAiAt` (telegraphs run through their planned length faster so they last the scaled time; cooldowns drain faster, frenzied faster still), `rollTierOf`, `restartsLeft`, `encounterChance`/`encounterWaves` (seam for set-piece events).
  - Wiring: `createWorld({ difficulty })` (and the player's `rollTier`), HP at `spawnEnemy`, damage in `landHitOnPlayer` (victim side, composed with the Sima's `enemyScale`), AI clocks in `updateEnemies`, elites in `loadFloor`, coins `coinBreakdown(..., difficulty)` (default easy ×1; `COINS.difficulty` now reads `TIERS`).
  - `pierceRoll` rule: `EnemyAttackDef.pierceRoll` (also on shots and `ProjectileState`), `IncomingHit.pierceRoll`; `classifyHit` returns hurt through i-frames and never a perfect dodge; telegraph events carry `pierceRoll` and play their own `zoneWarning` sound; the flag travels on enemy projectiles as an optional last slot.
  - Net: `start` and `lobby` carry `difficulty` only when it is not easy (absent and unknown read as easy: an old host is easy); `session.setDifficulty` (host only, re-sends the lobby), `session.difficulty()`; election passes it for `?net=local`.
  - App/town: `Settings.difficulty` (persisted, validated); loadout moves step has the tier row (◀ ▶, confirm cycles, hint line) above Start; the room host gets the tier row on top of the entrance and waystone windows, the room window shows the tier to everyone; game passes the tier to the run, limits solo restarts (`restartLabel`, inert row when none left), pays by tier; renderer draws elites with a pulsing ring and wash in the trait's colour; i18n block `difficulty.*`, `pause.restartNone`, `elite.*`.
  - Characterisation: a golden digest of 8 seeds x the six Crypt floors x 600 scripted steps recorded on main 043cb02 (`bebcc214`) equals the easy run; mutation (easy cooldown 0.99) fails it. Crypt only, so the other writers' content changes do not break it.
  - Existing tests changed on purpose: coins "multiplies by the difficulty" (easy is now the ×1 default), settings shape (+`difficulty`).
  - Evidence: tests written right after the code (no RED first); mutation checks instead (golden digest, pierceRoll rule removed fails 2 tests). `npm test` 110 files / 1045 tests passed; `npm run build` ok.
- [ ] T2 Hard+ content (route: same)
- [ ] T3 Records, leaderboard, end screen, docs (route: same)

## Acceptance criteria
- Easy: same floors, same spawns, same HP, same damage, same AI timings and same coins as a world without a tier (tests).
- Every scaled telegraph respects the floor; every new attack's telegraph is at least 280 ms and is followed by a recovery.
- A guest plays the host's tier (start message); an old start message reads easy.
- Records and Sima scores are kept per tier; old ones read as easy.

## Checks
`npm test`, `npm run build`, `git log --format=%B -n 4 | grep -ic co-authored` = 0, silent screenshots in /tmp/difficulty/.

## Progress
- Branch `feat/difficulty-tiers` from main 043cb02 (the seam).
