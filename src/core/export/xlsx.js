// Writes a WorkbookSpec (see spec.js) as .xlsx — a purpose-built OOXML writer, because the in-memory writers
// of ExcelJS/SheetJS can't hold 500k rows in the browser (ExcelJS's streaming writer is Node-only, and SheetJS
// Community can't write cell styles). Sheet XML is generated in chunks and deflated as it is produced
// (see zip.js), so memory stays near the size of the compressed file.
//
// Deliberately small: inline strings, number formats, solid fills, bold/coloured fonts, column widths, a frozen
// header row and an auto-filter. Anything else (formulas, merged cells, images) is out of scope.

import { AppError } from '../errors.js';
import { EXCEL_MAX_ROWS } from '../limits.js';
import { safeFileName, safeSheetName } from '../names.js';
import { derive } from './derive.js';
import { ZipWriter } from './zip.js';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const HEADER_FILL = 'FF217346';
const MAX_COLUMNS = 16384;
const MAX_CELL_CHARS = 32767;
const CHUNK_ROWS = 4000;
const WIDTH_SAMPLE_ROWS = 500;
const encoder = new TextEncoder();

// ---------------------------------------------------------------- escaping & addresses
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g; // illegal in XML 1.0
const NEEDS_ESCAPE = /[&<>"\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/;
const escapeXml = (s) => (NEEDS_ESCAPE.test(s)
  ? s.replace(CONTROL, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  : s);

const letters = [];
const colLetter = (i) => (letters[i] ??= (i >= 26 ? colLetter(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26)));
const argb = (hex) => `FF${hex.slice(1).toUpperCase()}`;

// ---------------------------------------------------------------- values
function valueAt(col, i) {
  if (col.derive) {
    const d = derive(col.derive, i);
    return d === '' ? null : d;
  }
  const s = col.rows ? col.rows[i] : i;
  if (s < 0) return null;
  if (col.nums) {
    const v = col.nums[s];
    if (!Number.isNaN(v)) return v;
  }
  const t = col.text?.[s];
  return t === '' || t == null ? null : t;
}

function widthOf(col, rowCount) {
  let max = String(col.header).length;
  for (let i = 0; i < Math.min(rowCount, WIDTH_SAMPLE_ROWS); i++) {
    const v = valueAt(col, i);
    if (v != null) max = Math.max(max, String(v).length);
  }
  return Math.min(60, Math.max(10, max + 2));
}

// ---------------------------------------------------------------- styles.xml
// cellXfs 0 = default, 1 = header; others are created on demand for (number format × palette style).
class StyleBook {
  fonts = ['<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>', `<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>`];
  fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>', `<fill><patternFill patternType="solid"><fgColor rgb="${HEADER_FILL}"/><bgColor indexed="64"/></patternFill></fill>`];
  xfs = [
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center"/></xf>',
  ];
  #numFmts = new Map();
  #cache = new Map();
  #index = { fonts: new Map(), fills: new Map() };

  #numFmtId(code) {
    if (!code) return 0;
    if (!this.#numFmts.has(code)) this.#numFmts.set(code, 164 + this.#numFmts.size);
    return this.#numFmts.get(code);
  }

  #intern(kind, key, xml) {
    const list = this[kind];
    const map = this.#index[kind];
    if (!map.has(key)) { list.push(xml); map.set(key, list.length - 1); }
    return map.get(key);
  }

  /** cellXfs index for a column number format combined with an optional palette style. */
  xf(numFmt, style) {
    if (!numFmt && !style) return 0;
    const key = `${numFmt ?? ''}|${style ? JSON.stringify(style) : ''}`;
    if (this.#cache.has(key)) return this.#cache.get(key);
    const numFmtId = this.#numFmtId(numFmt);
    let fontId = 0;
    let fillId = 0;
    if (style) {
      const color = style.color ? `<color rgb="${argb(style.color)}"/>` : '';
      fontId = this.#intern('fonts', `${style.bold}|${style.color}`, `<font>${style.bold ? '<b/>' : ''}<sz val="11"/>${color}<name val="Calibri"/><family val="2"/></font>`);
      if (style.fill) fillId = this.#intern('fills', style.fill, `<fill><patternFill patternType="solid"><fgColor rgb="${argb(style.fill)}"/><bgColor indexed="64"/></patternFill></fill>`);
    }
    this.xfs.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="0" xfId="0"${numFmtId ? ' applyNumberFormat="1"' : ''}${fontId ? ' applyFont="1"' : ''}${fillId ? ' applyFill="1"' : ''}/>`);
    this.#cache.set(key, this.xfs.length - 1);
    return this.xfs.length - 1;
  }

  toXml() {
    const nf = [...this.#numFmts].map(([code, id]) => `<numFmt numFmtId="${id}" formatCode="${escapeXml(code)}"/>`).join('');
    return `${XML}<styleSheet xmlns="${NS}">`
      + (nf ? `<numFmts count="${this.#numFmts.size}">${nf}</numFmts>` : '')
      + `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>`
      + `<fills count="${this.fills.length}">${this.fills.join('')}</fills>`
      + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
      + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
      + `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>`
      + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
      + '</styleSheet>';
  }
}

// ---------------------------------------------------------------- package parts
const contentTypes = (n) => `${XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
  + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
  + Array.from({ length: n }, (_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
  + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';

const rootRels = `${XML}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

const workbookXml = (parts) => `${XML}<workbook xmlns="${NS}" xmlns:r="${NS_R}"><sheets>`
  + parts.map((p, i) => `<sheet name="${escapeXml(p.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
  + '</sheets></workbook>';

const workbookRels = (n) => `${XML}<Relationships xmlns="${NS_PKG}">`
  + Array.from({ length: n }, (_, i) => `<Relationship Id="rId${i + 1}" Type="${NS_R}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
  + `<Relationship Id="rId${n + 1}" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>`;

// ---------------------------------------------------------------- worksheet
async function* sheetChunks({ sheet, from, to, sheetIndex, first }, ctx) {
  const { columns } = sheet;
  const { styles, steps, total, report } = ctx;
  const n = columns.length;
  const lastRow = to - from + 1; // header + data rows
  const lastCol = colLetter(Math.max(n, 1) - 1);
  const paletteStyles = sheet.styles ?? [];
  const xfOf = columns.map((c) => styles.xf(c.numFmt ?? null, null));
  const styledXf = columns.map((c) => (c.styleIds ? new Map() : null)); // palette id → xf
  const pane = sheet.freezeHeader === false ? '' : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>';

  let buf = `${XML}<worksheet xmlns="${NS}"><dimension ref="A1:${lastCol}${lastRow}"/>`
    + `<sheetViews><sheetView${first ? ' tabSelected="1"' : ''} workbookViewId="0">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>`
    + `<cols>${columns.map((c, ci) => `<col min="${ci + 1}" max="${ci + 1}" width="${c.width ?? widthOf(c, sheet.rowCount)}" customWidth="1"/>`).join('')}</cols><sheetData>`
    + `<row r="1" ht="22" customHeight="1">${columns.map((c, ci) => `<c r="${colLetter(ci)}1" s="1" t="inlineStr"><is><t>${escapeXml(String(c.header))}</t></is></c>`).join('')}</row>`;

  for (let i = from; i < to; i++) {
    const r = i - from + 2;
    let row = `<row r="${r}">`;
    for (let c = 0; c < n; c++) {
      const col = columns[c];
      const v = valueAt(col, i);
      let s = xfOf[c];
      const id = col.styleIds ? col.styleIds[i] : 0;
      if (id) {
        const cache = styledXf[c];
        if (!cache.has(id)) cache.set(id, styles.xf(col.numFmt ?? null, paletteStyles[id - 1]));
        s = cache.get(id);
      }
      const attrs = `r="${colLetter(c)}${r}"${s ? ` s="${s}"` : ''}`;
      if (v === null) {
        if (s) row += `<c ${attrs}/>`;
      } else if (typeof v === 'number') {
        if (Number.isFinite(v)) row += `<c ${attrs}><v>${v}</v></c>`;
      } else {
        const str = typeof v === 'string' ? v : String(v);
        const text = str.length > MAX_CELL_CHARS ? str.slice(0, MAX_CELL_CHARS) : str;
        row += `<c ${attrs} t="inlineStr"><is><t${/^\s|\s$/.test(text) ? ' xml:space="preserve"' : ''}>${escapeXml(text)}</t></is></c>`;
      }
    }
    buf += `${row}</row>`;
    ctx.done++;
    if ((i - from + 1) % CHUNK_ROWS === 0) {
      yield encoder.encode(buf);
      buf = '';
      report?.({ step: sheetIndex + 1, steps, stage: `Writing “${sheet.name}”`, fraction: ctx.done / total, processed: ctx.done, total });
    }
  }
  buf += '</sheetData>';
  if (sheet.autoFilter !== false && n) buf += `<autoFilter ref="A1:${lastCol}${lastRow}"/>`;
  yield encoder.encode(`${buf}</worksheet>`);
}

/**
 * @param {{ sheets: object[] }} workbook  WorkbookSpec
 * @param {{ report?: Function, maxRowsPerSheet?: number }} [opts]
 *        a sheet longer than maxRowsPerSheet continues on "Name (2)", "Name (3)" … each with its own header row
 * @returns {Promise<Blob>}
 */
export async function renderWorkbook(workbook, { report, maxRowsPerSheet = EXCEL_MAX_ROWS } = {}) {
  const taken = new Set();
  const parts = [];
  workbook.sheets.forEach((sheet, sheetIndex) => {
    if (sheet.columns.length > MAX_COLUMNS) {
      throw new AppError('TOO_LARGE', { message: `“${sheet.name}” has ${sheet.columns.length} columns; Excel allows ${MAX_COLUMNS}.` });
    }
    const count = Math.max(1, Math.ceil(sheet.rowCount / maxRowsPerSheet));
    for (let p = 0; p < count; p++) {
      parts.push({
        sheet, sheetIndex, first: parts.length === 0,
        from: p * maxRowsPerSheet, to: Math.min(sheet.rowCount, (p + 1) * maxRowsPerSheet),
        name: safeSheetName(p ? `${sheet.name} (${p + 1})` : sheet.name, taken),
      });
    }
  });

  const ctx = {
    styles: new StyleBook(), report, done: 0, steps: workbook.sheets.length,
    total: workbook.sheets.reduce((n, s) => n + s.rowCount, 0) || 1,
  };
  const zip = new ZipWriter();
  await zip.add('[Content_Types].xml', contentTypes(parts.length));
  await zip.add('_rels/.rels', rootRels);
  await zip.add('xl/workbook.xml', workbookXml(parts));
  await zip.add('xl/_rels/workbook.xml.rels', workbookRels(parts.length));
  for (const [i, part] of parts.entries()) await zip.add(`xl/worksheets/sheet${i + 1}.xml`, sheetChunks(part, ctx));
  await zip.add('xl/styles.xml', ctx.styles.toXml()); // last: the style table is complete only after all cells are written
  report?.({ step: ctx.steps, steps: ctx.steps, stage: 'Finishing', fraction: 1, processed: ctx.total, total: ctx.total });
  return zip.finish(XLSX_MIME);
}

/** One .xlsx per entry, packed into a zip (workbooks are already compressed, so they are stored). */
export async function renderZip(files, { report, maxRowsPerSheet } = {}) {
  const zip = new ZipWriter();
  const taken = new Set();
  for (const [i, file] of files.entries()) {
    const blob = await renderWorkbook(file.workbook, {
      maxRowsPerSheet,
      report: report && ((p) => report({
        step: 1, steps: 1, stage: `Building ${file.name}`,
        fraction: (i + (p.fraction ?? 0)) / files.length, processed: i, total: files.length,
      })),
    });
    const name = safeFileName(file.name.replace(/\.xlsx$/i, ''), { ext: '.xlsx', taken });
    await zip.add(name, new Uint8Array(await blob.arrayBuffer()), { compress: false });
  }
  report?.({ step: 1, steps: 1, stage: 'Finishing', fraction: 1, processed: files.length, total: files.length });
  return zip.finish('application/zip');
}
