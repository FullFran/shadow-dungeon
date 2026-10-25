/**
 * Keeps the screen awake during a run on touch devices (Screen Wake Lock
 * API, where it exists). Every call is guarded: an unsupported browser, a
 * denied request or a page in the background only means the screen may dim.
 * The lock drops when the page is hidden, so it is asked for again when the
 * page comes back. Returns the release.
 */
interface WakeLockSentinelLike {
  release(): Promise<void>;
}
interface WakeLockLike {
  request(type: 'screen'): Promise<WakeLockSentinelLike>;
}

export function holdWakeLock(): () => void {
  const api = (globalThis.navigator as { wakeLock?: WakeLockLike } | undefined)?.wakeLock;
  if (!api || typeof document === 'undefined') return () => {};
  let sentinel: WakeLockSentinelLike | null = null;
  let released = false;
  const request = () => {
    if (released || document.visibilityState !== 'visible') return;
    api
      .request('screen')
      .then((s) => {
        if (released) void s.release().catch(() => {});
        else sentinel = s;
      })
      .catch(() => {});
  };
  const onVisibility = () => request();
  document.addEventListener('visibilitychange', onVisibility);
  request();
  return () => {
    released = true;
    document.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release().catch(() => {});
    sentinel = null;
  };
}
