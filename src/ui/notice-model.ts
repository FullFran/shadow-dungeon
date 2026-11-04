/**
 * The system notice model (pure; .agents/DESIGN.md §4 "System notice"). One notice at a time, picked by
 * priority (update > install > news), shown only where the page is a calm place for it (the hub, never a
 * run) and never while another module holds notices back (`setBlocked`, e.g. the first-run welcome).
 * The view is src/ui/notice.ts; the three notices are built in src/pwa/notices.ts.
 */
export type NoticeKind = 'update' | 'install' | 'news';

export interface NoticeAction {
  label: string;
  /** What the button does; `stay` keeps the notice open (the update, whose page is about to reload). */
  run(): 'close' | 'stay';
}

export interface NoticeLine {
  /** Key of the small pixel icon beside the line (see `noticeIcon` in src/ui/notice.ts). */
  icon: string;
  text: string;
}

export interface NoticeSpec {
  kind: NoticeKind;
  title: string;
  /** Short benefit or change lines (at most three). */
  lines: NoticeLine[];
  /** The one ember button; Enter. */
  primary: NoticeAction;
  /** The quiet button; Esc, and a press on the veil where the notice allows it. */
  secondary?: NoticeAction;
  /** The small text link ("No volver a mostrar"). */
  tertiary?: NoticeAction;
}

/** Higher wins. */
export const NOTICE_PRIORITY: Record<NoticeKind, number> = { update: 3, install: 2, news: 1 };

/** A press on the veil is "Más tarde" only for notices that are safe to put off without a thought; the update is not. */
export function veilDismissible(kind: NoticeKind): boolean {
  return kind !== 'update';
}

/** Entrance timing: the veil fades 160 ms, the card drops 24 px in 220 ms; reduced motion is a fade only. */
export function noticeMotion(reduced: boolean): { veilMs: number; cardMs: number; dropPx: number } {
  return reduced ? { veilMs: 160, cardMs: 160, dropPx: 0 } : { veilMs: 160, cardMs: 220, dropPx: 24 };
}

export type NoticeKeyAction = 'primary' | 'secondary' | null;

/**
 * Enter = primary, Esc = secondary (the primary when there is none: the iOS acknowledge). While a button holds
 * focus, Enter belongs to it (the browser clicks it), so "Ahora no" stays reachable by keyboard.
 */
export function noticeKey(key: string, spec: NoticeSpec, onButton: boolean): NoticeKeyAction {
  if (key === 'Escape') return spec.secondary ? 'secondary' : 'primary';
  if (key === 'Enter' && !onButton) return 'primary';
  return null;
}

export interface NoticeQueueDeps {
  /** True when the page is a place a notice may appear (the hub; not a run, a town window or a drawer). */
  ready(): boolean;
  /** Presents the notice; `done` must be called once it is gone. */
  show(spec: NoticeSpec, done: () => void): void;
}

export interface NoticeQueue {
  /** Adds a notice (a pending one of the same kind is replaced; the kind on screen is ignored) and tries to show it. */
  enqueue(spec: NoticeSpec): void;
  /** Shows the best waiting notice when nothing is on screen, the page is ready and nobody blocks notices. */
  pump(): void;
  setBlocked(blocked: boolean): void;
  blocked(): boolean;
  /** Kinds waiting, best first. */
  pending(): NoticeKind[];
  active(): NoticeKind | null;
}

export function createNoticeQueue(deps: NoticeQueueDeps): NoticeQueue {
  const waiting = new Map<NoticeKind, NoticeSpec>();
  let active: NoticeKind | null = null;
  let blocked = false;
  const order = (): NoticeKind[] => [...waiting.keys()].sort((a, b) => NOTICE_PRIORITY[b] - NOTICE_PRIORITY[a]);

  const pump = (): void => {
    if (active !== null || blocked || waiting.size === 0 || !deps.ready()) return;
    const kind = order()[0]!;
    const spec = waiting.get(kind)!;
    waiting.delete(kind);
    active = kind;
    let closed = false;
    deps.show(spec, () => {
      if (closed) return;
      closed = true;
      active = null;
      pump();
    });
  };

  return {
    enqueue(spec) {
      if (active === spec.kind) return;
      waiting.set(spec.kind, spec);
      pump();
    },
    pump,
    setBlocked(value) {
      blocked = value;
      pump();
    },
    blocked: () => blocked,
    pending: order,
    active: () => active,
  };
}
