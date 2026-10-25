# Fairness floors (P5): one-hit cap and telegraph floor applied last

Branch: `fix/fairness-floors` (from main 868530d).

## Objective
Two global safety rules the balance harness found broken (hard fairness violations):
1. No single enemy hit exceeds 35 % of the **reference** max HP: the max HP the victim's species would have at the level expected on that floor (user design correction 2026-10-25: not the victim's own max HP; an under-levelled player must be punishable, even one-shot; an over-levelled one takes the same absolute damage).
2. No wind-up lasts less than the telegraph floor (280 ms; 400 ms for positional `pierceRoll` ones), after every speed modifier.

## Scope / constraints
- Victim-side clamp on the final absolute damage (`landHitOnPlayer`), after every multiplier, so solo, host and guests agree.
- Environmental ticks (collapse, gas, fog, flood, toxic) are excluded: non-lethal by design (they never pass through `landHitOnPlayer`).
- Reference HP is a pure function of the data (`src/core/fairness.ts`): expected level on floor F = level reached with the experience of every enemy of floors 1..F-1 (fixed rooms: their spawn list; generated floors: mean over 8 reference seeds of the generator), no items or upgrades. Set-piece extras are left out, so the estimate errs low and the cap errs protective.
- One helper for the effective wind-up length (`effectiveTelegraphMs`), the floor applied last; used by `tickAiAt` and by the harness observer.
- Easy golden digest must keep passing unless a legit Easy hit exceeded the cap.

## Tasks
- [x] T1 RED tests (`tests/core/fairness-floors.test.ts`): hit cap under tier × depth × pact, telegraph floor under elite pace + pact. Route: inline (one test file). RED observed: cap test got 100 HP lost (no cap), elite wind-up 183 ms on easy-320 under pace 1.8, in-play enraged Poochyena under a pact.
- [x] T2 Reference HP + cap: `MAX_HIT_SHARE` (data/difficulty.ts), `src/core/fairness.ts` (`expectedFloorXp`, `expectedLevel`, `speciesMaxHpAt`, `referenceMaxHp`, `hitCap`), `WorldState.referenceLevel` set by `enterFloor` (run.ts), clamp in `src/core/hits.ts`. Route: inline.
- [x] T3 Telegraph floor helper applied last (`effectiveTelegraphMs`, `tickAiAt` takes `{ pace, positional }`; `updateEnemies` passes the slow-mo/pact clock × elite pace and `pierceZone` positional flag). Route: inline.
- [x] T4 Harness: `max-hit` band measures damage / reference HP (`src/sim/metrics.ts`), bands read the data constants, `observe.ts` uses the same helper; KNOWN_VIOLATIONS entries removed; GDD §9 rules updated; report refreshed.

## Root causes
- Max hit: no cap existed; tier ×1.5 × party boss ×1.1–1.15 × depth stacked on a level-1 bot's HP.
- Telegraph floor: `tickAiAt` floored only the tier scale; `updateEnemies` multiplied the step by elite pace (swift ×1.3, enrage ×1.5) and the pact's `enemySpeed` before it, so e.g. 320 ms × 0.95 / 1.5 ≈ 203 ms on normal.

## Acceptance
- `npm test`, `npm run build` green; `npm run balance -- --quick` and the full sweep with 0 failures without the removed entries.

## Progress / evidence
- Golden Easy digest: unchanged play (the digest only needed the new `referenceLevel` field stripped like `difficulty`); no legit Easy hit was capped in it.
- `tests/core/party-scaling.test.ts`: the boss-damage test used a raw 100 hit (now capped); it uses 20 so it still measures ×1.1/×1.15.
- `npm run balance -- --quick`: 0 failures, 47 warnings, 66 passes.
- Removed KNOWN_VIOLATIONS: max-hit (crypt, misty-forest, flooded-caves, eclipse-chasm), telegraph-floor (eclipse-chasm).
- Full sweep `npm run balance`: 960 runs, 1920 arena fights in 400.5 s; 0 failures, 144 warnings, 176 passes.
- `npm test`: 147 files, 1398 tests passed. `npm run build`: built.
- Work-unit commit: f368734.
