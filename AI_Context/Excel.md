# Excel App — full project context for AI assistants

> Give this file to an AI at the start of a new session. It records what the app is, every decision made and why, how the
> code is organised, how it was verified, what is NOT done, and the traps already hit. Written at the end of the first
> long build session; last updated **2026-11-11** (3D landing page, dark theme for the whole app, new logo, UI bug sweep:
> see section 14). Project root: `M:\Excel_App`, a git repo (GitHub user MANISH-RANA229; work branch `AntiGravity`, main
> branch `main`). Older notes below mention `C:\My Work\Excel_App`: same project, earlier location. Owner: Manish (Manish.r@nrsconsulting.in).

---

## 1. What the app is

A **frontend-only React app** (no backend, JS only) for working with spreadsheets entirely in the browser. Files never leave
the device. The default route (`#/`) is a 3D scroll-driven landing page; "Open the app" goes to the Files page (`#/files`). The user loads up to two Excel/CSV files, picks a tool, configures it, previews results in a compact grid and
downloads a colour-coded `.xlsx` (or `.zip`).

Ten tools, in sidebar categories:

| Category | Tool | Files needed (`needs`) |
|---|---|---|
| Compare & match | **Diff Check** — best match in Excel 2 for every Excel 1 row, word-based % | 2 |
| Compare & match | **Fuzzy Lookup / Merge** — fuzzy VLOOKUP, pulls Excel 2 columns into Excel 1 | 2 |
| Compare & match | **Compare by Key** — exact old/new comparison by an ID column: added, removed, changed (old → new per cell) | 2 |
| Compare & match | **Reconcile** — ledger vs bank by reference/amount/date | 2 |
| Clean | **Duplicate Finder** — exact or similar duplicates, review, clean/mark | 1 |
| Clean | **Data Cleaner** — trim, text→number, text→date, case, replace, fill, drop empties | 1 |
| Organize | **Split by Column** — one file/sheet per value (ZIP or one workbook) | 1 |
| Organize | **Column Builder** — add formula-free columns: join/split/extract text, calculate, date parts and differences, IF rules, ranges, ranks, numbering | 1 |
| Organize | **Combine Files** — stack many files / many sheets into one sheet, columns matched by header name | 0 (own file list) |
| Organize | **Summarize** — group & total / cross-tab (no pivot table), columns → rows (unpivot), transpose | 1 |

The original brief: "Excel App", first tool DiffCheck (pick 2 columns, compare row-by-row by words), output Excel with the two
texts, match % and colours (green ≥90 … red 0). Later asked for a compact professional **Excel-green** UI with a global header
and sidebar, then five more tools on a shared, component-based architecture with proper loaders and error handling,
designed for ~500k-row files and future tools.

## 2. How to run

```
npm run dev       # dev server (Vite). Workers' heavy deps are pre-declared in vite.config.js optimizeDeps
npm run build     # production build -> dist/
npm run preview   # serve dist (we used port 4173)
npm run check     # runs EVERY src/**/*.check.js (plain assert scripts), see scripts/check.mjs; optional filter: npm run check reconcile
```
Last state: `npm run check` → **49 check files pass**, `npm run build` OK. `npm audit --omit=dev` → 0 vulnerabilities.
(Filter note: `npm run check name` matches against the Windows path, so use a plain word like `render`, not `export/render`.)

## 3. Stack and decisions (with the reason)

- **Vite 8 + React 19 (JS, no TS)**. Production deps: `react`, `react-dom`, `primereact`, `lucide-react`, `xlsx`.
  Dev deps: `vite`, `@vitejs/plugin-react`, `exceljs`, `jszip` (**tests only**: independent readers of what we write).
- **PrimeReact pinned to 10.9.9 (MIT).** v11 switched to a commercial "PrimeUI" licence needing a key (free only for tiny orgs).
  **Do not upgrade to 11+ without asking.**
- **SheetJS `xlsx` 0.20.3** installed from `https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (npm's copy is stale/vulnerable).
  Used only to READ, only inside the read worker (dynamic import). SheetJS CE cannot write cell styles.
- **Unified Design System & Component Library (`src/theme/`, `src/components/ui/`)**:
  Form controls and UI elements are wrapped in a central reusable library in `src/components/ui/index.js` (`Button`, `Dropdown`, `Select`, `InputText`, `Input`, `Checkbox`, `SelectButton`, `SegmentedControl`, `MultiSelect`, `NumberStepper`, `NumberInput`, `Badge`, `Card`).
  **Rule**: All tools and shared components import from `components/ui/`, never from raw vendor packages directly. If UI styling, accessibility, or behaviour needs to change in the future, changing the component file in `src/components/ui/` updates the entire suite immediately.
  Tokens live in `src/theme/tokens.js` and `src/theme/theme.css` (`--xl-green`, `--xl-green-dark`, `--xl-green-soft`, `--text`, `--radius: 7px`, `--radius-lg: 7px`).
- **Theme / design system (changed 2026-11-11: dark, matching the landing page)**: near-black green-tinted surfaces (`--bg #0a0e0c`,
  cards `--surface #121815`, menus/dialogs `--surface-elevated #171e1b`), one accent: Excel green. Two greens on purpose:
  `--xl-green #15804a` is a **fill** (buttons, white text on it passes AA) and `--accent #3ccf87` is green **text/icons** on dark.
  Tinted chips use `--xl-green-tint` (bg) + `--xl-green-soft` (border) + `--xl-green-dark` (text, a light green despite the name).
  Fonts **Geist** + **Geist Mono** (variable, bundled via `@fontsource-variable/geist` / `geist-mono`, so the app still makes no CDN requests;
  Inter was removed). Mono is used for anything that is a cell reference, count, figure or small label. PrimeReact **Fluent** theme
  (`fluent-light`, kept for its compact Office density) is re-pointed at the app's CSS variables by the Vite plugin in `vite.config.js`
  (section 14). Base font-size 14px (`html { font-size: 14px }`). **Dark theme only** (no light/dark switch). Icons: `lucide-react` only
  (no emoji). Product name: "Excel Suite" + PRO tag; logo = `components/brand/Logo.jsx`.
- **Corner radius limit**: Maximum 7px radius on all cards, dialogs, buttons, inputs, chips, tables (`--radius: 7px; --radius-lg: 7px;`). Only round dots, radios, and slider handles stay 50%.
- **No ExcelJS in the app.** ExcelJS's browser build exports only the in-memory `Workbook`; its streaming writer needs Node's
  `archiver`/`fs`, and the in-memory writer needs >1 GB for 500k rows. So export uses a **custom OOXML writer + streaming ZIP
  writer** (section 6). ExcelJS remains a devDependency purely to read files back in checks.
- **Dates are Excel serial numbers + a number format, never JS `Date`.** SheetJS 0.20.3 has no UTC option, so `Date` objects shift
  by a day when written back in IST. Verified timezone-independent (checks run under Asia/Kolkata, America/Los_Angeles, UTC).
