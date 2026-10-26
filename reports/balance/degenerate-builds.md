# Degenerate builds: exploits, fixes and metrics

odd/tasks/degenerate-builds.md, 2026-10-26. User report: "con Campana Concha puedes ser inmortal".

## How it is measured

- **Tank bot** (`src/sim/tank.ts`). It never rolls. It walks into a card boss and uses its best ready slot (area, boost, heavy, fast) at the floor's expected level with the build under test. Each Nightmare card is *held*: its clock and the boss HP are put back every step, so the fight only ends when the player faints. A build still standing after 180 s out-heals that card (**immortal**). A card is **flipped** when the build is immortal on a card that kills the same starter's bare, unranked default kit within 60 s.
- **Grids.** "Full ++" = the four FULL_BUILD loadouts at rank +2 on the 46 cards of the 8 card bosses (184 card fights). The audit (`npx vite-node tools/degenerate-builds.ts`, full table in `degenerate-builds-audit.md`) plays 16 builds, bare and with every sustain item (`TANK_ITEMS`).
- **Offence** (`npx vite-node tools/degenerate-offense.ts`). The perfect bot with four slots plays every fixed arena on Nightmare, seeds 1–2, full builds ++.
- **"Before"** is main 91408ba. On main the tank-item set holds 2 Leftovers, so main's real worst case (3 Leftovers) is worse than shown.

## Table

| Exploit | Mechanism | Fix | Before | After |
|---|---|---|---|---|
| **Shell Bell immortality** (the report) | `onHitDealt` healed 12 % × stacks (24 % with two) of *every* hit, with no cap. It was fed by zone ticks, chain jumps, split shards, rethrows and the overflow a spell card's HP floor throws away. A ranked multi-hit build out-healed a Nightmare boss. | Heals only on direct hits, on the HP the hit really took. Budget of 1 % max HP/s per stack, holding up to 3 s (`shellBellPerSecond`, `shellBellBurstSeconds`). Leftovers and the bell share a 2 % max HP/s ceiling (`sustainPerSecond`). | Full ++ with 2 bells: 76 of 184 cards immortal (17 of 32 on card 0 alone). zorua/aegislash, litwick/decidueye and cubone/salazzle card 0 were alive at 180 s. | 16 of 184 (4 bare). The three test cases die within the 150 s bound (19–24 s in the tuning runs). |
| **Leftovers ×3** | 1 % max HP/s per stack, 3 stacks: 3 %/s regeneration with no condition. That is more than a face-tanked Nightmare card deals. | `maxStacks` 3 → 2, under the shared 2 % ceiling. | Full ++ with 3 Leftovers: 37 of 184 immortal. mimikyu/dhelmise card 1 was alive at 180 s. | 18 of 184. mimikyu/dhelmise card 1 dies within 150 s. |
| **Drain lifesteal** (Juego Sucio +2, Puño Drenaje, Beso Drenaje, Gigadrenado) | `afterHit` healed `drain` × the computed damage, overflow included, with no cap. Foul Play's damage bonus made it huge. | `DRAIN_BUDGET`: 1 % max HP/s with a 3 s buffer (a big hit still heals 3 % at once), on the HP really taken. | zorua-iframes (Foul Play ++) bare: 30 of 46 immortal, 27 flipped, 5.4 % max HP/s healed. mimikyu-drain bare: 18 immortal, 12 flipped. | zorua-iframes 4 immortal, 1 flipped, 1.2 %/s. mimikyu-drain 4 immortal, 1 flipped. |
| **Permanent super-armor** (Mazazo +2, Doble Filo +2, Puño Drenaje +2, Envite Ígneo +1…) | A heavy move's 2–2.5 s ward was restarted by every swing. | A ward rests as long as it ran before another can start (`ward.restMs`), so it covers at most half the fight. | 87–98 % uptime (mimikyu-full 89 %, cubone-full 92 %, cubone-armor 94 %, mimikyu-drain 98 %). | 42–46 %. Ceiling test: 52 %. |
| **Guard × super-armor stacking** (Corpulencia/Defensa Férrea/Armadura Ácida under a ward; Danza Espada +2) | Damage-taken factors multiplied (0.5 × 0.7 = 0.35). | `DAMAGE_TAKEN_FLOOR` 0.5: guard and ward together let through at least half a hit. Either one alone is unchanged. | Bulk Up 0.6 under a 0.6 ward: 36 % of a hit got through. | 50 %. mimikyu-drain bare goes from 9 to 7 immortal cards with the floor alone. |
| Rank i-frames (Sombra Vil +2, Excavar +1, Golpe Bajo +1, Derribo +2, Nitrocarga +2, Envite Ígneo +2) | Invulnerable during the active phase of the move. | None needed: no build gets close to permanent invulnerability. Ceiling test: 25 %. | 1–20 % uptime (mimikyu-iframes 19 %, cubone-iframes 17 %, litwick-armor 17 %). | Same. |
| Will-O-Wisp +2 aura, zones, chains, splits | Repeated ticks fed Shell Bell. | Covered by the bell's direct-hit rule: zone ticks heal nothing now. The damage itself is part of the move's budget (hard ceiling, odd/tasks/move-progression.md). | Fed the bell. | Damage only. |
| Marks and weakening | Could stack? | None needed: one mark is pending per enemy, and a new weakening replaces the running one. | zorua-weaken bare: 2 of 46 immortal, 1 flipped. | Same. |
| Focus Sash + heals | Survives one lethal hit. | None needed: once per floor, so it only delays death once. | — | — |
| Rocky Helmet ×3 | 24 damage per enemy contact. | None needed: damage only, and it heals nothing. | — | — |
| Choice Band + Maestro, crit stacking | Damage multipliers. Crit chance can pass 100 %. | None needed. Spell-card HP floors and invulnerable declarations bound a fight, so no boss is skipped, and a crit is a flat ×1.5. | Nightmare arenas won (of 18) with no items: Mimikyu 4, Zorua 4, Litwick 2, Cubone 6. | With Choice Band, Muscle Band ×3, Expert Belt ×2, Scope Lens ×3 and Quick Claw ×2: 2, 5, 3 and 9 won; median boss TTK 20–40 % lower. |

