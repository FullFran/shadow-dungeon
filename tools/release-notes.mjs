#!/usr/bin/env node
/**
 * Prints the GitHub Release text of one version from the single changelog
 * (src/data/changelog.ts), Spanish first, then English, with the section
 * headings of the in-game screen (news.section.* in src/i18n):
 *
 *   node tools/release-notes.mjs 0.9.0 | gh release create v0.9.0 --title v0.9.0 --notes-file -
 *
 * Node runs the TypeScript data file directly (type stripping, Node 22.18+).
 * See docs/release.md.
 */
import { pathToFileURL } from 'node:url';
import { CHANGELOG, CHANGELOG_SECTIONS } from '../src/data/changelog.ts';
import es from '../src/i18n/es.json' with { type: 'json' };
import en from '../src/i18n/en.json' with { type: 'json' };

const CATALOGS = [
  { language: 'es', heading: 'Español', catalog: es },
  { language: 'en', heading: 'English', catalog: en },
];

/** The Markdown notes of one release. */
export function releaseNotesMarkdown(release) {
  const lines = [];
  for (const { language, heading, catalog } of CATALOGS) {
    lines.push(`## ${heading}`, '', `${catalog['news.version'].replace('{version}', release.version).replace('{date}', release.date)}`, '');
    for (const section of CHANGELOG_SECTIONS) {
      const items = release.sections[section] ?? [];
      if (items.length === 0) continue;
      lines.push(`### ${catalog[`news.section.${section}`]}`, '', ...items.map((item) => `- ${item[language]}`), '');
    }
  }
  return `${lines.join('\n').trimEnd()}\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const version = process.argv[2];
  const release = CHANGELOG.find((r) => r.version === version);
  if (!release) {
    console.error(version ? `No changelog entry for ${version} in src/data/changelog.ts.` : 'Usage: node tools/release-notes.mjs <version>');
    process.exit(1);
  }
  process.stdout.write(releaseNotesMarkdown(release));
}
