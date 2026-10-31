// Words of a cell: accents stripped, lower-cased, split on anything that is not a letter or digit.
export function tokenize(text) {
  if (text == null) return [];
  return String(text)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}
