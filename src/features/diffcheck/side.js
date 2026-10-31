import { columnIndex } from '../../core/dataset/dataset.js';

/** One side of a Diff Check run: a dataset plus the compared column and the carry-along columns. */
export const makeSide = (ds, column, carry) => ({
  ds,
  column,
  col: columnIndex(ds, column),
  carry,
  carryCols: carry.map((c) => columnIndex(ds, c)),
});

export const sideText = (side, r) => side.ds.text[side.col][r];
export const carryText = (side, k, r) => side.ds.text[side.carryCols[k]][r];
