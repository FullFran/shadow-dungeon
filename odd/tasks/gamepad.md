# Gamepad support

Objective: play the whole game with a standard controller, no keyboard needed (issue #32). Branch `feat/gamepad`. Delivery: `ask-on-risk`. Runners: `npx vitest`, real browser with a mocked Gamepad API.

## Specs

- S1 Log L1: "da soporte a mando ya de forma prioritaria". Scope from #32: combat, town, menus, cinematics and dialogue with a controller.
- S2 One adapter, no changes per screen: outside combat the pad acts as keys (arrows, Enter, Escape, 1 to 3), so every existing screen works; in combat it feeds `TouchFrame`, the same path as touch (analogue move, auto-aim, charge, right stick aim).
- S3 Keyboard, mouse and touch behave as before; the recorded Easy game does not change. The core and the net protocol are not touched.
- S4 Changing mode, connecting or disconnecting leaves nothing stuck, and a button held across a change of mode fires nothing.
- Assumption: buttons per the Gamepad API `standard` mapping. A roll, B back, X fast, Y heavy, LB boost, RB area, LT or R3 lock, D-pad left and right switch target, Start menu, Back minimap.

## Tasks

- T1 S2, S3, S4 pure mapping and runtime adapter, with tests. Inline.
- T2 S1, S2 wiring in `game.ts` and `main.ts`, controls list, i18n, GDD. Inline.
- T3 S1, S4 real-browser check with a mocked pad, gate.

Route evidence: no Writer trigger (one behaviour). Risk: none of items 1 to 5; input merging is shared code, so a differential for an idle pad is pinned by a test and the golden digest.

## Parity checklist

- [x] Solo and co-op (the same `TouchFrame` path; picks in a shared run do not pause, so the mode follows what is open).
- [x] Every dungeon, Sima, shrine, challenges: they all use the same input.
- [x] Town, windows, menus, cinematics: keys.
- [x] i18n es/en, controls list, GDD.
- [ ] Pending, not dropped: text fields (no on-screen keyboard; joining by code, account forms and report forms still need a keyboard or the device's own); next spectate target while dead (`KeyQ`); button prompts in the UI; rebinding; vibration.

## Log

- L1 2026-10-30 owner: "da soporte a mando ya de forma prioritaria"
- L2 2026-10-30 real browser with a mocked pad (`navigator.getGamepads`), no physical controller yet: menus, prologue skip, quiz, town menu, move, fast, charge with right stick after it recentred, pause menu, nothing stuck. Two peers not run with a pad.
