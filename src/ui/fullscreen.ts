/**
 * Immersive mode for a run on a phone: fullscreen (no browser bars eating the
 * landscape height) and the orientation locked to landscape. Both are
 * feature-detected and best effort: iPhone Safari offers neither, Android
 * Chrome needs the run to start from a tap (it does: Play, a dungeon, a
 * retry), an installed PWA is already fullscreen and landscape by its
 * manifest. Nothing here ever throws.
 */
export interface ImmersiveDeps {
  /** Installed (display-mode standalone / fullscreen). */
  standalone: boolean;
  fullscreenElement: unknown;
  requestFullscreen: (() => Promise<void>) | null;
  lockOrientation: (() => Promise<void>) | null;
}

export async function enterImmersive(deps: ImmersiveDeps = browserDeps()): Promise<void> {
  if (!deps.standalone && !deps.fullscreenElement && deps.requestFullscreen) {
    try {
      await deps.requestFullscreen();
    } catch {
      // Refused (no gesture, iframe, user setting): play in the page as it is.
    }
  }
  if (deps.lockOrientation) {
    try {
      await deps.lockOrientation();
    } catch {
      // Not offered outside fullscreen or on this device: the rotate hint stays the guide.
    }
  }
}

function browserDeps(): ImmersiveDeps {
  if (typeof document === 'undefined') return { standalone: true, fullscreenElement: null, requestFullscreen: null, lockOrientation: null };
  const root = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  const request = root.requestFullscreen ? () => root.requestFullscreen({ navigationUI: 'hide' }) : root.webkitRequestFullscreen ? async () => void (await root.webkitRequestFullscreen!()) : null;
  const orientation = (screen as Screen & { orientation?: ScreenOrientation & { lock?: (o: string) => Promise<void> } }).orientation;
  return {
    standalone: window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches ?? false,
    fullscreenElement: document.fullscreenElement ?? (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement ?? null,
    requestFullscreen: request,
    lockOrientation: orientation?.lock ? () => orientation.lock!('landscape') : null,
  };
}
