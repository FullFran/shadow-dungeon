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
- [x] T2 Net protocol and sync: message types, snapshot/state encoding, interpolation buffer, lag simulator, BroadcastChannel transport, two-tab local play via `?net=local` (route: writer A)
- [x] T3 Trystero transport, room-code lobby (create/join, up to 4), net stats overlay (route: delegated writer B; trigger: new dependency, adapters, app UI)
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

## T2 evidence and decisions
- `src/net` (may import core and data only; architecture test extended, core may not import net): `protocol.ts` (hello, start, state, claim, snap, floor, leave; state and snap as rounded arrays), `interpolation.ts` (pure buffer: render delay, linear mix, 50 ms extrapolation then hold, epoch = floor drops older samples, snap over 64 px), `transport.ts` (port, in-memory hub, fake scheduler), `lag.ts` (`LagTransport`, `parseLagParams`), `broadcast.ts` (`BroadcastChannelTransport`, hello/here discovery, 1 s heartbeat, 3.5 s timeout), `session.ts` (roster p1..p4, clock offset = min(arrival - sent), beforeStep/afterStep around each fixed step, claims sent reliably the step they happen, state/snap every 3 ticks).
- Bytes (compact JSON, measured by encoding `hostSnapshot` of run seed 7): floor 1: 4 enemies 269 B; floor 2: 13 enemies 759 B; floor 3: 10 enemies 589 B; boss floor: 1 enemy 115 B (~55-58 B per enemy). Own player state: 77 B. At 20 Hz: worst ~15 KB/s per guest from the host.
- Decisions: enemy velocity is not sent (extrapolation uses the last two samples); snapshots carry every enemy of the floor (asleep and dead too: simple, small enough); only enemy projectiles travel (remote players' projectiles are not drawn on other peers); the guest's own projectile/melee hits show locally and are overwritten by the next snapshot until the host applies the claim; host discovery waits 700 ms for a `start` answer, else the tab hosts (`?host=1` forces it); two tabs opened at the same instant can both become hosts (spike gap); a shared run never pauses on Esc and "restart floor" does nothing; fainted local player sends idle input; the host's perfect-dodge slow-mo slows enemies for everyone (spike gap).
- App: `?net=local`, `?host=1`, `?lag=&jitter=&loss=`, `?delay=` (render delay). Remote players drawn with the local sprite path, tag "P2".., HP bar, "debilitado"/"fainted" when down (i18n `net.fainted`, `net.connecting`, `net.hostLeft` unused yet).
- Checks: tests first (`tests/net/*`: interpolation 9, lag + hub 6, protocol 8, loopback 2), RED observed as missing modules; loopback mutants observed failing (guest not rolling -> hurt assertion fails; host ignoring claims -> e2 hp assertion fails). `npm test` 315/315, `npm run build` green.
- Not verified: headless two-tab smoke (no Chromium installed for Playwright); manual two-window run still needed: join/host election, enemies chasing both, both killing enemies, stairs moving both, `?lag=150&jitter=30` feel, remote faint display, closing a guest window.

## T3 evidence and decisions
- Dependency: `trystero` 0.26.0 (pulls `@trystero-p2p/nostr` and `@trystero-p2p/core` 0.26.0), default Nostr strategy, `appId: 'shadow-dungeon-spike'`, room id `room-<CODE>`, no TURN config. API used (read from the installed `dist/*.d.mts` and README): `joinRoom({appId}, roomId)`, `selfId`, `room.makeAction('m')` returning `{send(data, {target}), onMessage}` (properties, not registration functions), `room.onPeerJoin` / `room.onPeerLeave` (assignable properties), `room.getPeers()`, `room.leave()`. `room.ping` exists but is not used: RTT is measured with our own ping/pong so it works on every transport.
- Placement: `src/adapters/trystero-transport.ts` (`TrysteroTransport` over a typed `RoomLike`, tested with a fake room) and `src/adapters/trystero.ts` (the only file importing the package). The app loads it with `await import('../adapters/trystero')` from the lobby; a new architecture test asserts the package has exactly one importer and no static import of that adapter exists (mutant observed failing: a static import in `main.ts`).
- Unreliable over reliable: Trystero's data channel is reliable and ordered, so `state`/`snap` ride the same action as reliable messages (head-of-line blocking on loss is part of what the spike measures). `LagTransport` wraps it as before.
- Protocol: new reliable messages `lobby` (host roster before start), `full` (peer turned away), `ping` / `pong` (~1 Hz, every 60 steps; `pong` addressed by `to`).
- Session: `host(seed, floor, species, { lobby: true })` answers hellos with the roster only; `begin()` sends `start` with the host's seed to everyone; a fifth player gets `full` (`onFull`). A guest that knocked before the host was there knocks again on peer join or on a roster without itself (the host announces its roster when it starts hosting). `onRoster`, `inLobby`, `ping`, `peerId`, `liveStats`.
- Room codes (`src/net/room-code.ts`): 5 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O, 1/I/L); typed input normalized (case, spaces, dashes); `?room=CODE` prefills Join.
- Lobby UI (`main.ts`): "Jugar en línea": Crear sala / code input / Unirse; lobby shows the big code, Copiar, Ocultar código (page-lifetime toggle), player list (P1 anfitrión, tú), Empezar (host) and Salir; guests wait and start with the host's seed. Online runs hide "Try again" on the result screen. `?net=local` unchanged.
- Stats (`src/net/stats.ts`, pure, 1 s sliding window): bytes/s out and in, snapshots/s, average snapshot age, EWMA (0.25) RTT per peer. Snapshot age = arrival above the fastest observed path plus half the measured RTT to the sender (clocks are not synced, so this is an estimate). F3 overlay (`src/app/net-overlay.ts`, text from the pure `netStatsLines`): role, players connected, RTT per other player, snapshots/s and age (guest), KB/s out and in.
- Checks: RED observed first (missing modules; `session.onRoster`/`ping` not functions), then GREEN: `tests/net/room-code` 4, `tests/net/stats` 4, `tests/net/lobby` 4, `tests/adapters/trystero-transport` 3, `tests/app/net-overlay` 2, architecture 4. `npm test` 333/333; `npm run build` green: main chunk `index-*.js` 124.95 kB (42.05 kB gzip), lazy `trystero-*.js` 80.49 kB (29.05 kB gzip).
- Not verified: a real two-peer Trystero connection (the Playwright MCP has no Chrome installed here; nothing was run against public relays). Needs a manual run: two browsers, Create room / Join by code, Start, F3 numbers, fifth peer "sala llena", strict-NAT failure mode.

