import { defineWorker } from '../../workers/defineWorker.js';
import { scanIssues } from '../../core/clean/pipeline.js';

defineWorker(({ table }, { report }) => {
  report({ step: 1, stage: 'Scanning for problems', fraction: null });
  return { scan: scanIssues(table, { report: (fraction) => report({ step: 1, stage: 'Scanning for problems', fraction }) }) };
});
