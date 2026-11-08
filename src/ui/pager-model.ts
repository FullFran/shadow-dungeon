/** Pure core of the phone pager (src/ui/pager.ts): sizes in, pages out. No DOM here. */
export interface GridFit { cols: number; rows: number; perPage: number }

const fitAxis = (space: number, item: number, gap: number): number => (item > 0 ? Math.max(1, Math.floor((space + gap) / (item + gap))) : 1);

/** How many items of a given size fit a box, gaps counted between items only; never fewer than one. */
export function fitGrid(o: { width: number; height: number; itemWidth: number; itemHeight: number; gap: number }): GridFit {
  const cols = fitAxis(o.width, o.itemWidth, o.gap);
  const rows = fitAxis(o.height, o.itemHeight, o.gap);
  return { cols, rows, perPage: cols * rows };
}

export const pageCount = (total: number, perPage: number): number => Math.max(1, Math.ceil(total / Math.max(1, perPage)));

export const pageOf = (index: number, perPage: number): number => Math.floor(Math.max(0, index) / Math.max(1, perPage));

export const clampPage = (page: number, count: number): number => (Number.isFinite(page) ? Math.min(Math.max(0, count - 1), Math.max(0, Math.trunc(page))) : 0);

/** [start, end) item indexes of a page; the last page may be short. */
export function pageRange(page: number, perPage: number, total: number): [number, number] {
  const start = Math.min(total, Math.max(0, page) * perPage);
  return [start, Math.min(total, start + perPage)];
}

export const needsPaging = (total: number, perPage: number): boolean => total > perPage;

export const pageIndexOf = (index: number, starts: readonly number[]): number => {
  let page = 0;
  starts.forEach((start, i) => {
    if (index >= start) page = i;
  });
  return page;
};

/**
 * Pages of rows whose heights differ: the index of the row that opens each page, filling each page while the next row
 * (and its gap) still fits `available`. A row taller than the box gets a page to itself.
 */
export function packRows(heights: readonly number[], available: number, gap: number): number[] {
  const starts = [0];
  let used = 0;
  heights.forEach((height, i) => {
    if (i === 0) {
      used = height;
    } else if (used + gap + height <= available) {
      used += gap + height;
    } else {
      starts.push(i);
      used = height;
    }
  });
  return starts;
}