## Spike gap fixes (route: writer B, with T3)
1. Local host election race: fixed. `src/net/election.ts` `autoJoin` (moved out of `main.ts`): searching tabs remember each other's hellos (`session.rivals()`); at the search timeout only the lowest transport id among the searching tabs hosts (`winsElection`), and on hosting it admits every pending hello and sends `start` at once; the losers keep knocking. A searching winner that closes drops out on leave, so the next lowest hosts. Tests: `tests/net/election.test.ts` (both opening orders, joining a running host); mutant (always host) observed failing.
2. Host left: fixed. `session.onHostLeft` fires once for a guest (lobby or mid-run) on the host's `leave` message or its transport drop; `main.ts` ends the run/lobby with `net.hostLeft` and a back-to-menu button. Tests in `tests/net/lobby.test.ts` (lobby and mid-run, once; a guest leaving does not fire it).
3. Remote players' projectiles: fixed. `PlayerSnapshot.projectiles` (own live projectiles, encoded as an optional 11th element of the state array, ~50 B each), `RemotePlayer.projectiles` (id, pos, vel, radius; drawn only, never in `world.projectiles`, so they hit nothing on other peers), interpolated by id like enemy projectiles; renderer draws them. Tests: `tests/core/shared-run.test.ts`, protocol round-trip.
4. Guest hit feedback flicker: fixed. `src/net/hold.ts` (pure): after a guest step with claims, a hold keeps the enemy's local HP (and a local kill) until a snapshot shows HP at or below it or the enemy down, or `HOLD_MS` = 1500 ms passes (host value wins). Tests: `tests/net/hold.test.ts` 5, plus a loopback test (100 ms lag, 20 ms jitter) asserting the guest's enemy HP never goes back up; removing the session wiring makes it fail (observed).
5. Perfect-dodge slow-mo in shared runs: fixed by choice. `enemyTimeScale` is 1 for a guest or a host with remote players; the dodger keeps `slowMoMs` (tint, flash, sound) and the next-hit buff. Solo unchanged. Rationale: enemies are one shared simulation; slowing them for one player would slow them for all, and a guest slowing its local copy would desync its enemy projectiles from the host. Recorded in GDD §12.
- Checks: RED observed first (missing `election`/`hold` modules, `onHostLeft` not a function, `projectiles` undefined, timescale 0.3 instead of 1), then GREEN. `npm test` 349/349; `npm run build` green: main chunk 126.88 kB (42.75 kB gzip), lazy trystero chunk 80.49 kB (29.05 kB gzip).
- Remaining spike gaps: host-side lunge on a remote guest does not end early on the host (T1); no host migration; no reconnection; snapshot age is an estimate (no clock sync); the Trystero "unreliable" path is reliable/ordered; a real two-peer Trystero run and a manual two-window `?net=local` run are still unverified.

## Progress
Created 2026-10-25. Forecast ~1500 authored lines; delivery as work-unit commits on `feat/m1-netcode-spike`, deployed by fast-forwarding `main` with the user's OK.
