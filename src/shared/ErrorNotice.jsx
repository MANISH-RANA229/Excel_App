import { Button } from '../components/ui/index.js';
import { TriangleAlert, X } from 'lucide-react';

/** Inline error: what happened, what to do, and (collapsed) the technical detail. CANCELLED is silent. */
export default function ErrorNotice({ error, onRetry, retryLabel = 'Try again', onDismiss }) {
  if (!error || error.code === 'CANCELLED') return null;
  return (
    <div className="error-notice" role="alert">
      <TriangleAlert size={18} aria-hidden="true" />
      <div className="error-notice__body">
        <strong>{error.message}</strong>
        {error.hint && <p>{error.hint}</p>}
        {error.detail && (
          <details>
            <summary>Technical details</summary>
            <pre>{error.detail}</pre>
          </details>
        )}
      </div>
      <div className="error-notice__actions">
        {onRetry && <Button label={retryLabel} size="sm" outlined severity="secondary" onClick={onRetry} />}
        {onDismiss && <Button text rounded size="sm" severity="secondary" aria-label="Dismiss" icon={<X size={16} />} onClick={onDismiss} />}
      </div>
    </div>
  );
}
