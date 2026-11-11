# Rebind keyboard and mouse controls (issue #62)

Objective: players rebind every keyboard/mouse action from Settings. Branch `feat/rebind-controls`, single PR. Runner: `npx vitest run`.

## Specs

- S1. Player ticket SD-6UY359 (verbatim): "Bro que se pueda configurar los controles del teclado y raton".
- S2. An options section (Ajustes, next to the existing sections) rebinds every keyboard/mouse action: move, the four move slots, roll, lock/switch target, minimap/Tab, pause, interact and any other bound action. Click a row, press the new key or mouse button; Esc cancels. Conflicts are detected (policy: swap, documented in docs/gdd.md). "Restablecer" restores the defaults.
- S3. Bindings persist in settings (default, load/sanitize; local only) and the input code reads them.
- S4. Every key hint in the UI that names a key follows the chosen binding (through the binding lookup only; #43's touch/pad wording untouched).
- S5. Keyboard and mouse defaults stay exactly as today for players who never rebind, pinned by a test.
- S6. Gamepad remapping is out of scope: pending, #32.
- S7. i18n es/en, GDD section on controls, tests.

## Tasks

- T1 (S3, S5) Binding model, defaults, conflicts, sanitize, active table: `src/adapters/bindings.ts`. Inline. Done.
- T2 (S3) `src/adapters/input.ts`, `src/town/scene.ts`, `src/app/game.ts`, `src/app/main.ts` read the active table; synthetic pad keys read the defaults. Inline. Done.
- T3 (S3) `Settings.keyBindings` with default and sanitize. Inline. Done.
- T4 (S4) Hint bar, slot keycaps, town interact chip, tutorial signs, co-op spectate button. Inline. Done.
- T5 (S2) Settings > Controles section (`src/app/key-bindings-panel.ts` model, `src/app/settings-view.ts` DOM and capture). Inline. Done, checked in a headless browser.
- T6 (S7) i18n es/en, GDD «Reasignar teclado y ratón». Inline. Done.

## Parity checklist

- [x] Solo and co-op: input is translated locally before the net layer; the spectate key is rebindable (`tests/ui/rebound-hints.test.ts`).
- [x] Every place that reads keys: run (`input.ts`, `game.ts`), town (`scene.ts`), every dungeon (same input path; no per-dungeon keys).
- [x] Settings save/load/sanitize (`tests/app/key-bindings-settings.test.ts`, `tests/app/settings.test.ts`).
- [x] i18n es/en for every action and message (`tests/app/key-bindings-panel.test.ts`, `tests/ui/rebound-hints.test.ts`, `tests/i18n.test.ts`).
- [x] GDD `docs/gdd.md` §4 Controles.
- [x] Settings window on title, town and the run's Esc menu (one `settingsView`).
- [ ] Gamepad remapping: pending (#32), not out of scope.
- n/a Species, dungeons, bosses, net protocol, sim/prove: no key data there.

## Log

- L1 (2026-11-11) Coordinator task for issue #62, verbatim brief in the Orca dispatch (see S1-S7).
- L2 Decisions: conflict policy swap (clear when the old key would clash elsewhere); Esc, Enter, F1, F3, F11 and OS keys reserved; the menu's first key is Esc, fixed; mouse buttons only for combat actions; right Shift/Ctrl/Alt bind as left; the wheel keeps switching target and the left click keeps click-to-lock.
- L3 Browser check: capture, swap message, Esc cancel, Enter-then-key, reserved refusal and reset observed in headless Chromium; fixed a swallowed click after a middle-button capture.
