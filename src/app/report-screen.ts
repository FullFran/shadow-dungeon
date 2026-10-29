import { REPORT_CATEGORIES, type ReportCategory, type ReportPayload, type ReportResult } from '../adapters/report-api';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { cursorList, type CursorList, type ListItem } from '../ui/cursor-list';
import { h } from '../ui/window';

/**
 * "Reportar un problema" (issue #9): a short form a player fills in under a
 * minute, sent anonymously to the game API (adapters/report-api.ts). The
 * owner triages it and opens a GitHub issue by hand; nothing goes public on
 * its own. The draft stays in this browser until it is sent, so a failure
 * never loses what the player typed.
 */

export { REPORT_CATEGORIES };

/** Field limits, as the server checks them (server/internal/reports). */
export const REPORT_LIMITS = { description: 2000, steps: 2000, expected: 1000, observed: 1000, version: 40, device: 200 } as const;

export const REPORT_DRAFT_KEY = 'mazmorra-sombria.reportDraft';

/** What the player is typing. `attachTech` adds the game version, the coarse device summary and this session's diagnostics snapshot. */
export interface ReportDraft {
  category: ReportCategory;
  description: string;
  steps: string;
  expected: string;
  observed: string;
  attachTech: boolean;
}

type TextField = 'description' | 'steps' | 'expected' | 'observed';
const TEXT_FIELDS: readonly TextField[] = ['description', 'steps', 'expected', 'observed'];

export const emptyDraft = (): ReportDraft => ({ category: 'bug', description: '', steps: '', expected: '', observed: '', attachTech: true });

/** The saved draft, field by field; anything broken falls back to the empty draft's value. */
export function loadDraft(store: KeyValueStore): ReportDraft {
  const draft = emptyDraft();
  let raw: unknown;
  try {
    raw = JSON.parse(store.get(REPORT_DRAFT_KEY) ?? 'null');
  } catch {
    return draft;
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return draft;
  const saved = raw as Record<string, unknown>;
  if (REPORT_CATEGORIES.includes(saved.category as ReportCategory)) draft.category = saved.category as ReportCategory;
  for (const field of TEXT_FIELDS) {
    const value = saved[field];
    if (typeof value === 'string') draft[field] = value.slice(0, REPORT_LIMITS[field]);
  }
  if (typeof saved.attachTech === 'boolean') draft.attachTech = saved.attachTech;
  return draft;
}

export function saveDraft(store: KeyValueStore, draft: ReportDraft): void {
  store.set(REPORT_DRAFT_KEY, JSON.stringify(draft));
}

/** Forgets the draft (after a report is sent). An empty value reads back as the empty draft. */
export function clearDraft(store: KeyValueStore): void {
  store.set(REPORT_DRAFT_KEY, '');
}

/** What `navigator` the summary reads; nothing else of the browser is looked at. */
export interface DeviceInfo {
  userAgent: string;
  maxTouchPoints?: number;
}

/**
 * A coarse device class: browser family / OS family / touch, never versions,
 * models or the full user agent (no fingerprinting). "Firefox / Linux / no touch".
 */
export function deviceSummary(info: DeviceInfo): string {
  const ua = info.userAgent ?? '';
  const touch = (info.maxTouchPoints ?? 0) > 0;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\/|Opera/.test(ua)
      ? 'Opera'
      : /SamsungBrowser/.test(ua)
        ? 'Samsung Internet'
        : /Firefox\/|FxiOS/.test(ua)
          ? 'Firefox'
          : /Chrome\/|CriOS|Chromium/.test(ua)
            ? 'Chrome'
            : /Safari\//.test(ua)
              ? 'Safari'
              : 'Other';
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touch)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /CrOS/.test(ua)
          ? 'ChromeOS'
          : /Macintosh|Mac OS X/.test(ua)
            ? 'macOS'
            : /Linux|X11/.test(ua)
              ? 'Linux'
              : 'Other';
  return `${browser} / ${os} / ${touch ? 'touch' : 'no touch'}`;
}

/** The report as posted: the form's fields plus, with technical info on, the session's diagnostics snapshot (the server's `diagnostics`, at most 16 KB: src/app/diagnostics.ts). */
export type ReportToSend = ReportPayload & { diagnostics?: object };

