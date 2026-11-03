import { describe, expect, it } from 'vitest';
import { REPORT_CATEGORIES } from '../../src/adapters/report-api';
import { composeReport, fieldAnswer, missingRequired, optionKey, REPORT_FORMS, REPORT_TYPES, validateReport, type FieldSpec } from '../../src/app/report-forms';
import { REPORT_LIMITS } from '../../src/app/report-screen';
import { catalog, LANGUAGES } from '../../src/i18n';

const label = (key: string) => key;
const ids = (type: (typeof REPORT_TYPES)[number]) => REPORT_FORMS[type].fields.map((f) => f.id);

describe('report forms', () => {
  it('has a distinct form per type, each with at least one required text field', () => {
    const shapes = new Set(REPORT_TYPES.map((t) => ids(t).join(',')));
    expect(shapes.size).toBe(REPORT_TYPES.length);
    for (const type of REPORT_TYPES) {
      const fields = REPORT_FORMS[type].fields;
      expect(fields.length, type).toBeGreaterThan(0);
      expect(fields.length, type).toBeLessThanOrEqual(6);
      expect(fields.some((f) => f.required && f.kind === 'text'), type).toBe(true);
    }
  });

  it('the agreed per-type fields (owner brief)', () => {
    expect(ids('bug')).toEqual(expect.arrayContaining(['what', 'steps', 'expected', 'seen', 'where', 'often']));
    expect(ids('online')).toEqual(expect.arrayContaining(['role', 'players', 'what']));
    expect(ids('balance')).toEqual(expect.arrayContaining(['where', 'direction', 'details']));
    expect(ids('suggestion')).toEqual(['idea', 'why']);
    expect(ids('text')).toEqual(expect.arrayContaining(['where', 'current', 'proposal']));
    expect(ids('other')).toEqual(['what']);
  });

  it('every type maps to a category the server accepts', () => {
    for (const type of REPORT_TYPES) expect(REPORT_CATEGORIES).toContain(REPORT_FORMS[type].category);
    expect(REPORT_FORMS.online.category).toBe('online');
    expect(REPORT_FORMS.suggestion.category).toBe('suggestion');
  });

  it('every type has an icon id, and every select lists at least two options', () => {
    for (const type of REPORT_TYPES) {
      expect(REPORT_FORMS[type].icon).toBeTruthy();
      for (const f of REPORT_FORMS[type].fields) if (f.kind === 'select') expect(f.options!.length, `${type}.${f.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('the dungeon list covers every dungeon of the game', () => {
    const where = REPORT_FORMS.bug.fields.find((f) => f.id === 'where')!;
    for (const id of ['crypt', 'forest', 'caves', 'swamp', 'eclipse']) expect(where.options).toContain(id);
  });
});

describe('required fields', () => {
  it('lists the empty required fields, trimming blanks', () => {
    expect(missingRequired('bug', {})).toEqual(['what']);
    expect(missingRequired('bug', { 'bug.what': '   ' })).toEqual(['what']);
    expect(missingRequired('bug', { 'bug.what': 'It froze' })).toEqual([]);
    expect(missingRequired('text', { 'text.proposal': 'x' })).toEqual(['current']);
  });

  it('reads an answer by type and field', () => {
    expect(fieldAnswer({ 'bug.what': 'a', 'online.what': 'b' }, 'online', 'what')).toBe('b');
    expect(fieldAnswer({}, 'bug', 'what')).toBe('');
  });
});

describe('composing the payload', () => {
  it('puts the selects as labelled lines and the lone text raw into the description', () => {
    const out = composeReport('bug', { 'bug.what': 'The boss froze', 'bug.where': 'crypt', 'bug.often': 'always', 'bug.steps': '1. Enter', 'bug.expected': 'It attacks', 'bug.seen': 'Nothing' }, label);
    expect(out.category).toBe('bug');
    expect(out.description).toBe([`report.field.bug.where: ${optionKey('where', 'crypt')}`, `report.field.bug.often: ${optionKey('often', 'always')}`, 'The boss froze'].join('\n'));
    expect(out.steps).toBe('1. Enter');
    expect(out.expected).toBe('It attacks');
    expect(out.observed).toBe('Nothing');
  });

  it('skips unanswered selects and empty texts', () => {
    const out = composeReport('bug', { 'bug.what': 'x' }, label);
    expect(out).toMatchObject({ description: 'x', steps: '', expected: '', observed: '' });
  });

  it('online keeps the role and the players in the description', () => {
    const out = composeReport('online', { 'online.what': 'Lost the room', 'online.role': 'guest', 'online.players': '3' }, label);
    expect(out.category).toBe('online');
    expect(out.description).toContain(optionKey('role', 'guest'));
    expect(out.description).toContain(optionKey('players', '3'));
    expect(out.description.endsWith('Lost the room')).toBe(true);
  });

  it('types without a server category are tagged with their name and sent as "other"', () => {
    const out = composeReport('balance', { 'balance.details': 'Too many bats', 'balance.direction': 'tooHard' }, label);
    expect(out.category).toBe('other');
    expect(out.description.split('\n')[0]).toBe('[report.type.balance]');
    const text = composeReport('text', { 'text.current': 'Helo', 'text.proposal': 'Hello', 'text.where': 'Shop' }, label);
    expect(text.category).toBe('other');
    expect(text.description.split('\n')[0]).toBe('[report.type.text]');
    expect(text.expected).toBe('Hello');
    expect(text.observed).toBe('Helo');
  });

  it('a suggestion sends the idea as the description and the reason as expected', () => {
    const out = composeReport('suggestion', { 'suggestion.idea': 'More shrines', 'suggestion.why': 'Variety' }, label);
    expect(out).toMatchObject({ category: 'suggestion', description: 'More shrines', expected: 'Variety' });
  });

  it('ignores answers of other types', () => {
    const out = composeReport('other', { 'other.what': 'hi', 'bug.steps': 'leak' }, label);
    expect(out).toMatchObject({ description: 'hi', steps: '' });
  });

  for (const language of LANGUAGES) {
    it(`the longest possible answers still fit the server limits (${language})`, () => {
      const tr = catalog(language);
      const lab = (key: string) => tr[key] ?? key;
      for (const type of REPORT_TYPES) {
        const answers: Record<string, string> = {};
        for (const f of REPORT_FORMS[type].fields as FieldSpec[]) {
          if (f.kind === 'text') answers[`${type}.${f.id}`] = 'x'.repeat(f.max);
          else answers[`${type}.${f.id}`] = [...f.options!].sort((a, b) => lab(optionKey(f.set!, b)).length - lab(optionKey(f.set!, a)).length)[0]!;
        }
        const out = composeReport(type, answers, lab);
        expect(out.description.length, `${type} description`).toBeLessThanOrEqual(REPORT_LIMITS.description);
        expect(out.steps.length, `${type} steps`).toBeLessThanOrEqual(REPORT_LIMITS.steps);
        expect(out.expected.length, `${type} expected`).toBeLessThanOrEqual(REPORT_LIMITS.expected);
        expect(out.observed.length, `${type} observed`).toBeLessThanOrEqual(REPORT_LIMITS.observed);
        expect(validateReport(type, answers, lab)).toEqual({ ok: true });
      }
    });
  }

  it('validateReport names the first missing required field, then a too-long target', () => {
    expect(validateReport('bug', {}, label)).toEqual({ ok: false, field: 'what', reason: 'required' });
    expect(validateReport('bug', { 'bug.what': 'x', 'bug.steps': 'y'.repeat(REPORT_LIMITS.steps + 1) }, label)).toEqual({ ok: false, field: 'steps', reason: 'too-long' });
  });
});

describe('form text', () => {
  for (const language of LANGUAGES) {
    it(`"${language}" has every label, hint, option and type string`, () => {
      const tr = catalog(language);
      for (const type of REPORT_TYPES) {
        expect(tr[`report.type.${type}`], `type ${type}`).toBeTruthy();
        expect(tr[`report.type.${type}.about`], `about ${type}`).toBeTruthy();
        for (const f of REPORT_FORMS[type].fields) {
          expect(tr[`report.field.${type}.${f.id}`], `${type}.${f.id}`).toBeTruthy();
          if (f.kind === 'text') expect(tr[`report.field.${type}.${f.id}.hint`], `${type}.${f.id} hint`).toBeTruthy();
          for (const o of f.options ?? []) expect(tr[optionKey(f.set!, o)], optionKey(f.set!, o)).toBeTruthy();
        }
      }
      for (const key of ['report.required', 'report.error.required', 'report.type.label', 'report.back', 'report.answer.none', 'report.attachTech.about.short']) expect(tr[key], key).toBeTruthy();
    });
  }
});
