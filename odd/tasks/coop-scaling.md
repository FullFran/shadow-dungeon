# Co-op scaling

## Objective
Scale encounters with the number of players (1 to 4) so a shared run is neither a stunlock nor an HP sponge: sub-linear boss and enemy HP, slightly harder boss hits, less boss stagger, bosses that switch target and gain an area card in bigger groups, and a co-op revive.

## Problem
Today nothing depends on party size (docs/souls-difficulty-research.md: "Co-op scaling: none found"). Four players melt a boss and keep it stunned, and a fainted player sits out the rest of the floor.

## Why
docs/souls-difficulty-research.md P6 (co-op table) and Appendix A (Elden Ring Multiplayer Correction), GDD §6–8.

## Scope
- T1 Scaling table (`src/data/party-scaling.ts`, `partyScaling(n)`), party size (`partySizeOf(state)` in `src/core/party.ts`), applied to spawn HP, boss damage (victim side) and boss stagger; host sends the party size in its snapshot.
- T2 Boss behaviour by party: deterministic aggro switching from n >= 2; one area card at n >= 3 through a party trick table.
- T3 Co-op revive: stand next to a fainted ally for 3 s (broken by damage to the helper), 30 % HP, once per player per floor; nightmare forbids it through `TIERS`.
- T4 Solo unchanged (golden digest), protocol additions optional, docs (GDD §6–8, README).

## Constraints
- Core pure and deterministic; architecture test green; `npm test`, `npm run build` green.
- Solo worlds get no new fields (the golden digest in tests/core/difficulty-tiers.test.ts must not move).
- Protocol additions optional and back-compatible (an older peer ignores them).
- Shared edits additive: a balance-harness writer works in parallel and calls `partyScaling(n)` and `partySizeOf(state)`.
- One work-unit commit per task, Conventional Commits, explicit paths, no AI attribution, no push.
- About 400 authored lines per task is advisory only.

## Provisional table (`PARTY_SCALING`)
| Players | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Boss / mid-boss / echo HP | 1 | 1.6 | 2.1 | 2.6 |
| Regular enemy HP | 1 | 1.25 | 1.4 | 1.55 |
| Boss damage | 1 | 1 | 1.1 | 1.15 |
| Boss stagger taken (hitstun, knockback) | 1 | 0.6 | 0.4 | 0.3 |
Enemy count unchanged (design over numbers).

## Decisions
- Party size = players present at floor entry: the local player plus every remote in the world (fainted ones included), or the session roster at run start (no remotes exist yet on floor 1). Frozen for the floor: a player who leaves or joins mid-floor changes nothing until the next floor.
- Host-authoritative: every peer derives it identically, and the host's snapshot carries it (`n`); a guest that disagrees adopts the host's value and rescales its enemies' max HP.
- Boss class = enemies with boss state (`hasBossState`): guardians, mid-bosses and echoes.
- Boss damage applies victim side to every enemy hit while a boss-class enemy is alive on the floor (projectiles carry no owner).
- Aggro switches are deferred while the boss is winding up or attacking, so a telegraph never changes victim mid-way.

## Tasks
- [x] T1 Scaling table + party size + HP/damage/stagger + snapshot field (route: inline in this writer; RED observed: 13 of 18 new tests failing before code)
- [ ] T2 Boss aggro switching + party area cards
- [ ] T3 Co-op revive
- [ ] T4 Solo digest, protocol back-compat, docs

## Acceptance criteria
- `partyScaling(1)` is all ones; solo digest unchanged.
- Two-world loopback tests: party size agreed, boss HP scaled, aggro switching, revive over the wire.

## Checks
`npm test`, `npm run build`.

## Progress
(updated per task)

## Next step
T1.
