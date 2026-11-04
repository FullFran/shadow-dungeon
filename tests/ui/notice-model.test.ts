import { describe, expect, it } from 'vitest';
import { createNoticeQueue, NOTICE_PRIORITY, noticeKey, noticeMotion, veilDismissible, type NoticeKind, type NoticeSpec } from '../../src/ui/notice-model';

const spec = (kind: NoticeKind): NoticeSpec => ({
  kind,
  title: kind,
  lines: [],
  primary: { label: 'ok', run: () => 'close' },
  secondary: { label: 'later', run: () => 'close' },
});

function harness(ready = true) {
  const state = { ready, shown: [] as NoticeKind[], done: [] as (() => void)[] };
  const queue = createNoticeQueue({
    ready: () => state.ready,
    show: (s, done) => {
      state.shown.push(s.kind);
      state.done.push(done);
    },
  });
  return { state, queue };
}

describe('queue priority and one-at-a-time', () => {
  it('ranks update over install over news', () => {
    expect(NOTICE_PRIORITY.update).toBeGreaterThan(NOTICE_PRIORITY.install);
    expect(NOTICE_PRIORITY.install).toBeGreaterThan(NOTICE_PRIORITY.news);
  });

  it('shows the first to arrive at once and the rest by priority, each only after the current closes', () => {
    const { state, queue } = harness();
    queue.enqueue(spec('news'));
    queue.enqueue(spec('install'));
    queue.enqueue(spec('update'));
    expect(state.shown).toEqual(['news']);
    state.done[0]!();
    expect(state.shown).toEqual(['news', 'update']);
    state.done[1]!();
    expect(state.shown).toEqual(['news', 'update', 'install']);
    state.done[2]!();
    expect(queue.active()).toBeNull();
    expect(queue.pending()).toEqual([]);
  });

  it('picks by priority when several wait while the page is not ready', () => {
    const { state, queue } = harness(false);
    queue.enqueue(spec('news'));
    queue.enqueue(spec('install'));
    queue.enqueue(spec('update'));
    expect(state.shown).toEqual([]);
    expect(queue.pending()).toEqual(['update', 'install', 'news']);
    state.ready = true;
    queue.pump();
    expect(state.shown).toEqual(['update']);
  });

  it('never shows two at once, and a repeated kind replaces its pending copy instead of stacking', () => {
    const { state, queue } = harness(false);
    queue.enqueue(spec('install'));
    queue.enqueue(spec('install'));
    expect(queue.pending()).toEqual(['install']);
    state.ready = true;
    queue.pump();
    queue.pump();
    queue.enqueue(spec('update'));
    expect(state.shown).toEqual(['install']);
    expect(queue.active()).toBe('install');
    expect(queue.pending()).toEqual(['update']);
  });

  it('ignores a kind that is already on screen', () => {
    const { state, queue } = harness();
    queue.enqueue(spec('update'));
    queue.enqueue(spec('update'));
    expect(state.shown).toEqual(['update']);
    expect(queue.pending()).toEqual([]);
  });
});

describe('gating: runs and the welcome gate', () => {
  it('waits while the page is in a run (not ready) and shows on the next pump back on the hub', () => {
    const { state, queue } = harness(false);
    queue.enqueue(spec('update'));
    expect(state.shown).toEqual([]);
    state.ready = true;
    queue.pump();
    expect(state.shown).toEqual(['update']);
  });

  it('noticesBlocked holds every notice until unblocked, then releases them in priority order', () => {
    const { state, queue } = harness();
    expect(queue.blocked()).toBe(false);
    queue.setBlocked(true);
    queue.enqueue(spec('news'));
    queue.enqueue(spec('update'));
    queue.pump();
    expect(state.shown).toEqual([]);
    queue.setBlocked(false);
    expect(state.shown).toEqual(['update']);
  });

  it('closing the current notice while blocked does not open the next', () => {
    const { state, queue } = harness();
    queue.enqueue(spec('install'));
    queue.enqueue(spec('news'));
    queue.setBlocked(true);
    state.done[0]!();
    expect(state.shown).toEqual(['install']);
    queue.setBlocked(false);
    expect(state.shown).toEqual(['install', 'news']);
  });
});

describe('dismissal and keys', () => {
  it('lets a press on the veil dismiss install and news, never the update', () => {
    expect(veilDismissible('install')).toBe(true);
    expect(veilDismissible('news')).toBe(true);
    expect(veilDismissible('update')).toBe(false);
  });

  it('maps Enter to the primary and Esc to the secondary', () => {
    const s = spec('install');
    expect(noticeKey('Enter', s, false)).toBe('primary');
    expect(noticeKey('Escape', s, false)).toBe('secondary');
    expect(noticeKey('a', s, false)).toBeNull();
  });

  it('leaves Enter to the focused button, so Enter on "Ahora no" is that button', () => {
    expect(noticeKey('Enter', spec('install'), true)).toBeNull();
  });

  it('Esc falls back to the primary when there is no secondary (the iOS acknowledge)', () => {
    const { secondary: _drop, ...rest } = spec('install');
    expect(noticeKey('Escape', rest as NoticeSpec, false)).toBe('primary');
  });
});

describe('reduced-motion timing', () => {
  it('fades the veil 160 ms and drops the card 220 ms from above', () => {
    expect(noticeMotion(false)).toEqual({ veilMs: 160, cardMs: 220, dropPx: 24 });
  });

  it('reduced motion is fade only: no drop', () => {
    const m = noticeMotion(true);
    expect(m.dropPx).toBe(0);
    expect(m.veilMs).toBe(160);
    expect(m.cardMs).toBeLessThanOrEqual(160);
  });
});
