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

- T1 (S1, S2, S3, S7, AC3, AC4) shared ring + summary primitives in `src/adapters/perf-probe.ts`, production sampler `src/adapters/perf-sampler.ts`, wired into the run loop and the town loop: inline, commit pending.
- T2 (S2, S4, S5, AC5) `diagnostics.performance` in `src/app/diagnostics.ts` (budget, drop order): inline, commit pending.
- T3 (S4, S8, AC1, AC2) report form: attachment off by default and not inherited from saved drafts, preview of the exact payload, i18n es/en: inline, commit pending.
- T4 (S5, S6) server allowlist for `diagnostics.performance` in `server/internal/reports`: inline, commit pending.
- T5 (S7, AC3) before/after benchmark (`tools/mobile/bench.mjs`, sampler on/off) and micro cost; GDD §12; this document: inline, commit pending.

## Parity checklist

- [ ] Run loop: solo and co-op (same loop in `src/app/game.ts`), every dungeon kind (main, challenges, Sima, shrine, tutorial) goes through it
- [ ] Town loop (`src/town/scene.ts`): frame and render sampled, no enemies
- [ ] Hidden-host timer (co-op host with tab hidden): not sampled, discontinuity on return
- [ ] Every report type can attach it (performance first, all types share the switch)
- [ ] Room menu "Copiar informe técnico" (same `collectDiagnostics`)
- [ ] Admin triage view (`src/app/tickets-screen.ts`) shows the stored JSON
- [ ] Server validation and storage (`go test` in `server/`)
- [ ] Draft save/load: no inherited consent
- [ ] i18n es/en
- [ ] GDD §12
- [ ] Dev `?perf=1` probe and `tools/mobile` benchmarks still work

## Log

- L1 (coordinator brief, 2026-11-24): "Task: GitHub issue #71 (\"Capture opt-in performance diagnostics in player tickets (mobile enemy-density slowdowns)\") of FullFran/shadow-dungeon. Read it with `gh issue view 71 --comments`. The owner's instruction: for now, only the instrumentation as planned in the issue: implement its \"Scope (this issue)\" as written and nothing past it (no performance optimizations, no automatic remote telemetry, nothing from #14). Reuse the components the issue lists (`src/adapters/perf-probe.ts`, `src/app/diagnostics.ts`, `src/app/report-screen.ts`, `src/app/report-forms.ts`, the Go report storage in `server/`). The attachment is unchecked by default and the player sees exactly what is sent. Server-side validation stays within the 16 KiB limit; test it with `go test` in `server/`. Prove low overhead with a before/after measurement (for example `tools/mobile/bench.mjs`). Branch: `feat/perf-diagnostics-in-tickets`."
