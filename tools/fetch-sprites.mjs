#!/usr/bin/env node
// Downloads the M0 sprites from PMDCollab SpriteCollab (CC BY-NC 4.0) into
// public/sprites/<dex>/<form>/, writes src/data/sprite-meta.json and
// regenerates the sprite section of CREDITS.md from each folder's credits.txt
// (the other sections, such as Font and Music, are kept as they are).
//
//   node tools/fetch-sprites.mjs
//
// SpriteCollab layout: sprite/<dex4>/ is the base form, sprite/<dex4>/<form4>/
// an alternate form. Sheets have one column per frame and one row per
// direction (see DIRECTIONS). Frame durations are in 1/60 s ticks.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DIRECTIONS,
  creditsMarkdown,
  decodePng,
  mergeCredits,
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
// (0681 subgroup 0001 is named "Blade"; the base folder is the Shield form;
// 0778 subgroup 0001 is Mimikyu's Busted form).
const TARGETS = [
  { dex: '0778', form: '0000', species: 'mimikyu', formName: 'disguised' },
  { dex: '0778', form: '0001', species: 'mimikyu', formName: 'busted' },
  { dex: '0570', form: '0000', species: 'zorua', formName: 'base' },
  { dex: '0607', form: '0000', species: 'litwick', formName: 'base' },
  { dex: '0104', form: '0000', species: 'cubone', formName: 'base' },
  { dex: '0261', form: '0000', species: 'poochyena', formName: 'base' },
  { dex: '0092', form: '0000', species: 'gastly', formName: 'base' },
  { dex: '0681', form: '0000', species: 'aegislash', formName: 'shield' },
  { dex: '0681', form: '0001', species: 'aegislash', formName: 'blade' },
  // Misty Forest (tracker.json, 2026-10-25: 0710 subgroup 0001 is "Small", 0003 is "Super").
  { dex: '0708', form: '0000', species: 'phantump', formName: 'base' },
  { dex: '0710', form: '0001', species: 'pumpkaboo-small', formName: 'small' },
  { dex: '0710', form: '0003', species: 'pumpkaboo-super', formName: 'super' },
  { dex: '0590', form: '0000', species: 'foongus', formName: 'base' },
  { dex: '0167', form: '0000', species: 'spinarak', formName: 'base' },
  { dex: '0163', form: '0000', species: 'hoothoot', formName: 'base' },
  { dex: '0709', form: '0000', species: 'trevenant', formName: 'base' },
  { dex: '0724', form: '0000', species: 'decidueye', formName: 'base' },
  // Experimental roster (docs/species-candidates.md §2 Flooded Caves and Toxic Swamp, plus three Fire
  // species; tracker.json 2026-10-25: all have Idle, Walk, Attack, Shoot, Charge and Hurt).
  { dex: '0041', form: '0000', species: 'zubat', formName: 'base' },
  { dex: '0072', form: '0000', species: 'tentacool', formName: 'base' },
  { dex: '0170', form: '0000', species: 'chinchou', formName: 'base' },
  { dex: '0341', form: '0000', species: 'corphish', formName: 'base' },
  { dex: '0692', form: '0000', species: 'clauncher', formName: 'base' },
  { dex: '0194', form: '0000', species: 'wooper', formName: 'base' },
  { dex: '0088', form: '0000', species: 'grimer', formName: 'base' },
  { dex: '0109', form: '0000', species: 'koffing', formName: 'base' },
  { dex: '0023', form: '0000', species: 'ekans', formName: 'base' },
  { dex: '0453', form: '0000', species: 'croagunk', formName: 'base' },
  { dex: '0434', form: '0000', species: 'stunky', formName: 'base' },
  { dex: '0228', form: '0000', species: 'houndour', formName: 'base' },
  { dex: '0218', form: '0000', species: 'slugma', formName: 'base' },
  { dex: '0667', form: '0000', species: 'litleo', formName: 'base' },
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
  SpAttack: [],
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

async function main() {
  const meta = { directions: DIRECTIONS, ticksPerSecond: 60, sprites: {} };
  for (const target of TARGETS) {
    meta.sprites[`${target.dex}/${target.form}`] = await downloadTarget(target);
  }
  await writeFile(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);

  const names = parseCreditNames(await fetchText(`${RAW}/credit_names.txt`));
  const perArtist = await collectCredits(TARGETS, names);
  // Keep the hand-written sections (Font, Music...) of the current file.
  const existing = await readFile(OUT_CREDITS, 'utf8').catch(() => null);
  await writeFile(OUT_CREDITS, mergeCredits(existing, creditsMarkdown(perArtist)));
  console.log(`meta -> src/data/sprite-meta.json, ${perArtist.size} artists -> CREDITS.md`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
