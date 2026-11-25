# Co-op lobby, revive and reconnect (#3, #50, #51)

One feature for the three co-op issues that share the lobby, connection and revive code. Branch `fix/coop-lobby-revive-reconnect` off `origin/main` (8223b60a).
Much of the three issues already shipped (see Log L2); this feature closes the acceptance criteria still open and records evidence for the rest.

## Specs

Quoted verbatim from the issues.

### #3 Co-op lobby: no connection state, and dropped or unadmitted guests stay silently out of the room

- S1 "A guest sees "connecting to the host" until admitted, then the town; after a timeout, a clear message (host missing, or connection failed)."
- S2 "A peer that reconnects to the lobby is admitted again (same player id when possible), no duplicates."
- S3 "The host sees peers that are still connecting before it starts."
- S4 "Regression tests: guest dropped and reconnected in the lobby is re-admitted and started by `begin`; guest with no host gets a timeout result; host knows about connecting peers."
- S5 "Existing `tests/net/*` stay green; solo unchanged."
- S6 Problem 3: "On the guest side a host drop sets `hostGone` permanently (`session.ts:296`)."

### #50 Co-op: a fainted player can be stuck (no revive hint, stale host choice, bonfire counters per peer)

- S7 "No hint and no way back on a floor without revive ... Proposal: show whether a revive is available ("Un compañero te reanima si se queda a tu lado 3 s" / "Vuelves en la planta siguiente")."
- S8 "**Defect:** `onWipe` returns early while the host has a stale choice open ... Fix: close the choice when the local player faints."
- S9 "**Defect:** `bonfireUsed`/`bonfire` are counted per peer. ... Fix: the host always sends `sendRetry(floor, false)` on a shared defeat, or the respawn count lives in the shared state."
- S10 "A fainted host that hides the tab freezes the run for everyone (the loop runs on requestAnimationFrame)."

### #51 Co-op: a network blip throws a guest out of the room; joining is sometimes slow

- S11 "a 15 s grace window keeps a dropped peer's slot, the guest's run pauses with "Reconectando con el anfitrión…", the host re-sends what was missed when the peer is back, an explicit leave stays immediate (and is now also sent from the room's town), and a room that really ends says the connection to the host was lost."
- S12 "a reload in a full 4-player room is refused as "full" while the old slot is held, and a guest away while the host starts a new run stays in the old one."
- S13 "Still to measure: join time with 10 relays; fetch TURN credentials while the online screen is open; resend `leave` on pagehide. Needs a real two-browser check."

## Tasks

