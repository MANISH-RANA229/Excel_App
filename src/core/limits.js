// One place for every size/safety limit. Tuned from measured memory and time (see Phase 6), not guessed.

export const EXCEL_MAX_ROWS = 1_048_575; // data rows per sheet, header excluded
export const WARN_CELLS = 2_000_000; // above this: warn that tools will be slower
export const MAX_CELLS = 8_000_000; // above this: refuse to load (rows × columns)
export const MAX_FILE_MB = 200;
export const MAX_PASTE_MB = 5; // pasted text above this: ask the user to save a file instead (a text box is not for big data)
export const MAX_GROUPS_WARN = 500; // Split: warn about this many output files/sheets
export const MAX_GROUPS = 5000; // Split: refuse more than this
export const GRID_PAGE_SIZE = 50;
