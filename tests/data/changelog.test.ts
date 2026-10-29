import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHANGELOG, CHANGELOG_SECTIONS, compareVersions } from '../../src/data/changelog';

const pkg = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8')) as { version: string };

/** The single source of the patch notes (issue #10): the game screen and the GitHub Release both read it. */
describe('changelog', () => {
  it('compares semver versions numerically', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('0.9.0', '0.9.1')).toBeLessThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });

  it('lists releases newest first, with strictly descending semver versions', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0);
    for (const release of CHANGELOG) expect(release.version).toMatch(/^\d+\.\d+\.\d+$/);
    for (let i = 1; i < CHANGELOG.length; i++) expect(compareVersions(CHANGELOG[i - 1]!.version, CHANGELOG[i]!.version), CHANGELOG[i]!.version).toBeGreaterThan(0);
  });

  it('dates every release with a real YYYY-MM-DD date that never increases down the list', () => {
    for (const release of CHANGELOG) {
      expect(release.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(new Date(`${release.date}T00:00:00Z`).toISOString().slice(0, 10), release.version).toBe(release.date);
    }
    for (let i = 1; i < CHANGELOG.length; i++) expect(CHANGELOG[i - 1]!.date >= CHANGELOG[i]!.date).toBe(true);
  });

  it('gives every item a Spanish and an English text, and every release at least one item', () => {
    for (const release of CHANGELOG) {
      const sections = Object.keys(release.sections);
      for (const section of sections) expect(CHANGELOG_SECTIONS, section).toContain(section);
      const items = CHANGELOG_SECTIONS.flatMap((section) => release.sections[section] ?? []);
      expect(items.length, release.version).toBeGreaterThan(0);
      for (const item of items) {
        expect(item.es.trim(), JSON.stringify(item)).not.toBe('');
        expect(item.en.trim(), JSON.stringify(item)).not.toBe('');
      }
    }
  });

  it('has the notes of the current package.json version, so a release cannot ship without them', () => {
    expect(CHANGELOG.map((release) => release.version)).toContain(pkg.version);
    expect(CHANGELOG[0]!.version).toBe(pkg.version);
  });
});
