# Releasing a version

The version lives in one place, `package.json` `version` (semver). The patch notes live in one place, `src/data/changelog.ts`. The in-game "Novedades" screen and the GitHub Release both read them.

## Steps

1. **Bump the version** in `package.json` (`0.9.0` → `0.10.0` for new content, `0.9.1` for fixes only).
2. **Add the changelog entry** at the top of `CHANGELOG` in `src/data/changelog.ts`: `version`, `date` (YYYY-MM-DD of the deploy) and the sections that apply (`new`, `improved`, `fixed`, `multiplayer`, `balance`, `known`), every item with `es` (peninsular Spanish) and `en`.
   - Curate from `git log <previous tag>..main` (Conventional Commits): player-facing changes only, in the player's words, no internals.
   - List only what is implemented and goes out in this deploy. Never announce work in progress.
   - `tests/data/changelog.test.ts` fails if the `package.json` version has no entry, so a release cannot ship without notes.
3. **Deploy gate**, all green:
   ```sh
   npm run typecheck
   npx vitest run --testTimeout=30000
   npm run build
   npm run prove
   ```
4. **Commit and merge to `main`** (`chore(release): 0.10.0`).
5. **Deploy**: `gh workflow run deploy.yml -R FullFran/shadow-dungeon --ref main`. Wait for it to finish and check the game shows the new version on the title screen (`v0.10.0 · <commit>`).
6. **GitHub Release** from the same notes (Spanish first, then English):
   ```sh
   node tools/release-notes.mjs 0.10.0 | gh release create v0.10.0 -R FullFran/shadow-dungeon --target main --title v0.10.0 --notes-file -
   ```
   `tools/release-notes.mjs` needs Node 22.18 or newer (it runs the TypeScript changelog directly).

## What players see

- The title screen shows the build in a small dim line (`v0.9.0 · e60dcb9`); Credits name it too.
- After an update, the first time a player reaches the title, "Novedades" opens by itself once. A brand-new install only records the version. It never opens over the prologue, the personality test or a cinematic. It is always reachable from Options → Novedades.
