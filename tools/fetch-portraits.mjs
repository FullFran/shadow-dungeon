#!/usr/bin/env node
// Downloads the Mystery Dungeon portraits (odd/tasks/pmd-portraits.md) from PMDCollab SpriteCollab (CC BY-NC 4.0, the
// source of the sprites) into src/assets/portraits/<sprite key>/<Emotion>.png, mirroring public/sprites: every playable
// look (base, shiny and female) and every species that speaks in a dialogue (SPEAKERS), each with the 8 core emotions
// it has upstream. Writes src/data/portrait-meta.json (the pinned source commit and, per key, the emotions that exist)
// and the "## Portraits" section of CREDITS.md. A look or emotion without art of its own is simply left out: the game
// falls back to Normal and to the base portrait of the form (src/data/portraits.ts), and the manifest-driven tests say so.
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

// Every other species that speaks (sprite-meta species names): town residents and services, the Sima plea, the tour,
// the guardians and the Senda characters. tests/data/dialogue-speakers.test.ts fails when a speaker has no portrait.
const SPEAKERS = new Set([
  'gastly', 'phantump', 'poochyena', 'croagunk', 'foongus', 'hoothoot', 'shroomish', 'skrelp', 'smeargle', 'spinarak', 'venipede',
  'aegislash', 'decidueye', 'dhelmise', 'nihilego',
  'drowzee', 'hypno', 'musharna', 'munna', 'mr-mime', 'weavile', 'froslass', 'manectric', 'absol', 'bisharp', 'salamence', 'dragonite',
  'kangaskhan', 'dusknoir', 'banette', 'mismagius', 'houndoom', 'haunter', 'drifblim', 'kecleon', 'mightyena',
]);
// Keys that are not sprite keys but hold a speaker's art: Pumpkaboo's sizes have no portraits, its base form does.
const EXTRA = { '0710/0000': 'pumpkaboo' };

const EMOTIONS = ['Normal', 'Happy', 'Sad', 'Angry', 'Surprised', 'Worried', 'Determined', 'Pain'];

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
  const isPlayable = (meta) => PLAYABLE.has(meta.species.replace(/-.*/, '')) && !(meta.species === 'mimikyu' && meta.form === 'busted');
  // A speaker's base look (no shiny, no female); a playable species gets every look.
  const isSpeakerBase = (key, meta) => SPEAKERS.has(meta.species) && key.split('/').length === 2;
  const species = { ...Object.fromEntries(Object.entries(sprites).map(([key, meta]) => [key, meta.species])), ...EXTRA };
  const keys = [
    ...Object.entries(sprites)
      .filter(([key, meta]) => isPlayable(meta) || isSpeakerBase(key, meta))
      .map(([key]) => key),
    ...Object.keys(EXTRA),
  ].sort();

  const names = parseCreditNames((await fetchBuffer(`${base}/credit_names.txt`))?.toString('utf8') ?? '');
  const found = {};
  const missing = [];
  const perArtist = new Map(); // display name -> { contact, looks: Set }
  for (const key of keys) {
    const pngs = await Promise.all(EMOTIONS.map((emotion) => fetchBuffer(`${base}/portrait/${remote(key)}/${emotion}.png`)));
    const have = EMOTIONS.filter((_, i) => pngs[i]);
    if (have.length === 0) {
      missing.push(key);
      continue;
    }
    await mkdir(join(OUT, ...key.split('/')), { recursive: true });
    for (const [i, emotion] of EMOTIONS.entries()) if (pngs[i]) await writeFile(join(OUT, ...key.split('/'), `${emotion}.png`), pngs[i]);
    found[key] = have;
    const credits = (await fetchBuffer(`${base}/portrait/${remote(key)}/credits.txt`))?.toString('utf8') ?? '';
    for (const credit of parseCredits(credits)) {
      // Only the lines that cover an emotion drawn here.
      if (!credit.anims.some((anim) => have.includes(anim))) continue;
      const { name, contact } = resolveAuthor(names, credit.author);
      const entry = perArtist.get(name) ?? { contact, looks: new Set() };
      const [, , shiny, female] = key.split('/');
      entry.looks.add(`${species[key]}${female ? ' female' : ''}${shiny === '0001' ? ' shiny' : ''} (${remote(key)})`);
      perArtist.set(name, entry);
    }
    console.log(`${key} -> ${remote(key)}: ${have.join(' ')}`);
  }
  await writeFile(OUT_META, `${JSON.stringify({ source, files: found }, null, 2)}\n`);
  await writeCredits(perArtist, source);
  console.log(`${Object.keys(found).length} portraits from ${source}; no art of their own (base portrait used): ${missing.join(', ') || 'none'}`);
}

async function writeCredits(perArtist, source) {
  const rows = [...perArtist.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .map(([name, { contact, looks }]) => `| ${name} | ${contact || '-'} | ${[...looks].join(', ')} |`);
  const section = [
    '## Portraits',
    '',
    'The portraits (dialogue boxes, cinematics, profile plate, account drawer) come from [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab)',
    `at commit \`${source}\`, under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (non-commercial use, with attribution).`,
    'Every author whose credits cover an emotion shipped here is listed, current and former.',
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
