import '../styles/report-dismiss.css';
import { REPORT_CATEGORIES, type ReportPayload, type ReportResult } from '../adapters/report-api';
import type { KeyValueStore } from '../adapters/storage';
import { t } from '../i18n';
import { dropdown, type Dropdown } from '../ui/dropdown';
import { FORM_ICONS, REPORT_ICONS } from '../ui/icons/report-icons';
import { pixelSvgOf } from '../ui/pixel-icons';
import { h } from '../ui/window';
import { composeReport, emptyAnswers, fieldAnswer, optionKey, REPORT_FORMS, REPORT_LIMITS, REPORT_TYPES, validateReport, type FieldSpec, type ReportType } from './report-forms';

/**
 * "Reportar un problema" (issue #9): a short form a player fills in under a
 * minute, sent anonymously to the game API (adapters/report-api.ts). Each type
 * of report has its own form (report-forms.ts), folded into the server's
 * fields on send. The owner triages it and opens a GitHub issue by hand;
 * nothing goes public on its own. The draft stays in this browser until it is
 * sent, so a failure never loses what the player typed.
 */

export { REPORT_CATEGORIES, REPORT_LIMITS };

export const REPORT_DRAFT_KEY = 'mazmorra-sombria.reportDraft';

/** What the player is typing. Answers are keyed `type.field`. `attachTech` adds the game version, the coarse device summary and this session's diagnostics snapshot. */
export interface ReportDraft {
  type: ReportType;
  answers: Record<string, string>;
  attachTech: boolean;
}

export const emptyDraft = (): ReportDraft => ({ type: 'bug', answers: emptyAnswers(), attachTech: true });

const fieldOf = (type: ReportType, id: string): FieldSpec | undefined => REPORT_FORMS[type].fields.find((f) => f.id === id);

/** The saved draft, answer by answer; anything broken falls back to the empty draft's value. A pre-forms draft keeps its description. */
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
  const type = (saved.type ?? saved.category) as ReportType;
  if (REPORT_TYPES.includes(type)) draft.type = type;
  if (typeof saved.attachTech === 'boolean') draft.attachTech = saved.attachTech;
  if (saved.answers && typeof saved.answers === 'object' && !Array.isArray(saved.answers)) {
    for (const [key, value] of Object.entries(saved.answers as Record<string, unknown>)) {
      const [kind, id] = key.split('.') as [ReportType, string];
      const field = REPORT_TYPES.includes(kind) ? fieldOf(kind, id) : undefined;
      if (!field || typeof value !== 'string') continue;
      if (field.kind === 'text') draft.answers[key] = value.slice(0, field.max);
      else if (field.options!.includes(value)) draft.answers[key] = value;
    }
  } else if (typeof saved.description === 'string') {
    // Before per-type forms: the one description box.
    const main = REPORT_FORMS[draft.type].fields.find((f) => f.main);
    if (main) draft.answers[`${draft.type}.${main.id}`] = saved.description.slice(0, main.max);
  }
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

/** The report as posted: the server's fields plus, with technical info on, the session's diagnostics snapshot (the server's `diagnostics`, at most 16 KB: src/app/diagnostics.ts). */
export type ReportToSend = ReportPayload & { diagnostics?: object };

export type BuildResult = { ok: true; report: ReportToSend } | { ok: false; field: string; reason: 'required' | 'too-long' };

/** What technical info can add: the version, the device summary and, if given, the diagnostics snapshot. */
export interface ReportTech {
  version: string;
  device: string;
  diagnostics?: object;
}

