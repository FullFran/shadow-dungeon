import { describe, expect, it } from 'vitest';
import { clampPage, fitGrid, needsPaging, packRows, pageCount, pageIndexOf, pageOf, pageRange } from '../../src/ui/pager-model';

describe('fitGrid', () => {
  it('counts the columns and rows that fit, gaps included', () => {
    // 3 columns of 100 with 10 gaps need 320; 2 rows of 50 with 10 gaps need 110.
    expect(fitGrid({ width: 330, height: 115, itemWidth: 100, itemHeight: 50, gap: 10 })).toEqual({ cols: 3, rows: 2, perPage: 6 });
  });
  it('never returns less than one item per page', () => {
    expect(fitGrid({ width: 40, height: 20, itemWidth: 100, itemHeight: 50, gap: 10 })).toEqual({ cols: 1, rows: 1, perPage: 1 });
  });
  it('fits exact multiples without losing a row to the last gap', () => {
    expect(fitGrid({ width: 100, height: 110, itemWidth: 100, itemHeight: 50, gap: 10 }).rows).toBe(2);
    expect(fitGrid({ width: 100, height: 109, itemWidth: 100, itemHeight: 50, gap: 10 }).rows).toBe(1);
  });
  it('treats a list as a single column', () => {
    expect(fitGrid({ width: 300, height: 200, itemWidth: 300, itemHeight: 40, gap: 4 }).perPage).toBe(4);
  });
});

describe('pages', () => {
  it('counts pages, at least one', () => {
    expect(pageCount(0, 6)).toBe(1);
    expect(pageCount(6, 6)).toBe(1);
    expect(pageCount(7, 6)).toBe(2);
    expect(pageCount(30, 6)).toBe(5);
  });
  it('finds the page that holds an item', () => {
    expect(pageOf(0, 6)).toBe(0);
    expect(pageOf(5, 6)).toBe(0);
    expect(pageOf(6, 6)).toBe(1);
    expect(pageOf(29, 6)).toBe(4);
  });
  it('clamps a page into range and survives bad input', () => {
    expect(clampPage(-3, 5)).toBe(0);
    expect(clampPage(9, 5)).toBe(4);
    expect(clampPage(2, 5)).toBe(2);
    expect(clampPage(Number.NaN, 5)).toBe(0);
    expect(clampPage(1, 0)).toBe(0);
  });
  it('slices the last page short', () => {
    expect(pageRange(0, 6, 14)).toEqual([0, 6]);
    expect(pageRange(2, 6, 14)).toEqual([12, 14]);
  });
  it('pages only when the items overflow', () => {
    expect(needsPaging(6, 6)).toBe(false);
    expect(needsPaging(7, 6)).toBe(true);
  });
});

describe('packRows (rows of different heights)', () => {
  it('starts a new page when the next row no longer fits, gaps counted', () => {
    expect(packRows([50, 50, 50, 50], 110, 10)).toEqual([0, 2]);
    expect(packRows([50, 50, 50, 50], 109, 10)).toEqual([0, 1, 2, 3]);
  });
  it('packs tall and short rows by their real heights', () => {
    expect(packRows([30, 60, 30, 60], 100, 10)).toEqual([0, 2]);
    expect(packRows([20, 20, 30, 60], 100, 10)).toEqual([0, 3]);
  });
  it('gives a row taller than the box a page of its own', () => {
    expect(packRows([200, 50], 100, 10)).toEqual([0, 1]);
  });
  it('is one page when everything fits or there is nothing', () => {
    expect(packRows([20, 20], 100, 10)).toEqual([0]);
    expect(packRows([], 100, 10)).toEqual([0]);
  });
  it('finds the page of an item from the page starts', () => {
    expect(pageIndexOf(0, [0, 3, 6])).toBe(0);
    expect(pageIndexOf(2, [0, 3, 6])).toBe(0);
    expect(pageIndexOf(3, [0, 3, 6])).toBe(1);
    expect(pageIndexOf(99, [0, 3, 6])).toBe(2);
    expect(pageIndexOf(-1, [0, 3, 6])).toBe(0);
  });
});
