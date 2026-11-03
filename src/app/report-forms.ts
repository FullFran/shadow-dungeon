import type { ReportCategory } from '../adapters/report-api';

/**
 * The report types and the form of each (issue #9 follow-up): every type asks
 * what its kind of problem needs, with dropdowns where the answer is one of a
 * few choices. The server keeps its original fields (category, description,
 * steps, expected, observed: server/internal/reports), so `composeReport`
 * folds a form into them with labelled lines; nothing about the contract
 * changed. Types the server has no category for (balance, texts) go as
 * "other" with their name on the first line, so triage still sees them.
 */

/** Field limits, as the server checks them (server/internal/reports). */
export const REPORT_LIMITS = { description: 2000, steps: 2000, expected: 1000, observed: 1000, version: 40, device: 200 } as const;

export type ReportTarget = 'description' | 'steps' | 'expected' | 'observed';

export const REPORT_TYPES = ['bug', 'online', 'performance', 'interface', 'progress', 'balance', 'text', 'suggestion', 'other'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export interface FieldSpec {
  id: string;
  kind: 'text' | 'select';
  required?: boolean;
  /** Where the answer lands in the server's fields. */
  target: ReportTarget;
  /** Text: the character limit. Select: unused. */
  max: number;
  /** Textarea height in rows (text). */
  rows?: number;
  /** The description's main text goes last, unlabelled. */
  main?: boolean;
  /** Text: half the form's width, beside the next half field. */
  half?: boolean;
  /** Select: the option ids and the family their labels come from. */
  options?: readonly string[];
  set?: string;
}

export interface ReportForm {
  /** The server's category this type is filed under. */
  category: ReportCategory;
  /** Key into the type icons (src/ui/icons/report-icons.ts). */
  icon: ReportType;
  /** True when the server has no category of this name: the description starts with `[Type]`. */
  tagged?: boolean;
  fields: readonly FieldSpec[];
}

const DUNGEONS = ['crypt', 'forest', 'caves', 'swamp', 'eclipse'] as const;
const text = (id: string, target: ReportTarget, max: number, extra: Partial<FieldSpec> = {}): FieldSpec => ({ id, kind: 'text', target, max, rows: 3, ...extra });
const select = (id: string, set: string, options: readonly string[], target: ReportTarget = 'description'): FieldSpec => ({ id, kind: 'select', target, max: 0, set, options });
const WHERE = [...DUNGEONS, 'town', 'menu'] as const;
const OFTEN = ['once', 'sometimes', 'always'] as const;

export const REPORT_FORMS: Record<ReportType, ReportForm> = {
  bug: {
    category: 'bug',
    icon: 'bug',
    fields: [
      text('what', 'description', 1200, { required: true, main: true }),
      select('where', 'where', WHERE),
      select('often', 'often', OFTEN),
      text('steps', 'steps', 1000, { rows: 2 }),
      text('expected', 'expected', 900, { rows: 2, half: true }),
      text('seen', 'observed', 900, { rows: 2, half: true }),
    ],
  },
  online: {
    category: 'online',
    icon: 'online',
    fields: [
      select('role', 'role', ['host', 'guest']),
      select('players', 'players', ['2', '3', '4']),
      select('stage', 'stage', ['connecting', 'lobby', 'town', 'run']),
      text('what', 'description', 1200, { required: true, main: true }),
      text('expected', 'expected', 900, { rows: 2 }),
    ],
  },
  performance: {
    category: 'performance',
    icon: 'performance',
    fields: [select('where', 'where', WHERE), select('often', 'often', OFTEN), text('what', 'description', 1200, { required: true, main: true })],
  },
  interface: {
    category: 'interface',
    icon: 'interface',
    fields: [select('area', 'area', ['menu', 'town', 'run', 'touch', 'settings']), text('what', 'description', 1200, { required: true, main: true }), text('proposal', 'expected', 900, { rows: 2 })],
  },
  progress: {
    category: 'progress',
    icon: 'progress',
    fields: [select('kind', 'kind', ['save', 'coins', 'unlocks', 'achievements']), text('what', 'description', 1200, { required: true, main: true }), text('steps', 'steps', 1000, { rows: 2 })],
  },
  balance: {
    category: 'other',
    icon: 'balance',
    tagged: true,
    fields: [select('where', 'dungeon', DUNGEONS), select('direction', 'direction', ['tooHard', 'tooEasy', 'unfair', 'repetitive']), text('details', 'description', 1200, { required: true, main: true })],
  },
  text: {
    category: 'other',
    icon: 'text',
    tagged: true,
    fields: [text('where', 'description', 160, { rows: 1 }), text('current', 'observed', 900, { required: true, rows: 2 }), text('proposal', 'expected', 900, { rows: 2 })],
  },
  suggestion: {
    category: 'suggestion',
    icon: 'suggestion',
    fields: [text('idea', 'description', 1200, { required: true, main: true }), text('why', 'expected', 900, { rows: 3 })],
  },
  other: {
    category: 'other',
    icon: 'other',
    fields: [text('what', 'description', 1200, { required: true, main: true, rows: 5 })],
  },
};

export const emptyAnswers = (): Record<string, string> => ({});

/** i18n key of a select option: the dungeons reuse the game's own names. */
export function optionKey(set: string, value: string): string {
  if ((set === 'where' || set === 'dungeon') && (DUNGEONS as readonly string[]).includes(value)) return `dungeon.${value}.name`;
  return `report.opt.${set}.${value}`;
}

/** The answers are keyed `type.field`, so switching type keeps what was typed in each. */
export const fieldAnswer = (answers: Readonly<Record<string, string>>, type: ReportType, field: string): string => answers[`${type}.${field}`] ?? '';

/** Ids of the required fields still empty, in form order. */
export function missingRequired(type: ReportType, answers: Readonly<Record<string, string>>): string[] {
  return REPORT_FORMS[type].fields.filter((f) => f.required && !fieldAnswer(answers, type, f.id).trim()).map((f) => f.id);
}

export interface ComposedReport {
  category: ReportCategory;
  description: string;
  steps: string;
  expected: string;
  observed: string;
}

/** The form as the server's fields. `label` translates an i18n key. */
export function composeReport(type: ReportType, answers: Readonly<Record<string, string>>, label: (key: string) => string): ComposedReport {
  const form = REPORT_FORMS[type];
  const out: ComposedReport = { category: form.category, description: '', steps: '', expected: '', observed: '' };
  for (const target of ['description', 'steps', 'expected', 'observed'] as const) {
    const fields = form.fields.filter((f) => f.target === target);
    const lines: string[] = [];
    if (target === 'description' && form.tagged) lines.push(`[${label(`report.type.${type}`)}]`);
    const named = (f: FieldSpec, value: string) => `${label(`report.field.${type}.${f.id}`)}: ${value}`;
    const answered = fields.map((f) => ({ f, value: fieldAnswer(answers, type, f.id).trim() })).filter((a) => a.value);
    for (const { f, value } of answered) if (f.kind === 'select') lines.push(named(f, label(optionKey(f.set!, value))));
    const texts = answered.filter((a) => a.f.kind === 'text');
    const lone = target !== 'description' && fields.filter((f) => f.kind === 'text').length === 1;
    for (const { f, value } of texts) if (!f.main && !lone) lines.push(named(f, value));
    for (const { f, value } of texts) if (f.main || lone) lines.push(value);
    out[target] = lines.join('\n');
  }
  return out;
}

export type Validation = { ok: true } | { ok: false; field: string; reason: 'required' | 'too-long' };

/** The first required field that is empty, or the first field whose text (or whose composed server field) is over its limit. */
export function validateReport(type: ReportType, answers: Readonly<Record<string, string>>, label: (key: string) => string): Validation {
  const missing = missingRequired(type, answers)[0];
  if (missing) return { ok: false, field: missing, reason: 'required' };
  const form = REPORT_FORMS[type];
  for (const f of form.fields) if (f.kind === 'text' && fieldAnswer(answers, type, f.id).trim().length > f.max) return { ok: false, field: f.id, reason: 'too-long' };
  const composed = composeReport(type, answers, label);
  for (const target of ['description', 'steps', 'expected', 'observed'] as const) {
    if (composed[target].length > REPORT_LIMITS[target]) return { ok: false, field: form.fields.find((f) => f.target === target)!.id, reason: 'too-long' };
  }
  return { ok: true };
}
