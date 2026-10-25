# Integrate feat/forest-remaster into main

## Objective

Merge `feat/forest-remaster` (from 043cb02: ab35be7, 2d3aa3d, 1e08a9d, 38e9acd, 288bb74) onto `main` at b95b502 (after the difficulty tiers), keeping both features whole.

## Scope and constraints

- Branch `feat/integrate-forest-remaster` from `main`; `git merge --no-ff feat/forest-remaster`.
- One `pierceRoll` definition (the difficulty branch's rule, its snapshot slot and its violet "!" telegraph); the forest's root spike and rain arrow use it, on hosts and guests.
- Both difficulty hooks coexist: the forest's `behaviourFor` / `data/forest-tricks.ts` patches (hard+) and the tier table (telegraph scaling with its floor, cooldowns, elites).
- The easy golden digest (Crypt) still passes; GDD keeps the forest §3 text and the §9 rewrite.
- No push; `main` and other branches untouched.

## Checklist

- [x] T1 Merge and resolve the seven conflicting files (route: inline; the conflicts were already mapped by the caller)
- [x] T2 Wire the forest's positional attacks into the shared rule's telegraph and sound (route: inline)
- [x] T3 Integration tests (route: inline)
- [x] T4 `npm test`, `npm run build`, silent screenshots (route: inline)

## Conflicts and resolutions

- `src/core/state.ts`: imports merged (`EliteTrait` + `TreantCard`); `ProjectileState.pierceRoll?: boolean` kept from main (the forest's placeholder `?: true` dropped).
- `src/core/brain.ts`: `spawnShot` keeps main's `pierceRoll: true` copy (one definition).
- `src/data/enemies.ts`: `EnemyAttackDef.pierceRoll?: boolean` with main's doc (plus a note that the forest uses it); `TierGate` kept; lunger keeps main's `followUpFrom`/`thirdCut`/`howl`/`landingHazard` and the forest's `feint`/`ember`; caster keeps `hardSpread`/`secondBall` and `ring`; slammer keeps `hardRing` and `leap`.
- `src/core/enemies.ts`: lunger merged: howl, then feint (sidestep), then the cut chain. Only a chaining lunger counts cuts (`cut = chains ? ai.chain ?? 0 : 0`) because Impidimp's `chain` counts feints; without that guard its real lunge after a feint was named `lunge2`. Ekans' landing hazard and Pumpkaboo Small's ember both kept. Caster: Drifloon's ring branch first, then Duskull's fan; the attack phase runs Gastly's second ball every tick, then the ring waves, then recovery. One `worldDifficulty` import; the dispatcher passes the tier it already computed to `behaviourFor` and still ticks with `tickAiAt` (tier telegraph scaling and cooldowns reach every forest brain, bosses included).
- `src/core/run.ts`: `tieredSpawns(...)` floor generation plus the forest's spirit-light cache.
- `src/adapters/renderer.ts`: imports merged.
- `docs/gdd.md`: main's §9 rewrite kept; its placeholder line "Los enemigos del Bosque Brumoso solo reciben los cambios de la tabla…" replaced by the forest's "El Bosque según la dificultad" paragraph, amended to say Normal plays no trick but does feel the tier table; the forest's duplicate "lo que pagas" sentence dropped (main's version stays).

## Integration changes beyond the conflicts

- `src/core/victim.ts`: `PierceZone` gains `{ kind: 'lanes' }`; `pierceZone` returns it for Trevenant's `roots` stance and Decidueye's `rain` stance when the data says `pierceRoll`.
- `src/core/treant.ts`, `src/core/archer.ts`: `windUp` takes `pierceRoll`; roots and rain wind-ups emit `enemyTelegraph` with `pierceRoll: true` (so audio plays `zoneWarning`).
- `src/adapters/renderer.ts`: the "!" badge now shows on those wind-ups; threatened root and rain lanes get the pulsing white and violet double edge (`pierceLane`).
- `tests/core/forest-difficulty.test.ts`: "easy and normal are step-for-step the shipped fight" no longer holds (Normal now scales telegraphs, cooldowns, HP by the tier table); the test keeps "no trick on easy or normal" (same behaviour objects) and the step-for-step identity for easy only.
- `tests/core/forest-tiers.test.ts` (new, 9 tests): root spike and rain arrow hit a rolling player solo and as a guest through `hostSnapshot` → `encodeMessage`/`decodeMessage` → `applyHostSnapshot`, each with a control (same shot without the flag is dodged, so the check can fail); Trevenant's nightmare telegraphs last `scaledTelegraphMs` (within one tick) and never under the floor; Phantump's hard second grab (320 ms) stops at the 280 ms floor on nightmare; Phantump's trick absent on normal, present on hard; roots telegraph carries `pierceRoll` and `pierceZone` gives `lanes` for roots and rain, `null` for a volley.

## Verification evidence

- `npx tsc --noEmit -p .`: clean.
- `npm test`: 119 files, 1112 tests passed (includes the easy golden digest in `tests/core/difficulty-tiers.test.ts`).
- `npm run build`: built (only the existing chunk-size warning).
- Test-first: the integration tests were written after the resolution (no RED observed); each pierce test carries a negative control.
- Screenshots (headless Firefox over WebDriver BiDi, profile `user.js` with `user_pref("media.volume_scale", "0.0");`, settings with `muted: true` and all volumes 0 stored on a same-origin non-game URL before the game loads; dev server 4597, BiDi 9497, both stopped after): `/tmp/integrate-forest-remaster/decidueye-p2-rain-pierce.png` (phase-2 rain: violet "!" over Decidueye, struck lanes edged white/violet, safe lane bright), `/tmp/integrate-forest-remaster/contact-rain.jpg`, `/tmp/integrate-forest-remaster/forest-hard-elites.png` (Difícil, forest floor 2 seed 17: a frenzied Shroomish with the red ring and a tough Spinarak with the amber ring).

## Next step

Human decision: merge `feat/integrate-forest-remaster` into `main`.
