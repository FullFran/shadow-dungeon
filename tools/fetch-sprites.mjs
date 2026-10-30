#!/usr/bin/env node
// Downloads the M0 sprites from PMDCollab SpriteCollab (CC BY-NC 4.0) into
// public/sprites/<dex>/<form>/, writes src/data/sprite-meta.json and
// regenerates the sprite section of CREDITS.md from each folder's credits.txt
// (the other sections, such as Font and Music, are kept as they are).
//
//   node tools/fetch-sprites.mjs
//   node tools/fetch-sprites.mjs --only=shiny   (only the shiny sheets; the
//     rest of sprite-meta.json is kept, CREDITS.md is regenerated in full)
//   node tools/fetch-sprites.mjs --add=drowzee,hypno   (only those species'
//     sheets; the rest of sprite-meta.json is kept, CREDITS.md in full)
//   node tools/fetch-sprites.mjs --only=female   (only the female sheets; the
//     rest of sprite-meta.json is kept, CREDITS.md is regenerated in full)
//
// SpriteCollab layout: sprite/<dex4>/ is the base form, sprite/<dex4>/<form4>/
// an alternate form and sprite/<dex4>/<form4>/0001/ its shiny (local folder
// public/sprites/<dex4>/<form4>/0001/, meta key "<dex4>/<form4>/0001"). A female sheet lives in
// sprite/<dex4>/<form4>/0000/0002/, its shiny in sprite/<dex4>/<form4>/0001/0002/ (the same paths locally
// and in the meta key). Sheets have one column per frame and one row per
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
  // Crypt of the Sword King remaster (docs/species-candidates.md §2).
  { dex: '0355', form: '0000', species: 'duskull', formName: 'base' },
  { dex: '0622', form: '0000', species: 'golett', formName: 'base' },
  { dex: '0624', form: '0000', species: 'pawniard', formName: 'base' },
  { dex: '0302', form: '0000', species: 'sableye', formName: 'base' },
  // Misty Forest remaster (tracker.json 2026-10-25: all three have Idle, Walk, Attack, Shoot, Charge and Hurt, phase 1).
  { dex: '0859', form: '0000', species: 'impidimp', formName: 'base' },
  { dex: '0285', form: '0000', species: 'shroomish', formName: 'base' },
  { dex: '0425', form: '0000', species: 'drifloon', formName: 'base' },
  // Flooded Caves (tracker.json 2026-10-25: Krabby, Shellos West, Remoraid, Dhelmise phase 1 and
  // Lanturn phase 2, all with Idle, Walk, Attack, Shoot, Charge and Hurt).
  { dex: '0098', form: '0000', species: 'krabby', formName: 'base' },
  { dex: '0422', form: '0000', species: 'shellos', formName: 'west' },
  { dex: '0223', form: '0000', species: 'remoraid', formName: 'base' },
  { dex: '0171', form: '0000', species: 'lanturn', formName: 'base' },
  { dex: '0781', form: '0000', species: 'dhelmise', formName: 'base' },
  // Toxic Swamp (docs/species-candidates.md §2 Dungeon 4; tracker.json 2026-10-25: all have Idle, Walk, Attack, Shoot, Charge and Hurt).
  { dex: '0543', form: '0000', species: 'venipede', formName: 'base' },
  { dex: '0757', form: '0000', species: 'salandit', formName: 'base' },
  { dex: '0690', form: '0000', species: 'skrelp', formName: 'base' },
  { dex: '0758', form: '0000', species: 'salazzle', formName: 'base' },
  { dex: '0793', form: '0000', species: 'nihilego', formName: 'base' },
  // Evolved forms of the regulars (AnimData.xml 2026-10-26: all have native Idle, Walk, Attack, Shoot, Charge and Hurt;
  // Golurk and Grimmsnarl left out, their Shoot is a copy of another sheet).
  { dex: '0262', form: '0000', species: 'mightyena', formName: 'base' },
  { dex: '0093', form: '0000', species: 'haunter', formName: 'base' },
  { dex: '0094', form: '0000', species: 'gengar', formName: 'base' },
  { dex: '0356', form: '0000', species: 'dusclops', formName: 'base' },
  { dex: '0625', form: '0000', species: 'bisharp', formName: 'base' },
  { dex: '0286', form: '0000', species: 'breloom', formName: 'base' },
  { dex: '0426', form: '0000', species: 'drifblim', formName: 'base' },
  { dex: '0860', form: '0000', species: 'morgrem', formName: 'base' },
  { dex: '0164', form: '0000', species: 'noctowl', formName: 'base' },
  { dex: '0168', form: '0000', species: 'ariados', formName: 'base' },
  { dex: '0042', form: '0000', species: 'golbat', formName: 'base' },
  { dex: '0099', form: '0000', species: 'kingler', formName: 'base' },
  { dex: '0224', form: '0000', species: 'octillery', formName: 'base' },
  { dex: '0342', form: '0000', species: 'crawdaunt', formName: 'base' },
  { dex: '0024', form: '0000', species: 'arbok', formName: 'base' },
  { dex: '0435', form: '0000', species: 'skuntank', formName: 'base' },
  { dex: '0110', form: '0000', species: 'weezing', formName: 'base' },
  { dex: '0089', form: '0000', species: 'muk', formName: 'base' },
  { dex: '0454', form: '0000', species: 'toxicroak', formName: 'base' },
  { dex: '0229', form: '0000', species: 'houndoom', formName: 'base' },
  // The starters' Sendas' new bosses (docs/story-quests.md; AnimData.xml 2026-10-26: native Idle, Walk, Attack, Shoot,
  // Charge and Hurt; Alolan Marowak left out, its Shoot is a copy of Strike).
  { dex: '0630', form: '0000', species: 'mandibuzz', formName: 'base' },
  { dex: '0115', form: '0000', species: 'kangaskhan', formName: 'base' },
  { dex: '0477', form: '0000', species: 'dusknoir', formName: 'base' },
  { dex: '0354', form: '0000', species: 'banette', formName: 'base' },
  { dex: '0429', form: '0000', species: 'mismagius', formName: 'base' },
  { dex: '0352', form: '0000', species: 'kecleon', formName: 'base' },
  { dex: '0442', form: '0000', species: 'spiritomb', formName: 'base' },
  // Mimikyu's Senda's shadows (docs/story-quests.md; AnimData 2026-10-26: native Idle, Walk, Attack, Charge and Hurt;
  // Ditto's Shoot is a copy of its Charge, which is how it copies).
  { dex: '0132', form: '0000', species: 'ditto', formName: 'base' },
  { dex: '0855', form: '0000', species: 'polteageist', formName: 'base' },
  { dex: '0039', form: '0000', species: 'jigglypuff', formName: 'base' },
  { dex: '0025', form: '0000', species: 'pikachu', formName: 'base' },
  { dex: '0858', form: '0000', species: 'hatterene', formName: 'base' },
  // The Refugio's move tutor (tracker.json 2026-10-26: full sheet set, CHUNSOFT + PMDCollab).
  { dex: '0235', form: '0000', species: 'smeargle', formName: 'base' },
  // Gacha evolution lines (odd/tasks/gacha-evolutions.md T3).
  { dex: '0063', form: '0000', species: 'abra', formName: 'base' },
  { dex: '0064', form: '0000', species: 'kadabra', formName: 'base' },
  { dex: '0065', form: '0000', species: 'alakazam', formName: 'base' },
  { dex: '0393', form: '0000', species: 'piplup', formName: 'base' },
  { dex: '0394', form: '0000', species: 'prinplup', formName: 'base' },
  { dex: '0395', form: '0000', species: 'empoleon', formName: 'base' },
  { dex: '0403', form: '0000', species: 'shinx', formName: 'base' },
  { dex: '0404', form: '0000', species: 'luxio', formName: 'base' },
  { dex: '0405', form: '0000', species: 'luxray', formName: 'base' },
  { dex: '0610', form: '0000', species: 'axew', formName: 'base' },
  { dex: '0611', form: '0000', species: 'fraxure', formName: 'base' },
  { dex: '0612', form: '0000', species: 'haxorus', formName: 'base' },
  // The starters' evolved forms (odd/tasks/roster-parity.md; AnimData 2026-10-26: Idle, Walk, Attack, Shoot, Charge and Hurt are their own sheets).
  { dex: '0571', form: '0000', species: 'zoroark', formName: 'base' },
  { dex: '0608', form: '0000', species: 'lampent', formName: 'base' },
  { dex: '0609', form: '0000', species: 'chandelure', formName: 'base' },
  { dex: '0105', form: '0000', species: 'marowak', formName: 'base' },
  // The gacha lines' Senda bosses (docs/story-quests.md; AnimData 2026-10-26: Idle, Walk, Attack, Shoot, Charge and Hurt
  // are their own sheets, no CopyOf; Bisharp's lord wears the regular Bisharp's sheets).
  { dex: '0517', form: '0000', species: 'munna', formName: 'base' },
  { dex: '0096', form: '0000', species: 'drowzee', formName: 'base' },
  { dex: '0122', form: '0000', species: 'mr-mime', formName: 'base' },
  { dex: '0097', form: '0000', species: 'hypno', formName: 'base' },
  { dex: '0518', form: '0000', species: 'musharna', formName: 'base' },
  { dex: '0362', form: '0000', species: 'glalie', formName: 'base' },
  { dex: '0461', form: '0000', species: 'weavile', formName: 'base' },
  { dex: '0473', form: '0000', species: 'mamoswine', formName: 'base' },
  { dex: '0478', form: '0000', species: 'froslass', formName: 'base' },
  { dex: '0131', form: '0000', species: 'lapras', formName: 'base' },
  { dex: '0181', form: '0000', species: 'ampharos', formName: 'base' },
  { dex: '0310', form: '0000', species: 'manectric', formName: 'base' },
  { dex: '0359', form: '0000', species: 'absol', formName: 'base' },
  { dex: '0466', form: '0000', species: 'electivire', formName: 'base' },
  { dex: '0197', form: '0000', species: 'umbreon', formName: 'base' },
  { dex: '0621', form: '0000', species: 'druddigon', formName: 'base' },
  { dex: '0445', form: '0000', species: 'garchomp', formName: 'base' },
  { dex: '0373', form: '0000', species: 'salamence', formName: 'base' },
  { dex: '0149', form: '0000', species: 'dragonite', formName: 'base' },
];

