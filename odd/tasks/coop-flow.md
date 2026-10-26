# coop-flow

## Objective
Co-op runs feel fair and predictable: peers on different versions cannot join each other, nobody loses their payout when the host leaves, the party descends and enters boss rooms together after confirming, a mid-boss bonfire gives the party a respawn point, and a fallen player watches a teammate.

## Problem
(Code audit 2026-10-26, see Engram game-design/coop-floor-flow-audit.)
- No protocol/version gate: an unknown dungeon becomes the Crypt (src/data/dungeons.ts:479) and enemy species from the wire are not validated (src/net/protocol.ts:169-212), so a newer host can desync or crash an older guest.
- Host leaving dissolves the room before `onEnd`, so guests get no payout (src/app/main.ts:203-205, 287-291); a guest can also miss `onEnd` when the host reopens the lobby first (main.ts:897-899, 965-972).
- Any living player on the stairs moves the whole party instantly (src/core/floor.ts:54); room exits only check the host (src/core/rooms.ts:41).
- A wipe ends the run; there is no checkpoint. Late join/reconnect drops a fresh level-1 character mid-floor (src/net/session.ts:321-323).
- A hidden tab leaves a frozen, targetable body that can hold the stairs. A fallen player's camera stays on their body (src/app/game.ts:908).
- Descending appears to heal fainted players by 25 % (src/core/run.ts:245, inferred).

## Why
User requests (2026-10-26): stairs should ask before descending; the party gathers at the stairs; a Dark Souls fog before each boss where teammates wait; a bonfire at the mid-boss as respawn for the second half; none of this in the Sima; investigate every multiplayer situation and fix in the agreed order.

## Scope
- T1 Version gate: protocol version + content hash in hello; mismatch is refused with a clear message on both sides; validate enemy species and dungeon ids from the wire (no crash).
- T2 Payout safety: a guest whose host leaves mid-run gets the normal defeat-style payout of what it earned (same rule as a defeat); fix the reopen-lobby race so every peer runs `onEnd` before following.
- T3 Stairs confirm + gather: stepping on the stairs asks "¿Bajar?"; solo descends on confirm; in co-op confirming marks you ready ("Esperando a N"); descend when every living, present, active player is ready; fallen players come along; AFK (no input 30 s) or hidden-tab players do not count. Same rule for room exits (fixes host-only exits). Check and fix the descent heal on fainted players if confirmed.
- T4 Fog gate: every boss room (mid-boss, final boss; not Sima echoes, not shrine) starts with a short antechamber and a fog wall; touching it asks to cross; the fight starts when every active living player has crossed (same gather rule); the fog seals behind.
- T5 Bonfire: defeating the mid-boss lights a bonfire; a later full wipe respawns the party at it with the snapshot taken when lit (HP, items, levels, coin tally) instead of ending the run; respawns per tier (proposal: easy ∞, normal 3, hard 1, nightmare 0, to confirm); off in Sima/endless, shrine and challenge dungeons if they have no mid-boss. Online: host sends a retry message, each peer restores its own snapshot. Mid-run join/reconnect only at the bonfire or on a new floor start.
- T6 Spectate: a fallen player's camera follows a standing teammate (cycle with a key/tap).

## Constraints
- Allowed surfaces: odd/tasks/coop-flow.md, src/**, tests/**, docs/gdd.md, index.html.
- Simple and clean (user). Single shared world per run stays; no independent floors per player.
- Golden digest, prove, existing tests green; solo flow unchanged except the stairs prompt.
- Net changes keep old-peer behaviour safe (T1 lands first).
- One work-unit commit per task, Conventional Commits, no AI attribution; no push/merge.

## Decisions
- 2026-10-26 (user): stairs ask; gather at the stairs instead of independent floors; fog gate before bosses; bonfire at the mid-boss; nothing of this in the Sima; order T1→T6 approved; gacha published first.

## Delivery strategy
New branch `feat/coop-flow` from main after the gacha merge; one commit per task; forecast ~1,500–2,000 authored lines.

## Tasks
- [x] T1 Version gate + wire validation.
- [x] T2 Payout on host leave + reopen race.
- [ ] T3 Stairs confirm + gather + AFK exclusion + room exits.
- [ ] T4 Fog gate before bosses.
- [ ] T5 Mid-boss bonfire respawn + join points.
- [ ] T6 Spectate camera.

## Acceptance
- typecheck, `npx vitest run --testTimeout=30000`, build, `npm run prove` green.
- Loopback net tests (tests/net/coop-loop.ts) cover: mismatch refused, guest paid on host leave, stairs need all active players, AFK excluded, fog starts the fight only when all crossed, wipe after mid-boss respawns at the bonfire, Sima unaffected.

## Progress / evidence
- T1 (route: delegated writer, single bounded writer for T1–T3). hello, lobby and start carry `v` (PROTOCOL_VERSION 2) and `c` (FNV-1a of the sorted species, move, item, room and dungeon ids, src/net/version.ts). The host answers another version with `full` + `reason: 'version'` (an older peer reads it as a full room) and fires `onVersionRefused` (toast); a guest refuses a lobby/start of another version itself. The decoder drops enemies of unknown species, projectiles of unknown types, malformed states, actions of unknown moves (action null), unknown AI modes (idle), starts of unknown dungeons, roster entries without a p1..p4 id, malformed hit claims and non-whole floors. The shrine flag and `oldPeers` were removed: the gate supersedes them. RED: tests/net/version.test.ts failed (module missing) on the base; GREEN after. Checks: typecheck ok; vitest 215 files / 2608 tests passed; build ok; prove 166/166 cards, 24/24 fights. Commit 1c0797f.
- T2 (route: delegated writer). `RunningGame.cutShort('hostLeft' | 'closed')`: a run still going ends now as a defeat (defeatShare 0.75 of what was earned), an end already decided shows its screen now, a finished one does nothing (`cutShortAction`, src/app/after-run.ts); `onEnd` is guarded so it runs exactly once (the last-hit timer and the guardian card cannot run it twice). main.ts: host left mid-run → cutShort('hostLeft') then `leaveNet` in onEnd, end screen line `net.cutShort.hostLeft`, back to the hub (backToRoom falls back to the town, not the title); host reopened the lobby while the guest's run is still going → cutShort('closed'), the guest's end screen leads back to the room's town. No Sima score for a cut run. RED: `cutShortAction is not a function` (tests/app/after-run.test.ts); GREEN after, plus a session loopback (room closes once, host leaves once). Checks: typecheck ok; vitest 215 files / 2610 tests passed; build ok; prove 166/166, 24/24.

## Next step
Merge and deploy gacha-evolutions, then T1.
