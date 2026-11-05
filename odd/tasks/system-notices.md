# System notices (owner, 2026-11-04)

Owner: "el aviso este y de nueva actualización y demás que salga con el fondo blur oscurecido, arriba y más grande para darle más prioridad visual".
One shared component for update, install and news notices (`src/ui/notice.ts`); see `.agents/DESIGN.md` §4 and §8.

## Tasks
- [x] T1 RED tests: queue priority and one-at-a-time, gating (run, `noticesBlocked`), keys, veil rule, motion, notice actions (`tests/ui/notice-model.test.ts`, `tests/pwa/notices.test.ts`)
- [x] T2 model (`src/ui/notice-model.ts`) and notices as data (`src/pwa/notices.ts`), es/en strings
- [x] T3 view, CSS, wiring in `src/ui/pwa.ts` and `src/app/main.ts`; old card, toast and boot news screen removed
- [x] T4 DESIGN.md §4 and §8, dev trigger `?notice=`, Playwright screenshots at 1920x1080, 1440x900, 844x390

## Parity checklist
- [x] Notices found: install card (`pwa.banner`), update toast (`registerServiceWorker` callback), news screen on boot (`patchNotesOnBoot`). All three go through the queue. The iOS Share steps stay the install notice's body (`pwa.ios`); the desktop "manual" instructions window and the corner "Instalar" button are menu entries, not notices, and are unchanged.
- [x] Stored flags unchanged: `installBanner=never`, `lastSeenVersion` (written at the same moment as before), update snooze is in-memory only.
- [x] Hub only: the queue's `ready()` needs `.hub` and no town window, drawer, iOS window, run or town canvas; an update that arrives in a run shows on the next hub draw.
- [x] Welcome gate: `setNoticesBlocked(true|false)` or the `sd:notices-blocked` event; default unblocked.
- [x] i18n es and en for every new string (`notice.*`).
- [x] All three kinds screenshot-checked at three sizes (install shown with the `prompt` offer; the iOS variant is covered by the notice unit test only).
- Not covered: controller (gamepad) input inside the card relies on its key events reaching the trapped card; not tested with a real pad.
