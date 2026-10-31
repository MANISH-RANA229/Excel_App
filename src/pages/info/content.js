import { EXCEL_MAX_ROWS, MAX_CELLS, MAX_FILE_MB, MAX_GROUPS, MAX_GROUPS_WARN, WARN_CELLS } from '../../core/limits.js';
import { formatCount } from '../../core/format.js';

// Words for the How-it-works page. Plain language on purpose (content.check.js rejects technical jargon).
// Everything here describes what the app really does; the source of each statement is the tool's own code (see AI_Context/Excel.md, sections 6-8).

/** Table of contents: id = element id on the page. */
export const SECTIONS = [
  { id: 'steps', title: 'In 3 steps' },
  { id: 'privacy', title: 'Your files stay with you' },
  { id: 'reading', title: 'How your file is read' },
  { id: 'scores', title: 'How match scores work' },
  { id: 'tools', title: 'Every tool, explained' },
  { id: 'results', title: 'Your result file' },
  { id: 'faq', title: 'Good to know' },
];

export const STEPS = [
  { title: 'Add your file', text: 'Drop an Excel or CSV file on the Files page. Most tools need one file; the compare tools need two (Excel 1 and Excel 2).' },
  { title: 'Pick a tool', text: 'Choose what you want to do, then choose the columns it should look at. A short note under each setting explains it.' },
  { title: 'Check and download', text: 'Look at the result on screen first. When it looks right, download it as a new Excel file. Your original file is never changed.' },
];

export const PRIVACY = {
  happens: [
    'Your file is opened inside your browser tab, on your computer.',
    'All the work (reading, matching, cleaning, building the result file) is done by your computer.',
    'The result file is created on your computer and saved by your browser, like any download.',
  ],
  never: [
    'Your file is never uploaded to a server. There is no server that receives it.',
    'No account, no sign-in, no tracking of what is in your data.',
    'Your files and results are never saved. Close or reload the tab and they are gone. "Clear workspace" does the same right away.',
    'Your original file is never changed. Every tool gives you a new file.',
  ],
  note: 'The only thing your browser may remember is that you closed the welcome note, if you tick "Don\'t show this again". It never remembers any file or result.',
  check: 'Do not take our word for it: press F12 in your browser, open the Network tab, then load a file and run a tool. You will see that no request carries your data.',
};

/** The welcome note shown when the app opens (shared/WelcomeModal.jsx). Keep it short: five promises, one sentence each. */
export const WELCOME = {
  title: 'Your data stays on your computer',
  lead: 'Excel Suite works inside your browser. Here is what that means for you:',
  points: [
    { title: 'Never uploaded', text: 'Your files are opened on this computer. There is no server that receives them.' },
    { title: 'No account, no tracking', text: 'No sign-in. Nothing about your data is collected.' },
    { title: 'Nothing is saved', text: 'Close or reload the tab and your files and results are gone. "Clear workspace" does the same right away.' },
    { title: 'Your original is never changed', text: 'Every tool gives you a new file. Your original stays exactly as it was.' },
    { title: 'Check it yourself', text: 'Press F12, open the Network tab, then work as usual. No request carries your data.' },
  ],
  never: 'Don\'t show this again',
  remember: 'Remembers only this choice, never your files.',
};

export const READING = [
  { title: 'Sheet and header row', text: 'If a workbook has several sheets, you choose one. The header row is found for you (title rows above the table are skipped). If it guessed wrong, type the right row number on the file card.' },
  { title: 'Blank rows', text: 'Completely empty rows are left out. Every row still remembers its real row number in your original file, so you can find it again.' },
  { title: 'Numbers, dates and codes', text: 'Numbers and dates keep their Excel format. A CSV is read exactly as written, so a code like 00123 stays 00123 and does not turn into 123.' },
  { title: 'Pasted tables', text: 'No file? Copy cells in Excel or Google Sheets and use "Paste table" on the Files page. The text is turned into a small file in memory and read exactly like a CSV, so it goes through the same checks.' },
  { title: 'Data health', text: 'When a file is loaded, a quick check counts blank cells, repeated rows, extra spaces, hidden characters, and numbers or dates stored as text. It only reports. It never changes your data.' },
  { title: 'Wrong or damaged files', text: 'A file that is not really a spreadsheet, is empty, is damaged, or is password-protected stops with a clear message instead of showing garbage.' },
  { title: 'Size', text: `Files up to ${MAX_FILE_MB} MB are accepted. Above ${formatCount(WARN_CELLS)} cells (rows × columns) you get a warning that tools will be slower; above ${formatCount(MAX_CELLS)} cells the file is refused with the exact numbers.` },
];

