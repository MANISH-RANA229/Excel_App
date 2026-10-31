// Dates as Excel serial numbers, computed with UTC arithmetic only — no JS Date in local time, so the same
// input gives the same serial in any time zone.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EPOCH = 25569; // Excel serial of 1970-01-01 (1900 date system)

export const DATE_FORMATS = ['dd-mmm-yyyy', 'yyyy-mm-dd', 'dd/mm/yyyy', 'mm/dd/yyyy'];

export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const valid = (y, m, d) => y >= 1900 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
const fullYear = (yy) => (yy >= 100 ? yy : yy < 30 ? 2000 + yy : 1900 + yy); // Excel's rule: 00–29 → 20xx, 30–99 → 19xx
const monthOf = (name) => MONTHS.indexOf(name.slice(0, 3).toLowerCase()) + 1; // 0 when not a month name

export const toSerial = (y, m, d) => Date.UTC(y, m - 1, d) / 86400000 + EPOCH;

export function fromSerial(serial) {
  const dt = new Date(Math.round((serial - EPOCH) * 86400000));
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}

const pad = (n) => String(n).padStart(2, '0');

/** Display text for a serial in one of DATE_FORMATS. */
export function formatSerial(serial, format = 'dd-mmm-yyyy') {
  const { y, m, d } = fromSerial(serial);
  switch (format) {
    case 'yyyy-mm-dd': return `${y}-${pad(m)}-${pad(d)}`;
    case 'dd/mm/yyyy': return `${pad(d)}/${pad(m)}/${y}`;
    case 'mm/dd/yyyy': return `${pad(m)}/${pad(d)}/${y}`;
    default: return `${pad(d)}-${MONTH_ABBR[m - 1]}-${y}`;
  }
}

const TIME_TAIL = /[\sT]+\d{1,2}:\d{2}(?::\d{2})?(?:\.\d+)?\s*(?:am|pm)?(?:\s*(?:z|utc|[+-]\d{2}:?\d{2}))?$/i;

/**
 * @param {unknown} input
 * @param {{ dayFirst?: boolean }} [opts]  how to read 05/03/2026 when both parts could be the month (default: day first)
 * @returns {{ serial: number, ambiguous: boolean } | null}  null when the text is not clearly a date
 */
export function parseDate(input, { dayFirst = true } = {}) {
  const s = String(input ?? '').trim().replace(/\s+/g, ' ').replace(TIME_TAIL, '').replace(/(\d)(?:st|nd|rd|th)\b/gi, '$1').trim();
  if (!s) return null;
  const done = (y, m, d, ambiguous = false) => (valid(y, m, d) ? { serial: toSerial(y, m, d), ambiguous } : null);
  let r;

  if ((r = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s))) return done(+r[1], +r[2], +r[3]); // 2026-03-05
  if ((r = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return done(+r[1], +r[2], +r[3]); // 20260305

  if ((r = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/.exec(s))) { // 05/03/2026 or 03/05/26
    const [a, b, y] = [+r[1], +r[2], fullYear(+r[3])];
    if (a > 12) return done(y, b, a); // only day-first can be right
    if (b > 12) return done(y, a, b); // only month-first can be right
    return dayFirst ? done(y, b, a, a !== b) : done(y, a, b, a !== b);
  }

  if ((r = /^(\d{1,2})[ \-/.]([A-Za-z]{3,9})\.?[ \-/.,]*(\d{2}|\d{4})$/.exec(s))) { // 5 Mar 2026, 05-Mar-26, 5 March 2026
    const m = monthOf(r[2]);
    return m ? done(fullYear(+r[3]), m, +r[1]) : null;
  }
  if ((r = /^([A-Za-z]{3,9})\.?[ \-/.]+(\d{1,2})[ \-/.,]+(\d{2}|\d{4})$/.exec(s))) { // Mar 5, 2026
    const m = monthOf(r[1]);
    return m ? done(fullYear(+r[3]), m, +r[2]) : null;
  }
  return null;
}

// ---------------------------------------------------------------- calendar arithmetic (Column Builder)
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const monthName = (m) => MONTH_NAMES[m - 1];
export const weekdayName = (w) => WEEKDAY_NAMES[w];

/** 0 = Sunday … 6 = Saturday (Excel's WEEKDAY minus 1). */
export const weekdayOf = (serial) => (((Math.floor(serial) - 1) % 7) + 7) % 7;

/** ISO 8601 week: { year, week } — the week belongs to the year that holds its Thursday, so 3 Jan 2021 is week 53 of 2020. */
export function isoWeek(serial) {
  const { y, m, d } = fromSerial(serial);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const year = date.getUTCFullYear();
  return { year, week: Math.ceil(((date - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7) };
}

/** Same day n months later (earlier when negative); the day is cut back to the end of a shorter month: 31 Jan + 1 = 28/29 Feb. */
export function addMonths(serial, n) {
  const { y, m, d } = fromSerial(serial);
  const index = y * 12 + (m - 1) + n;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return toSerial(year, month, Math.min(d, daysInMonth(year, month)));
}
export const monthStart = (serial) => { const { y, m } = fromSerial(serial); return toSerial(y, m, 1); };
export const monthEnd = (serial) => { const { y, m } = fromSerial(serial); return toSerial(y, m, daysInMonth(y, m)); };

/** Working days (Mon–Fri) from a to b, both days counted, like Excel's NETWORKDAYS; negative when b is before a. */
export function workdaysBetween(a, b) {
  const from = Math.floor(a);
  const to = Math.floor(b);
  if (to < from) return 0 - workdaysBetween(to, from); // "0 -" so that no zero comes out as -0
  const weeks = Math.floor((to - from + 1) / 7);
  let count = weeks * 5;
  for (let s = from + weeks * 7; s <= to; s++) { const w = weekdayOf(s); if (w !== 0 && w !== 6) count++; }
  return count;
}

/** The date n working days after (before, when negative) the start, like Excel's WORKDAY. */
export function addWorkdays(serial, n) {
  let s = Math.floor(serial);
  const step = n < 0 ? -1 : 1;
  for (let left = Math.abs(n); left > 0;) { s += step; const w = weekdayOf(s); if (w !== 0 && w !== 6) left--; }
  return s;
}

/** Whole months from a to b (negative when b is before a): 31 Jan → 29 Feb is 0, 15 Jan → 15 Mar is 2. Excel's DATEDIF "m". */
export function completeMonths(a, b) {
  if (b < a) return 0 - completeMonths(b, a);
  const from = fromSerial(a);
  const to = fromSerial(b);
  return (to.y - from.y) * 12 + (to.m - from.m) - (to.d < from.d ? 1 : 0);
}