// Every playable sprite also has a shiny (odd/tasks/shiny-echo.md; AnimData 2026-10-26: all 21 have
// Idle, Walk, Attack, Shoot, Charge and Hurt). Busted Mimikyu is a playable sheet too.
const PLAYABLE = new Set(['mimikyu', 'zorua', 'litwick', 'cubone', 'abra', 'kadabra', 'alakazam', 'piplup', 'prinplup', 'empoleon', 'shinx', 'luxio', 'luxray', 'axew', 'fraxure', 'haxorus', 'zoroark', 'lampent', 'chandelure', 'marowak']);
const SHINY_TARGETS = TARGETS.filter((t) => PLAYABLE.has(t.species)).map((t) => ({ ...t, shiny: '0001', formName: `${t.formName}-shiny` }));

// The species with female art (odd/tasks/pokemon-gender.md; verified in SpriteCollab 2026-10-30, normal and shiny;
// Alakazam's folder 404s). Keep it in step with FEMALE_ART in src/core/gender.ts (tests/data/female-sprites.test.ts).
const FEMALE_ART = new Set(['shinx', 'luxio', 'luxray']);
const FEMALE_TARGETS = TARGETS.filter((t) => FEMALE_ART.has(t.species)).flatMap((t) => [
  { ...t, female: '0002', formName: `${t.formName}-female` },
  { ...t, shiny: '0001', female: '0002', formName: `${t.formName}-female-shiny` },
]);
const ALL_TARGETS = [...TARGETS, ...SHINY_TARGETS, ...FEMALE_TARGETS];

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

