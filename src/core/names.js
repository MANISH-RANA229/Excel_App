// Names that Excel and Windows will actually accept (sheet tabs, files inside a zip).

const SHEET_ILLEGAL = /[\\/?*[\]:]/g;
const FILE_ILLEGAL = /[<>:"/\\|?*\u0000-\u001f]/g;
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
export const SHEET_NAME_MAX = 31;
const FILE_BASE_MAX = 120;

/** Adds " (2)", " (3)" … until `name` is unique (case-insensitive) in `taken`, staying within `max`, and records it. */
export function uniqueName(name, taken, max = Infinity) {
  let candidate = name.slice(0, max);
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) {
    const suffix = ` (${n})`;
    candidate = name.slice(0, max - suffix.length) + suffix;
  }
  taken.add(candidate.toLowerCase());
  return candidate;
}

export function safeSheetName(name, taken = new Set()) {
  let n = String(name ?? '').replace(SHEET_ILLEGAL, ' ').replace(/\s+/g, ' ').trim().replace(/^'+|'+$/g, '');
  if (!n) n = 'Sheet';
  if (n.toLowerCase() === 'history') n += '_'; // reserved by Excel
  return uniqueName(n, taken, SHEET_NAME_MAX);
}

/** `ext` includes the dot ('.xlsx'). Returns a name that is legal on Windows and unique within `taken`. */
export function safeFileName(name, { ext = '', taken = new Set() } = {}) {
  let base = String(name ?? '').replace(FILE_ILLEGAL, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
  if (!base) base = 'file';
  if (WINDOWS_RESERVED.test(base)) base = `_${base}`;
  base = base.slice(0, FILE_BASE_MAX);
  let candidate = `${base}${ext}`;
  for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} (${n})${ext}`; // suffix goes before the extension
  taken.add(candidate.toLowerCase());
  return candidate;
}
