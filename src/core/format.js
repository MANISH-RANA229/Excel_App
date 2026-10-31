// Small display helpers shared by the loader and results.

export function formatDuration(ms) {
  if (!(ms >= 0)) return '';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)} s`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

export const formatCount = (n) => Number(n).toLocaleString();

// Time left for the current step. Only an estimate once it is stable: ≥3% done and ≥1 s into the step.
export function estimateEta(fraction, stepElapsedMs) {
  if (fraction == null || fraction < 0.03 || fraction >= 1 || stepElapsedMs < 1000) return null;
  return (stepElapsedMs * (1 - fraction)) / fraction;
}
