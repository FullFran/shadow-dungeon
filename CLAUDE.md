# Mazmorra Sombría: project rules for agents

## Integration rule (mandatory)

New content must be woven into everything that already exists. A feature is not done while old content of the same kind lacks it.

- When a new system lands (evolutions, challenges, skins, move tiers, rank effects, co-op rules, save fields...), apply it to every existing instance it concerns: all playable species (starters and gacha lines), all dungeons (main, challenges, Sima/endless, shrine), solo and co-op, save/migrate/sanitize, net protocol, i18n es/en, GDD (`docs/gdd.md`), sim/prove harnesses.
- When new content lands (a species, a dungeon, a boss), give it everything the existing content of the same kind has: full movepool (learnset, tutor offers, tiers, rank effects, builds), evolutions, challenge dungeon, sprites (normal and shiny), lore lines, i18n.
- Prefer tests that iterate over every instance (`PLAYABLE_SPECIES`, `DUNGEONS` plus `CHALLENGES`, every boss) so a missing piece fails a test instead of passing silently.
- Every feature document (`odd/tasks/*.md`) carries a "Parity checklist" section listing each existing area the change must reach, ticked with evidence before the feature closes.
- Never drop a planned item (for example, shiny skins from `docs/gacha-roster-plan.md`) without the owner's explicit approval; if scope is cut for simplicity, list the cut items as pending, not as out of scope.

## Conventions

- Code, identifiers, comments, commits in English; player-facing text in `src/i18n/es.json` (Spanish, peninsular) and `en.json`; GDD in Spanish.
- Conventional Commits, explicit paths in `git add`, no AI attribution.
- Deploy gate: `npm run typecheck`, `npx vitest run --testTimeout=30000`, `npm run build`, `npm run prove` all green.
- Backend lives in `server/` (Go, PocketBase as a framework).