- **Target size ≈ 500k rows** (user's answer). Hence columnar data, typed-array results, workers for everything heavy, lazy
  presentation (only visible rows are materialised).
- **Diff Check was refactored onto the shared platform** with golden-file regression checks (user approved). Its results are
  byte-identical to the original engine (see section 9).
- Output of Diff Check = **Top-K matches per Excel 1 row** (K 1–10), not full n×m (n×m can exceed Excel's 1,048,575 row limit);
  plus an "Unmatched in Excel 2" sheet. Sheets longer than the Excel limit now continue on `Name (2)` instead of erroring.

## 4. Architecture rules (keep following these)

1. **Pure core, thin UI.** Logic lives in `src/core/**` as plain functions (no React/DOM); testable in Node, runs unchanged in workers.
2. **Anything heavy runs in a Web Worker** behind one protocol: file parsing, every engine, export.
3. **Compact data, lazy presentation.** Datasets are columnar; engines return index-based typed arrays; word diffs/labels/rows are
   derived only for visible or exported rows.
4. **A tool is a plugin**: one folder + one manifest line in `src/features/index.js`.
5. **Declarative over imperative**: Cleaner operations, Reconcile passes, export specs, keep-rules are registries/specs.
6. **Typed errors at every boundary; honest progress** (ETA only when real).
7. **Strict defensive UI presentation**: Result components (`*Results.jsx`) must safely access context, datasets, row numbers, and totals using optional chaining (`?.`) and fallbacks (`(a?.ds || a?.dataset)?.fileName ?? 'Excel 1'`) so incomplete or unexpected worker states never crash the view.
8. **UI component abstraction**: Never import raw vendor form controls directly in feature pages; import from `src/components/ui/index.js`.

### Adding a new tool (checklist)
Create `src/features/<id>/` with: `index.js` (manifest `{ id, title, description, icon, category: 'compare'|'clean'|'organize', needs: 1|2, Component: lazy(() => import('./XTool.jsx')) }`),
`XTool.jsx` (uses `useWorkerTask` + `ToolWorkflow`), `XConfig.jsx`, `XResults.jsx`, `engine.js` (pure) + `engine.check.js`, `x.worker.js`
(`defineWorker`), `exportSpec.js` (+ check). Add the manifest to `tools` in `src/features/index.js`. Sidebar, Files page, gating and lazy mount follow automatically.

## 5. File map (src/)

```
theme/                     Design system tokens and styling contracts
  tokens.js                Design tokens (colors, radii, typography, elevation, spacing)
  theme.css                CSS variables derived from tokens.js
  index.js                 Theme entry point exporting tokens and helpers
  tokens.check.js          Contract check verifying tokens integrity and component exports
components/ui/             Unified, accessible UI components (wrapped vendor controls)
  Button.jsx               Theme-aligned button with size/variant/severity props
  Dropdown.jsx / Select.jsx Single-select with standardized small/medium density and label
  InputText.jsx / Input.jsx Text input field with consistent styling and focus states
  Checkbox.jsx             Customized accessible checkbox
  SelectButton.jsx / SegmentedControl.jsx  Segmented toggle control
  MultiSelect.jsx          Multi-value selection dropdown
  NumberStepper.jsx / NumberInput.jsx  Numeric stepper with accessible plus/minus controls
  Badge.jsx                Status badge and counter pill
  Card.jsx                 Surface container adhering to max 7px border radius
  index.js                 Central export barrel for all UI components
components/brand/Logo.jsx  The logo: LogoMark (green tile, sheet grid, selected cell with Excel's fill handle) + Logo (mark + "Excel Suite" + tag).
                           public/favicon.svg is the same drawing: keep them in step.
pages/LandingPage.jsx      Route `#/` / `#/landing` (the default). 3D scroll page; see section 14. Its CSS is src/landing.css (scoped under `.lp`).
pages/landing/scene.js     three.js world (lazy chunk): 36×28 instanced cells, one layout per chapter, camera per chapter, rain, drag-to-turn cube.
pages/landing/content.js   Every chapter's words, stats, formula-bar text (`ref`, `formula`) and which 3D layout (`scene`) it shows.
core/                      pure JS (+ *.check.js beside each module)
  errors.js                AppError(code,{message,hint,detail}); codes FILE_UNSUPPORTED/ENCRYPTED/CORRUPT/EMPTY, TOO_LARGE, NO_HEADER, BAD_CONFIG,
                           NO_RESULT, EXPORT_FAILED, WORKER_CRASH, CANCELLED, UNKNOWN; serializeError/reviveError/toAppError
  limits.js                EXCEL_MAX_ROWS 1,048,575 · WARN_CELLS 2M · MAX_CELLS 8M · MAX_FILE_MB 200 · MAX_GROUPS_WARN 500 · MAX_GROUPS 5000 · GRID_PAGE_SIZE 50
  format.js                formatDuration (ms under 1 s, "4.1 s", "2 min 5 s"), formatCount, estimateEta (needs ≥3% and ≥1 s into the step)
  names.js                 safeSheetName (31 chars, illegal chars, reserved "History", case-insensitive unique), safeFileName (Windows reserved, suffix before ext), uniqueName
  bands.js                 BANDS (≥90 green, 70–89 light green, 50–69 yellow, 1–49 orange, 0 red; Excel Good/Neutral/Bad colours), bandIndex, getBand, bandRange, summarize (typed)
  dataset/dataset.js       columnar Dataset + accessors (columnIndex, columnTexts, getText, rowPreview, sampleValues, cellForExport, isDateFormat)
  dataset/fromSheet.js     SheetJS dense sheet -> Dataset; header auto-detect (detectHeaderIndex); drops blank rows; keeps real Excel row numbers
  group/groupRows.js       groupRows(values,{ignoreCase,blankLabel}) -> {labels,counts,offsets,order,blankGroup} (CSR groups, first-appearance order); Split and Summarize
  dataset/sniff.js         file-signature check (xlsx must be ZIP "PK"; xls OLE/ZIP/XML-HTML; csv no binary NULs unless UTF-16 BOM; 0 bytes -> FILE_EMPTY)
  parse/number.js          parseAmount (₹/$/Rs, Indian & western grouping, (500), trailing minus, decimal comma; NaN when unsure, never guesses), looksLikeStoredNumber,
                           cellNumber(col{text,nums}, r, opts) = stored number else parseAmount(text) (Summarize)
  parse/date.js            parseDate ({serial, ambiguous}|null; ISO, d/m/y, month names, yyyymmdd, times ignored), toSerial/fromSerial/formatSerial (UTC math), DATE_FORMATS
  text/tokenize.js, fuzzy.js, similarity.js, normalize.js   see section 7
  text/keys.js             buildKeys(keyColumns, normalizeOpts): one normalised key per row (null when all key cells blank); shared by Duplicates and Compare by Key
  export/spec.js           WorkbookSpec helpers (datasetColumn, textColumn, numberColumn, stylePalette)
  export/xlsx.js           renderWorkbook / renderZip (custom OOXML writer)       export/zip.js  streaming ZIP writer (native deflate)
  export/derive.js         derived columns computed inside the export worker (wordDiff, pairText)
  columns/operations.js    Column Builder registry (ops/text.js, number.js, date.js, logic.js, sequence.js; contract documented at the top of ops/text.js)
  columns/pipeline.js      runColumns (steps build on earlier steps' new columns), stepProblem, outputNames (unique names), displayText; conditions.js = IF-rule tests; testkit.js = helpers for the checks
  clean/operations.js      Data Cleaner operation registry     clean/pipeline.js  runPipeline, scanIssues, suggestionsFrom, previewSteps, tableFromDataset
workers/
  defineWorker.js          worker side of the protocol; withTransfer(); throttles progress to ≤20/s
  readWorkbook.worker.js   probe (sheet names + dimensions, size guards) then parse only the chosen sheet -> Dataset
  exportWorkbook.worker.js renders an ExportSpec to a Blob (xlsx or zip)
hooks/
  useWorkerTask.js         one job at a time in a Worker: status/progress/elapsedMs/etaMs/result/error/start/cancel/reset
  useGrid.js               filter/sort/page over Int32Array row indexes
  useHashRoute.js          [routeId, navigate(id,{replace})] from the URL hash (#/diffcheck); no router dependency. App.jsx turns it into the
                           page via resolveRoute (features/index.js: unknown id or files-not-loaded -> Files, URL corrected in place);
                           tools stay mounted-but-hidden after the first visit (keep-alive), each tool is its own lazy chunk behind Suspense + ToolSkeleton
shared/                    React components used by all tools
  JobProgress.jsx (card|inline|dialog variants), JobDialog.jsx, ErrorNotice.jsx, ErrorBoundary.jsx, ToastProvider.jsx (useToast),
  ToolWorkflow.jsx (config -> running -> results shell), ToolSkeleton.jsx, FileDropCard.jsx, DataPreview.jsx, download.js
  fields/  ColumnField (clearable), ColumnMultiField, SourcePicker(+useSource), ThresholdField, NumberInput (names the ± buttons for screen readers),
           OptionFields (renders an operation's `fields`: select/text/number/checkbox/pairs + column/columns/conditions; used by Cleaner and Column Builder)
  results/ GridTable, KpiStrip, StatusChips, BandTag, WordBreakdown (HighlightedText, highlightSets), ExportButton,
           ResultGrid (a computed table {rowCount, columns: ColumnSpec[]} as a searchable/sortable grid; Summarize, Combine, Column Builder)
layout/    AppShell (builds the breadcrumb `crumbs` from the active route + the phase the tool reported), GlobalHeader (brand, breadcrumb, privacy chip) + HeaderSearch (jump-to-tool box, Ctrl/⌘+K), Sidebar (grouped by category, drawer under 900px, badge/hint chips, "Storage: In-Memory" = size of the two loaded files), PageHeader (title, optional badge, subtitle, actions)
pages/     InfoPage.jsx = "How Excel Suite works" (route `#/info`, opened by the "i" link at the right end of GlobalHeader; lazy chunk; sticky contents + scrollspy, per-tool `<details>` guides built from the `tools` registry). Its words live in `pages/info/content.js` (plain language, `content.check.js` rejects jargon and fails when a tool has no guide) and the worked example in `pages/info/example.js` (run through the real engine; the check pins its result). Add a guide there when you add a tool.
           FilesPage.jsx = home page "Files & Spreadsheets": two big FileDropCards (tag, sheet + header-row bar, preview, "primary key candidate" footer), Swap files / Add file (fills the first free slot via the card's `ref.open()`), ToolPicker, quick pre-processing shortcuts (Duplicate Finder, Data Cleaner)
features/  index.js (registry: CATEGORIES {title for sidebar, tab for Files page}, tools, isReady, needsHint; optional manifest fields `cta`, `badge`, `recommend(datasets)`), ToolPicker.jsx (category tabs + cards; "Recommended" when `recommend` returns a note), diffcheck/, keycompare/, lookup/, reconcile/, duplicates/, cleaner/, split/, summarize/, combine/, colbuilder/
App.jsx / main.jsx / styles.css     (main.jsx wraps App in PrimeReactProvider > ToastProvider > ErrorBoundary)
```
Other files: `vite.config.js` (theme colour plugin, worker format es, optimizeDeps include exceljs/jszip/xlsx), `scripts/check.mjs`, `index.html`, `public/favicon.svg`.

## 6. Platform internals worth knowing

### Dataset (columnar, typed)
`{ id, fileName, sheet, headerRow, columns[], rowCount, rowNums:Uint32Array (real Excel row numbers), text:string[][] (display text, text[c][r]),
nums:(Float64Array|null)[] (numeric value or NaN; dates = Excel serials), formats:(string|null)[] (Excel number format per column) }`.
`id` (uuid) changes on every (re)load; tools reset when it changes. CSV cells are never numeric (raw parse), so `00123` stays text.
Whitespace in cell text is preserved (the Cleaner needs it); blank rows are dropped, header row auto-detected (title rows above the table are skipped; user can override the "Header row" number on the file card).

### Reading a file (worker)
Probe with `sheetRows:1` (names + `!fullref` dims) -> refuse > MAX_CELLS (before the expensive parse) -> parse only the chosen sheet
with `{dense, cellNF, cellText, cellStyles:false, cellFormula:false, cellHTML:false}` -> `datasetFromSheet`. `sniffFormat` runs first.
Progress stages: Reading file -> Scanning sheets -> Building columns. Changing sheet/header row re-parses from the kept `File` (header edits debounced 500 ms).
App state per file slot: `{ file, sheetNames, dims, warnings, dataset }`; file cards update the list with functional `setFiles(prev => …)` (a stale-closure race was found and fixed).

### Job protocol
main→worker `{type:'run', payload}`; worker→main `{type:'progress', fraction|null, stage, step, steps, processed, total}` · `{type:'done', result}` · `{type:'error', error}`.
Cancel = `worker.terminate()`. Worker `onerror`/`onmessageerror` -> `WORKER_CRASH`. Typed arrays are transferred with `withTransfer(result,[buffers])`.
`JobProgress` fades in after 150 ms (no flash), uses transform-only animation, shows step trail, `processed/total`, elapsed and "about N s left" only when estimable.

### Export pipeline (one path for every tool)
Tools build a **WorkbookSpec** on the main thread without copying data; `ExportButton` sends it to the export worker behind a cancellable `JobDialog`; the worker returns a Blob; `downloadBlob`.
- ExportSpec = `{ fileName, workbook }` or `{ fileName, zip: [{ name, workbook }] }`; WorkbookSpec = `{ sheets }`;
  SheetSpec = `{ name, rowCount, columns, styles?, freezeHeader?, autoFilter? }`; ColumnSpec = `{ header, text?, nums?, rows?, numFmt?, width?, styleIds?, derive? }`.
- Value of output row i: `s = rows ? rows[i] : i`; `s < 0` → blank; numeric if `nums[s]` is a number, else `text[s]` (`''` = truly empty cell). `styleIds[i]` = palette index (1-based, 0 = none).
- `derive: { kind, … }` computes values inside the worker (Diff Check's four word columns and "matched text/label") so 500k extra strings are never built.
- `xlsx.js` writes inline strings, number formats, solid fills, bold/coloured fonts, column widths, frozen header, auto-filter over the whole data range; strings cut at 32,767 chars; control chars stripped; text starting with `=` stays text; sheet > 1,048,575 rows continues on `Name (2)`.
- `zip.js` streams entries through `CompressionStream('deflate-raw')` with data descriptors; no zip64 (each entry/archive < 4 GB).
- Measured: 500k rows × 8 columns with fills → **4.3 s**, 19.5 MB, in a real browser worker; 100k × 6 in ~0.4 s in Node.

### Results grid
`GridTable` takes `count`, `getRow(i)`, `columns`, `accept`, `filterKey`, `rowsKey`, `sorters`, `expansion`, `headerGroup`, `toolbar` and renders a lazy PrimeReact DataTable page (50 rows) from an index view. `rowsKey` must change when edited cell state changes without the data changing (Split names/checkboxes, Duplicates decisions). Sort ~85 ms and page change ~55 ms at 200k rows.

## 7. Matching engine (shared) — `core/text/*`

Score = cosine similarity of TF-IDF word vectors: word order and case ignored, rare words weigh more (idf = sqrt(log(1+N/df)), pure numbers ×0.5), one-letter typos match at ×0.85 (delete-1 neighbour lookup + optimal-string-alignment ≤1; only words ≥4 chars without digits).
Built for scale: word ids, CSR docs/postings in typed arrays; a query row only visits target rows sharing an *informative* word (posting list ≤ `maxPostings = max(2000, nTargets/100)`); very common words are scored exactly only for candidates already found (binary search in postings); a row with only common words falls back to its rarest word. With default settings and ≲200k rows nothing is pruned (equals an exhaustive scan). `createSimilarityIndex(queries, targets)`; `index.query(i,{topK,min,skipSelf},out)`; pass the same array for both to compare a column with itself. `explainPair(a,b)` = lazy word breakdown (matched / typo pairs / only-in-A / only-in-B).
`runDiff` output is columnar: `{ n, a, b(−1 = none), pct, rank, unmatchedB }` (typed arrays); an unmatched Excel 1 row still gets one entry (b=−1, pct=0, rank=1).

## 8. The tools — behaviour and key decisions

- **Diff Check** (`features/diffcheck`): config = column per file (auto-picks a same-named column), optional carry-along columns, matches per row. Results: KPI strip + band chips (filters), compact grid with grouped header (Excel 1 | Excel 2), highlighted words (green match, amber typo), expandable row with `WordBreakdown`, search, "Best match only". Export sheets: Results, Summary, Unmatched in Excel 2.
- **Fuzzy Lookup** (`features/lookup`): Excel 1 = main table, Excel 2 = reference; pick key per file, columns to pull (≥1, keep their formats), min % (default 80). Status per row: **Matched / Ambiguous** (runner-up within 5 points and ≥ threshold — a plain VLOOKUP would silently pick one) **/ Not found** (nearest row still shown). Export: Merged (all Excel 1 columns typed + `Excel2: …` columns + Match % + Status, coloured), Unused reference rows, Summary.
- **Duplicate Finder** (`features/duplicates`): key column(s); mode exact (ignore case/spaces/punctuation toggles; blank keys never match) or similar (threshold 60–99, topK 20 neighbours per row, union-find; reports the weakest link of each group); keep rule first/last/most complete (registry). Results: groups grid, expand a group to choose a different row to keep, tick "Not duplicates", output = remove (Cleaned, Removed duplicates, Duplicate groups, Summary) or mark (All rows with Status/Duplicate group). Decisions logic is pure (`decisions.js`).
- **Data Cleaner** (`features/cleaner`, ops in `core/clean/operations.js`): scans every cell on open and suggests fixes ("5 dates in “Date” are stored as text" → Add fix / Add all), ordered steps with per-op options, live preview on the first 500 rows, runs in a worker, change log capped at 100k entries (counts exact), optional yellow highlight of changed cells. Ops: trim & collapse spaces, remove invisible chars, change case, find & replace, text→number (never converts `00123`-style codes or unclear text; counted as "left as they were"), add leading zeros (result is text), text→date (day-first default; ambiguity counted), fill blanks, remove empty columns/rows (applied last). Op contract: `apply` returns undefined (nothing) / null (could not) / string / `{text,num,format,note}`.
- **Split by Column** (`features/split`): groups by one column (case/space-insensitive by default, blanks = "(Blank)"), results grid with include/exclude and editable names, output ZIP of workbooks (+ `_summary.xlsx`) or one workbook with a sheet per value; typed values/formats/widths preserved; > 500 groups warns, > 5000 refuses.
- **Reconcile** (`features/reconcile`): per file: reference column (optional), amount = one column OR debit+credit (net = credit − debit), optional date; options: line-by-line or **total per reference**, tolerance, ignore sign, decimal mark, date window (days) + day-first, "also try" amount&date alone (marked Probable) and similar references. Column guesses from headers (`guessColumns`). Ordered passes, each on rows earlier passes left open (so one-to-one): 1 same reference & amount → 2 same reference, different amount (DIFFERENCE) → 3 similar reference & amount (optional) → 4 amount & date (PROBABLE, scan capped at 500 equal-amount candidates). Sum mode adds all lines per reference then compares totals. Statuses: Matched, Matched·similar, Probable, Amount difference, Only in Excel 1/2. KPIs include **Unreconciled = ΣExcel 1 − ΣExcel 2**. Export: Matched, Differences, Only in Excel 1, Only in Excel 2 (with all original columns), Difference lines (sum mode), Summary. References are compared by letters+digits only ("INV-001" = "inv 001").

- **Compare by Key** (`features/keycompare`): Excel 1 = old, Excel 2 = new. Key = one or more column pairs (Excel 1 column ↔ Excel 2 column, auto-picks a same-named id-like column); compared columns = columns with the same header in both files (matched ignoring case/spaces/punctuation), untick to skip; none = "in A but not in B" only. Statuses: **Unchanged / Changed / Added (only in Excel 2) / Removed (only in Excel 1)**. A key that repeats is paired by occurrence (1st with 1st…); rows with an all-blank key never match (listed as Added/Removed, counted). Cell equality: numbers as numbers (100 = 100.00, optional tolerance, 1e-9 relative noise ignored), text with optional trim (default on) / ignore-case. Engine `engine.js` returns typed arrays (`status,rowA,rowB,changedCount`); which columns changed is recomputed lazily (`changedColumns`) for visible rows and the export. Export: Summary (incl. changed cells per column), **Changed** (key columns + `Old: X` / `New: X` for columns that changed somewhere, differing cells red/green), Added, Removed, optional Unchanged.

- **Summarize** (`features/summarize`, one file): three modes. **Group & total**: group-by 0+ columns (0 = one total), measures = Count of rows / Count of filled cells / Sum / Average / Smallest / Largest / Number of different values, optional **Across** column = cross-tab (pivot; ≤ 200 distinct values, a "Total" column is added; empty intersections are blank, not 0), grand-total row, sort (group name, first appearance, largest first), ignore-case, decimal comma for numbers stored as text (`cellNumber`); non-numeric cells are skipped and reported ("1 cell in “Amount” is not a number"). Group labels keep the first spelling seen. Engine `engine.js` returns a generic **result table** `{ rowCount, columns: ColumnSpec[] }` (so the export is the table itself and a future "use result as input" can reuse it). **Columns → rows** (`reshape.js unpivot`): keep id columns, turn others into Attribute/Value rows, optional skip blanks; mixed number formats → General (dates fall back to text). **Transpose**: ≤ 16,383 rows (Excel column limit), optional header column, numbers lose their format and dates become text. Export: result sheet (Summary / Unpivoted / Transposed, grand total bold) + Settings sheet.

- **Combine Files** (`features/combine`, `needs: 0`): the tool owns its source list (a source = one sheet of one file), independent of the two slots on the Files page. App.jsx keys `needs: 0` tools by a reset counter (not the dataset key), so loading Excel 1/2 does not wipe them; "Clear workspace" does. Sources are compact `FileDropCard`s (`compact`, `initialFile`, `initialSheet`, `actions` props; onChange(null) = remove) each with its own read worker; a multi-file drop adds many; "Add its other sheets" adds one source per remaining sheet of a workbook (each re-reads the file once, ponytail). Cap 50 sources (`MAX_SOURCES`). Columns are matched by `normalizeHeader` (case, spaces, punctuation ignored), output = union in order of first appearance; the UI lists only columns not in every file, each with a "join to…" dropdown (overrides keyed by source key; a joined column stays listed so it can be undone); option "only columns found in every file". Optional Source file / sheet / row columns. Missing columns stay blank; the first number format wins (warning on mixed formats; warning when a column is number/date in some files and text in others). `planColumns` is shared by the UI preview and the engine. Export: Combined + Sources (+ Notes). Refuses > MAX_CELLS (TOO_LARGE).

- **Column Builder** (`features/colbuilder` + `core/columns`): ordered steps, each adds ONE new column (name optional, blank = the operation's default; clashes get " (2)"); a step can use the new columns of the steps above it (the column pickers offer them; the UI lists what is missing). Original sheet comes back unchanged with the new columns at the END plus a Steps sheet (what it does, what it reads, blank cells, cells that could not be worked out). Cell result contract: undefined/'' = blank · null/NaN = could not work it out (blank + counted + red in the download) · string · number. Operations (20): *Text* join columns, text template `{Column}`, split text pick a part, text before/after a character, first/last/middle characters, pull out of text (email/phone/number/URL/domain/own pattern) · *Numbers* calculate (+ − × ÷, % of, % change, optional rounding), round (Excel semantics: halves and "up" go away from zero, "down" toward it) · *Dates* part of a date (year, month, month name, month-year, quarter, day, weekday name/number, ISO week, financial year with start month), time between dates (days / working days Mon–Fri / complete months / complete years, to a column or to today), add time to a date (days, working days, months, years; month ends are cut back), start/end of month · *Logic* IF…THEN rules (first match wins; results that are all numbers give a number column; dates compare as dates), group numbers into ranges, translate values with a list, do two columns match · *Numbering* serial number, count within a group (position / size), running total (optionally per group), rank (ties share a rank). Dates typed as text are read day-first by default (setting); numbers stored as text use "." or "," decimal (setting). Live preview runs on the first 200 rows (first 10 shown). Date helpers live in `core/parse/date.js` (weekdayOf, isoWeek, addMonths, monthStart/End, workdaysBetween = NETWORKDAYS, addWorkdays = WORKDAY, completeMonths = DATEDIF "m"). Not built (ideas): "split into N columns" shortcut, holiday lists for working days, placing a new column next to its source, mapping from Excel 2, AND/OR conditions.

## 9. What was verified (and how)

Test approach: pure checks in `src/**/*.check.js` (assert scripts) + real-browser drives with headless Edge over the DevTools protocol. **Those drive scripts and golden files lived in the Claude session scratchpad (temporary, NOT in the repo)**; recreate them if needed.

- Regression of Diff Check vs the pre-refactor build: engine output on the user's files (k=1, k=3) and a deterministic 2000×2000 set identical (scores, ranks, word breakdowns, unmatched) — permanent fingerprints are embedded in `features/diffcheck/engine/diffEngine.check.js` (`743f464c2843bb25`, `3c8cb700a67bbae1`, `9e978cdb6ce02e37`); downloaded `.xlsx` identical cell-by-cell (documented differences only: empty cells are truly blank, filter covers the data range, empty-cell font flags).
- New engine is ~3.6× faster (10k×10k top-3: 446 ms vs 1,617 ms) and equals a brute-force TF-IDF cosine in a check.
- Every tool: end-to-end through the real UI with real or generated files, downloaded file read back with ExcelJS/SheetJS/JSZip. Specific confirmations: typed numbers/dates and formats preserved, leading zeros kept, original row numbers, band colours, blank cells.
- Error handling in the browser: wrong type, corrupt xlsx (caught by `sniffFormat` after a bug where SheetJS read garbage as data), empty csv/xlsx, header-only (warning + tools disabled), 26M-cell sheet (TOO_LARGE with numbers), recovery after failures, unicode/BOM csv, export cancel (no download, can re-export), simulated worker crash (friendly notice, settings still usable).
- Responsive/a11y sweep at 768 and 390 px over all tools: 0 horizontal overflow, 0 unlabeled buttons/inputs (after adding `NumberInput`).
- Performance (headless Edge, noisy machine): 200k × 200k Diff Check: read 4.7 s per file, run 28 s (loader showed `28,001/200,000 · 14% · about 22 s left`), sort 85 ms, search 35–270 ms, export 235k rows 2.6 s, main-thread JS heap 123 MB. **500k rows (5 columns)**: file load ≈ 30 s each (noisy; SheetJS parse dominates, `cellNF` costs extra), Split group 4 s + ZIP export 7.5 s, Duplicate Finder exact 4 s + export 8 s, Data Cleaner scan 6 s + clean 1.4 s + export 11 s; whole browser peaked ~1.6–2.1 GB including Edge's own ~0.9 GB baseline.

## 10. NOT done / honest gaps (pick up here)

1. **500k × 500k runs of Diff Check, Fuzzy Lookup and Reconcile were NOT measured** (the user stopped that run). Files `bigA.xlsx/bigB.xlsx` (500k rows) can be regenerated with a small ExcelJS streaming script (company names, amounts, dates). Phase 6 of the plan ("finalise limits.js from measurements") is therefore only partly done; `MAX_CELLS = 8M` is untested at the limit (tested up to 2.5M cells).
2. **Never opened the generated files in desktop Excel** (checked only with ExcelJS and SheetJS readers, which are strict XML parsers). A quick manual open of a download from each tool is advisable.
3. File load speed at 500k is slow (~30 s). Idea: read number formats from a small sample of the first ~2000 rows (the size probe already runs) and parse the full sheet without `cellNF`; and make the probe cheaper than inflating the whole sheet. Not done because timings were too noisy to prove the gain.
4. Password-protected files are detected only by SheetJS error text (`/password|encrypt/`); untested with a real encrypted file. `.xls` verified via signature check only, not with a real legacy file in the UI.
5. Duplicate "similar" mode caps neighbours per row at 20 (a cluster of 20+ near-identical rows could split); Reconcile amount&date pass scans ≤ 500 equal-amount candidates per row. Both marked with `ponytail:` comments.
6. Sum-by-reference Reconcile has no fuzzy/probable passes; rows without a reference are listed as "only in" items. Combination (subset-sum) matching is out of scope.
7. Out of scope on purpose (architecture leaves room): saved presets, per-row review queue for Diff/Lookup, multi-column weighted matching, a user-editable "ignore words" list (Pvt, Ltd), undo history, a light-theme switch (the app is dark-only since 2026-11-11), editable colour bands, i18n, README.
8. Numbers display with the browser locale (the user's shows Indian grouping, e.g. `2,00,000`); amounts use `toLocaleString`.

## 11. Gotchas already hit (don't repeat)

- **UI Component Imports:** Always import buttons, dropdowns, inputs, checkboxes, segmented controls from `components/ui/index.js`, not directly from `primereact/*`.
- **Diff Check Context (`makeSide`):** In `features/diffcheck/side.js`, `makeSide` returns `{ ds, dataset: ds, column, col, carry, carryCols }`. Result screens must always access datasets defensively via `(a?.ds || a?.dataset)?.fileName ?? 'Excel 1'` and row numbers via `(a?.ds || a?.dataset)?.rowNums?.[ai]`.
- **Result Screens Defensive Programming:** All result screens (`*Results.jsx`) must defensively guard against missing `ctx`, `totals` (`result?.totals || ctx?.totals || {}`), `fileName`, and empty arrays so that unexpected or partial data never crashes the view into the ErrorBoundary.
- **`WordBreakdown` & `HighlightedText`:** `HighlightedText` accepts `{ text, matched, fuzzy, sets }` so that passing either `sets={highlightSets(...)}` or `{...highlightSets(...)}` works without throwing null-property errors. `highlightSets` defensively returns empty sets if `words` is null/undefined.
- **Typed arrays and JSX:** `Int32Array.map(row => <tr/>)` coerces elements to numbers (rendered "0000"). Convert with `Array.from(...)` first (was a real bug in the Duplicates group expansion).
- **Typed-array views are cloned whole** by `postMessage` unless transferred; views of one buffer in one message share a single clone (Split relies on this).
- **React stale state:** two file cards finishing together overwrote each other until `setFiles` became functional.
- **PrimeReact 10** class names: inline `Message` is `.p-inline-message`; Checkbox/Radio need real mouse events in automation (synthetic `.click()` on inner boxes is ignored); number inputs need real key events (setting `.value` + `input` event does not update state).
- **PrimeReact InputNumber** spin buttons have no accessible name: always use `shared/fields/NumberInput.jsx`.
- **Excel limits:** sheet names ≤ 31 chars, `History` reserved; Windows reserved file names; cell text ≤ 32,767 chars.
- **Excel stores dates as numbers:** never write JS `Date` (time-zone shift); write serial + `numFmt`.
- **SheetJS reads anything** (even random bytes as text) → always `sniffFormat` first. CSV must be parsed `raw:true` or `00123` becomes 123.
- **Dev server:** workers import `exceljs/jszip/xlsx` dynamically, so they are listed in `optimizeDeps.include` (otherwise the first export fails with "Failed to fetch dynamically imported module").
- **Windows shell:** very long bash heredocs and `node -e` with template strings get mangled (empty `ev()` calls, lost backslashes). Prefer writing files with the editor tools. `rm` with an unexpanded variable is blocked by the harness (use `"${VAR:?}"`).
- **Headless Edge** has a minimum window width ≈ 496 px; to test phone width use `Emulation.setDeviceMetricsOverride`. A `data:` page cannot host an iframe of the app.
- **Floating point:** equal scores can differ in the last bit by summation order (0.9999999999999999); compare with a tolerance or round to whole % like the app.
- In checks, build sample tables with care about column-major layout (`text[c][r]`) — several wrong expectations came from that.
- **Browser drives (headless Edge over CDP, no library):** Node 22's built-in `WebSocket` is enough; scripts lived in the session scratchpad (not in the repo). `innerText` honours CSS `text-transform` (section titles are upper-case: match case-insensitively); `Runtime.evaluate` with `returnByValue` throws on a DOM node (return `!!el`); PrimeReact dropdowns/multiselects/number boxes need real mouse/key events; a "Download ready" toast can cover the footer button (close it first); tools stay mounted but `hidden` after you leave them, so scope selectors to visible elements; sparse ExcelJS rows break `deepEqual` (compare cells).
- **PrimeReact Dropdown does not forward `ariaLabel` to its inner input:** give it `inputId` + a visually hidden `<label htmlFor>` (class `sr-only`), or wrap it in a `<label>`.
- **Date display text:** `parseDate`/`formatSerial` are UTC-only; "−0" can appear from `0 - x`-style maths (normalise with `0 - x` or `|| 0`).
- **Combine / needs: 0 tools** keep their state across changes of Excel 1/2 because App.jsx keys them by a reset counter, not by the dataset key.
- **Design rules the user set (2026-10-31):** no corner radius above **7px** anywhere (`--radius` and `--radius-lg` are both 7px; chips use 5-6px; only status dots, radio buttons and the slider handle stay round). `styles.css` has no `999px`/`50%` on anything bigger than a dot; a computed-style audit (every element, radius over 7px) was run on all tool screens and came back empty. The page header is compact on purpose (title 1.5rem + one-line subtitle, about 60px tall) because it is on every screen.
- **Settings-screen building blocks** (reuse them for the next tool): `shared/fields/ConfigSection.jsx` (title, hint, optional `actions`, `cols={1|2}`; give a child `className="span-2"` to span both columns) inside `<div className="card config config--form">` (max 1080px), ending with `<div className="config__foot">` (hint left, primary button right). Labels are the first `span` of `.field`; hints are `<small className="muted">`; checkbox rows are `.check`; `SelectButton` is restyled globally as a segmented control; column pickers are `.col-picks` tiles; text-link add buttons use `className="btn-add"`; rows with an optional remove button add `has-remove` (`.key-row`, `.measure-row`) so no empty column is reserved. Two-file panels use `.config__sides` / `.side` with the `file-tag` chip. Section grids use a 48px column gap so they line up with the two-file panels. `ColumnField` only renders its "e.g. …" line when it has examples. `GridTable` gives each header the same class as its column (numbers right-aligned, checkboxes centred).
- **Header:** the logo and "Workspace" in the breadcrumb are plain `<a href="#/files">` links (hash routing). The logo is `<Logo size={28} tag="PRO" />` from `components/brand/Logo.jsx` (classes `.logo`, `.logo__word`, `.logo__suite`, `.logo__tag`; the old `.gheader__logo/__name/__pro` classes are gone).
- **Info page (2026-10-31):** `info` is a second reserved route id besides `files` (`resolveRoute` always allows it; `index.check.js` guards both). It is not in the sidebar `nav`, so `AppShell` builds its crumbs (`Workspace › How it works`) itself and passes `infoActive` to the header's "i" link. `App.jsx` must not assume the route is a tool (`tools.find(...)` is undefined there). **In-page links cannot use `href="#section"`**: the hash is the route, so the contents list uses `scrollIntoView` buttons; element ids on the page are prefixed `info-` because tools stay mounted (hidden) and could share ids. Opening Info keeps tools mounted, so their results survive (browser-verified: same DOM node after Info → Back).
- **Breadcrumb follows the tool's phase (2026-10-31):** `ToolWorkflow` calls `useToolPhase(phase, task.reset)` (`shared/ToolPhase.js`); `App` provides a `ToolPhaseContext` per mounted tool (`{ id, set }`) and keeps `phases[toolId] = { phase, back }`, `AppShell` reads only the active route's entry. On results the crumb is `Workspace › <tool title> › <manifest resultLabel>` (e.g. `Workspace › Diff Check › Diff result`); config/running stay two levels. The tool-name crumb is a button that calls `back` (= `task.reset`), so there is **no "Settings" button on results pages** any more: that crumb is the way back, and the config state survives (it lives in each tool's own `useState`). The entry is removed on unmount (a tool remounted by a dataset reload never shows a stale "result"). Every manifest needs `resultLabel` (checked in `features/index.check.js`).
- **Compact config pages:** `ToolWorkflow` renders config/running inside `<div className="page page--config">` (max-width 1080px for every tool, tighter padding/gaps, `.field` gap 4px; the key-row link/remove offsets in Compare by Key are retuned for it, see the end of the "settings card" block in `styles.css`). Results pages (their own `.page`) keep the full width. Phones (≤ 900 / 700 px) keep the roomier rules. At 1366×768 eight of ten config pages fit without a vertical scrollbar (Reconcile and Summarize group mode are long by nature); at 1920×1080 all fit.
- **Scrollbars:** one global thin scrollbar at the top of `styles.css` (10px track, 6px visible pill; `::-webkit-scrollbar` for Chromium, `scrollbar-width`/`scrollbar-color` only inside `@supports not selector(::-webkit-scrollbar)` for Firefox, because Chromium 121+ ignores the webkit rules once the standard ones are set).
- **Number stepper:** `.p-inputnumber-buttons-horizontal .p-inputnumber-input { border-radius: 0 }` keeps the centre box square (the global `.p-inputtext` radius is unlayered and beats PrimeReact's layered `border-radius: 0`).
- **Home tool cards:** icon + title + arrow on one row, description clamped to 3 lines (full text in the button's `title` tooltip), about 162px tall.
- **React StrictMode (dev only) + one-shot effects:** it mounts, unmounts and remounts once; `useWorkerTask` terminates its worker on unmount, so a read started by a "run once" effect never finished (Combine Files hung on "Reading…" under `npm run dev`, fine in a production build). `FileDropCard`'s `initialFile` effect now resets its `started` guard in its cleanup. Any new run-on-mount worker job needs the same.
- **PrimeReact AutoComplete** forwards unknown props to its input: use `aria-label`, not `ariaLabel` (React warns). It re-focuses the input after `onSelect`, so blur in a `setTimeout`.
- **Home page facts that are computed, not mocked:** "Loaded" count, key candidate (`core/dataset/keyCandidate.js`: first column whose cells are all filled and all different, id-like names first), file type/size, storage total, "Recommended" (Compare by Key when both files share an id-like column, `suggestKey`).

- **Trust features (2026-10-31, second round):** Paste table, Use as input, Data health card, welcome modal. **User's hard rule: the original file must always be safe.**
  - *One loader for "open this File in a slot from anywhere":* `hooks/useFileLoader.js` (App-level, same `readWorkbook.worker`, `JobDialog` while reading) + `shared/Workspace.js` context (`names`, `loadFile(file, slot)`). The slot is replaced **only after the read succeeded**; the replaced slot object goes on a small stash (max 5) and `FilesPage` shows a restore bar (`Restore <file>`); an entry is dropped when the slot no longer holds the file it put there; `clear()` empties it. `FileDropCard` was not touched.
  - *Paste table:* `core/dataset/pasted.js` turns clipboard text (tabs from Excel/Sheets, quote-aware) into a UTF-8 **CSV File** (`Pasted table.csv`, BOM) so it goes through the normal reader (same checks, "Header row", `00123` stays text). `shared/PasteTableDialog.jsx`; Ctrl+V on the Files page (not in inputs) opens it pre-filled. PrimeReact `Dialog` moves focus after its animation: focus the box in `onShow`.
  - *Use as input:* second button in `shared/results/ExportButton.jsx` (`reuse={false}` on Split). It runs the same export worker and opens the Blob as a File via `loadFile`, so the loaded result is exactly the download (no per-tool conversion). One free slot is used silently, otherwise `shared/results/ReuseDialog.jsx` asks which to replace.
  - *Data health:* `pages/DataHealthCard.jsx` + `workers/dataHealth.worker.js` run `core/dataset/health.js` (blanks, empty/mostly-blank columns, repeated rows) **and the Data Cleaner's own `scanIssues`/`suggestionsFrom`**. No score, only counts and findings.
  - *Welcome modal:* `shared/WelcomeModal.jsx`, wording `WELCOME` in `pages/info/content.js` (lint covers it). Shows on first visit; "Don't show this again" stores one flag via `shared/welcomeSeen.js`, the **only** `localStorage` use in the app (user chose this over showing it every visit).
  - *Enforced by `src/safety.check.js`:* no file-write APIs, no network calls, no cookies/sessionStorage/indexedDB, `localStorage` only in `welcomeSeen.js`, and every `exportSpec.js` download name has text/`_` around the original name. Mutation-tested (a planted `fetch` fails it).
  - Browser-verified (headless Edge): modal (Esc, tick + reload, 390px), paste (free slot, replace + Restore, over 5 MB), Use as input (chooser, free slot, Restore), health numbers, 1366/768/390 no overflow, radius audit empty, sha-256 of the test files identical before and after. NOT browser-tested: a failed read inside `useFileLoader` (reasoned: nothing is set until success).
  - CDP gotcha: `DOM.setFileInputFiles` silently does nothing for a path containing `..`; resolve it first.

## 12. Working preferences of the user (from this session)

- **The user's original files must always be safe** (said 2026-10-31): nothing may ever overwrite or modify a loaded file; every output is a new file; anything that replaces a loaded slot must be restorable.
- Wants a **minimal, professional, Excel-green, compact** UI (small controls, sidebar + global header, dense Excel-like tables); first design (airy indigo wizard) was rejected as "too big".
- **Page-by-page redesign (started 2026-10-31), superseded 2026-11-11:** the user first sent one design image per page (light, Inter). On 2026-11-11 the user asked for the whole inside of the app to look like the new 3D landing page ("same color theme"), so the app is now dark with Geist (section 14); every page inherits it through the tokens. Earlier per-page layout decisions still stand. Rule: redesign only, no functionality may change or break. Design elements with no real feature behind them were NOT faked: Auto-save chip, user avatar, "Recent History", cell tags like "92% Match"/"UPPERCASE", "Encoding" (the footer shows file type + size instead); the "Add File / Sheet" button is "Add file" and is disabled when both slots are full.
- Wants **senior-level architecture, reusable components, no throwaway code**, nothing already working may break (regression-checked), proper loaders with elapsed/ETA, proper error handling, optimised JS-only logic.
- Wants questions asked once for flow corrections, then action. Prefers real verification and honest reporting of what was and was not tested.
- A "ponytail" (laziest-solution) style hook was active in the session; the user explicitly asked for quality/architecture over minimal code for this project.
- Likes modern, scroll-driven 3D marketing pages (gave https://vulk-kilnmark.pages.dev/ as the reference) and dislikes "AI slop" styling: gradient text, glowing blobs, pulsing buttons, tilt cards, stock images, emoji-like pills, many-coloured icon grids. Prefers one accent colour, big confident type, real product facts.
- Auto memory for this project lives at `C:\Users\ManishRana\.claude\projects\c--My-Work-Excel-App\memory\` (PrimeReact v10 pin, design preference, Top-K decision). The implementation plan file is `C:\Users\ManishRana\.claude\plans\i-want-you-to-crispy-acorn.md` (outside the repo; its Phase 6 is only partly complete, see section 10).

## 13. Suggested next tasks

0. The four tools added after the first build (Compare by Key, Summarize, Combine Files, Column Builder) were verified on small files only (≤ ~50 rows, as requested): engine/export checks, real-browser drives (read back the downloads with ExcelJS), 768/390 px overflow, unnamed-control sweep. NOT done: large-file timing for them, opening their downloads in desktop Excel. Ideas not built yet (ranked backlog): Report → Table (messy report clean-up), Saved Recipes + "use result as input", Value Standardizer (cluster similar spellings), Data Check (validate + profile), Filter & Pick Columns, Split by row count / round-robin, paste-in table + CSV output, more Cleaner ops (mapping list, ignore-words, phone standardizing, masking), PDF table → Excel.

1. Finish Phase 6: run Diff/Lookup/Reconcile at 500k, measure memory/time, set `limits.js` from the numbers, try the cheaper-read idea (section 10.3).
2. Open one download from every tool in desktop Excel; fix anything Excel "repairs".
3. Optional features listed in section 10.7 (ignore-words list and multi-column weighted matching are the most requested-sounding).
4. Add a short `README.md` for developers (run/build/check, how to add a tool) based on sections 2, 4 and 5 of this file.

## 14. Landing page, dark theme and logo (2026-11-11)

### 14.1 3D landing page (`pages/LandingPage.jsx`, `pages/landing/*`, `src/landing.css`)
- Modelled on the user's reference https://vulk-kilnmark.pages.dev/ (studied in a browser: three.js r170 on one fixed full-screen
  canvas, Lenis smooth scroll, Geist type, a 0→100 preloader counter, chapters of text scrolling over the 3D world). No GSAP there, none here.
- Deps: `three@0.170` (only in the lazy `scene` chunk, ~125 kB gzip, so the app's main chunk does not grow), `lenis` (smooth scroll,
  `autoRaf`), `@fontsource-variable/geist` + `geist-mono`. Everything is bundled and procedural (no models, textures or fonts fetched),
  so `safety.check.js` (no network) still holds.
- How it works: each chapter is a `<section>`; its **anchor** = scroll position where it is centred. Scroll → fractional chapter index
  (`progress()` in LandingPage) → `scene.js` blends the cells from one chapter's layout to the next (per-cell stagger = a wave, a small arc
  mid-flight) and the camera between two viewpoints (`CAMERAS`). Each layout is precomputed once (positions, sizes, colours for 1008
  instances = 36 columns × 28 rows, which is also 12×12×7 for the final cube). Layouts: `city` (hero), `two`, `matched`, `close`, `changed`,
  `balanced` (Compare tools), `sheet` (the "runs on your machine" statement), `messy`, `once`, `tidy`, `apart`, `built`, `together`,
  `totals` (one-file tools), `cube` (drag to turn; camera `far` for the closing CTA). Column letters / row numbers are canvas textures on the floor.
- Header has a formula bar (name box + fx) that types the current chapter's `ref`/`formula` from `content.js`.
- To add or reorder a chapter: edit `content.js` only (`kind` = title | word | limit | turn); add a layout + camera in `scene.js` if it needs a new `scene`.
- Reduced motion: no Lenis, no idle spin, no rain, no typing; WebGL failure: `.no-gl` shows a CSS grid background. On unmount Lenis and the
  renderer are disposed and the window scrolls to the top. `App.jsx` no longer shows the welcome modal over the landing page (`welcome && !isLanding`).
- Removed: the old static landing (gradient text, orbs, tilt cards, marquee, pulse buttons) and its stock images `src/assets/{hero,cleaning,comparison}.jpg`.
- Known exception to the 7px rule: the landing page's nav/buttons are 999px pills, copied from the reference and approved by the user
  ("landing page is great"). The app itself keeps the 7px rule.

### 14.2 Dark theme for the whole app
- **One token set**: `src/theme/theme.css` `:root` is the only place CSS variables are defined (the duplicate `:root` that used to sit
  in `styles.css` and override it was removed). `tokens.js` mirrors the values; `tokens.check.js` asserts `--xl-green` and `--bg` match.
- Token roles: `--bg` page · `--bg-sunken` wells (inputs, table heads, footers) · `--surface` cards/header · `--surface-elevated`
  menus, dialogs, toasts · `--surface-hover/-active/-3` interaction steps · `--border-soft < --border < --border-strong` ·
  `--text > --text-2 > --text-muted > --text-dim` · status pairs `--danger` (text) / `--danger-fill` (button) / `--danger-bg` /
  `--danger-border`, same idea for warning, info, success · `--match-*`, `--fuzzy-*`, `--old-*` for word highlights and old→new cells.
- **PrimeReact Fluent → variables** (`vite.config.js`, plugin `excel-theme`): Fluent ships literal light hex colours. Each one is mapped by
  the *role of the CSS property it appears in*: `fg` (color/fill/stroke/--text*), `bg` (background*, --surface*, --highlight-bg), `line`
  (border/outline/box-shadow). Example: `#ffffff` → `var(--surface)` as a background but stays white as text (it is the text on green
  buttons). Office blue → green (`--accent` as text, `--xl-green` as fill). A colour without a mapping for that role is left alone.
  If a PrimeReact widget looks wrong, add its hex to `FLUENT` rather than overriding in CSS.
- Overrides that need a solid surface on dark live at the end of `styles.css` ("dark theme: PrimeReact pieces"): toasts (solid card +
  coloured left edge), tooltip, dialog mask, sortable headers, slider/progress tracks.
- **Status/band tags keep Excel's pastel fills on purpose** (`core/bands.js`: Good/Neutral/Bad colours), because they are the same
  colours the user gets in the downloaded workbook. Do not "dark-ify" `BANDS`: the export uses them.
- Shell restyle: header and sidebar sit on `--bg` with hairlines; sidebar section titles in mono caps; active item = raised surface +
  2px green bar on the left; page titles 1.6rem/600 with tight tracking (like the landing type).

### 14.3 Logo
- `components/brand/Logo.jsx`: a 7px-radius green tile with faint sheet grid lines and one selected cell drawn with Excel's **fill handle**
  (the small square at the corner of a selection). Used in the app header (`<Logo tag="PRO" />`), the landing nav/footer (`<LogoMark />`)
  and `public/favicon.svg` (same SVG by hand).

### 14.4 UI bugs found and fixed in the sweep
- Grid paginator read "Showing1–27of27rows": PrimeReact makes `.p-paginator-current` a flex box, which drops the spaces between text
  and `<strong>`s. Fixed with `display: block; white-space: nowrap`.
- Search icon inside every results-grid search box was invisible: the input is positioned and painted over the absolutely positioned
  icon. Fixed with `.p-icon-field > .p-input-icon { z-index: 1 }`.
- Phones: the file name on a Files-page card was cut to "Past…" because the rows/cols chip shared its line; the chip now wraps under it.
- Sidebar section labels were below 3.6:1 contrast; `--text-dim` raised to `#74817b`.
- **Results screens broken by commit 3675e02 ("landing page")**, which rewrote every `*Results.jsx` and read fields the engines never
  return. Fixed by comparing each file with the engine/worker output and with cb4e3b8 (the last good version), keeping the newer markup:
  - Reconcile: reference came from non-existent `keyA/keyB` (now key-column text at `repA/repB`), amounts from `hasAmountA`/per-row
    `amountA` (now per-item `sumA/sumB`), status chip colour from `meta.color.bg` (now `meta.bg/fg`), expanded lines from `ctx.amountsA`
    (now `result.amountA`). Every row had shown "(no reference)" and "—". "Matched on" no longer wraps (rows were three lines tall).
  - Duplicates: decisions were a plain object instead of `{ keepOverride: Map, ignored: Set }` and `applyDecisions(...).stats` was misread:
    all-zero KPIs, a disabled download, and review choices never reached the export. `result.keptRow` → `result.keep`.
  - Fuzzy Lookup: status (Matched / Ambiguous / Not found) was not shown (BandTag ignores `label`); Not-found rows showed the nearest
    row's pulled values as if matched. Match % column and the muted "nearest: …" text restored.
  - Compare by Key: `changedColumns` called with the wrong signature and the tolerance dropped from `makeEqual`, so "Changed values"
    and the expansion were wrong; added/removed expansion misused `columnTexts`.
  - Diff Check: `explainPair` was given token arrays instead of texts (highlights / word breakdown wrong); Rank column restored for top-K > 1.
  - Lookup, Reconcile, Compare by Key: the row-expander column was missing although `expansion` was passed (details could not be opened).
  - Split: restored the over-MAX_GROUPS error and the >100-sheets warning; Cleaner: restored "Showing the first N of M changes".
  - Not restored (looked deliberate): Compare by Key's "Changed cells" count column, Split's "Blank cells" KPI. Split's KPI says
    "Files to create" even in one-workbook mode. Combine, Summarize, Column Builder had no data regressions.
  - Browser-verified on the test tables: Reconcile (refs, amounts, coloured statuses, expanded lines), Diff Check (word breakdown),
    Compare by Key (old → new values), Duplicates (KPIs; ticking "Not duplicates" changes them), Lookup (statuses, blank Not-found), Split.
  - **Lesson:** a large restyle that touches result components must be re-run tool by tool with real data; `npm run check` does not cover UI.

### 14.5 How it was verified (2026-11-11)
- Browser (Claude's built-in browser, dev server on :5173): landing at 1440×900 and 375×812 (every chapter, mid-scroll morph,
  drag-to-turn checked numerically on instance matrices, hand-off to the app). App: two test tables loaded through the app's own
  **Paste table** dialog (setting the textarea with the native value setter + `input` event works), then every tool's settings screen,
  the results of Diff Check, Reconcile and Summarize, the Files page at desktop and phone width, the mobile drawer.
- An in-page audit script (computed colours, alpha-composited against ancestors) checked every visible text element for contrast
  < 3.6:1 and every surface for leftover light backgrounds, on all ten settings screens and the results screens: clean except band tags (intended).
- `npm run build` OK; `npm run check` 49/49; `npm audit --omit=dev` 0 vulnerabilities.
- NOT verified: Firefox/Safari rendering of the 3D page, a real GPU-less machine, results screens of tools whose settings need column
  picks the automation could not make (PrimeReact dropdowns need real mouse events).

### 14.6 Gotchas from this session
- Some source files have **CRLF** line endings (`styles.css` was, `GlobalHeader.jsx` is): multi-line string replacements written with `\n`
  silently do nothing. Normalise first or use the editor tool.
- Long bash heredocs containing quotes get mangled by the Windows shell: write scripts to a file and run them.
- Testing in a browser: navigating to the same URL with only a different hash does **not** reload the page (hash routing); use `location.reload()` after code changes.
- Replacing `color: var(--xl-green)` with a regex also hit `border-color: …` (substring). Anchor on the property name.
- three.js `InstancedMesh` + `instanceColor`: set `frustumCulled = false` when instances move far from the original bounds.
