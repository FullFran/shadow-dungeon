import { describe, expect, it } from 'vitest';
import { GUARDIAN_CINEMATICS } from '../../src/data/guardian-cinematics';
import { guardianLine, momentEmotion, NARRATED, parseSpeech, SPEAKERLESS_SOURCES, speakerSprite, spokenLine, type DialogueMoment } from '../../src/data/dialogue-speakers';
import { portraitFor, PORTRAIT_EMOTIONS } from '../../src/data/portraits';
import { PROLOGUE } from '../../src/data/prologue';
import { simaSceneKeys } from '../../src/data/sima-scenes';
import { SPECIES } from '../../src/data/species';
import { SPRITE_KEYS } from '../../src/data/sprites';
import { CHAPTERS, chapterOf, STORY_QUESTS, storyKeys, STORY_TRIGGERS, type StoryQuest } from '../../src/data/story-quests';
import en from '../../src/i18n/en.json';
import es from '../../src/i18n/es.json';
import { dialogueSources } from '../../src/town/dialogue-sources';

/** Issue #47 (odd/tasks/pmd-portraits.md S9): every speaker that appears in dialogue data has a portrait, or is listed as having none. */
const LANGS = { es: es as Record<string, string>, en: en as Record<string, string> };

/** Every Senda line a character can say, with the moment it is said in. */
function sendaLines(quest: StoryQuest): { key: string; moment: DialogueMoment }[] {
  const { line } = quest;
  const out: { key: string; moment: DialogueMoment }[] = [{ key: storyKeys.phantump(line), moment: 'line' }];
  for (const ch of CHAPTERS) {
    const c = chapterOf(quest, ch);
    out.push({ key: storyKeys.bond(line, ch), moment: 'bond' });
    c.before.forEach((_, i) => out.push({ key: storyKeys.before(line, ch, i), moment: 'line' }));
    c.after.forEach((_, i) => out.push({ key: storyKeys.after(line, ch, i), moment: 'line' }));
    for (const boss of c.bosses) {
      for (let i = 0; i < boss.pre; i++) out.push({ key: storyKeys.bossPre(line, ch, boss.floor, i), moment: 'bossPre' });
      for (let i = 0; i < boss.post; i++) out.push({ key: storyKeys.bossPost(line, ch, boss.floor, i), moment: 'bossPost' });
    }
  }
  return out;
}

const quests = Object.values(STORY_QUESTS) as StoryQuest[];

describe('who says a line', () => {
  it('a named quote is that character, an unnamed one the line itself, plain prose nobody (es and en)', () => {
    expect(parseSpeech('Drowzee: «Huelo en ti una pesadilla.»')).toEqual({ name: 'Drowzee', quote: 'Huelo en ti una pesadilla.', whole: true });
    expect(parseSpeech('Drowzee: "I smell a nightmare."')).toEqual({ name: 'Drowzee', quote: 'I smell a nightmare.', whole: true });
    expect(parseSpeech('La niebla se disipa. Abra: «Era mi favorito.»')).toEqual({ name: 'Abra', quote: 'Era mi favorito.', whole: false });
    expect(parseSpeech('«Bajo contigo.»')).toEqual({ name: null, quote: 'Bajo contigo.', whole: true });
    expect(parseSpeech('Al despertar finge que no ha dicho nada. "Did I scream?"')).toEqual({ name: null, quote: 'Did I scream?', whole: false });
    expect(parseSpeech('Un trapo amarillo, cosido a mano.')).toBeNull();
  });

  it('a name resolves to its species sheet, a longer lead-in by its first word, anything else to nobody', () => {
    expect(speakerSprite('Drowzee')).toBe(SPRITE_KEYS.drowzee);
    expect(speakerSprite('Mr. Mime')).toBe(SPRITE_KEYS.mrMime);
    expect(speakerSprite('Bisharp se aparta')).toBe(SPRITE_KEYS.bisharp);
    expect(speakerSprite('La última dice')).toBeNull();
  });

  it('a line with a speaker shows only the quote when it is all the line says, the whole line otherwise', () => {
    expect(spokenLine('Dusknoir: «Sube.»', 'bossPost')).toEqual({ speaker: { kind: 'species', sprite: SPRITE_KEYS.dusknoir }, emotion: 'Pain', text: 'Sube.' });
    expect(spokenLine('«Bajo contigo.»', 'line')).toEqual({ speaker: { kind: 'self' }, emotion: 'Normal', text: 'Bajo contigo.' });
    expect(spokenLine('La niebla se disipa. Abra: «Era mi favorito.»', 'bossPost')!.text).toBe('La niebla se disipa. Abra: «Era mi favorito.»');
    expect(spokenLine('Un trapo amarillo.', 'line')).toBeNull();
  });
});