export const SCORE_STEPS = [
  { title: 'Split into words', text: 'Each cell becomes a list of words. Capital letters, accents, punctuation and word order do not matter.' },
  { title: 'Share of words', text: 'The score is how much of the wording two cells share, from 0% (nothing) to 100% (the same words).' },
  { title: 'Rare words count more', text: 'A word that appears in almost every row (like "Ltd") tells little. A rare word (like a surname) tells a lot, so it counts for more.' },
  { title: 'Small typos still count', text: 'A word that is one letter off ("Trader" and "Traders") still counts, but a bit less than an exact word. Short words and words with digits must match exactly.' },
];

export const SCORE_NOTES = [
  'The numbers in the example come from the real matching engine, run on exactly these rows.',
  'On your own files the numbers differ, because "rare" depends on what is in your files.',
];

/** Per tool, keyed by tool id (content.check.js makes sure no tool is missing). */
export const GUIDE = {
  diffcheck: {
    does: 'Finds the most similar row in Excel 2 for every row in Excel 1, by comparing one column word by word.',
    steps: [
      'You pick one column in each file.',
      'Every Excel 1 cell is scored against the Excel 2 cells it shares useful words with (see "How match scores work").',
      'The best matches are kept. You choose how many to keep per row, from 1 to 10.',
      'Rows in Excel 2 that no one matched are listed separately.',
    ],
    output: ['Results: both texts, the match % and a colour for every row', 'Summary: how many rows fall in each colour', 'Unmatched in Excel 2: rows nothing pointed to'],
    careful: [
      'A percentage is a suggestion, not a verdict. Look at the yellow, orange and red rows yourself.',
      'Click a row to see which words matched, which were a typo, and which appear on one side only.',
      'With the normal settings and up to about 200,000 rows, every possible match is checked.',
    ],
  },
  keycompare: {
    does: 'Compares an old and a new version of a list using an ID column. Shows what was added, removed or changed.',
    steps: [
      'Excel 1 is the old version, Excel 2 the new one. You pick the ID (key) column in each; you can use more than one.',
      'Rows with the same ID are the same record. Capital letters and extra spaces are ignored by default.',
      'Columns with the same heading in both files are compared cell by cell. Numbers are compared as numbers (100 equals 100.00); for text you choose whether spaces and capitals matter.',
      'Every row ends up as Unchanged, Changed, Added (only in Excel 2) or Removed (only in Excel 1).',
    ],
    output: ['Summary, with changed cells counted per column', 'Changed: old and new value side by side, differing cells coloured', 'Added and Removed rows', 'Unchanged rows, only if you ask for them'],
    careful: [
      'Matching on the ID is exact. It never guesses.',
      'If an ID appears more than once, the first is paired with the first, the second with the second, and so on.',
      'Rows with an empty ID are never matched. They are listed as Added or Removed and counted.',
    ],
  },
  lookup: {
    does: 'Works like VLOOKUP, but forgives spelling differences. Brings columns from Excel 2 into your Excel 1 table.',
    steps: [
      'Excel 1 is your main table, Excel 2 is the reference list. You pick the matching column in each.',
      'You pick which Excel 2 columns to bring over, and the lowest match % you accept (80 to start with).',
      'Each Excel 1 row looks for its closest reference row, using the word score.',
      'At or above your limit, the columns are filled in. Below it, the row is marked Not found.',
    ],
    output: ['Merged: all your Excel 1 columns, the new Excel 2 columns, the match % and a status, coloured', 'Unused reference rows: Excel 2 rows nobody used', 'Summary'],
    careful: [
      'Status is Matched, Ambiguous or Not found.',
      'Ambiguous means a second row scored within 5 points of the best one. A plain VLOOKUP would quietly pick one of them. Here you are told, so you can decide.',
      'For Not found rows, the nearest row is still shown, so you can see how close it was.',
    ],
  },
  reconcile: {
    does: 'Matches two lists of money entries, such as your ledger and the bank statement.',
    steps: [
      'For each file you pick a reference column (optional), the amount (one column, or debit and credit) and a date (optional).',
      'Matching runs in rounds, from most to least certain. Each round only looks at rows the earlier rounds left open, so a row is used once.',
      'Round 1: same reference and same amount means Matched.',
      'Round 2: same reference but a different amount means Amount difference.',
      'Optional rounds: a similar reference with the same amount (Matched, similar); the same amount with dates close enough, as you set it (Probable).',
      'Instead of line by line, you can add up all lines per reference first and compare the totals.',
    ],
    output: ['Matched, Differences, Only in Excel 1, Only in Excel 2', 'Difference lines, when comparing totals', 'Summary, including the Unreconciled amount (total of Excel 1 minus total of Excel 2)'],
    careful: [
      'References are compared by letters and digits only, so INV-001 equals inv 001.',
      'Probable is never counted as Matched. It is shown separately for you to confirm.',
      'Amounts like ₹1,25,000, $1,250.50 or (500) are understood. If an amount is unclear it is treated as not a number, never guessed.',
      'It does not try to find several small entries that add up to one big one.',
    ],
  },
  duplicates: {
    does: 'Finds repeated rows, lets you review them, then removes or marks them.',
    steps: [
      'You pick the column or columns that identify a record.',
      'Exact mode: rows are duplicates when those cells are the same, ignoring capitals and extra spaces (punctuation is optional).',
      'Similar mode: rows are linked when their match % reaches your limit (60 to 99). Linked rows form a group.',
      'In each group one row is kept: the first, the last, or the most complete. You can change that, or tick "Not duplicates".',
    ],
    output: ['Remove mode: Cleaned, Removed duplicates, Duplicate groups and Summary', 'Mark mode: all rows with a Status and a Duplicate group column'],
    careful: [
      'Rows with an empty key are never called duplicates.',
      'Nothing is deleted from your original file. You always get a new file.',
      'Each group shows its weakest link, so you can see how sure it is.',
      'In Similar mode each row is compared with its 20 closest rows. A cluster of more than 20 near-identical rows could be split in two.',
    ],
  },
  cleaner: {
    does: 'Tidies text, numbers and dates in one go: trim spaces, fix numbers and dates stored as text, change case, and more.',
    steps: [
      'When you open it, every cell is checked and fixes are suggested, such as "5 dates in Date are stored as text".',
      'You add fixes as steps, in the order you want them run. Each has its own options.',
      'A live preview shows the first 500 rows, so you see the effect before you run it.',
      'Run it on the whole file. Removing empty rows and columns always happens last.',
    ],
    output: ['Cleaned: your table after the fixes, with changed cells optionally highlighted yellow', 'Change log: what changed, cell by cell', 'Summary'],
    careful: [
      'Text becomes a number only when it clearly is one. Codes like 00123 and unclear text are left as they were, and counted.',
      'Dates typed as text are read day first (31/12 or 12/31?) unless you change it. Dates that could be read two ways are counted for you.',
      'Adding leading zeros makes the cell text, which is what you want for codes.',
      'The change log lists up to 100,000 changes. The counts in the Summary are always exact.',
    ],
  },
  split: {
    does: 'Makes one file (or one sheet) for each different value in a column, such as one per branch or per month.',
    steps: [
      'You pick the column to split by.',
      'Rows with the same value go together. Capitals and extra spaces are ignored; empty cells go to "(Blank)".',
      'You can untick groups you do not need and rename the rest.',
      'You choose: a ZIP of separate workbooks, or one workbook with a sheet per value.',
    ],
    output: ['A ZIP with one workbook per value plus a summary file, or a single workbook with one sheet per value', 'Values, formats and column widths are kept'],
    careful: [
      'Names are made safe for Excel and Windows: sheet names are cut to 31 characters, forbidden characters are replaced, repeated names get a number.',
      `More than ${formatCount(MAX_GROUPS_WARN)} different values shows a warning. More than ${formatCount(MAX_GROUPS)} is refused.`,
    ],
  },
  summarize: {
    does: 'Adds up and counts by group without building a pivot table. Can also turn columns into rows, or flip a table on its side.',
    steps: [
      'Group & total: pick the columns to group by (none gives one grand total) and what to work out: row count, filled cells, sum, average, smallest, largest, or number of different values.',
      'Optionally pick an "Across" column to spread its values into columns (a cross-tab). A Total column is added.',
      'Columns to rows: keep some columns as they are, and the others become Attribute and Value rows.',
      'Transpose: rows become columns and columns become rows.',
    ],
    output: ['The result sheet (with a bold grand-total row if you asked for one)', 'A Settings sheet that says exactly how the result was made'],
    careful: [
      'Cells that are not numbers are skipped in a sum and reported, for example "1 cell in Amount is not a number".',
      'Empty places in a cross-tab are left blank, not shown as 0.',
      'Group names keep the first spelling seen. "ACME" and "Acme" are one group by default.',
      `Transpose works up to ${formatCount(16383)} rows, because Excel has no more columns than that. Numbers lose their format and dates become text there.`,
    ],
  },
  combine: {
    does: 'Stacks many files, or many sheets, one below another into a single sheet.',
    steps: [
      'You add files. Each sheet of each file is one source (up to 50). This tool keeps its own list and does not use Excel 1 and Excel 2.',
      'Columns are matched by their heading. Capitals, spaces and punctuation are ignored.',
      'The result has every column found, in the order first seen. Where a file lacks a column, the cells stay blank.',
      'Headings that differ ("Cust Name" and "Customer") can be joined by hand. Optional columns can show the source file, sheet and row.',
    ],
    output: ['Combined: all rows in one sheet', 'Sources: what was read from where', 'Notes, when something needs your attention'],
    careful: [
      'If a column is a number in one file and text in another, or has different number formats, you get a warning. The first format found is used.',
      'A combination that is too big is refused instead of failing halfway.',
    ],
  },
  colbuilder: {
    does: 'Adds new columns made from existing ones, without writing formulas: join, split, calculate, date parts, IF rules, ranges, ranks and numbering.',
    steps: [
      'You add steps in order. Each step makes exactly one new column. Naming it is optional.',
      'A step can use the new columns made by the steps above it.',
      'A live preview shows the first rows, so you see the effect as you build.',
      'Run it on the whole file.',
    ],
    output: ['Your original sheet, unchanged, with the new columns at the end', 'A Steps sheet: what each step does, what it reads, how many cells are blank, and how many could not be worked out'],
    careful: [
      'A cell that cannot be worked out is left blank, counted, and shown in red in the download. It is never guessed.',
      'The new columns hold values, not formulas, so they do not change if you edit the file later.',
      'Dates typed as text are read day first unless you change that setting.',
    ],
  },
};

