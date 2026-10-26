# Movepools: default kits vs recommended builds

Generated 2026-10-26 with `npm run balance -- --quick --slots --species=<s>` (default loadout) and `--build=<s>` (the recommended tutor build, `RECOMMENDED_BUILD` in src/data/tutor.ts, no Mejoras). CI sweep: 5 dungeons, Easy and Nightmare, perfect/average/masher bots, party 1, seeds 1 and 2. The bots use the boost and area slots (`--slots`) but do not exploit priority, homing or lingering zones.

Before the feature, `npm run balance -- --quick --slots` (Mimikyu default) gave 0 failures, 42 warnings, 71 passes; after it, the same command gives exactly the same report (the default kits did not change).

| Starter | Build | Gate | Known fairness violations | Performance warnings | Passes |
|---|---|---|---|---|---|
| Mimikyu | Garra Umbría · Carantoña · Danza Espada · Brillo Mágico | PASS | 9 | 33 | 71 |
| Mimikyu | Sombra Vil · Carantoña · Danza Espada · Golpe Fantasma | PASS | 11 | 36 | 66 |
| Zorua | Finta · Pulso Noche · Maquinación · Pulso Umbrío | PASS | 8 | 29 | 76 |
| Zorua | Desarme · Bomba Lodo · Maquinación · Pulso Umbrío | PASS | 6 | 31 | 76 |
| Litwick | Ascuas · Infortunio · Fuego Fatuo · Lanzallamas | PASS | 8 | 32 | 73 |
| Litwick | Ascuas · Bola Sombra · Paz Mental · Lanzallamas | PASS | 8 | 33 | 72 |
| Cubone | Hueso Palo · Huesomerang · Corpulencia · Terremoto | PASS | 12 | 31 | 70 |
| Cubone | Desarme · Huesomerang · Danza Espada · Terremoto | PASS | 10 | 33 | 70 |

Reading: no build breaks a fairness invariant (0 failures everywhere; the known violations are content-side and vary with how long the bots survive). The recommended builds are not stronger than the default kits for the bots: Mimikyu's is a little weaker (Sombra Vil has 40 power and the bots do not use its reach; Golpe Fantasma is a long dash), the others are within a pass or two. The per-slot damage budget (tests/data/tutor-moves.test.ts) keeps every tutor move at or under the best original move of its slot and shape (+25 % with recoil or a heavy cooldown), so a tutor move adds options and coverage, not raw damage; the Mejoras (+10 % damage per rank, two ranks) are the deliberate power step.
