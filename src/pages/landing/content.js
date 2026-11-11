// Every chapter of the landing page, in scroll order. `scene` names the 3D layout the world shapes itself into while the
// chapter is on screen (see scene.js), `ref` and `formula` fill the formula bar in the header, `pos` places the text block.

export const HERO = {
  scene: 'city',
  ref: 'A1',
  formula: '=EXCEL_SUITE()',
};

export const CHAPTERS = [
  {
    kind: 'title', id: 'compare', scene: 'two', pos: 'tr', ref: 'B1', formula: '=COMPARE(Excel1, Excel2)',
    title: 'Two files in.',
    text: 'Four tools for when Excel 1 and Excel 2 should agree, and don’t.',
  },
  {
    kind: 'word', scene: 'matched', pos: 'l', ref: 'B2', formula: '=DIFFCHECK(A:A, Excel2!A:A)',
    index: 'Two files in', word: 'Matched.', name: 'Diff Check',
    text: 'For every row in Excel 1, the closest rows in Excel 2, scored word by word.',
    stats: [['scoring', 'word-based %'], ['matches per row', 'top 1–10'], ['bands', '90 % and up is green']],
  },
  {
    kind: 'word', scene: 'close', pos: 'r', ref: 'B3', formula: '=FUZZYLOOKUP(B2, Excel2!A:D, 3)',
    index: 'Two files in', word: 'Close.', name: 'Fuzzy Lookup',
    text: 'A VLOOKUP that forgives typos. Pulls columns across even when the names don’t quite line up.',
    stats: [['tolerates', 'typos, spacing, case'], ['returns', 'any Excel 2 column'], ['every match', 'with a score']],
  },
  {
    kind: 'word', scene: 'changed', pos: 'bl', ref: 'B4', formula: '=COMPAREBYKEY(ID, Excel1, Excel2)',
    index: 'Two files in', word: 'Changed.', name: 'Compare by Key',
    text: 'Old and new, lined up by an ID column. Every added, removed and edited cell, old value next to new.',
    stats: [['lined up by', 'any ID column'], ['changes shown', 'per cell'], ['outcomes', 'added · removed · changed']],
  },
  {
    kind: 'word', scene: 'balanced', pos: 'r', ref: 'B5', formula: '=RECONCILE(Ledger, Bank)',
    index: 'Two files in', word: 'Balanced.', name: 'Reconcile',
    text: 'Ledger against bank by reference, amount and date. Line by line, or by totals per reference.',
    stats: [['matches on', 'ref · amount · date'], ['date window', '± days you set'], ['amounts', 'with a tolerance']],
  },
  {
    kind: 'limit', id: 'local', scene: 'sheet', ref: 'C1', formula: '=SUM(uploads)',
    lines: ['Between the two:', 'words, keys and', 'tolerances. All of it', 'runs on your machine.'],
    stats: [['rows per file', '500,000'], ['bytes uploaded', '0'], ['accounts needed', 'none']],
  },
  {
    kind: 'title', id: 'clean', scene: 'messy', pos: 'l', ref: 'D1', formula: '=CLEAN(Excel1)',
    title: 'One file, put right.',
    text: 'Six tools for a single sheet that needs tidying, splitting, building on or adding up.',
  },
  {
    kind: 'word', scene: 'once', pos: 'r', ref: 'D2', formula: '=UNIQUE(A2:F5000)',
    index: 'One file, put right', word: 'Once.', name: 'Duplicate Finder',
    text: 'Exact or near-identical rows, grouped. Choose which one to keep, then clean or mark the rest.',
    stats: [['finds', 'exact or similar'], ['similarity', 'threshold you set'], ['then', 'clean or mark']],
  },
  {
    kind: 'word', scene: 'tidy', pos: 'tl', ref: 'D3', formula: '=TRIM(PROPER(A2))',
    index: 'One file, put right', word: 'Clean.', name: 'Data Cleaner',
    text: 'Trim spaces, turn text into numbers and dates, fix case, replace, fill blanks. In steps, in the order you set.',
    stats: [['issues', 'found for you'], ['steps', 'ordered, previewed'], ['original', 'never touched']],
  },
  {
    kind: 'word', scene: 'apart', pos: 'br', ref: 'D4', formula: '=FILTER(A:F, C:C="North")',
    index: 'One file, put right', word: 'Apart.', name: 'Split by Column',
    text: 'One file for every value in a column, or one sheet each in a single workbook.',
    stats: [['split on', 'any column'], ['download', '.zip or .xlsx'], ['one part', 'per value']],
  },
  {
    kind: 'word', scene: 'built', pos: 'l', ref: 'D5', formula: '=IF(E2>1000, "Large", "Small")',
    index: 'One file, put right', word: 'Built.', name: 'Column Builder',
    text: 'New columns without formulas: join and split text, calculate, date parts, IF rules, ranks and numbering.',
    stats: [['formulas', 'none to write'], ['rules', 'IF, ranges, ranks'], ['dates', 'parts and differences']],
  },
  {
    kind: 'word', scene: 'together', pos: 'tr', ref: 'D6', formula: '=VSTACK(Jan, Feb, Mar)',
    index: 'One file, put right', word: 'Together.', name: 'Combine Files',
    text: 'Many files and many sheets stacked into one. Columns are matched by their header name.',
    stats: [['stacks', 'files and sheets'], ['columns', 'matched by name'], ['result', 'one sheet']],
  },
  {
    kind: 'word', scene: 'totals', pos: 'tl', ref: 'D7', formula: '=SUMIFS(Sales, Region, A2)',
    index: 'One file, put right', word: 'Totalled.', name: 'Summarize',
    text: 'Group and total, cross-tab, columns to rows, or a straight transpose. No pivot table to set up.',
    stats: [['group by', 'one or more columns'], ['reshape', 'unpivot, transpose'], ['pivot table', 'not needed']],
  },
  {
    kind: 'turn', id: 'turn', scene: 'cube', ref: 'E1', formula: '=ROWS(workbook)',
    title: 'Turn it with your hand',
    text: 'Drag sideways to turn the block. Every cube is a cell, every layer a sheet, and the green row and column are the ones you changed.',
  },
];

export const CLOSE = { scene: 'cube', ref: 'F1', formula: '=OPEN(file)' };
