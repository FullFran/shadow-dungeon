# Four slots: TTK with and without the boost and area slots

`npm run balance -- --quick` (60 runs, 72 arenas; Mimikyu, the sweep's species; seeds 1 and 2) on feat/four-slots, 2026-10-25.

- Before = the default sweep (the bots use only the fast slot): byte-identical to the report of main 868530d (0 failures, 49 warnings, 64 passes).
- After = `--slots`: the perfect and average bots also cast Danza Espada before a boss or a crowd of 3 and Brillo Mágico on 2+ enemies or a boss in reach (0 failures, 53 warnings, 60 passes).
- Two seeds per cell: single-cell swings (Decidueye easy/average 15 s → 41 s, one fight each) are noise; read the medians.

Summary: enemy TTK in runs drops slightly on Easy (perfect bot: Crypt 7 → 5 s, Forest 4 → 3 s, Swamp 7 → 5 s; most cells unchanged). Boss TTK is about the same (median ratio after/before 1.06 over the 21 arenas felled both times): the slow ring wind-up and the cooldowns cost about as much DPS as Danza Espada adds. No fairness invariant failed; the four new warnings are performance bands (Swamp easy/average clears, HP lost per floor, one Nightmare perfect death) moving within the noise of two seeds. The new slots do not trivialise the fights.

## Boss TTK (arenas in isolation, party 1)
| dungeon | arena | tier | bot | felled before | after | TTK before | after |
|---|---|---|---|---|---|---|---|
| crypt-of-the-sword-king | F3 sableye | easy | perfect | 2/2 | 2/2 | 20 s | 17 s |
| crypt-of-the-sword-king | F6 aegislash | easy | perfect | 2/2 | 2/2 | 13 s | 17 s |
| crypt-of-the-sword-king | F3 sableye | easy | average | 2/2 | 2/2 | 43 s | 34 s |
| crypt-of-the-sword-king | F6 aegislash | easy | average | 2/2 | 2/2 | 12 s | 12 s |
| crypt-of-the-sword-king | F3 sableye | nightmare | perfect | 2/2 | 2/2 | 27 s | 26 s |
| crypt-of-the-sword-king | F6 aegislash | nightmare | perfect | 2/2 | 2/2 | 22 s | 20 s |
| crypt-of-the-sword-king | F3 sableye | nightmare | average | 1/2 | 2/2 | 42 s | 38 s |
| crypt-of-the-sword-king | F6 aegislash | nightmare | average | 1/2 | 1/2 | 20 s | 17 s |
| misty-forest | F4 trevenant | easy | perfect | 2/2 | 2/2 | 12 s | 18 s |
| misty-forest | F8 decidueye | easy | perfect | 0/2 | 0/2 | – | – |
| misty-forest | F4 trevenant | easy | average | 2/2 | 2/2 | 19 s | 21 s |
| misty-forest | F8 decidueye | easy | average | 1/2 | 1/2 | 15 s | 41 s |
| misty-forest | F4 trevenant | nightmare | perfect | 0/2 | 0/2 | – | – |
| misty-forest | F8 decidueye | nightmare | perfect | 0/2 | 0/2 | – | – |
| misty-forest | F4 trevenant | nightmare | average | 0/2 | 0/2 | – | – |
| misty-forest | F8 decidueye | nightmare | average | 0/2 | 0/2 | – | – |
| flooded-caves | F5 lanturn | easy | perfect | 2/2 | 2/2 | 27 s | 21 s |
| flooded-caves | F10 dhelmise | easy | perfect | 2/2 | 2/2 | 18 s | 19 s |
| flooded-caves | F5 lanturn | easy | average | 1/2 | 2/2 | 16 s | 22 s |
| flooded-caves | F10 dhelmise | easy | average | 2/2 | 2/2 | 15 s | 18 s |
| flooded-caves | F5 lanturn | nightmare | perfect | 0/2 | 0/2 | – | – |
| flooded-caves | F10 dhelmise | nightmare | perfect | 2/2 | 2/2 | 22 s | 25 s |
| flooded-caves | F5 lanturn | nightmare | average | 0/2 | 0/2 | – | – |
| flooded-caves | F10 dhelmise | nightmare | average | 1/2 | 1/2 | 29 s | 25 s |
| toxic-swamp | F5 salazzle | easy | perfect | 0/2 | 0/2 | – | – |
| toxic-swamp | F10 nihilego | easy | perfect | 0/2 | 1/2 | – | 49 s |
| toxic-swamp | F5 salazzle | easy | average | 0/2 | 1/2 | – | 22 s |
| toxic-swamp | F10 nihilego | easy | average | 0/2 | 0/2 | – | – |
| toxic-swamp | F5 salazzle | nightmare | perfect | 0/2 | 0/2 | – | – |
| toxic-swamp | F10 nihilego | nightmare | perfect | 0/2 | 0/2 | – | – |
| toxic-swamp | F5 salazzle | nightmare | average | 0/2 | 0/2 | – | – |
| toxic-swamp | F10 nihilego | nightmare | average | 0/2 | 0/2 | – | – |
| eclipse-chasm | F5 aegislash | easy | perfect | 2/2 | 2/2 | 11 s | 14 s |
| eclipse-chasm | F5 aegislash | easy | average | 2/2 | 2/2 | 10 s | 11 s |
| eclipse-chasm | F5 aegislash | nightmare | perfect | 2/2 | 2/2 | 16 s | 15 s |
| eclipse-chasm | F5 aegislash | nightmare | average | 2/2 | 1/2 | 13 s | 15 s |

median boss TTK ratio after/before (both felled): 1.06 over 21 arenas

## Enemy TTK (runs, party 1)
| dungeon | tier | bot | cleared before | after | enemy TTK before | after |
|---|---|---|---|---|---|---|
| crypt-of-the-sword-king | easy | perfect | 2/2 | 2/2 | 7 s | 5 s |
| crypt-of-the-sword-king | easy | average | 1/2 | 1/2 | 9 s | 8 s |
| crypt-of-the-sword-king | easy | masher | 0/2 | 0/2 | 6 s | 6 s |
| crypt-of-the-sword-king | nightmare | perfect | 0/2 | 0/2 | 2 s | 2 s |
| crypt-of-the-sword-king | nightmare | average | 0/2 | 0/2 | 9 s | 9 s |
| crypt-of-the-sword-king | nightmare | masher | 0/2 | 0/2 | – | – |
| misty-forest | easy | perfect | 2/2 | 2/2 | 4 s | 3 s |
| misty-forest | easy | average | 2/2 | 2/2 | 5 s | 5 s |
| misty-forest | easy | masher | 2/2 | 2/2 | 3 s | 3 s |
| misty-forest | nightmare | perfect | 0/2 | 0/2 | 4 s | 4 s |
| misty-forest | nightmare | average | 0/2 | 0/2 | 3 s | 4 s |
| misty-forest | nightmare | masher | 0/2 | 0/2 | 3 s | 3 s |
| flooded-caves | easy | perfect | 2/2 | 2/2 | 7 s | 7 s |
| flooded-caves | easy | average | 2/2 | 1/2 | 7 s | 7 s |
| flooded-caves | easy | masher | 2/2 | 2/2 | 4 s | 4 s |
| flooded-caves | nightmare | perfect | 0/2 | 0/2 | 11 s | 9 s |
| flooded-caves | nightmare | average | 0/2 | 0/2 | 5 s | 8 s |
| flooded-caves | nightmare | masher | 0/2 | 0/2 | 3 s | 3 s |
| toxic-swamp | easy | perfect | 1/2 | 2/2 | 7 s | 5 s |
| toxic-swamp | easy | average | 1/2 | 0/2 | 8 s | 6 s |
| toxic-swamp | easy | masher | 1/2 | 1/2 | 6 s | 6 s |
| toxic-swamp | nightmare | perfect | 0/2 | 0/2 | 8 s | 13 s |
| toxic-swamp | nightmare | average | 0/2 | 0/2 | 11 s | 10 s |
| toxic-swamp | nightmare | masher | 0/2 | 0/2 | 6 s | 6 s |
| eclipse-chasm | easy | perfect | 2/2 | 2/2 | 5 s | 4 s |
| eclipse-chasm | easy | average | 2/2 | 2/2 | 5 s | 4 s |
| eclipse-chasm | easy | masher | 2/2 | 2/2 | 4 s | 4 s |
| eclipse-chasm | nightmare | perfect | 2/2 | 1/2 | 8 s | 8 s |
| eclipse-chasm | nightmare | average | 0/2 | 0/2 | 4 s | 5 s |
| eclipse-chasm | nightmare | masher | 0/2 | 0/2 | 2 s | 2 s |
