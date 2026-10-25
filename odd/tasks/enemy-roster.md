# Feature: enemy-roster (experimental enemy roster for the Sima del Eclipse)

Locator: `odd/tasks/enemy-roster.md` · Engram mirror: `odd/enemy-roster/tasks` · Branch: `feat/enemy-roster` (from main 4c90a5d)

## Objective

"Añade más variedad de enemigos; la Sima del Eclipse puede ser el sitio donde probar toda la mierda" (2026-10-25).
Add ~14 new enemy species with distinct, souls-fair behaviours (clear telegraph, dodge window, punish window),
exported as `EXPERIMENTAL_ENEMIES` so the endless Sima del Eclipse (built in parallel) can draw them at integration.

## Scope and constraints

- Species from `docs/species-candidates.md` (Flooded Caves, Toxic Swamp) plus three Fire species so Litwick's
  Flash Fire has something to absorb. Not Duskull, Golett, Pawniard, Sableye (Crypt remaster) and no edits to
  dungeon defs or pools (Sima writer).
- Core stays pure (architecture test); co-op snapshots extended only with optional fields.
- New types (water, electric, fighting) get `TYPE_CHART` rows, `TYPE_COLORS` and `type.<id>` i18n keys.
- Shared files: additive edits; new i18n keys in one contiguous block.
- Task size heuristic ~400 authored lines is advisory only; sprite metadata (generated) excluded.

## Sprite verification (tracker.json, 2026-10-25)

All 14 chosen species have native Idle, Walk, Attack, Shoot, Charge, Hurt sheets (checked again in the
generated `sprite-meta.json`: every `source` equals the wanted name). Fire picks: Houndour (0228, phase 2),
Slugma (0218, phase 1), Litleo (0667, phase 2); Numel (0322) also complete but not needed. Skrelp left out.

## Tasks

- [x] T1 sprites + enemy defs + `EXPERIMENTAL_ENEMIES` (route: delegated writer, this agent) — commit bdd30ca; `tests/core/roster.test.ts` 18 green; suite 800/800
- [x] T2 behaviours, telegraphs, VFX tint, snapshot fields, tests first — commit c114b99; RED observed (31 of 35 failing before `src/core/roster.ts`), GREEN 838/838, build ok
- [x] T3 balance pass, dev `?spawn=` test floor, docs (GDD section, README), screenshots in `/tmp/roster/` — balance
  budget in `TUNING.roster` checked by `tests/core/roster-balance.test.ts` (shown able to fail: 5 of 14 fail at a 15 % cap);
  `src/core/test-floor.ts` + `?spawn=`; screenshots `/tmp/roster/roster-*.png`, `/tmp/roster/contact-sheet.png`
  (silent Firefox: user.js volume 0, settings `muted: true` before load); route: inline, same writer

## Acceptance criteria

- Each behaviour has deterministic tests: telegraph length, a dodge (roll) avoids the hit, contact damages,
  special rules (Croagunk counter, Koffing explosion, Fire hits absorbed by Flash Fire).
- `npm test` and `npm run build` green; no AI attribution in commits.

## Checks

`npm test`, `npm run build`, `git log --format=%B -n 4 | grep -ic co-authored` (0).

## Progress / evidence

- Sprites fetched with `node tools/fetch-sprites.mjs` (exit 0, 14 new folders).

## Decisions

- New behaviour kinds live in `src/core/roster.ts` (beam, pulse, cone, mortar, bomber, counter); Zubat/Ekans reuse
  the lunger (`weave`, `lockMs`), Tentacool/Wooper/Grimer the slammer (`puddle`, `trail`, `floats`), Litleo the caster.
- `AiState` gained optional `attack` (named attack) and `aimPoint`; host snapshots and the wire protocol carry them
  only when present (appended after the boss slots), and a guest drops stale ones.
- `telegraph` and `pathDirection` moved from enemies.ts to brain.ts so roster.ts does not import enemies.ts.
- Guards: crab shell (frontal arc, chip damage, open while recovering) and Croagunk's stance (blocked, answered by a
  counter aimed at the striker, also for guest claims on the host). Koffing's fuse ignores stagger; killing it cancels it.
- Hazards are still enemy projectiles (speed 0, one hit each); their look is per type (Poison keeps the spore look).
- Coins per species are a hint in `EXPERIMENTAL_ENEMIES` only (the run tally still pays a flat `COINS.perEnemy`).

## Next step

Integration: the Sima del Eclipse pool appends `EXPERIMENTAL_ENEMIES`; then look at each species in game and retune.
