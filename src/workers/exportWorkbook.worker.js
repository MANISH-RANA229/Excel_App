import { defineWorker } from './defineWorker.js';
import { AppError } from '../core/errors.js';
import { renderWorkbook, renderZip } from '../core/export/xlsx.js';

// payload { spec: ExportSpec }  (see core/export/spec.js)
// result  { blob, fileName }

defineWorker(async ({ spec }, { report }) => {
  report({ step: 1, stage: 'Preparing', fraction: null });
  try {
    const blob = spec.zip ? await renderZip(spec.zip, { report }) : await renderWorkbook(spec.workbook, { report });
    return { blob, fileName: spec.fileName };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('EXPORT_FAILED', { detail: e?.message ?? String(e) });
  }
});