/** The report to send: the form folded into the server's fields (report-forms.ts), required answers present, every field within the server's limits. */
export function buildReport(draft: ReportDraft, tech: ReportTech, label: (key: string) => string = t): BuildResult {
  const checked = validateReport(draft.type, draft.answers, label);
  if (!checked.ok) return checked;
  const composed = composeReport(draft.type, draft.answers, label);
  return {
    ok: true,
    report: {
      ...composed,
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

export type ReportError = 'rate-limited' | 'unavailable' | 'invalid' | 'required' | 'too-long';

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

/** Shows a field's characters used once it nears its limit. */
const COUNT_FROM = 0.8;

interface FieldView {
  spec: FieldSpec;
  control: HTMLElement;
  error: HTMLElement;
  invalid(on: boolean, message?: string): void;
}

/**
 * The report form window: a type dropdown (each type with its own pixel
 * icon), the fields of that type (dropdowns for the choices, text boxes for
 * the rest, required ones marked, a problem shown under its field), a switch
 * for the technical info, Send (the one primary action) and Back. On success
 * it shows the reference to quote.
 */
export function reportWindow(options: ReportWindowOptions): { element: HTMLElement; dispose(): void } {
  const draft = loadDraft(options.store);
  const keep = () => saveDraft(options.store, draft);
  const status = h('p', { className: 'report-status' });
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const title = h('h2', { className: 'md-window-title', textContent: t('report.title') });
  const body = h('div', { className: 'md-window-body' });
  const element = h('section', { className: 'md-window shop report-window' }, [title, body]);
  let busy = false;
  let disposed = false;
  let views = new Map<string, FieldView>();
  let dropdowns: Dropdown[] = [];

  const answerKey = (id: string) => `${draft.type}.${id}`;

  // --- the type picker
  const typeLabel = h('span', { className: 'rp-label', id: 'rp-type-label', textContent: t('report.type.label') });
  const about = h('p', { className: 'rp-about' });
  const paintAbout = () => {
    about.textContent = t(`report.type.${draft.type}.about`);
  };
  const typePicker = dropdown({
    label: t('report.type.label'),
    labelledBy: 'rp-type-label',
    value: draft.type,
    items: REPORT_TYPES.map((type) => ({ value: type, label: t(`report.type.${type}`), hint: t(`report.type.${type}.about`), icon: () => pixelSvgOf(REPORT_ICONS[REPORT_FORMS[type].icon]!, 'px-icon rp-icon') })),
    onChange: (value) => {
      draft.type = value as ReportType;
      keep();
      paintAbout();
      status.textContent = '';
      renderFields();
    },
  });

  // --- the fields of the chosen type
  const fields = h('div', { className: 'rp-fields' });

  function textField(spec: FieldSpec, id: string): { control: HTMLTextAreaElement; extra: HTMLElement } {
    const box = h('textarea', { className: 'rp-input', id, value: fieldAnswer(draft.answers, draft.type, spec.id) });
    box.rows = spec.rows ?? 3;
    box.maxLength = spec.max;
    box.spellcheck = true;
    box.placeholder = t(`report.field.${draft.type}.${spec.id}.hint`);
    const count = h('p', { className: 'rp-count' });
    const paintCount = () => {
      const near = box.value.length >= spec.max * COUNT_FROM;
      count.hidden = !near;
      count.textContent = near ? t('report.chars').replace('{n}', String(box.value.length)).replace('{max}', String(spec.max)) : '';
    };
    paintCount();
    box.addEventListener('input', () => {
      draft.answers[answerKey(spec.id)] = box.value;
      views.get(spec.id)?.invalid(false);
      paintCount();
      keep();
    });
    return { control: box, extra: count };
  }

  function selectField(spec: FieldSpec, labelId: string): { control: HTMLElement; picker: Dropdown } {
    const picker = dropdown({
      label: t(`report.field.${draft.type}.${spec.id}`),
      labelledBy: labelId,
      value: fieldAnswer(draft.answers, draft.type, spec.id),
      placeholder: t('report.answer.none'),
      items: [{ value: '', label: t('report.answer.none') }, ...spec.options!.map((o) => ({ value: o, label: t(optionKey(spec.set!, o)) }))],
      onChange: (value) => {
        draft.answers[answerKey(spec.id)] = value;
        keep();
      },
    });
    return { control: picker.element, picker };
  }

  function renderFields(): void {
    for (const d of dropdowns) d.dispose();
    dropdowns = [];
    views = new Map();
    const form = REPORT_FORMS[draft.type];
    fields.replaceChildren(
      ...form.fields.map((spec) => {
        const base = `rp-${draft.type}-${spec.id}`;
        const name = t(`report.field.${draft.type}.${spec.id}`);
        const labelNodes = [h('span', { textContent: name }), spec.required ? h('span', { className: 'rp-req', textContent: t('report.required') }) : null];
        const label = spec.kind === 'text' ? h('label', { className: 'rp-label' }, labelNodes) : h('span', { className: 'rp-label', id: `${base}-label` }, labelNodes);
        if (spec.kind === 'text') label.setAttribute('for', base);
        const error = h('p', { className: 'rp-error', id: `${base}-error` });
        error.hidden = true;
        error.setAttribute('role', 'alert');
        const built = spec.kind === 'text' ? textField(spec, base) : selectField(spec, `${base}-label`);
        if ('picker' in built) dropdowns.push(built.picker);
        const control = built.control;
        if (spec.required) control.setAttribute('aria-required', 'true');
        control.setAttribute('aria-describedby', error.id);
        const view: FieldView = {
          spec,
          control,
          error,
          invalid(on, message = '') {
            control.classList.toggle('is-invalid', on);
            if (on) control.setAttribute('aria-invalid', 'true');
            else control.removeAttribute('aria-invalid');
            error.hidden = !on;
            error.replaceChildren(...(on ? [pixelSvgOf(FORM_ICONS.warn!, 'px-icon'), h('span', { textContent: message })] : []));
          },
        };
        views.set(spec.id, view);
        return h('div', { className: 'rp-field' + (spec.kind === 'text' && !spec.half ? ' is-wide' : '') }, [label, control, 'extra' in built ? built.extra : null, error]);
      }),
    );
  }

  // --- the technical-info switch
  const techState = h('span', { className: 'rp-state' });
  const techAbout = h('small');
  const techRow = h('button', { type: 'button', className: 'rp-switch' }, [
    h('span', { className: 'rp-track' }, [h('span', { className: 'rp-knob' })]),
    h('span', { className: 'rp-switch-text' }, [h('span', { textContent: t('report.attachTech') }), techAbout]),
    techState,
  ]);
  techRow.setAttribute('role', 'switch');
  const tech = h('p', { className: 'report-tech' });
  const paintTech = () => {
    techRow.setAttribute('aria-checked', String(draft.attachTech));
    techState.textContent = t(draft.attachTech ? 'report.on' : 'report.off');
    techAbout.textContent = t('report.attachTech.about.short');
    const session = options.diagnostics ? ` ${t('report.attachTech.session')}` : '';
    tech.textContent = draft.attachTech ? `${t('report.attachTech.about')} ${options.version} · ${options.device}.${session}` : '';
  };
  const toggleTech = () => {
    draft.attachTech = !draft.attachTech;
    paintTech();
    keep();
  };
  techRow.addEventListener('click', toggleTech);
  // Enter and Space act on keydown, like the dropdown; the menu behind never sees them.
  techRow.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (!e.repeat) toggleTech();
  });
  paintTech();

  // --- send and back
  const sendButton = h('button', { type: 'button', className: 'rp-btn rp-primary' }, [pixelSvgOf(FORM_ICONS.send!, 'px-icon'), h('span', { textContent: t('report.send') })]);
  const backButton = h('button', { type: 'button', className: 'rp-btn rp-secondary', textContent: t('report.back') });
  backButton.addEventListener('click', () => options.onBack());
  sendButton.addEventListener('click', () => void submit());
  for (const button of [sendButton, backButton]) {
    button.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      if (!e.repeat) button.click();
    });
  }

  const fail = (error: ReportError) => {
    status.classList.remove('is-busy');
    status.textContent = t(reportErrorKey(error));
  };

  async function submit(): Promise<void> {
    if (busy) return;
    // The fields first, before any snapshot is taken.
    const checked = validateReport(draft.type, draft.answers, t);
    for (const view of views.values()) view.invalid(false);
    if (!checked.ok) {
      const view = views.get(checked.field);
      view?.invalid(true, t(checked.reason === 'required' ? 'report.error.required' : 'report.error.too-long'));
      view?.control.focus();
      view?.control.closest('.rp-field')?.scrollIntoView?.({ block: 'nearest' });
      return;
    }
    busy = true;
    sendButton.setAttribute('aria-disabled', 'true');
    keep();
    status.classList.add('is-busy');
    status.textContent = t('report.sending');
    const built = await collectReport(draft, options);
    if (disposed) return;
    const result = built.ok ? await options.send(built.report) : ({ kind: 'invalid' } as const);
    busy = false;
    sendButton.removeAttribute('aria-disabled');
    if (disposed) return;
    if (result.kind === 'ok') {
      clearDraft(options.store);
      sent(result.ref);
    } else fail(result.kind);
  }

  function form(): void {
    paintAbout();
    renderFields();
    // The fields scroll; the status line and the buttons stay in view.
    body.replaceChildren(
      h('div', { className: 'rp-scroll' }, [h('p', { className: 'report-intro', textContent: t('report.intro') }), h('div', { className: 'rp-field' }, [typeLabel, typePicker.element, about]), fields, techRow, tech]),
      h('div', { className: 'rp-footer' }, [status, h('div', { className: 'rp-actions' }, [sendButton, backButton])]),
    );
  }

  function sent(ref: string): void {
    for (const d of dropdowns) d.dispose();
    dropdowns = [];
    typePicker.close();
    title.textContent = t('report.sent.title');
    const done = h('button', { type: 'button', className: 'rp-btn rp-primary', textContent: t('report.back') });
    done.addEventListener('click', () => options.onBack());
    body.replaceChildren(h('div', { className: 'rp-scroll' }, [h('p', { className: 'report-ref', textContent: ref }), h('p', { textContent: t('report.sent.body') })]), h('div', { className: 'rp-footer' }, [h('div', { className: 'rp-actions' }, [done])]));
    done.focus();
  }

  // Esc leaves the form (a text box lets go of the focus first); an open dropdown keeps the key for itself.
  const onKey = (e: KeyboardEvent) => {
    if (!element.isConnected) {
      if (disposed) window.removeEventListener('keydown', onKey);
      return;
    }
    if (e.defaultPrevented || e.code !== 'Escape' || e.ctrlKey || e.altKey || e.metaKey) return;
    e.preventDefault();
    if (e.target instanceof HTMLTextAreaElement) e.target.blur();
    else options.onBack();
  };
  window.addEventListener('keydown', onKey);

  form();
  // Start on the type picker: a keyboard player opens it with Enter or the arrows.
  requestAnimationFrame(() => {
    if (!disposed && element.isConnected && !document.activeElement?.closest?.('.report-window')) typePicker.element.focus({ preventScroll: true });
  });
  return {
    element,
    dispose: () => {
      disposed = true;
      window.removeEventListener('keydown', onKey);
      typePicker.dispose();
      for (const d of dropdowns) d.dispose();
      dropdowns = [];
    },
  };
}
