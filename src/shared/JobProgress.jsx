import { Button } from 'primereact/button';
import { Check, X } from 'lucide-react';
import { formatCount, formatDuration } from '../core/format.js';

/**
 * Loader for any background job.
 *  - determinate bar when progress.fraction is a number, indeterminate otherwise
 *  - `stages` (names) + progress.step (1-based) draw the step trail
 *  - ETA only when the hook could estimate it honestly; otherwise elapsed time only
 * variants: 'card' (in a page), 'inline' (inside a file card), 'dialog' (inside JobDialog).
 */
export default function JobProgress({ title, progress, elapsedMs = 0, etaMs = null, stages, unit = 'rows', onCancel, variant = 'card' }) {
  const fraction = progress?.fraction ?? null;
  const determinate = fraction != null;
  const pct = determinate ? Math.min(100, Math.round(fraction * 100)) : null;
  const step = progress?.step ?? 0;
  const stage = progress?.stage || stages?.[step - 1] || 'Working…';
  const counted = progress?.processed != null && progress?.total != null;

  return (
    <div className={`jp jp--${variant}`} aria-busy="true">
      <div className="jp__head">
        <div className="jp__titles">
          {variant !== 'dialog' && title && <div className="jp__title">{title}</div>}
          <div className="jp__stage" aria-live="polite">{stage}</div>
        </div>
        {onCancel && <Button label="Cancel" size="small" text severity="secondary" icon={<X size={14} />} onClick={onCancel} />}
      </div>

      <div
        className="jp__bar"
        role="progressbar"
        aria-label={title || stage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
      >
        <div className={`jp__fill${determinate ? '' : ' is-indeterminate'}`} style={determinate ? { transform: `scaleX(${fraction})` } : undefined} />
      </div>

      <div className="jp__meta">
        <span>
          {counted && `${formatCount(progress.processed)} / ${formatCount(progress.total)} ${unit}`}
          {counted && determinate && ' · '}
          {determinate && `${pct}%`}
        </span>
        <span>
          {formatDuration(elapsedMs)} elapsed
          {etaMs != null && ` · about ${formatDuration(etaMs)} left`}
          {etaMs == null && determinate && elapsedMs >= 1000 && ' · estimating…'}
        </span>
      </div>

      {stages?.length > 1 && variant !== 'inline' && (
        <ol className="jp__steps" aria-label="Steps">
          {stages.map((name, i) => {
            const state = i + 1 < step ? 'done' : i + 1 === step ? 'active' : 'todo';
            return (
              <li key={name} className={`jp__step is-${state}`} aria-current={state === 'active' ? 'step' : undefined}>
                {state === 'done' ? <Check size={12} aria-hidden="true" /> : <span className="jp__dot" aria-hidden="true" />}
                {name}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
