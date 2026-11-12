# nightmare-tuning

Objective: make Nightmare harder by tightening what exists (owner-approved option 5(a) of docs/research/items-and-prep.md §3.3). Branch `feat/nightmare-tuning` (from origin/main + `docs/items-prep-research`). Delivery: work-unit commits, no push. Test runner: vitest (`npx vitest run`), proof `npm run prove`.

## Specs

- S1 (N1) "Card HP band: per-card Nightmare segment HP so the margin lands in [1.1, 1.8] (scale cards above 1.8 down to it; leave those under it alone)". Data-driven: new boss cards inherit the band (a test fails when a Nightmare card is out of band). Proof check: "`npm run prove` margin column ≥ 1.1 for every card; known-gap list does not grow".
- S2 (N2) "All six elite traits on Nightmare (swift, volley, armored, enrage join tough/frenzied)". Telegraph floor still applies.
- S3 (N3) "Less free healing: floor-entry heal 25 % → 15 %, Oran Berry chance 35 % → 20 %, item sustain ceiling 2 %/s → 1.5 %/s, on Nightmare only".
- S4 (N4) "\"Tu turno\" 800 → 700 ms (its floor)".
- S5 (N5) "coin rewards x2.5 on Nightmare" (task brief; the doc's guaranteed item-gacha pull is not in this task's brief, listed as pending).
- S6 "rerun the measurements the doc used (balance --quick, prove --judge) before and after and put the numbers in odd/tasks/nightmare-tuning.md".
- S7 "every card must stay survivable under the solver".
- S8 "Hard/Normal/Easy unchanged (add a test proving their numbers did not move)".
- S9 "update difficulty texts (i18n es/en) and the GDD".

## Tasks

| ID | Specs | Route | Status | Evidence |
|---|---|---|---|---|
| T1 | S2-S5, S8 | inline | done | a65b8e2; RED: 10 of 12 tests in tests/core/nightmare-tuning.test.ts failed (traits, `tierHealing` missing, heal 65 vs 55, Leftovers 12 vs 11.5, turn 800, coins 2.2); GREEN 12/12 |
| T2 | S1, S6, S7 | inline | done | N1 commit; RED: tests/data/nightmare-band.test.ts could not load `data/nightmare-band`; GREEN 6/6; `npm run prove` 166/166, 24/24 |
| T4 | S1, S6 | inline | done | branch fix/nightmare-band-new-cards (feat/boss-patterns merged): RED: 4 new tests in tests/data/nightmare-band.test.ts (bandFactors `echo` 2.12 vs 2.27, echo segment 0.6 vs 0.48, `NIGHTMARE_ECHO_CARD_HP` missing); GREEN 11/11; `npm run prove` exit 0, 217/217, 24/24; band tool stable on rerun |
| T3 | S9 | inline | done | docs commit; RED: N5 hint test "expected 'Cartas de hechizo extra y élites a me…' to contain '×2,5'"; GREEN |

## Parity checklist

- [x] Every card boss gets the band through the one wiring point (`GUARDIAN_TRICKS`, src/data/guardian-tricks.ts): 8 guardians, 42 Senda shadows, 8 wounds measured; a new boss is banded by being there, and the proof fails (`marginCeiling`) for a home case above 1.8 until `tools/nightmare-band.ts --write` runs. Evidence: tests/data/nightmare-band.test.ts iterates every species of `GUARDIAN_TRICKS`.
- [x] Sima echoes, Sima story bosses and reused road bosses: inherit the banded segments; used as lower bounds; proof and story-prove-sima / story-prove-reused tests green. Since T4 the echoes band on their own factor (`NIGHTMARE_ECHO_CARD_HP`, applied by `echoCards`), so an echo no longer caps the home fight; story and reused cases still bound the home factor (none capped after the boss-patterns merge).
- [x] Every dungeon (main, challenges, Senda roads, Sima, shrine): the levers read `TIERS` (`tierEliteRule`, `tierHealing`, `turnMsFor`, `COINS.difficulty`); no per-dungeon list. A dungeon's own `floorHeal` (the tutorial's 1) still wins. The Sima keeps its own elite list (`SIMA_ELITES`, already all six).
- [x] Solo and co-op: elites and berries come from the floor seed and the host's tier (same on every peer); floor heal and sustain are per peer from the world's tier; no co-op-only path.
- [x] Save/migrate/sanitize, net protocol: no new fields (elite traits were already on the wire as `ALL_ELITE_TRAITS`; tier is already shared).
- [x] i18n es/en: `difficulty.nightmare.hint`; test pins every tier's hint to its coin multiplier.
- [x] GDD §9 table (turn, elites, card band, free healing, coins), elite paragraph, rule 9 band bullet, §3 floor heal / Oran Berry / sustain ceiling.
- [x] sim/prove: report regenerated; audit, story-prove and wound-prove check the ceiling through `proofFailures`; band tool added.
- [ ] Heralds (generated Sima bosses, data/herald.ts): not tier card fights, not in the proof table; not banded. Pending owner call if the band should reach them.

## Measurements