## With every sustain item (residual)

Rows are tank items (Leftovers ×2, Shell Bell ×2, Sitrus Berry ×2, Focus Sash, Rocky Helmet ×3) on the 46 Nightmare cards. Values are immortal cards, then flipped cards in parentheses.

| Build | Main (before) | After |
|---|---|---|
| zorua-full | 33 (30) | 8 (5) |
| zorua-iframes | 33 (30) | 14 (11) |
| zorua-uturn | 35 (32) | 12 (9) |
| litwick-full | 32 (18) | 14 (4) |
| mimikyu-full | 23 (16) | 1 (0) |
| cubone-full | 20 (8) | 2 (0) |
| mimikyu-drain | 34 (27) | 21 (14) |
| zorua-weaken | 33 (30) | 21 (18) |
| cubone-kit (Bulk Up ++) | 36 (20) | 24 (9) |
| cubone-iframes (Iron Defense ++, Dig) | 39 (23) | 31 (16) |

Healing per second with these items is now 1.9–3.3 % max HP (main: 2.6–5.7 %). The 3 % peaks come from the Sitrus Berries and the drain budget on top of the 2 % sustain ceiling.

A build that spends about nine item picks on defence still out-heals many cards **when it never dodges**. Most of those cards are near equilibrium even bare: the default kits face-tank them for 80–177 s, and the unranked kits with the same items hold 10–17 of them.

Pushing the ceiling lower would make Leftovers and Shell Bell pointless. The request asked for a ceiling of about 2–3 % max HP/s, and the shared 2 % ceiling sits inside it. Bulk Up +2 (heal 10 %) and Iron Defense +2 (heal 8 %) are what lift cubone-kit and cubone-iframes. They flip nothing bare (0 and 1), so they were left alone.

## Balance quick report

`npm run balance -- --quick --slots` is byte-identical to the baseline after B1 and after B2 (0 failures, 41 warnings, 72 passes): no sweep run changed. The sweep's bots take the first item offered and play unranked kits, so none of the changed paths (bell or drain budget, a third Leftovers, a restarted ward, guard × ward) altered a run. This was not traced run by run.
