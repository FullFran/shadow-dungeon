# Feature: evolved-enemies (evolved forms of the existing enemies)

Locator: `odd/tasks/evolved-enemies.md` · Engram mirror: `odd/evolved-enemies/tasks` · Branch: `feat/evolved-enemies` (from main da33dc1)

## Objective

"Pon también Pokémon evolucionados, estás poniendo solo preevoluciones" (2026-10-26). Add about 20 evolved forms of
enemies already in the game, each keeping its line's identity but escalating it, on the deeper floors of each dungeon
and at the matching Sima strata.

## Problem / why

Every enemy is a first stage, so depth only brings more of the same faces; evolutions are the natural way to show
"deeper is tougher" without adding bodies (the threat budget stays the limiter).

## Scope

- T1 Sprites and species: SpriteCollab check (native Idle, Walk, Attack, Shoot, Charge, Hurt), `tools/fetch-sprites.mjs`
  targets, sprite keys, `SPECIES` entries, XP, i18n names, attack animation.
- T2 Behaviours: data on the existing kinds (lunger, caster, slammer, beam, cone, bomber, counter), escalated (longer
  patterns, an extra move, more poise and HP); one extra trick on hard+ for a few (dungeon trick tables); tests first.
- T3 Placement: second half of each dungeon's generated floors, Sima pool at the matching stratum, roles, a threat
  above the base form so an evolution replaces basics in the budget, escorts so an evolution leads its line.
- T4 Docs and harness: GDD roster table (Spanish), README line, balance before/after, screenshots.

## Constraints

- Core pure, architecture test green, `npm test` and `npm run build` green.
- Additive edits to shared data files (an integration writer merges procedural bosses + four slots in parallel);
  sprite-meta is regenerated at integration anyway.
- Elites and leader rules unchanged; fairness floors (`effectiveTelegraphMs`) and the hit cap apply to every new attack.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only (sprite metadata and sheets excluded).

## Sprite check (SpriteCollab AnimData.xml, 2026-10-26)

Native six sheets: Mightyena 0262, Haunter 0093, Gengar 0094, Dusclops 0356, Bisharp 0625, Breloom 0286, Drifblim 0426,
Morgrem 0860, Noctowl 0164, Ariados 0168, Golbat 0042, Kingler 0099, Octillery 0224, Crawdaunt 0342, Arbok 0024,
Skuntank 0435, Weezing 0110, Muk 0089, Toxicroak 0454, Houndoom 0229 (chosen). Also complete but not taken: Dusknoir,
Gourgeist (0711, 0711/0003), Crobat, Tentacruel, Clawitzer, Gastrodon, Quagsire, Whirlipede, Scolipede, Dragalge, Magcargo.
Skipped as incomplete: Golurk (Shoot is a copy of SpAttack), Grimmsnarl (Shoot copies Charge); no AnimData: Pyroar,
Amoonguss, Gourgeist Small. Lanturn and Salazzle are bosses (skipped).

## Tasks

- [x] T1 Sprites + species + XP + names (route: inline, this writer; mechanical data) — commit 86bd0e9; `node tools/fetch-sprites.mjs`
  exit 0, `git diff -- public/sprites` empty for existing sheets (only 20 new folders); new `tests/core/evolved.test.ts`
  (21 green: native six sheets, HP and XP above the base form, es/en names); suite 155 files / 1542 tests
- [x] T2 Behaviours + tricks, tests first (route: inline, this writer) — RED: `tests/core/evolved-behaviour.test.ts` failed to
  load (no `src/data/evolved-enemies.ts`); GREEN 75/75 after the data (test fix on the way: a bomber's puff emits no
  `enemyAttack`, so the strike check counts hits too); suite 156 files / 1617 tests; typecheck clean
