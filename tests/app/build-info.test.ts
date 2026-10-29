import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_BUILD, APP_VERSION, buildLabel } from '../../src/app/build-info';
import config, { buildDefines, shortCommit } from '../../vite.config';

const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version: string };

describe('build info (issue #7)', () => {
  it('package.json carries a real semver version', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.version).not.toBe('0.0.0');
  });

  it('labels a build as "v<version> · <commit>"', () => {
    expect(buildLabel('0.9.0', 'e60dcb9')).toBe('v0.9.0 · e60dcb9');
  });

  it('falls back to "dev" outside a Vite build (the tests)', () => {
    expect(APP_VERSION).toBe('dev');
    expect(APP_BUILD).toBe('dev');
    expect(buildLabel()).toBe('dev');
  });

  it('takes the short commit from GITHUB_SHA, else git, else "dev"', () => {
    expect(shortCommit({ GITHUB_SHA: 'e60dcb9a1b2c3d4e5f' }, () => 'zzz')).toBe('e60dcb9');
    expect(shortCommit({}, () => 'abc1234\n')).toBe('abc1234');
    expect(
      shortCommit({}, () => {
        throw new Error('no git');
      }),
    ).toBe('dev');
  });

  it('Vite injects the package.json version and the commit', () => {
    const defines = buildDefines({ GITHUB_SHA: '96c0e81ffff' }, () => 'unused');
    expect(defines).toEqual({ __APP_VERSION__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify('96c0e81') });
    expect(Object.keys((config as { define?: Record<string, string> }).define ?? {})).toEqual(['__APP_VERSION__', '__APP_BUILD__']);
  });
});
