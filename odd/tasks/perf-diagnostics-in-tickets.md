# Performance diagnostics in player tickets (issue #71)

Objective: a bounded, on-device performance sampler whose 10 s summary a player can preview and attach to a ticket (unchecked by default), validated by the server within the 16 KiB diagnostics cap. Instrumentation only: no optimizations, no remote telemetry, nothing from #14. Branch `feat/perf-diagnostics-in-tickets` (from origin/main 8223b60a), runner Vitest and `go test`.

## Specs

Quoted from issue #71, "Scope (this issue)" and "Acceptance criteria":

- S1. "Introduce production-safe, low-overhead local performance measurement, bounded to a short sliding window. No raw per-frame logs uploaded."
- S2. "Summarize frame intervals (p50/p95, low-FPS incidence), simulation and rendering time **where separately instrumentable**, active/visible enemies, bullets, Canvas resolution/DPR, game version, broad browser/OS/touch class, dungeon/floor and solo/coop context."
- S3. "Handle background-tab throttling, first-load transients, low sample counts, devices with varying refresh rates, and missing measurements without misreporting them as poor performance."
- S4. "Extend the **existing** ticket diagnostics builder/preview; show exactly what will be sent. Use a clear **unchecked-by-default** per-report attachment decision (or explicit confirmation before sending). Do not conflate this with any future telemetry permission."
- S5. "Preserve anonymity of reports and avoid account data, full user-agent, save data, peer identifiers, IP/geolocation, free-text logs, or persistent session identifiers in performance metrics. Review existing scrubbing/allowlists."
- S6. "Keep the server's current 16 KiB diagnostic limit; validate/sanitize server-side and gracefully degrade when data unavailable."
- S7. "Add unit tests for timing summaries, capped windows, preview/consent, no PII, limits and serialization, plus mobile benchmark regression evidence before/after enabling the probe."
- S8. "Update i18n (ES/EN) and the privacy/diagnostics explanation in game."
- AC1. "A player reproducing SD-MICH33 can open **Options → Tickets → Performance** and inspect/attach a useful compact summary with **one clear voluntary action**."
- AC2. "Opting out sends **zero performance data**; a generic ticket is still possible."
- AC3. "Local sampling uses bounded memory and negligible measured overhead (quantify in existing mobile benchmarks, do not assume)."
- AC4. "The report makes it possible to compare performance with the number of enemies/bullets and distinguish update/render bottlenecks where instrumented."
- AC5. "Automated tests cover data minimization; no raw identifiers or raw traces leak into reports."

Owner constraints (coordinator brief, 2026-11-24): "only the instrumentation as planned in the issue: implement its \"Scope (this issue)\" as written and nothing past it (no performance optimizations, no automatic remote telemetry, nothing from #14)". "The attachment is unchecked by default and the player sees exactly what is sent. Server-side validation stays within the 16 KiB limit".

## Tasks

- T1 (S1, S2, S3, S7, AC3, AC4) shared ring + summary primitives in `src/adapters/perf-probe.ts`, production sampler `src/adapters/perf-sampler.ts`, wired into the run loop and the town loop: inline, done in 30aa5d8d.
- T2 (S2, S4, S5, AC5) `diagnostics.performance` in `src/app/diagnostics.ts` (budget, drop order), wired into `collectDiagnostics` in `src/app/main.ts`: inline, done in ca111657.
- T3 (S4, S8, AC1, AC2) report form: attachment off by default and not inherited from saved drafts, preview of the exact payload, i18n es/en: inline, done in 54f97a77.
- T4 (S5, S6) server allowlist for `diagnostics.performance` in `server/internal/reports`: inline, done in b5aabc8d.
- T5 (S7, AC3) before/after benchmark (`tools/mobile/bench.mjs`, sampler on/off) and micro cost; GDD §12; this document: inline, done in the `docs(perf)` commit that closes the feature (evidence `reports/perf/issue71-sampler-overhead.md`).

## Parity checklist

