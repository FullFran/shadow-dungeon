/**
 * Adds a stylesheet to the page once (by id), for screens whose styles live
 * with their module instead of index.html.
 */
export function ensureStyle(id: string, css: string): void {
  if (typeof document === 'undefined' || document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = css;
  document.head.append(style);
}
