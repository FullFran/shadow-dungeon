#!/usr/bin/env node
// Downloads the "Normal" face portraits of every playable species (base, shiny and female looks) from PMDCollab
// SpriteCollab (CC BY-NC 4.0, the source of the sprites) into src/assets/portraits/<sprite key>/Normal.png, mirroring
// public/sprites. Writes src/data/portrait-meta.json (the pinned source commit and the keys that exist upstream)
// and the "## Portraits" section of CREDITS.md. A look without art of its own is simply left out: the game falls
// back to the base portrait of the form (src/data/portraits.ts), and says so in the manifest-driven test.
//
//   node tools/fetch-portraits.mjs                 (pinned commit of src/data/portrait-meta.json)
//   node tools/fetch-portraits.mjs --update        (move the pin to SpriteCollab's current master)
//
// SpriteCollab layout: portrait/<dex4>/Normal.png is the base form; portrait/<dex4>/<form4>/Normal.png another form;
// .../<form4>/<shiny4>/Normal.png its shiny; .../<form4>/<shiny4 or 0000>/0002/Normal.png its female look. The local
// folders are the sprite keys ("0612/0000", "0612/0000/0001", "0405/0000/0001/0002").
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCreditNames, parseCredits, resolveAuthor } from './sprite-lib.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(ROOT, 'src', 'assets', 'portraits');
const OUT_META = join(ROOT, 'src', 'data', 'portrait-meta.json');
const OUT_CREDITS = join(ROOT, 'CREDITS.md');
const SPRITE_META = join(ROOT, 'src', 'data', 'sprite-meta.json');
const REPO = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab';

// Keep in step with PLAYABLE_SPECIES (src/data/species.ts); tests/data/portraits.test.ts fails when one is missing.
const PLAYABLE = new Set(['mimikyu', 'zorua', 'litwick', 'cubone', 'abra', 'kadabra', 'alakazam', 'piplup', 'prinplup', 'empoleon', 'shinx', 'luxio', 'luxray', 'axew', 'fraxure', 'haxorus', 'zoroark', 'lampent', 'chandelure', 'marowak']);

async function fetchBuffer(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': 'mazmorra-sombria-tools' } });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status === 404) return null;
    if (attempt === 3) throw new Error(`${url} -> HTTP ${response.status}`);
  }
  return null;
}

/** The sprite key as a folder under portrait/ ("0612/0000" is portrait/0612 itself). */
function remote(key) {
  const [dex, form, shiny, female] = key.split('/');
  if (female) return `${dex}/${form}/${shiny}/${female}`;
  if (shiny) return `${dex}/${form}/${shiny}`;
  return form === '0000' ? dex : `${dex}/${form}`;
}

async function main() {
  const previous = await readFile(OUT_META, 'utf8').then((text) => JSON.parse(text)).catch(() => null);
  let source = previous?.source;
  if (!source || process.argv.includes('--update')) {
    const head = await fetch('https://api.github.com/repos/PMDCollab/SpriteCollab/commits/master', { headers: { 'User-Agent': 'mazmorra-sombria-tools' } });
    if (!head.ok) throw new Error(`commit lookup -> HTTP ${head.status}`);
    source = (await head.json()).sha;
  }
  const base = `${REPO}/${source}`;
  const sprites = JSON.parse(await readFile(SPRITE_META, 'utf8')).sprites;
  const keys = Object.entries(sprites)
    .filter(([, meta]) => PLAYABLE.has(meta.species.replace(/-.*/, '')) && !(meta.species === 'mimikyu' && meta.form === 'busted'))
    .map(([key]) => key)
    .sort();

  const names = parseCreditNames((await fetchBuffer(`${base}/credit_names.txt`))?.toString('utf8') ?? '');
  const found = [];
  const missing = [];
  const perArtist = new Map(); // display name -> { contact, looks: Set }
  for (const key of keys) {
    const png = await fetchBuffer(`${base}/portrait/${remote(key)}/Normal.png`);
    if (!png) {
      missing.push(key);
      continue;
    }
    await mkdir(join(OUT, ...key.split('/')), { recursive: true });
    await writeFile(join(OUT, ...key.split('/'), 'Normal.png'), png);
    found.push(key);
    const credits = (await fetchBuffer(`${base}/portrait/${remote(key)}/credits.txt`))?.toString('utf8') ?? '';
    for (const credit of parseCredits(credits)) {
      // Only the lines that cover the Normal emotion: the one drawn here.
      if (!credit.anims.includes('Normal')) continue;
      const { name, contact } = resolveAuthor(names, credit.author);
      const entry = perArtist.get(name) ?? { contact, looks: new Set() };
      const [, , shiny, female] = key.split('/');
      entry.looks.add(`${sprites[key].species}${female ? ' female' : ''}${shiny === '0001' ? ' shiny' : ''} (${remote(key)})`);
      perArtist.set(name, entry);
    }
    console.log(`${key} -> ${remote(key)}`);
  }
  await writeFile(OUT_META, `${JSON.stringify({ source, files: found }, null, 2)}\n`);
  await writeCredits(perArtist, source);
  console.log(`${found.length} portraits from ${source}; no art of their own (base portrait used): ${missing.join(', ') || 'none'}`);
}

async function writeCredits(perArtist, source) {
  const rows = [...perArtist.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .map(([name, { contact, looks }]) => `| ${name} | ${contact || '-'} | ${[...looks].join(', ')} |`);
  const section = [
    '## Portraits',
    '',
    'The face portraits (profile plate, account drawer) come from [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab)',
    `at commit \`${source}\`, under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (non-commercial use, with attribution).`,
    'Every author whose credits cover the Normal portrait is listed, current and former.',
    '',
    '_Generated by `node tools/fetch-portraits.mjs`; do not edit by hand._',
    '',
    '| Artist | Contact | Portraits |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n');
  const existing = await readFile(OUT_CREDITS, 'utf8');
  const parts = existing.split(/^(?=## )/m);
  const kept = parts.filter((part) => !part.startsWith('## Portraits'));
  // Right after the Sprites section.
  const at = kept.findIndex((part) => part.startsWith('## Sprites'));
  kept.splice(at + 1, 0, `${section}\n`);
  await writeFile(OUT_CREDITS, kept.map((p, i) => (i < kept.length - 1 ? p.replace(/\n*$/, '\n\n') : p.replace(/\n*$/, '\n'))).join(''));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
