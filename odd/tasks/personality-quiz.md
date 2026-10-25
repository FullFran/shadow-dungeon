# Personality quiz

## Objective
A Mystery Dungeon-style personality quiz that decides which Pokémon you wake up as, framed by our isekai premise: you were a human, a voice asks "¿Me oyes?" in the dark, and your answers reveal your nature and your starter.

## Problem
The user insists the quiz must exist: it is the iconic opening of Mystery Dungeon. The game has no way to pick a starter yet (the run is hardcoded to Mimikyu).

## Why
It gives the run a story opening, gives the streamer a moment the chat reacts to, and is the hand-off point to the starter roster another writer is adding (zorua, litwick, cubone).

## Scope
- Quiz core (pure, tested): original question pool, nature points, deterministic tie-break, nature → starter mapping, seeded question picks.
- Quiz screen: black screen with slow fade, MD-style window with the question and a cursor list of answers; result screen with the starter sprite, accept or choose manually. Started from the title menu (new adventure path) and from Settings ("Repetir test").
- One small integration point: the quiz outputs a species id; the app stores it and hands it to the run start / loadout, guarded when the species is not playable yet.

Out of scope: Twitch chat voting (removed by user decision 2026-10-25), the prologue (another writer; the quiz follows it later), the starter species data and loadouts (another writer).

## Constraints
- Core stays pure (no adapters, app, ui, i18n imports); architecture test green.
- Questions are original, not copied from Mystery Dungeon.
- Neutral Spanish, mysterious tone; every key in es and en.
- CSS lives in index.html (not an allowed edit surface): quiz styles are injected from `src/ui`.
- Minimal edits to `src/app/main.ts`; `src/app/settings.ts` untouched (other writers): the starter is stored under its own storage key.
- Conventional Commits, one work-unit commit per task, no AI attribution.

## Tasks
- [x] T1 Quiz core + data + i18n strings (route: inline in this writer; pure modules `src/data/quiz.ts`, `src/core/quiz.ts`, `src/app/quiz-text.ts`, tests first). RED observed (missing modules), then GREEN: 447/447 tests, typecheck clean.
- [ ] T2 Quiz screen, result screen, title and settings entry points, starter hand-off (route: inline in this writer)
- [x] ~~T3 Twitch chat voting~~ — removed by user decision 2026-10-25 (the streamer runs the chat dynamic herself). No ChatFeed port, no IRC adapter, no voting settings.

## Acceptance criteria
- Same seed → same questions; answers → same nature and starter; ties resolved deterministically.
- Every nature and every starter reachable; every question has 3 answers; 8 questions in the pool, 6 per run.
- The result reads "Eres de naturaleza X… ¡Eres un Zorua!" (es) / "Your nature is X… You're a Zorua!" (en).
- The quiz opens from the title menu on a new adventure and from Settings; the result accepts or lets you pick manually; the chosen species reaches the loadout/run start (falls back to Mimikyu while the species is not playable).

## Checks
- `npm test` (all green, architecture test included)
- `npm run build`
- `git log --format=%B -n 3 | grep -ic co-authored` = 0

## Design (T1)
- 8 natures: brave, calm, hardy, jolly, lonely, quirky, sassy, timid (Spanish game names: Audaz, Serena, Fuerte, Alegre, Huraña, Rara, Grosera, Miedosa).
- Starters: Mimikyu (lonely, timid), Zorua (quirky, sassy), Litwick (calm, jolly), Cubone (brave, hardy).
- 8 original questions (lantern, mask, friend, mirror, storm, keepsake, voice, wish), 3 answers each; each answer gives 2 points to a main nature and 1 to a second. Every nature is the main nature of exactly 3 answers (a test enforces it).
- 6 questions per run, seeded Fisher-Yates over the core mulberry32 RNG.
- Tie-break: the latest answer that scored a tied nature decides (its higher-scored tied nature; list order if equal).
- Strings sit in one contiguous block at the top of `src/i18n/{es,en}.json` (less likely to clash with writers appending at the end).

## Progress
- Feature doc created.
- T1 done.

## Next step
T2.
