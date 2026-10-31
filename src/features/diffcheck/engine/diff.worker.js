import { runDiff } from './diffEngine.js';

self.onmessage = ({ data }) => {
  try {
    const result = runDiff(data.textsA, data.textsB, data.options, (value) => self.postMessage({ type: 'progress', value }));
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message });
  }
};