export type BuildResult = { ok: true; report: ReportToSend } | { ok: false; field: TextField };

/** What technical info can add: the version, the device summary and, if given, the diagnostics snapshot. */
export interface ReportTech {
  version: string;
  device: string;
  diagnostics?: object;
}

/** The report to send: trimmed fields, the description required, every field within the server's limits. */
export function buildReport(draft: ReportDraft, tech: ReportTech): BuildResult {
  const text = {} as Record<TextField, string>;
  for (const field of TEXT_FIELDS) {
    text[field] = draft[field].trim();
    if (text[field].length > REPORT_LIMITS[field]) return { ok: false, field };
  }
  if (!text.description) return { ok: false, field: 'description' };
  return {
    ok: true,
    report: {
      category: draft.category,
      ...text,
      version: draft.attachTech ? tech.version.trim().slice(0, REPORT_LIMITS.version) : '',
      device: draft.attachTech ? tech.device.trim().slice(0, REPORT_LIMITS.device) : '',
      ...(draft.attachTech && tech.diagnostics ? { diagnostics: tech.diagnostics } : {}),
    },
  };
}

/**
 * The report with its snapshot taken now, only when technical info is on
 * (nothing is gathered otherwise). A snapshot that fails leaves the report
 * without it rather than stopping it.
 */
export async function collectReport(draft: ReportDraft, tech: { version: string; device: string; diagnostics?: () => Promise<object> }): Promise<BuildResult> {
  let diagnostics: object | undefined;
  if (draft.attachTech && tech.diagnostics) diagnostics = await tech.diagnostics().catch(() => undefined);
  return buildReport(draft, { version: tech.version, device: tech.device, ...(diagnostics ? { diagnostics } : {}) });
}

export type ReportError = 'rate-limited' | 'unavailable' | 'invalid' | 'description' | 'too-long';

/** i18n key of an error line under the form. */
export const reportErrorKey = (error: ReportError): string => `report.error.${error}`;

export interface ReportWindowOptions {
  store: KeyValueStore;
  /** The game version to attach (`APP_VERSION` once build-info lands). */
  version: string;
  /** The device summary to attach (`deviceSummary(navigator)`). */
  device: string;
  /** This session's technical snapshot (src/app/diagnostics.ts), taken at send time only with technical info on. */
  diagnostics?: () => Promise<object>;
  send(report: ReportPayload): Promise<ReportResult>;
  onBack(): void;
}

/** Layout only this window needs: full-width text boxes under their labels. */
const STYLE = `
.report-window .md-item.report-field { flex-wrap: wrap; align-items: flex-start; }
.report-window .md-item.report-field .md-value { flex: 1 1 100%; white-space: normal; padding-left: 1.2em; }
.report-window textarea.report-input { font: inherit; font-size: 16px; color: var(--md-cursor); background: var(--md-ink); border: 2px solid var(--md-border-shade); border-radius: 6px; padding: 4px 8px; width: 100%; box-sizing: border-box; resize: vertical; }
.report-window textarea.report-input:focus { outline: none; border-color: var(--md-cursor); }
.report-window .report-ref { font-size: 2em; letter-spacing: 0.15em; color: var(--md-cursor); text-align: center; margin: 12px 0; user-select: all; }
.report-window .report-tech { font-size: 14px; margin: 4px 0 0; overflow-wrap: anywhere; }
/* A tall form on a phone: the body scrolls inside the screen, and the window clears the touch "Atrás" button. */
.report-window .md-window-body { max-height: calc(100dvh - 150px); overflow-y: auto; overscroll-behavior: contain; scrollbar-color: var(--md-border-shade) transparent; }
html.touch .report-window { margin-top: 52px; }
`;

/**
 * The report form window: category (left/right or confirm cycles), the text
 * boxes (confirm focuses one; up, down and Esc leave it), the technical-info
 * toggle, Send and Back. On success it shows the reference to quote.
 */
