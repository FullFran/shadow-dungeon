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

- [ ] T1 S3, S4 (host knows connecting peers): the session lists the peers linked to the room but not in the roster yet (no hello yet, or one in flight), and the host's room window shows them. Route: inline.
- [ ] T2 S1 (connecting clock): a guest that falls out of the roster after being in (dropped, re-knocking) reads "connecting" again with a fresh timeout, not "the host is not answering" at once. Route: inline.
- [ ] T3 S13 (slow join): the TURN credentials are fetched while the online screen is open, and opening the room reuses them instead of waiting up to 4 s. Route: inline.
- [ ] T4 S2, S5-S12: already on main; evidence recorded (tests named in the Log), suite green. Route: inline.
- [ ] T5 Deploy gate (typecheck, vitest, build, prove). Route: inline.

## Parity checklist

- [ ] Solo unchanged (no session, no room window, no TURN fetch outside online).
- [ ] Host and guest roles; town lobby (main flow) and room runs (main dungeons, challenges, Sima/endless, shrine trials all start from the same lobby `begin`).
- [ ] Net protocol: no change (version stays as on main; #67 bumps it separately).
- [ ] i18n es/en for every new player-facing string.
- [ ] GDD (`docs/gdd.md`) co-op lobby section mentions the host's connecting list.
- [ ] Diagnostics report (`src/app/diagnostics.ts`) still gets the room status.
- [ ] Save/migrate/sanitize: not concerned (no persisted field).
- [ ] sim/prove harnesses: not concerned (no gameplay rule changes); prove green.

## Log

- L1 (coordinator brief, verbatim): "fix the co-op bugs in GitHub issues #3, #50 and #51 of FullFran/shadow-dungeon, as one feature (they share the lobby, connection and revive code). Read each with `gh issue view <n> --comments` and implement every acceptance criterion they list. - #3 Co-op lobby: no connection state, and dropped or unadmitted guests stay silently out of the room. - #50 Co-op: a fainted player can be stuck (no revive hint, stale host choice, bonfire counters per peer). - #51 Co-op: a network blip throws a guest out of the room; joining is sometimes slow. Reproduce each bug first (a failing test through the public interface, or a documented manual repro) before fixing it. Note: another worker (issue #67) is bumping the net protocol version to carry a move id on enemy shots; if you also need a protocol change, keep it minimal and say so in your report so the owner can merge both. Branch: `fix/coop-lobby-revive-reconnect`."
- L2 (audit of origin/main, 2026-11-24): already shipped. #3 re-admission (`tests/net/lobby.test.ts` "a guest the host dropped ... knocks again and starts with the group", "a guest left out of a lobby update knocks again"), connecting/unreachable room status (`src/town/lobby.ts` `roomStatus`, `ADMIT_TIMEOUT_MS`). #50 points 1-3 in f5c8d978 (`tests/app/wipe.test.ts`), point 4 in b4ad6917 (hidden host steps from a timer). #51 grace window, reload in a full room, new run while away, explicit leave in 510c0b75 and follow-ups (`tests/net/drop-grace.test.ts`). Open: S3 (host has no view of connecting peers), S1 clock after a drop, S13 TURN prefetch and the real two-browser measurement.
