import { defineWorker } from './defineWorker.js';
import { datasetHealth } from '../core/dataset/health.js';
import { scanIssues, suggestionsFrom } from '../core/clean/pipeline.js';

// payload { table: { names, text, nums, rowCount } }   (the same table the Data Cleaner scans)
// result  { health, suggestions }   health = core/dataset/health.js; suggestions = the Data Cleaner's own "fix this" list
const STAGE = 'Checking your data';

defineWorker(({ table }, { report }) => {
  report({ step: 1, stage: STAGE, fraction: null });
  const health = datasetHealth(table, { report: (f) => report({ step: 1, stage: STAGE, fraction: f * 0.5 }) });
  const scan = scanIssues(table, { report: (f) => report({ step: 1, stage: STAGE, fraction: 0.5 + f * 0.5 }) });
  return { health, suggestions: suggestionsFrom(scan) };
});