export function reportWindow(options: ReportWindowOptions): { element: HTMLElement; dispose(): void } {
  const draft = loadDraft(options.store);
  const keep = () => saveDraft(options.store, draft);
  const status = h('p', { className: 'lobby-error report-status' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const title = h('h2', { className: 'md-window-title', textContent: t('report.title') });
  const body = h('div', { className: 'md-window-body' });
  const element = h('section', { className: 'md-window shop report-window' }, [h('style', { textContent: STYLE }), title, body]);
  let list: CursorList | null = null;
  let busy = false;
  let disposed = false;

  const categoryValue = h('span', { textContent: t(`report.category.${draft.category}`) });
  const cycleCategory = (delta: -1 | 1) => {
    const i = REPORT_CATEGORIES.indexOf(draft.category);
    draft.category = REPORT_CATEGORIES[(i + delta + REPORT_CATEGORIES.length) % REPORT_CATEGORIES.length]!;
    categoryValue.textContent = t(`report.category.${draft.category}`);
    keep();
  };

  const tech = h('p', { className: 'dim report-tech' });
  const techValue = h('span');
  const paintTech = () => {
    techValue.textContent = t(draft.attachTech ? 'report.on' : 'report.off');
    const session = options.diagnostics ? ` ${t('report.attachTech.session')}` : '';
    tech.textContent = draft.attachTech ? `${t('report.attachTech.about')} ${options.version} · ${options.device}.${session}` : '';
  };
  const toggleTech = () => {
    draft.attachTech = !draft.attachTech;
    paintTech();
    keep();
  };
  paintTech();

  const boxes = {} as Record<TextField, HTMLTextAreaElement>;
  const textRow = (field: TextField, rows: number): ListItem => {
    const box = h('textarea', { className: 'report-input', value: draft[field] });
    box.rows = rows;
    box.maxLength = REPORT_LIMITS[field];
    box.spellcheck = true;
    box.placeholder = t(`report.${field}.placeholder`);
    box.setAttribute('aria-label', t(`report.${field}`));
    box.addEventListener('input', () => {
      draft[field] = box.value;
      keep();
    });
    // A click on the box focuses it; it must not also confirm the row behind it.
    box.addEventListener('click', (e) => e.stopPropagation());
    boxes[field] = box;
    return { label: t(`report.${field}`), value: box, className: 'report-field', onConfirm: () => box.focus() };
  };

  const fail = (error: ReportError) => {
    status.textContent = t(reportErrorKey(error));
  };

  const submit = async () => {
    if (busy) return;
    // The fields first, before any snapshot is taken.
    const checked = buildReport(draft, { version: options.version, device: options.device });
    if (!checked.ok) {
      fail(checked.field === 'description' && !draft.description.trim() ? 'description' : 'too-long');
      boxes[checked.field].focus();
      return;
    }
    busy = true;
    keep();
    status.textContent = t('report.sending');
    const built = await collectReport(draft, options);
    if (disposed) return;
    const result = built.ok ? await options.send(built.report) : ({ kind: 'invalid' } as const);
    busy = false;
    if (disposed) return;
    if (result.kind === 'ok') {
      clearDraft(options.store);
      sent(result.ref);
    } else fail(result.kind);
  };

  function form(): void {
    list = cursorList({
      onBack: options.onBack,
      label: t('report.title'),
      className: 'shop-list',
      items: [
        { label: t('report.category'), value: categoryValue, onAdjust: cycleCategory, onConfirm: () => cycleCategory(1) },
        textRow('description', 3),
        textRow('steps', 2),
        textRow('expected', 2),
        textRow('observed', 2),
        { label: t('report.attachTech'), value: techValue, onAdjust: toggleTech, onConfirm: toggleTech },
        { label: t('report.send'), onConfirm: () => void submit() },
        { label: t('menu.back'), onConfirm: options.onBack },
      ],
    });
    body.replaceChildren(h('p', { textContent: t('report.intro') }), list.element, tech, status);
  }

  function sent(ref: string): void {
    list?.dispose();
    title.textContent = t('report.sent.title');
    list = cursorList({ onBack: options.onBack, label: t('report.sent.title'), className: 'shop-list', items: [{ label: t('menu.back'), onConfirm: options.onBack }] });
    body.replaceChildren(h('p', { className: 'report-ref', textContent: ref }), h('p', { textContent: t('report.sent.body') }), list.element);
  }

  form();
  return {
    element,
    dispose: () => {
      disposed = true;
      list?.dispose();
      list = null;
    },
  };
}
