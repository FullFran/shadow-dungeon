#!/usr/bin/env node
// Downloads the M0 sprites from PMDCollab SpriteCollab (CC BY-NC 4.0) into
// public/sprites/<dex>/<form>/, writes src/data/sprite-meta.json and
// regenerates CREDITS.md from each folder's credits.txt.
//
//   node tools/fetch-sprites.mjs
//
// SpriteCollab layout: sprite/<dex4>/ is the base form, sprite/<dex4>/<form4>/
// an alternate form. Sheets have one column per frame and one row per
// direction (see DIRECTIONS). Frame durations are in 1/60 s ticks.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIRECTIONS,
  decodePng,
  parseAnimData,
  parseCreditNames,
  parseCredits,
  pickAnim,
  resolveAuthor,
  shadowAnchor,
} from './sprite-lib.mjs';

const RAW = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master';
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT_SPRITES = join(ROOT, 'public', 'sprites');
const OUT_META = join(ROOT, 'src', 'data', 'sprite-meta.json');
const OUT_CREDITS = join(ROOT, 'CREDITS.md');

// Form names verified against SpriteCollab's tracker.json
// (0681 subgroup 0001 is named "Blade"; the base folder is the Shield form).
const TARGETS = [
  { dex: '0778', form: '0000', species: 'mimikyu', formName: 'disguised' },
  { dex: '0261', form: '0000', species: 'poochyena', formName: 'base' },
  { dex: '0092', form: '0000', species: 'gastly', formName: 'base' },
  { dex: '0681', form: '0000', species: 'aegislash', formName: 'shield' },
  { dex: '0681', form: '0001', species: 'aegislash', formName: 'blade' },
];

// Animations the game uses, with fallbacks when a sheet does not exist.
const WANTED = {
  Idle: ['Walk'],
  Walk: ['Idle'],
  Attack: ['Strike', 'Swing', 'Idle'],
  Shoot: ['Attack', 'Idle'],
  Charge: ['DeepBreath', 'Idle'],
  Hurt: ['Cringe', 'Idle'],
  Faint: ['Hurt', 'Idle'],
  Strike: [],
  Swing: [],
  Double: [],
  Hop: [],
  Rotate: [],
};

async function fetchBuffer(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url, { headers: { 'User-Agent': 'mazmorra-sombria-tools' } });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    if (response.status === 404) return null;
    if (attempt === 3) throw new Error(`${url} -> HTTP ${response.status}`);
  }
  return null;
}

async function fetchText(url) {
  const buffer = await fetchBuffer(url);
  if (!buffer) throw new Error(`${url} -> not found`);
  return buffer.toString('utf8');
}

const folderUrl = (target) =>
  `${RAW}/sprite/${target.dex}${target.form === '0000' ? '' : `/${target.form}`}`;

async function downloadTarget(target) {
  const base = folderUrl(target);
  const outDir = join(OUT_SPRITES, target.dex, target.form);
  await mkdir(outDir, { recursive: true });

  const { shadowSize, anims } = parseAnimData(await fetchText(`${base}/AnimData.xml`));
  const downloaded = new Map(); // concrete anim name -> sheet info
  const meta = { species: target.species, form: target.formName, shadowSize, anims: {} };

  for (const [wanted, fallbacks] of Object.entries(WANTED)) {
    const picked = pickAnim(anims, wanted, fallbacks);
    if (!picked) {
      if (fallbacks.length) throw new Error(`${target.dex}/${target.form}: no sheet for ${wanted}`);
      continue;
    }
    if (!downloaded.has(picked.name)) {
      const sheet = await fetchBuffer(`${base}/${picked.name}-Anim.png`);
      if (!sheet) throw new Error(`${target.dex}/${target.form}: ${picked.name}-Anim.png missing`);
      await writeFile(join(outDir, `${picked.name}-Anim.png`), sheet);
      const image = decodePng(sheet);
      const shadow = await fetchBuffer(`${base}/${picked.name}-Shadow.png`);
      downloaded.set(picked.name, {
        sheetWidth: image.width,
        sheetHeight: image.height,
        anchor: shadow ? shadowAnchor(decodePng(shadow), picked.anim.frameWidth, picked.anim.frameHeight) : null,
      });
    }
    const sheet = downloaded.get(picked.name);
    const { frameWidth, frameHeight, durations, ...timing } = picked.anim;
    const frameCount = Math.round(sheet.sheetWidth / frameWidth);
    if (frameCount !== durations.length) {
      throw new Error(`${target.dex}/${target.form} ${picked.name}: ${frameCount} columns vs ${durations.length} durations`);
    }
    meta.anims[wanted] = {
      file: `${picked.name}-Anim.png`,
      source: picked.name,
      frameWidth,
      frameHeight,
      frameCount,
      rows: Math.round(sheet.sheetHeight / frameHeight),
      durations,
      ...timing,
      anchor: sheet.anchor,
    };
  }
  console.log(`${target.dex}/${target.form} ${target.species} (${target.formName}): ${downloaded.size} sheets`);
  return meta;
}

async function collectCredits(targets, names) {
  const perArtist = new Map(); // display name -> { contact, sprites: Set }
  for (const target of targets) {
    const text = (await fetchBuffer(`${folderUrl(target)}/credits.txt`))?.toString('utf8') ?? '';
    for (const credit of parseCredits(text)) {
      const { name, contact } = resolveAuthor(names, credit.author);
      const entry = perArtist.get(name) ?? { contact, sprites: new Set() };
      entry.sprites.add(`${target.species} (${target.dex}${target.form === '0000' ? '' : `/${target.form}`})`);
      perArtist.set(name, entry);
    }
  }
  return perArtist;
}

function creditsMarkdown(perArtist) {
  const rows = [...perArtist.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'en', { sensitivity: 'base' }))
    .map(([name, { contact, sprites }]) => `| ${name} | ${contact || '-'} | ${[...sprites].join(', ')} |`);
  return [
    '# Credits',
    '',
    'Mazmorra Sombría is a non-commercial fan project. Pokémon and its characters belong to',
    'Nintendo, Creatures Inc., GAME FREAK and The Pokémon Company.',
    '',
    '## Sprites',
    '',
    'Mystery Dungeon-style sprites come from [PMDCollab SpriteCollab](https://github.com/PMDCollab/SpriteCollab)',
    'under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) (non-commercial use, with attribution).',
    'Every author listed in each sprite folder\'s `credits.txt` is credited, current and former.',
    '',
    '_Generated by `node tools/fetch-sprites.mjs`; do not edit by hand._',
    '',
    '| Artist | Contact | Sprites |',
    '|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

async function main() {
  const meta = { directions: DIRECTIONS, ticksPerSecond: 60, sprites: {} };
  for (const target of TARGETS) {
    meta.sprites[`${target.dex}/${target.form}`] = await downloadTarget(target);
  }
  await writeFile(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);

  const names = parseCreditNames(await fetchText(`${RAW}/credit_names.txt`));
  const perArtist = await collectCredits(TARGETS, names);
  await writeFile(OUT_CREDITS, creditsMarkdown(perArtist));
  console.log(`meta -> src/data/sprite-meta.json, ${perArtist.size} artists -> CREDITS.md`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