describe('emotions (S6: the right one when the moment says it, Normal otherwise)', () => {
  it('follows the moment, and a boss feels the fight differently from the player', () => {
    expect(momentEmotion('lowHp', true)).toBe('Pain');
    expect(momentEmotion('mid', true)).toBe('Worried');
    expect(momentEmotion('arrive', true)).toBe('Normal');
    expect(momentEmotion('bond', true)).toBe('Happy');
    expect(momentEmotion('bossPre', false)).toBe('Determined');
    expect(momentEmotion('bossPre', true)).toBe('Worried');
    expect(momentEmotion('bossPost', false)).toBe('Pain');
    expect(momentEmotion('bossPost', true)).toBe('Normal');
    expect(momentEmotion('line', false)).toBe('Normal');
  });

  it('every emotion used is one of the 8 core ones', () => {
    const moments: DialogueMoment[] = ['line', 'arrive', 'mid', 'lowHp', 'bond', 'bossPre', 'bossPost'];
    for (const m of moments) for (const self of [true, false]) expect(PORTRAIT_EMOTIONS).toContain(momentEmotion(m, self));
  });
});

describe('every speaker has a portrait or is listed as having none (S9)', () => {
  it('town: every dialogue source with a speaker has a portrait; the rest are signs, statues and system lines', () => {
    for (const source of dialogueSources()) {
      if (source.portrait) expect(portraitFor(source.portrait), source.id).not.toBeNull();
      else expect(SPEAKERLESS_SOURCES.some((prefix) => source.id.startsWith(prefix)), source.id).toBe(true);
    }
  });

  it('Sendas: every line resolves to the same speaker in es and en, and each speaker has a portrait', () => {
    expect(quests.length).toBeGreaterThanOrEqual(8);
    let spoken = 0;
    for (const quest of quests) {
      for (const { key, moment } of sendaLines(quest)) {
        const [a, b] = (['es', 'en'] as const).map((lang) => spokenLine(LANGS[lang][key]!, moment));
        expect(b?.speaker ?? null, key).toEqual(a?.speaker ?? null);
        if (!a) continue;
        spoken++;
        const sprite = a.speaker.kind === 'self' ? SPRITE_KEYS[SPECIES[quest.line].sprite] : a.speaker.sprite;
        expect(portraitFor(sprite, a.emotion), `${key} (${sprite})`).not.toBeNull();
      }
      // The inner voice is the line's own Pokémon, in every chapter's form.
      for (const ch of CHAPTERS) for (const trigger of STORY_TRIGGERS) expect(LANGS.es[storyKeys.voice(quest.line, ch, trigger)], `${quest.line} ${ch} ${trigger}`).toBeTruthy();
    }
    expect(spoken).toBeGreaterThan(100);
  });

  it('every evolved form a Senda shows has a portrait (the speaker of its lines in that chapter)', () => {
    for (const quest of quests)
      for (const ch of CHAPTERS)
        for (const beat of [...chapterOf(quest, ch).before, ...chapterOf(quest, ch).after]) {
          const form = beat.figure?.form ?? quest.line;
          expect(portraitFor(SPRITE_KEYS[SPECIES[form].sprite]), `${quest.line} ${ch} ${form}`).not.toBeNull();
        }
  });

  it('guardians: each speaks its pre and post lines with a portrait, except those listed as having none', () => {
    for (const [species, cinematic] of Object.entries(GUARDIAN_CINEMATICS)) {
      for (const panel of [...cinematic!.pre, ...cinematic!.post]) {
        const said = guardianLine(species as keyof typeof SPECIES, panel.id);
        if (NARRATED.guardians.includes(species)) {
          expect(said, `${species} ${panel.id}`).toBeNull();
          continue;
        }
        if (panel.id === 'reveal') expect(said, `${species} name card`).toBeNull();
        else {
          expect(said, `${species} ${panel.id}`).not.toBeNull();
          expect(portraitFor(said!.sprite, said!.emotion), `${species} ${panel.id}`).not.toBeNull();
        }
      }
    }
  });

  it('the prologue and the Sima scenes are narration and the Voice: listed as having none, and no line names a speaker', () => {
    expect(NARRATED.cinematics).toEqual(['prologue', 'sima']);
    const keys = [...PROLOGUE.flatMap((p) => p.lines), ...simaSceneKeys()];
    expect(keys.length).toBeGreaterThan(10);
    for (const key of keys)
      for (const lang of ['es', 'en'] as const) {
        const text = LANGS[lang][key];
        if (!text) continue;
        const speech = parseSpeech(text);
        expect(speech?.name ? speakerSprite(speech.name) : null, `${lang} ${key}`).toBeNull();
      }
  });
});
