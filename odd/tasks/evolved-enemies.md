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

- [ ] T1 Sprites + species + XP + names (route: inline, this writer; mechanical data, no RED: sprite pipeline test covers it)
- [ ] T2 Behaviours + tricks, tests first (route: inline, this writer)
- [ ] T3 Placement: pools, Sima strata, threat, escorts (route: inline, this writer)
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

- (filled per task)

## Next step

T1.