Commands (the doc's): `npx vite-node tools/balance.ts --quick --tier=<t> --out=<tmp>` (seeds 1-2, 5 dungeons, solo) and `npx vite-node tools/prove.ts --judge` / `npm run prove`. Margin stats exclude survival cards and recorded kill gaps, as the doc did. Before = origin/main 5c76039 + research doc; after N4 = commit a65b8e2; after = N1-N5.

Proof, every case of the report (guardians + Sima echoes):

| Tier | when | cards | survival | known gaps | median margin | p25 | min | max | cards > 1.8 | cards < 1.3 | median melee window |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Normal | before = after | 43 | 0 | 4 | 2.44 | 1.77 | 1.56 | 8.26 | 28 | 0 | 4.70 s |
| Hard | before = after | 53 | 10 | 9 | 2.08 | 1.47 | 1.33 | 8.80 | 21 | 0 | 4.65 s |
| Nightmare | before | 70 | 10 | 10 | **2.33** | 1.58 | 1.13 | 7.27 | 34 | 11 | 4.35 s |
| Nightmare | after N4 only | 70 | 10 | 10 | 2.33 | 1.58 | 1.13 | 7.27 | 34 | 11 | 4.35 s |
| Nightmare | after N1-N5 | 70 | 10 | 10 | **1.78** | 1.58 | 1.13 | 3.46 | 15 | 11 | 4.35 s |

Nightmare split by case kind:

| Nightmare cases | when | cards | median | min | max | > 1.8 |
|---|---|---|---|---|---|---|
| guardians in their arenas (band cases) | before | 33 | 2.01 | 1.13 | 5.86 | 19 |
| guardians in their arenas (band cases) | after | 33 | **1.78** | 1.13 | **1.79** | **0** |
| Sima echoes (not band cases, ×0.6 HP) | before | 17 | 3.03 | 1.14 | 7.27 | 15 |
| Sima echoes | after | 17 | 2.22 | 1.14 | 3.46 | 15 |

Every proof run: 166/166 cards survivable, 24/24 solver fights cleared (after the band, 12 stored solver fights no longer cleared with the longer bars and were re-solved by `npm run prove`: all cleared). Known-gap list unchanged (10 Nightmare entries).

Band tool (`npx vite-node tools/nightmare-band.ts --write`, 6 jobs, 64 s): 488 Nightmare card samples (246 home: guardians, 42 Senda shadows, 8 wounds; plus echoes, 50 Sima story cases, 3 reused road bosses as lower bounds). 116 cards raised (19 guardian, 97 Senda), factors ×1.1 to ×8.28 (median ×1.43); none capped by a lower bound; home margins after: min 1.11, max 1.79.

Run bots (`balance --quick`), perfect / average clears of 10: Normal 2/10 and 1/10, Hard 1/10 and 0/10, Nightmare 0/10 and 0/10, before and after. The Normal and Hard reports are byte-identical before and after. Nightmare's gate stays PASS (3 known fairness violations, 21 warnings); the bots still saturate at the first card boss, as the doc found, so they cannot rank the change.

Findings:
- N4 moved nothing in the proof: the turn is `max(turnMs, the move's own recovery)` (core/cards.ts) and every guardian Nightmare move but 4 recovers for ≥ 800 ms; the last spell's turn was already at its 600 ms floor. The doc's "about −12 % punish time" does not happen with today's data; the lever stays as specified (700 ms).
- N1 is the lever that moves the numbers: the Nightmare median kill margin of the guardians drops from 2.01 to 1.78 (whole report 2.33 → 1.78), below Hard's 2.08.

## Log

- L1 (2026-11-12, coordinator brief): "Task: make Nightmare harder (branch `feat/nightmare-tuning`) ... Owner-approved option 5(a): tighten what exists: N1 per-card HP band [1.1, 1.8] of the kill margin on Nightmare, N2 all six elite traits on Nightmare, N3 less free healing, N4 turn 700 ms, N5 coin rewards x2.5 on Nightmare, exactly as the doc defines them. Do: implement N1-N5 with tests that pin each lever; rerun the measurements the doc used (balance --quick, prove --judge) before and after and put the numbers in odd/tasks/nightmare-tuning.md; every card must stay survivable under the solver; Hard/Normal/Easy unchanged (add a test proving their numbers did not move); update difficulty texts (i18n es/en) and the GDD. Another worker is adding new boss cards in parallel: keep your changes to card HP and tuning data minimal and data-driven so new cards inherit the band."
- L2 (2026-11-12): scope: the integration rule (CLAUDE.md) makes N1 reach every card boss, not only the 8 guardians the doc measured: Senda shadows and wounds are band home cases; echoes, Sima story bosses and reused road bosses only bound factors from below.
- L3 (2026-11-12): finding: N4 does not move the proof (turn = max(turnMs, the move's recovery)); kept as specified.
- L4 (2026-11-12): the structure tests' "last spell ≤ 15 % of the bar" now checks the authored fight; on Nightmare the band may grow a segment (GDD note added). Shares stay normalised (the bar grows through `hpScale`).
- L5 (2026-11-12): pending: N5's "a Nightmare clear guarantees one uncommon item-gacha pull" (doc §3.3) is not in this brief and depends on the item gacha (other worker); not done, not dropped.
- L6 (2026-11-12, coordinator brief): "make the Nightmare card HP band converge with the new boss cards ... prove ... fails `dhelmise nightmare sc-dhe-chain: kill margin 1.91 > 1.8`, and the tool prints `sc-dhe-chain: x2.12 (capped by a case at its target)` ... find a principled fix: for example band the home fight and the reused cases with separate factors (per case, not per card) ... Do not loosen the band for any other card."
- L7 (2026-11-12): finding: the binding case was `dhelmise-echo` (unbanded margin 2.35 vs home 4.05; the echo plays a 0.6 share of the guardian at its depth). Fix: per-case factors for the one case kind that can carry its own, the Sima echo (`echoCards` scales each kept card by `echoHp`, `bandFight` writes it from `NIGHTMARE_ECHO_CARD_HP`, the tool measures both tables). sc-dhe-chain Nightmare: home ×2.27 → margin 1.78, echo ×2.12 → 1.11 (its only two cases). No other card's factor or ceiling changed. Story and reused cases still share the home fight, so they stay lower bounds.