- [x] Run loop: solo and co-op (same loop in `src/app/game.ts`), every dungeon kind (main, challenges, Sima, shrine, tutorial) goes through it: `perfSampler()?.begin('run')` before the first rAF and `sampler.frame(...)` after the render in `frame()`; bench scenes floor, crowd-4, crowd-12 and the card bosses show a `sampler` channel.
- [x] Town loop (`src/town/scene.ts`): frame and render sampled, no enemies: `begin('town')` and `frame(now, NaN, renderMs, NaN, NaN, NaN)`; test "leaves out what was not measured" (no simMs, enemies, bullets in the town).
- [x] Hidden-host timer (co-op host with tab hidden): not sampled, discontinuity on return: the hidden `setInterval` tick never calls the sampler, and `onHidden` calls `perfSampler()?.pause()`; test "never counts a hidden tab or a long gap as a slow frame".
- [x] Every report type can attach it (performance first, all types share the switch): one `attachTech` switch for every type in `src/app/report-screen.ts`; tests in 'report consent (issue #71)'.
- [x] Room menu "Copiar informe técnico" (same `collectDiagnostics`): `src/app/main.ts:329`, and the fatal-error screen (`main.ts:2476`) use the same function, so both carry `performance`.
- [x] Admin triage view (`src/app/tickets-screen.ts`) shows the stored JSON: `diagnosticsText` prints the whole stored `diagnostics`, `performance` included; no change needed.
- [x] Server validation and storage (`go test` in `server/`): `go test ./...` 278 passed; allowlist and API tests in `server/internal/reports`.
- [x] Draft save/load: no inherited consent: `saveDraft` stores `{type, answers}` only and `loadDraft` reads an old `attachTech: true` as false; test "the draft does not keep the decision".
- [x] i18n es/en: new `report.attachTech.*` keys in both files; i18n parity test green.
- [x] GDD §12: "Reportar un problema" (unchecked by default) and the new "Rendimiento en el reporte" entry.
- [x] Dev `?perf=1` probe and `tools/mobile` benchmarks still work: probe moved to the shared ring, bench runs on and off (`reports/perf/issue71-*.json`).

## Measurement (AC3)

`reports/perf/issue71-sampler-overhead.md`: on a Ryzen 5 5500 with headless Firefox 160 at DPR 3, frame p95 stays at 17.1 ms with the sampler on and off in every bench scene, and simulation and render move within ±0.25 ms (run-to-run noise); the sampler's own cost reads 0.00/0.02 ms p50/p95 (timer resolution). Pure cost in Node: `frame()` 57.7 ns, `snapshot()` 0.22 ms on a full window (only when a report is previewed or sent), 82 KiB fixed memory, 604-byte JSON. Pending: a real phone measurement and a 20+ enemy point (the test arena caps at 12).

## Log

- L1 (coordinator brief, 2026-11-24): "Task: GitHub issue #71 (\"Capture opt-in performance diagnostics in player tickets (mobile enemy-density slowdowns)\") of FullFran/shadow-dungeon. Read it with `gh issue view 71 --comments`. The owner's instruction: for now, only the instrumentation as planned in the issue: implement its \"Scope (this issue)\" as written and nothing past it (no performance optimizations, no automatic remote telemetry, nothing from #14). Reuse the components the issue lists (`src/adapters/perf-probe.ts`, `src/app/diagnostics.ts`, `src/app/report-screen.ts`, `src/app/report-forms.ts`, the Go report storage in `server/`). The attachment is unchecked by default and the player sees exactly what is sent. Server-side validation stays within the 16 KiB limit; test it with `go test` in `server/`. Prove low overhead with a before/after measurement (for example `tools/mobile/bench.mjs`). Branch: `feat/perf-diagnostics-in-tickets`."
- L2 (worker, 2026-11-24): the dev test arena takes at most 12 enemies (`TEST_FLOOR.maxEnemies`), so the benchmark density ladder stops at 12; the `20+` bucket is covered by unit tests only.
