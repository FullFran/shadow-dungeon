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
- [x] T5 Screens wired: cloud sync, ranking, friends, tickets, report, account.
- [x] T6 Docs (DESIGN.md, gdd.md), measurements after, screenshots.

## Parity checklist

- [ ] Every API adapter (account, friends, report, admin) routes failures through the model (test iterates them).
- [ ] Every sprite consumer (renderer, town, dialogue box, prologue and story scenes, portraits, loadout, backdrop, move preview) reads through the shared loader.
- [x] Tiles of the town load through `assets.image`.
- [ ] i18n es and en for every message (key parity test).
- [ ] Solo, co-op, town, Sima, shrine, challenges: run preload covers the player species and the dungeon's pool; the rest loads lazily.
- [ ] `npm run prove` unchanged.
