# First-run onboarding: welcome gate, questionnaire and walker reveal

Objective: a profile with no walker never meets the hub with its empty altar. It enters through a welcome gate (account or guest), then the prologue, a fully redesigned questionnaire and a walker reveal, then the first run. Branch: `feat/title-hub`.
Delivery: work-unit commits, never push. Runner: `npx vitest run --testTimeout=30000`. Design contract: `.agents/DESIGN.md` (§4 Welcome gate, Questionnaire, Walker reveal).

## Specs

- S1 owner (2026-11-04): "tienes que hacer diferente el cuando aún no has iniciado partida y no tienes un caminante: no debería salir el círculo rojo ni el hueco para tu pokémon, debe primero pedirte elegir si como invitado o iniciar sesión y guiarte primero al onboarding/cuestionario para elegir tu caminante, que también debe rediseñarse al completo acorde a lo que venimos haciendo."
- Constraint: the story order and flags stay (prologue seen flag, `starterChosen`, tutorial dungeon next); only the entry and the presentation change.
- Constraint: scoring (`src/core/quiz.ts`), every question and answer text unchanged.

## Flow

```
boot / any titleScreen() -> onboardingGate()
  adoptReturningPlayer (progress in save or records -> starterChosen)
  bootRoute({ starterChosen, hasProgress, signedIn, prologueSeen, stored step })
    hub        -> title hub as before (stored onboarding cleared)
    welcome    -> welcome gate
        Iniciar sesion -> account drawer
             closes signed in, no open sync choice -> gate again: cloud walker => hub; else prologue/quiz
             closes signed out (Esc, X) -> stays on the welcome
             "Seguir como invitado" in the drawer -> guest
        Jugar como invitado -> step = prologue (quiz when the prologue was seen)
        Ya tengo partida en este dispositivo (only with a local save) -> returning player -> hub
    prologue   -> prologue cinematic (seen flag as before) -> step = quiz
    quiz       -> voice -> one question per screen (seeded, answers saved each time) -> reveal
    reveal     -> Comenzar -> starter becomes the species, onboarding key cleared, playScreen (tutorial dungeon while the town is closed)
                  Repetir cuestionario -> new seed, first question
                  Elegir otro Pokemon -> four starter cards -> reveal of that one
                  Volver -> last question
```

## Tasks

- T1 done: `src/app/onboarding.ts` route + persisted step (device key `mazmorra-sombria.onboarding`, sanitized on read, outside `PROFILE_KEYS`). RED: `tests/app/onboarding.test.ts` (stub that routed everything to the hub failed 8 assertions first).
- T2 done: `src/app/quiz-view.ts` view model, `src/ui/icons/onboarding-icons.ts` (24 answer icons + device + two runes). RED: `tests/app/quiz-view.test.ts`, `tests/ui/onboarding-icons.test.ts` (13 assertion failures against stubs first).
- T3 done: welcome gate, questionnaire and reveal views, `src/styles/onboarding.css`, wiring in `src/app/main.ts`, `onGuest` in the account drawer.
- T4 done: DESIGN.md §4/§8, GDD "Primera vez".

## Parity checklist

- [x] Every question and answer (8 questions x 3 answers) renders with an icon in es and en (`tests/app/quiz-view.test.ts` iterates `QUIZ_QUESTIONS`); measured in the browser: all 8 questions in es and en at 844x390, 1280x720 and 1366x768 with no clipping, no scroll and answers >= 56 px (`onb-allq.mjs`, 16 distinct question texts)
- [x] Scoring unchanged: seed 7 picks the same six questions, four fixed answer paths give the same nature/walker, the distribution over all 729 paths is pinned (cubone 170, zorua 238, mimikyu 187, litwick 134)
- [x] Every starter (`STARTERS`: mimikyu, zorua, litwick, cubone) reveals with name, types and its natures' lore line in es and en (`revealView` test iterates `NATURES`)
- [x] i18n es/en parity for every new key (15 `onb.*`; `tests/i18n.test.ts` green)
- [x] Settings "Repetir test" and the first-run steps reached through Play use the same new questionnaire (`quiz()` in main.ts; retake ends in "Aceptar")
- [x] Save/migrate/sanitize: the step lives in its own device key, sanitized on read (garbage, wild answers, unknown walker); it is not a profile key, so it never syncs and `wipeDevice` leaves it harmless (a stored step is ignored once a walker exists)
- [x] Returning players: `?unlock=veteran` goes straight to the hub (no onboarding); a device with a walker or progress is never shown the gate
- [x] Solo and co-op: the gate sits in front of the title only; lobby, rooms and runs untouched; Play online still runs its own first-time steps for a profile that bypassed the gate (it cannot: no walker means no hub)
- [x] Sprite fit rule: the reveal altar and the starter cards are declared `sprite-box`es in `SPRITE_BOXES` (`.ob-altar-sprite`, `.ob-pick-art`); `tests/ui/sprite-fit.test.ts` green
- [x] Touch/gamepad: the gamepad sends keys, handled like the keyboard (arrows, Enter, Esc); touch is plain buttons >= 44 px (answers >= 68 px). Real gamepad NOT tried
- [ ] Gamepad on a real pad, a real Clerk round trip (see report), Google/Discord redirect return into the welcome gate (`?sso=1` path coded, not run)
- [x] GDD "Primera vez" section; `.agents/DESIGN.md` patterns + decision log

## Log

- L1 (2026-11-04): S1. Fresh-profile Playwright runs (Chromium, cleared storage, dev server without `?unlock`) at 1920x1080, 1440x900, 1366x768, 1280x720, 844x390: welcome, intro, question, reveal: zero page scroll, zero clipped controls. Guest path end to end (welcome, prologue skip, voice, six questions by keys 1-3, reveal, reload on the reveal comes back to the reveal, Comenzar starts the tutorial run). Sign-in path: the card opens the account drawer over the welcome, Esc returns to the welcome with focus restored, the drawer's "Seguir como invitado" continues as a guest.