- [x] T1 S3, S4 (host knows connecting peers): the session lists the peers linked to the room but not in the roster yet (no hello yet, or one in flight), and the host's room window shows them. Route: inline. RED: 3 new tests in `tests/net/lobby.test.ts` failed (`connecting` not a function), GREEN after. Commit 33ea10e9.
- [x] T2 S1 (connecting clock): a guest that falls out of the roster after being in (dropped, re-knocking) reads "connecting" again with a fresh timeout, not "the host is not answering" at once. Route: inline. RED: `tests/town/lobby.test.ts` "the wait for the host starts over..." failed (`createAdmitClock` missing), GREEN after. Commit 33ea10e9.
- [x] T3 S13 (slow join): the TURN credentials are fetched while the online screen is open, and opening the room reuses them instead of waiting up to 4 s. Route: inline. RED: 4 new tests in `tests/adapters/turn.test.ts` failed (`createIceCache` missing), GREEN after. The online screen also loads the Trystero chunk ahead. Commit 26c563d0.
- [x] T4 S2, S5-S12: already on main; evidence recorded (Log L2, L3), suite green. Route: inline.
- [x] T5 Deploy gate (typecheck, vitest, build, prove). Route: inline, local (the remote CI box needs a pushed branch; pushing is the owner's call). typecheck exit 0; `npx vitest run --testTimeout=30000`: 455 files, 6540 tests passed, but exit 1 from one vitest-worker RPC timeout (`Timeout calling "onTaskUpdate"`, laptop loaded by parallel workers); rerun with `--maxWorkers=4`: 6540 passed, exit 0; build exit 0; prove exit 0 (217 cards survivable, 24/24 solver fights).

## Parity checklist

- [x] Solo unchanged: `connecting()` is [] outside a host session; the room window and the clock exist only in a room; the TURN fetch starts only on the online screen.
- [x] Host and guest roles; town lobby and every run kind (main dungeons, challenges, Sima/endless, shrine trials) start from the same lobby `begin`, so the connecting list covers all of them; held peers (mid-run) are excluded by test.
- [x] Net protocol: no change (no new message or field; protocol version untouched, so #67's bump merges cleanly).
- [x] i18n es/en: `lobby.peerConnecting` in both files (test asserts the key resolves).
- [x] GDD (`docs/gdd.md` §7 "Quién está entrando", and the online rooms line for the TURN prefetch).
- [x] Diagnostics report (`src/app/main.ts` room status) uses the same clock as the room window.
- [x] Save/migrate/sanitize: not concerned (no persisted field).
- [x] sim/prove harnesses: not concerned (no gameplay rule changes); prove run in the deploy gate.

## Log

- L1 (coordinator brief, verbatim): "fix the co-op bugs in GitHub issues #3, #50 and #51 of FullFran/shadow-dungeon, as one feature (they share the lobby, connection and revive code). Read each with `gh issue view <n> --comments` and implement every acceptance criterion they list. - #3 Co-op lobby: no connection state, and dropped or unadmitted guests stay silently out of the room. - #50 Co-op: a fainted player can be stuck (no revive hint, stale host choice, bonfire counters per peer). - #51 Co-op: a network blip throws a guest out of the room; joining is sometimes slow. Reproduce each bug first (a failing test through the public interface, or a documented manual repro) before fixing it. Note: another worker (issue #67) is bumping the net protocol version to carry a move id on enemy shots; if you also need a protocol change, keep it minimal and say so in your report so the owner can merge both. Branch: `fix/coop-lobby-revive-reconnect`."
- L2 (audit of origin/main, 2026-11-24): already shipped. #3 re-admission (`tests/net/lobby.test.ts` "a guest the host dropped ... knocks again and starts with the group", "a guest left out of a lobby update knocks again"), connecting/unreachable room status (`src/town/lobby.ts` `roomStatus`, `ADMIT_TIMEOUT_MS`). #50 points 1-3 in f5c8d978 (`tests/app/wipe.test.ts`), point 4 in b4ad6917 (hidden host steps from a timer). #51 grace window, reload in a full room, new run while away, explicit leave in 510c0b75 and follow-ups (`tests/net/drop-grace.test.ts`). Open: S3 (host has no view of connecting peers), S1 clock after a drop, S13 TURN prefetch and the real two-browser measurement.
- L3 (evidence per spec, 2026-11-24): S1 `tests/town/lobby.test.ts` (connecting, unreachable after `ADMIT_TIMEOUT_MS`, wait restarts after a drop); S2 `tests/net/lobby.test.ts` "a guest the host dropped ... knocks again and starts with the group" (same `p2`), `admit` reuses a known peer (no duplicate); S3/S4 `tests/net/lobby.test.ts` three "(#3)" connecting tests; S6 replaced by the grace window: `tests/net/drop-grace.test.ts` (a drop shorter than 15 s keeps the room, longer ends it once as lost); S7-S9 `tests/app/wipe.test.ts`; S10 `tests/app/hidden-host.test.ts`; S11-S12 `tests/net/drop-grace.test.ts`; S13 pagehide leave in `src/app/main.ts` (a3046a19), TURN prefetch in `tests/adapters/turn.test.ts`. Pending (owner, manual): real two-device run across networks and the join time with 10 relays; not measurable from this worktree without a second device.