export const RESULT_FILE = [
  { title: 'A new Excel file', text: 'Every tool gives you a new .xlsx (or a .zip of them). Your original file is never touched.' },
  { title: 'Colours with a meaning', text: 'Match scores use the same colours as the screen. Differences are red and green. Yellow marks cells that were changed.' },
  { title: 'Values, not formulas', text: 'You get the final values. Dates stay real dates, numbers stay numbers, and codes like 00123 keep their zeros.' },
  { title: 'Use as input', text: 'Next to Download there is "Use as input". It opens the result as Excel 1 or Excel 2, so you can clean, then remove duplicates, then compare, without saving and re-loading files. It is a new copy. If it replaces a file you loaded, "Restore" brings that one back.' },
  { title: 'A record of the settings', text: 'A Summary or Settings sheet notes what was done, so you (or a colleague) can see how the result was made.' },
  { title: 'Big results', text: `Excel allows ${formatCount(EXCEL_MAX_ROWS)} rows per sheet. If a result is longer, it carries on in a second sheet called "Name (2)".` },
];

export const FAQ = [
  { q: 'Is a match % a guarantee?', a: 'No. It says how much of the wording is shared. Two different companies can share most words, and one company can be written in very different ways. Use the colours to decide where to look, and check the in-between ones yourself.' },
  { q: 'What does "Ambiguous" mean?', a: 'Two rows in Excel 2 looked almost equally good for the same row. The tool does not pick one silently. You decide.' },
  { q: 'Can I undo something?', a: 'Your original file is never changed, so there is nothing to undo. Each tool gives you a new file. If you do not like it, change the settings and run again.' },
  { q: 'Can "Use as input" change my original file?', a: 'No. It opens a new copy of the result inside the app. The file on your computer is never touched, and if the copy replaces a file you loaded, "Restore" on the Files page brings it back.' },
  { q: 'Why is a tool greyed out?', a: 'It needs files first. Tools that compare need both Excel 1 and Excel 2; the others need at least one. Combine Files brings its own files, so it is always open.' },
  { q: 'Will I lose my work if I open this page?', a: 'No. Tools keep their settings and results while you read this page. Go back and everything is where you left it.' },
];