- [x] T3 Placement: pools, Sima strata, threat, escorts (route: inline, this writer) — RED: new
  `tests/core/evolved-placement.test.ts` 62 failing before the data; GREEN after it; 4 existing tests moved on purpose:
  Easy golden digest ('530cec91' -> '6e22f931', the Crypt's floors 4-5 now draw evolutions), the Crypt floor-4 species
  set (now lists the evolutions), the Sima "whole pool by depth" check (30 -> 40, the swamp evolutions join on 36-38)
  and the Sima "Crypt newcomers seen" check (seeds widened: Pawniard still shows, 16 times on late floors over 40
  seeds, but not on the original four once the evolutions share its floors); suite 157 files / 1680 tests
- [ ] T4 GDD, README, balance before/after, screenshots (route: inline, this writer)

## Acceptance criteria

- Every evolution has native sheets, a behaviour of its base form's kind with at least one escalation, a role, a
  threat above its base form, XP in proportion, a name in es/en.
- Each appears only in the second half of its dungeon's generated floors, and in the Sima from its stratum's late floors.
- Each new attack: telegraph >= the roster minimum, no hit above the roster hit share, tier floors respected.
- Encounters invariants (budget, bodies, roles, enemies ratio and XP parity bands) stay green.

## Checks

`npm test`, `npm run build`, `npm run balance -- --quick`, `git log --format=%B -n 4 | grep -ic co-authored` (0).

## Progress / evidence

- Baseline (main da33dc1): `npm test` 154 files / 1521 tests passed; `npm run balance -- --quick` 0 failures,
  39 warnings, 74 passes (copy in /tmp/evolved/balance-before.md).

## Decisions

- Behaviours are data only on the base form's kind (`src/data/evolved-enemies.ts`, merged into `ENEMY_BEHAVIOUR`), no new
  state machine code: the escalation uses fields the core already reads (follow-ups, third cuts, rings with waves, a
  second ball, bursts, repeats, landing hazards, sweeps, puddles, a leap with a ring) and tier gates set to easy.
  Literals on purpose: enemies.ts imports the file, so it only imports types back (no load-order cycle).
- Escalation rule tested generically: same kind, poise not lower than the base, and a new field, a tier-gated field
  played earlier or a bigger count/radius/reach; 17 of 20 add a move, Drifblim, Morgrem and Weezing escalate by count and size.
- Hard+ tricks (7): Drifblim third ring, Noctowl third dive (forest); Crawdaunt third jet, Kingler third pincer (caves);
  Toxicroak third jab, Muk sludge ring (swamp); Houndoom faster sweep (Sima). Crypt evolutions keep their tier content in
  data (`howl`, `hardSpread`), as the Crypt has no trick table; Octillery's hard fan is a data tier gate too.
- Fairness: every damaging attack on every tier (with its tricks) under `TUNING.roster.maxHitShare` against every
  starter; openers >= `TUNING.roster.minTelegraphMs`, chained wind-ups >= `TELEGRAPH_FLOOR.minMs`; a nightmare run of each
  evolution shows every `enemyTelegraph` >= the floor (the game's own `effectiveTelegraphMs` path).
- Threat: `SPECIES_THREAT` override in `src/data/encounters.ts` (role cost + 1, at most 5, Weezing/Muk/Houndoom 5);
  `threatOf` reads it first. So an evolution spends more of a room's budget (fewer, tougher bodies) and, being its
  room's highest threat, is the one crowned by the existing leader rule; no leader code change was needed (the leader
  code has no species preference; the highest-threat rule is the preference).
- Roles follow the line, except the swarm's evolutions fight alone: Golbat skirmisher, Skuntank brute.
- Leading their line: mixed packs (`escort`) Mightyena+Poochyena, Bisharp+Pawniard, Gengar+Gastly (Crypt), Morgrem+Impidimp
  (Forest), Golbat+2 Zubat (Caves), Skuntank+Stunky (Swamp). Base weights are untouched: the budget does the replacing.
- Placement: second half of each dungeon's generated floors (Crypt 4-5, Forest 5-7, Caves 6-9, Swamp 6-9; Gengar
  only on Crypt 5, Toxicroak from Swamp 7). Sima: stratum I 6-9, II 16-18 (Houndoom 18), III 26-28, IV 36-38, weight 1,
  +0.04 per floor, never in packs.

## Next step

T4.
