/**
 * Leaving the page pauses a solo run (ticket SD-LJJ7QL: F1 opened the
 * browser's help mid-boss, the run went on behind it and she came back to a
 * defeat). A shared run never stops, so it keeps going; an ended run or an
 * open menu has nothing to pause.
 */
export function pausesOnLeave(run: { shared: boolean; ended: boolean; menuOpen: boolean }): boolean {
  return !run.shared && !run.ended && !run.menuOpen;
}
