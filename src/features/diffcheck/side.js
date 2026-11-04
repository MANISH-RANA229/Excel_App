import { columnIndex } from '../../core/dataset/dataset.js';

/** One side of a Diff Check run: a dataset plus the compared column and the carry-along columns. */
export const makeSide = (ds, column, carry = []) => ({
  ds,
  dataset: ds,
  column,
  col: columnIndex(ds, column),
  carry,
  carryCols: (carry || []).map((c) => columnIndex(ds, c)),
});

export const sideText = (side, r) => {
  const d = side?.ds || side?.dataset;
  if (!d || !d.text || side.col < 0 || !d.text[side.col]) return '';
  return d.text[side.col][r] ?? '';
};

export const carryText = (side, k, r) => {
  const d = side?.ds || side?.dataset;
  if (!d || !d.text || !side.carryCols || side.carryCols[k] == null || side.carryCols[k] < 0) return '';
  return d.text[side.carryCols[k]]?.[r] ?? '';
};
