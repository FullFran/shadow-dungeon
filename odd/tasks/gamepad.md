# Gamepad support

Objective: play the whole game with a standard controller, no keyboard needed (issue #32). Branch `feat/gamepad` (first pass), then `feat/gamepad-parity` (audit against #32 and the missing pieces, 2026-11-24). Delivery: `ask-on-risk`. Runners: `npx vitest`, real browser with a mocked Gamepad API (`tests/e2e/desktop-gamepad.spec.ts`).

## Specs

- S1 Log L1: "da soporte a mando ya de forma prioritaria". Scope from #32: combat, town, menus, cinematics and dialogue with a controller.
- S2 One adapter, no changes per screen: outside combat the pad acts as keys (arrows, Enter, Escape, 1 to 3), so every existing screen works; in combat it feeds `TouchFrame`, the same path as touch (analogue move, auto-aim, charge, right stick aim).
- S3 Keyboard, mouse and touch behave as before; the recorded Easy game does not change. The core and the net protocol are not touched.
- S4 Changing mode, connecting or disconnecting leaves nothing stuck, and a button held across a change of mode fires nothing.
- Assumption: buttons per the Gamepad API `standard` mapping. A roll, B back, X fast, Y heavy, LB boost, RB area, LT or R3 lock, D-pad left and right switch target, Start menu, Back minimap.
- S5 Issue #32, Expected result: "The whole game playable with a standard controller (Gamepad API, `standard` mapping), with no keyboard needed:" and "Menus: every screen navigable, with confirm and back." Audit L3: A did nothing on a focused button (hub system notice, Pokémon picker, town menu): the bridge's synthetic Enter runs no browser default action, so a focused control must be activated by the bridge itself, as a real Enter would.
- S6 Issue #32, Parity checklist: "Solo and co-op (host and guest), every dungeon, Sima, shrine and challenges." Fainted in co-op, the next teammate to watch had only `Q` and a tap: the pad switches with the D-pad sides (the same press that switches target), and the button names it.
- S7 Issue #32, Parity checklist: "A controller connecting or disconnecting mid-run: no stuck inputs, and a sensible pause." The last controller disconnecting while it was playing opens the run's menu (solo: the run is paused; a shared run cannot pause, the menu still opens and the player stands still).
- S8 Issue #32, Parity checklist: "Every menu and form. Text fields need an answer: an on-screen keyboard or a clear limit." Owner's answer L4: "clear limit everywhere, no on-screen keyboard. Every text field (room code, nickname, friend code, account fields, report textarea, admin search, Clerk sign-in, avatar picker) shows a clear hint that it needs a keyboard (the device's or a physical one) when the pad is the last device, and the pad can still move focus past the field and back out without getting stuck."
- S9 Issue #32, Acceptance criteria: "A full run, from the title to a dungeon clear, with only a controller." and "Keyboard, mouse and touch behave as before, and the recorded Easy game digest does not change." Tests: "Pure mapping from gamepad state to `PlayerInput`, one test per rule. A check in a real browser, since vitest here has no DOM."
- Out of scope (#32): "Rebinding buttons, and vibration (can follow later)."

## Tasks

- T1 S2, S3, S4 pure mapping and runtime adapter, with tests. Inline. Done (first pass).
- T2 S1, S2 wiring in `game.ts` and `main.ts`, controls list, i18n, GDD. Inline. Done (first pass).
- T3 S1, S4 real-browser check with a mocked pad, gate. Done (first pass, L2).
- T4 S5 the bridge activates a focused control on Enter when no listener took it. Inline. Done, 254d973e.
- T5 S6 fainted in co-op: D-pad sides watch the next teammate; pad wording on the button. Inline. Done, f2ba7551.
- T6 S7 losing the last controller mid-run opens the menu. Inline. Done, a57c4faf.
- T7 S8 text fields: one page-wide note under a focused text field while the pad is the last device; focus leaves every field with the pad. Inline. Done, 985e1010 (a closed dropdown lets the pad's arrows go on, so the report form is not a trap).
- T8 S5-S9 browser check over every screen with only a mocked pad (`tests/e2e/desktop-gamepad.spec.ts`), GDD, this document, deploy gate. Inline. Spec 93ad20e9; GDD and this document in the closing commit.

Route evidence: no Writer trigger (small units, one behaviour each, sequential in one adapter). Risk: item 3 for T4 (the key bridge is shared by every screen); pinned by pure tests and the browser check over every screen.

## Parity checklist

- [x] Solo and co-op host and guest: the same `TouchFrame` path; picks in a shared run do not pause, so the mode follows what is open. Spectating while fainted (T5).
- [x] Every dungeon (main, challenges, Sendas), Sima/endless, shrine: they all run through `game.ts` and the same input.
- [x] Town (walking, talking, interacting: `src/town/scene.ts` reads the bridge's keys), shops, tutor, gacha, evolutions, notice board, every window: keys, plus Enter on a focused control (T4).
- [x] Cinematics and dialogue: advance and skip (`src/ui/cinematic-controls.ts`, dialogue box), pad glyphs.
- [x] Button prompts: dual hints and glyphs (issue #43, `src/ui/device-hint.ts`, `src/adapters/pad-class.ts`).
- [x] Text fields: a clear limit (T7, 985e1010). Checked with the pad in Chromium: nickname (settings), room code (online), account email and password, report textareas (through both dropdowns), all show the note and the D-pad leaves both ways (L5). An on-screen keyboard stays a possible follow-up, not built (owner, L4). Not reached locally: Clerk sign-in (no Clerk key in dev), the admin ticket search (admin only), the friend code (the window needs a signed-in account); all are page inputs under the same page-wide listener.
- [x] Connect and disconnect mid-run (T6, a57c4faf): `padLossWatch` unit tests; the browser spec unplugs the pad in a run and the menu opens (fails without the unplug).
- [x] i18n es/en (`gamepad.limit.*`, `spectate.nextKey.pad`, `controls.target`; tests/ui/pad-field-note.test.ts and the device-wording catalogue test), GDD «Mando» (docs/gdd.md), real-browser check: tests/e2e/desktop-gamepad.spec.ts, 27 tests green, each with a negative control that fails (L5).
- Pending, not dropped: rebinding pad buttons, vibration (out of scope in #32); a physical controller test (only a mocked Gamepad API so far); Safari/iOS (open question in #32, not verified); a full run from the title to a dungeon clear with only a controller (S9): with the mocked pad, title → Jugar → prologue skipped by holding B → in the Camino Hundido; the clear itself needs a person with a controller; co-op with two pads (the guest path is the same `TouchFrame` code, not run with two browsers).

## Log

- L1 2026-10-30 owner: "da soporte a mando ya de forma prioritaria"
- L2 2026-10-30 real browser with a mocked pad (`navigator.getGamepads`), no physical controller yet: menus, prologue skip, quiz, town menu, move, fast, charge with right stick after it recentred, pause menu, nothing stuck. Two peers not run with a pad.
- L3 2026-11-24 audit of #32 on main with a mocked pad over every `?screen=` (Chromium headless): down/A/B answer on every screen except A on a focused button (hub system notice "Ver novedades", Pokémon picker cards, town menu "Seguir"): synthetic key events run no default action. Missing: spectate next with the pad, a pause on losing the pad, text fields.
- L4 2026-11-24 owner via coordinator: "Owner chose: clear limit everywhere, no on-screen keyboard. Every text field (room code, nickname, friend code, account fields, report textarea, admin search, Clerk sign-in, avatar picker) shows a clear hint that it needs a keyboard (the device's or a physical one) when the pad is the last device, and the pad can still move focus past the field and back out without getting stuck. Update docs/gdd.md:634 and odd/tasks/gamepad.md to record the decision (an on-screen keyboard stays listed as a possible follow-up, not built)."
- L5 2026-11-25 browser checks with the mocked pad (Chromium headless): every field above shows the note and the D-pad leaves it both ways; the report form's closed dropdowns used to swallow the arrows (only A or Back left them), now the arrows go on and A opens. tests/e2e/desktop-gamepad.spec.ts: 27 passed; negative controls (no B press, no A press, no unplug) fail. Pad-only walk: title → Jugar → prologue skip (hold B, after the first second) → in the Camino Hundido. A dungeon clear with only a controller was not run.
