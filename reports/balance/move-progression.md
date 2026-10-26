# Move progression: balance before and after (odd/tasks/move-progression.md T4)

`npm run balance -- --quick --slots` (60 runs, 72 arena fights; easy and nightmare, perfect / average / masher bots, solo, seeds 1–2, the Sima to floor 5).

| Run | Failures | Warnings | Passes |
|---|---|---|---|
| Default (Mimikyu), before the feature (main 86b9fcb) | 0 | 42 | 71 |
| Default (Mimikyu), after the feature | 0 | 42 | 71 (report byte-identical) |
| `--species=mimikyu` → `--full=mimikyu --ranks=2` | 0 → 0 | 42 → 40 | 71 → 73 |
| `--species=zorua` → `--full=zorua --ranks=2` | 0 → 0 | 37 → 33 | 76 → 80 |
| `--species=litwick` → `--full=litwick --ranks=2` | 0 → 0 | 40 → 40 | 73 → 73 |
| `--species=cubone` → `--full=cubone --ranks=2` | 0 → 0 | 43 → 41 | 70 → 72 |

No fairness invariant fails with a fully invested build: the enemy side (one-hit cap against the reference HP, telegraphs, simultaneous wind-ups, unseen attacks) does not change, since this feature only raises player damage and adds effects that lower the damage taken. The warnings that move are boss-TTK and death-rate bands (more bosses felled inside the timer, fewer deaths).

Full builds (data/tutor.ts `FULL_BUILD`, every move at rank +2): Mimikyu Garra Umbría · Mazazo · Danza Espada · Golpe Fantasma; Zorua Finta · Pulso Noche · Maquinación · Pulso Umbrío (its Maestro moves, Bomba Lodo and Vozarrón, are Poison and Normal: useless on the Ghost and Steel bosses); Litwick Ascuas · Llamarada · Fuego Fatuo · Lanzallamas; Cubone Hueso Palo · Doble Filo · Danza Espada · Terremoto.

## Boss TTK at full investment

From `reports/balance/move-progression-ttk.md` (every fixed arena in isolation, perfect and average bots with the four slots, Normal and Nightmare, 72 fights per build, paired medians):

| Starter | Speed-up, default moves at ++ | Speed-up, full build at ++ | Bosses felled in time (default → full ++) |
|---|---|---|---|
| Mimikyu | 32 % | 37 % | 22 → 34 of 72 |
| Zorua | 37 % | 37 % | 28 → 40 |
| Litwick | 26 % | 26 % | 19 → 28 |
| Cubone | 11 % | 30 % | 27 → 34 |

Target was ~30–50 % faster boss kills at full investment: met by Mimikyu, Zorua and Cubone, Litwick lands at 26 %. The bots barely use Litwick's heavy slot (Infortunio and Llamarada give the same result), so its gain comes from Ascuas ++ (40 % burn, embers) and Lanzallamas ++ (flame line); a player who lands Llamarada gets more. Spell cards keep their timers and their dodging: a faster kill shortens a card's damage phase, never its patterns, so the cards still need to be dodged.

## Kill gaps

`npm run prove` measures boss kill feasibility with the reference DPS of the **default** moves at the floor's expected level (src/sim/prove.ts `referenceDps`): unchanged by this feature, so no gap in `src/sim/kill-gaps.ts` closes and the list is untouched (it is never added to).
