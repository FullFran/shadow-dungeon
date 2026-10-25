# M1 netcode spike

## Objective
Find out, with a playable 2–4 player prototype, whether souls-like combat feels fair over real browser-to-browser latency, before building full co-op (M4).

## Problem
GDD §12: if the host decides everything, guests get hit "even though they rolled". The combat relies on dodge timing, so latency could ruin it. User fallback if it cannot work: lean into "masked turn-based rhythm" (long telegraphs, clear beats), which is what makes souls combat readable anyway.

## Approach (spike, provisional)
- Same run seed on every peer, so every peer generates the same floors locally; only dynamic state travels.
- Host-authoritative enemies: the host runs enemy AI against all players and broadcasts snapshots (~20 Hz) with enemy state, active hitboxes/projectiles and telegraphs.
- Each peer owns its own player: movement, rolls and attacks are simulated locally with no wait (client-side prediction by ownership). Peers send their player state (~20 Hz) and hit claims on enemies; the host applies them (trusted in the spike).
- Victim-side hit detection: each peer checks enemy hitboxes against its own player, so a roll that dodged locally always dodged.
- Remote players and (on guests) enemies are rendered from an interpolation buffer (render delay ~100 ms, tunable).
- Transport port with adapters: BroadcastChannel (two local tabs, no internet) and Trystero (real rooms by code); a lag simulator wraps any transport (`?lag=ms&jitter=ms&loss=0..1`).
- Floor changes are host-decided and broadcast.
- Measure: RTT, snapshot rate, packet age, hits that guests felt unfair (manual playtest log).

Out of scope: difficulty selection, enemy scaling by n, revive, anti-cheat, reconnection, an unreliable data channel (measure the reliable one first), lobby polish.

## Constraints
- Core stays pure and deterministic; networking lives in adapters/app; architecture test green.
- Single-player must keep working unchanged (solo = host with no peers).
- No AI attribution in commits; Conventional Commits. Deploys only with the user's explicit OK each time.

## Tasks
- [x] T1 Core multi-player model: N players in the world, enemies target among players, peer roles (host runs enemies, guest applies snapshots), hit claims, victim-side hits (route: delegated writer A; trigger: core state/step/enemies/hits refactor + tests)
- [ ] T2 Net protocol and sync: message types, snapshot/state encoding, interpolation buffer, lag simulator, BroadcastChannel transport, two-tab local play via `?net=local` (route: writer A)
- [ ] T3 Trystero transport, room-code lobby (create/join, up to 4), net stats overlay (route: delegated writer B; trigger: new dependency, adapters, app UI)
- [ ] T4 Manual latency playtest with the user, findings and go/no-go recorded in the GDD (route: parent + user)
- [ ] T5 Deploy (route: parent, needs user OK)

## Acceptance criteria
- Two local tabs with `?net=local` play the same floor together; enemies chase and hit both; both can kill enemies; stairs move both to the next floor.
- With `?lag=150&jitter=30` a player's own movement and rolls never stall; a locally dodged hit never damages.
- Solo play is unchanged (all existing tests green).
- `npm test` and `npm run build` pass.

## Checks
`npm test`, `npm run build`, manual two-tab run.

## T1 evidence and decisions
- Model: `state.player` stays the local player (no churn in solo code paths); `state.localId`, `state.role` (`host`/`guest`, solo = host), `state.remotes` (other peers' players as `PlayerState`, never simulated) and `state.appliedClaims` (bounded to 512 ids) were added. `presentPlayers`/`targetOf`/`partyDefeated` in `src/core/party.ts`.
- Targeting: each enemy goes for the nearest present (hp > 0) player, ties broken by the lower id; recomputed every step (no aggro memory in the spike). Brains take the target position for steering; contact is always checked against the local player (`src/core/victim.ts` holds the shared melee hitbox predicates).
- Flow field: one multi-source BFS from every present player's tile (cost independent of N; rebuilt when any player changes tile). `flowFieldFrom(grid, origins)`.
- Waking: any present player wakes sleepers (room, radius with sight, or being hit).
- Guest step: own player, own projectiles, lock, collapse damage/push on the local player; no wake/flow/AI/enemy reactions/collapse enemy drops. Enemy melee attacks from the last snapshot land victim-side via `guestEnemyContacts`; the guest keeps its own per-attack contact record across snapshots of the same attack (`sameAttack` in `sync.ts`).
- Hit claims: only guests emit `hitClaim` events (host and solo are authoritative, so solo event streams are unchanged). Claim id = `<playerId>:<source>:<enemyId>`, source = `m<tick the move started>` for melee or the projectile id; `applyHitClaims` ignores ids seen before. Guards are resolved on the guest's copy (blocked claims carry chip damage, no stagger).
- Run: `onStairs` counts any standing player; `progressRun` on a guest never takes the stairs; `followToFloor` loads the host's floor from the shared seed; defeat only when every player is down.
- Known spike gaps: a host-side lunge that hits a remote guest (on the guest) does not end early on the host; guest hp/hit feedback on enemies is overwritten by the next snapshot until the host applies the claim.
- Checks: tests first in `tests/core/party.test.ts` (RED observed: missing modules, then 4 failing shared-run tests), GREEN 289/289 with all pre-existing tests unchanged; `npm run build` green.

## Progress
Created 2026-10-25. Forecast ~1500 authored lines; delivery as work-unit commits on `feat/m1-netcode-spike`, deployed by fast-forwarding `main` with the user's OK.
