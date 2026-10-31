// Which column could identify a row? Used for the "primary key candidate" line on the Files page and Compare by Key's default pick.

export const KEY_HINT = /(^|\W|_)(id|ref|reference|code|key|no|number|sku|email|invoice|account)(\W|_|$)/i;

const isUnique = (col) => {
  const seen = new Set();
  for (const v of col) {
    const key = v.trim();
    if (key === '' || seen.has(key)) return false; // stops at the first repeat or blank, so non-keys are cheap
    seen.add(key);
  }
  return true;
};

/** Name of the first column whose cells are all filled and all different (id-like names win), or null. */
export function keyCandidate(ds) {
  if (!ds.rowCount) return null;
  const find = (hinted) => ds.columns.find((name, c) => KEY_HINT.test(name) === hinted && isUnique(ds.text[c]));
  return find(true) ?? find(false) ?? null;
}
