import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Cloud sync sees save writes through the store main.ts gets from
 * `setupAccount` (an observed device store). A module that wrote the save
 * through its own `browserStore()` would bypass it, so every save write
 * point must take the store as a parameter.
 */
const ROOT = join(__dirname, '../..');
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('cloud save wiring', () => {
  it('main.ts builds the game store through setupAccount', () => {
    const main = readFileSync(join(ROOT, 'src/app/main.ts'), 'utf8');
    expect(main).toMatch(/const \{ account, store \} = setupAccount\(\{\s*store: browserStore\(\)/);
    expect(main.match(/browserStore\(\)/g)).toHaveLength(1);
  });

  it('the account observes every profile key, not only the save', () => {
    const screen = readFileSync(join(ROOT, 'src/app/account-screen.ts'), 'utf8');
    expect(screen).toMatch(/observeKeys\(options\.store, PROFILE_KEYS,/);
  });

  it('no module that writes profile data makes its own browser store', () => {
    const writers = sourceFiles(join(ROOT, 'src')).filter((file) =>
      /\b(writeSave|earnCoins|earnChallengeReward|SAVE_KEY|saveRun|saveScore|saveTrial|recordHerald|RECORDS_KEY|LEADERBOARD_KEY|SHRINE_KEY|BESTIARY_KEY)\b/.test(readFileSync(file, 'utf8')),
    );
    expect(writers.length).toBeGreaterThan(3);
    const bypass = writers.filter((file) => !file.endsWith('main.ts') && /browserStore\(\)/.test(readFileSync(file, 'utf8')));
    expect(bypass.map((file) => relative(ROOT, file))).toEqual([]);
  });
});
