# Loading and error states, fast sprite start (owner, 2026-11-04)

Request: "tienes que hacer el sistema de estados de error y loading, además de optimizar todo para que no tarde en cargar los sprites al iniciar."

## Baseline (Chromium 1243 headless, cache disabled, 1280x720, `src/data/sprite-meta.json`: 1524 sheets, 26.7 MB)

| Run | Hub shown | Partner drawn | Sprite requests / bytes before partner |
|---|---|---|---|
| dev, localhost | 904 ms | 1434 ms | 1524 / 26.7 MB |
| dev, 4G (10 Mbps, 40 ms) | 8924 ms | 31599 ms | 1524 / 26.7 MB |
| preview build, localhost | 388 ms | 3389 ms | 1524 / 26.7 MB |
| preview build, 4G | 1107 ms | 23532 ms | 1524 / 26.7 MB |

Cause: `loadSheets()` fetches every sheet of every species at boot and the partner portrait waits for all of them.

## Tasks

- [x] T1 Error model (`src/adapters/net-error.ts`), `request()` with timeout and GET-only backoff (`src/adapters/http.ts`), adapters routed through it.
- [x] T2 Shared loader (`src/adapters/assets.ts`): dedupe, cache, priority, retry once, placeholder, idle prefetch; boot critical set; run preload.
- [x] T3 Service worker: art cache that survives deploys, `/portraits/`.
- [x] T4 Relic status components (`src/ui/status.ts`, `src/styles/status.css`): spinner, skeleton, inline error, error card, fatal screen, toast, offline banner, boot splash.
- [x] T5 Screens wired: cloud sync (notice once per outage), friends and tickets (spin loader, error card, auto retry when back online), resume, lobby and town waits (spin loader). Ranking board shows a dot placeholder while loading and already retries every 15 s; report and account keep their own inline error lines (already specific).
- [x] T6 Docs (DESIGN.md, gdd.md), measurements after, screenshots.

## Parity checklist

- [x] Every API adapter (account, friends, report, admin) routes failures through the model (tests/adapters/api-error-routing.test.ts iterates them; Clerk's own SDK keeps its error keys).
- [x] Every sprite consumer (renderer, town, dialogue box, prologue and story scenes, portraits, loadout, backdrop, move preview) reads through the shared loader (`sheets` store; `tsc` clean, `rg` shows no other `new Image`).
- [x] Tiles of the town load through `assets.image`.
- [x] i18n es and en for every message (tests/i18n.test.ts and net-error.test.ts).
- [x] Solo, co-op, town, Sima, shrine, challenges: run preload covers the player species and the dungeon's pool; the rest loads lazily. Not measured in a browser: a full run start (only the hub, offline reload and error screens were).
- [x] `npm run prove` unchanged: 166 cards survivable, 24/24 solver fights, no diff in reports/proof/.

## Pass 3 (2026-11-04)

- [x] Error card and fatal screen use an original `error` pixel icon, not the padlock (`tests/ui/status-icon.test.ts`, `tests/ui/pixel-icons.test.ts`).
- [x] The town tile loader and the sprite loader report an `asset` error once per session through `reportAssetFailure` (`tests/adapters/asset-report.test.ts`); the town no longer draws flat colours silently.
- [x] Parity: sprites and tiles are the two asset consumers that raise it; portraits use the same `image` loader and the same reporter.