/** The target's folder under sprite/ (and under public/sprites/, with the base form's "0000"). */
const femalePath = (target) => `${target.dex}/${target.form}/${target.shiny ?? '0000'}/${target.female}`;
const remotePath = (target) => (target.female ? femalePath(target) : `${target.dex}${target.form === '0000' && !target.shiny ? '' : `/${target.form}`}${target.shiny ? `/${target.shiny}` : ''}`);
const localKey = (target) => (target.female ? femalePath(target) : `${target.dex}/${target.form}${target.shiny ? `/${target.shiny}` : ''}`);
const folderUrl = (target) => `${RAW}/sprite/${remotePath(target)}`;

async function downloadTarget(target) {
  const base = folderUrl(target);
  const outDir = join(OUT_SPRITES, ...localKey(target).split('/'));
  await mkdir(outDir, { recursive: true });

  const { shadowSize, anims } = parseAnimData(await fetchText(`${base}/AnimData.xml`));
  const downloaded = new Map(); // concrete anim name -> sheet info
  const meta = { species: target.species, form: target.formName, shadowSize, anims: {} };

  for (const [wanted, fallbacks] of Object.entries(WANTED)) {
    const picked = pickAnim(anims, wanted, fallbacks);
    if (!picked) {
      if (fallbacks.length) throw new Error(`${localKey(target)}: no sheet for ${wanted}`);
      continue;
    }
    if (!downloaded.has(picked.name)) {
      const sheet = await fetchBuffer(`${base}/${picked.name}-Anim.png`);
      if (!sheet) throw new Error(`${localKey(target)}: ${picked.name}-Anim.png missing`);
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
      throw new Error(`${localKey(target)} ${picked.name}: ${frameCount} columns vs ${durations.length} durations`);
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
  console.log(`${localKey(target)} ${target.species} (${target.formName}): ${downloaded.size} sheets`);
  return meta;
}

async function collectCredits(targets, names) {
  const perArtist = new Map(); // display name -> { contact, sprites: Set }
  for (const target of targets) {
    const text = (await fetchBuffer(`${folderUrl(target)}/credits.txt`))?.toString('utf8') ?? '';
    for (const credit of parseCredits(text)) {
      const { name, contact } = resolveAuthor(names, credit.author);
      const entry = perArtist.get(name) ?? { contact, sprites: new Set() };
      entry.sprites.add(`${target.species}${target.female ? ' female' : ''}${target.shiny ? ' shiny' : ''} (${remotePath(target)})`);
      perArtist.set(name, entry);
    }
  }
  return perArtist;
}

async function main() {
  const onlyShiny = process.argv.includes('--only=shiny');
  const onlyFemale = process.argv.includes('--only=female');
  const added = new Set((process.argv.find((a) => a.startsWith('--add='))?.slice('--add='.length) ?? '').split(',').filter(Boolean));
  const partial = onlyShiny || onlyFemale || added.size > 0;
  const kept = partial ? JSON.parse(await readFile(OUT_META, 'utf8')).sprites : {};
  const meta = { directions: DIRECTIONS, ticksPerSecond: 60, sprites: {} };
  for (const target of ALL_TARGETS) {
    const key = localKey(target);
    const fresh = added.size > 0 ? added.has(target.species) : onlyFemale ? target.female : target.shiny && !target.female;
    meta.sprites[key] = partial && !fresh && kept[key] ? kept[key] : await downloadTarget(target);
  }
  await writeFile(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);

  const names = parseCreditNames(await fetchText(`${RAW}/credit_names.txt`));
  const perArtist = await collectCredits(ALL_TARGETS, names);
  // Keep the hand-written sections (Font, Music...) of the current file.
  const existing = await readFile(OUT_CREDITS, 'utf8').catch(() => null);
  await writeFile(OUT_CREDITS, mergeCredits(existing, creditsMarkdown(perArtist)));
  console.log(`meta -> src/data/sprite-meta.json, ${perArtist.size} artists -> CREDITS.md`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
