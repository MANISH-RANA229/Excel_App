// Typed errors: every failure the user can see has a code, a plain-language message and a next step.
// Technical detail travels separately (`detail`) and is only shown behind "Technical details".

const MESSAGES = {
  FILE_UNSUPPORTED: ['This file type is not supported.', 'Use a .xlsx, .xls or .csv file.'],
  FILE_ENCRYPTED: ['This file is password-protected.', 'Remove the password in Excel, save a copy and load that copy.'],
  FILE_CORRUPT: ['This file could not be read. It may be damaged.', 'Open it in Excel, save it as .xlsx and try again.'],
  FILE_EMPTY: ['There is no data in this sheet.', 'Choose another sheet or check the header row.'],
  TOO_LARGE: ['This sheet is too large to process in the browser.', 'Remove unused columns or split the file, then load it again.'],
  NO_HEADER: ['No header row was found.', 'Set the header row manually on the file card.'],
  BAD_CONFIG: ['Some settings need attention.', 'Fix the highlighted fields and run again.'],
  NO_RESULT: ['Nothing to show for these settings.', 'Try different columns or a lower threshold.'],
  EXPORT_FAILED: ['The Excel file could not be created.', 'Try again, or export fewer rows.'],
  WORKER_CRASH: ['The background process stopped unexpectedly.', 'Try again. If it keeps happening, use a smaller file.'],
  CANCELLED: ['Cancelled.', ''],
  UNKNOWN: ['Something went wrong.', 'Try again.'],
};

export const ErrorCode = Object.fromEntries(Object.keys(MESSAGES).map((k) => [k, k]));

export class AppError extends Error {
  constructor(code, { message, hint, detail } = {}) {
    const [defMessage, defHint] = MESSAGES[code] ?? MESSAGES.UNKNOWN;
    super(message ?? defMessage);
    this.name = 'AppError';
    this.code = MESSAGES[code] ? code : 'UNKNOWN';
    this.hint = hint ?? defHint;
    this.detail = detail ?? '';
  }
}

/** Wraps anything thrown into an AppError (AbortError becomes CANCELLED). */
export function toAppError(e) {
  if (e instanceof AppError) return e;
  if (e?.name === 'AbortError') return new AppError('CANCELLED');
  return new AppError('UNKNOWN', { detail: e?.stack?.split('\n').slice(0, 3).join(' | ') || e?.message || String(e) });
}

// Errors cross the worker boundary as plain objects.
export function serializeError(e) {
  const { code, message, hint, detail } = toAppError(e);
  return { code, message, hint, detail };
}

export const reviveError = ({ code, message, hint, detail }) => new AppError(code, { message, hint, detail });
