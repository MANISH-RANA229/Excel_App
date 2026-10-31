import { Button } from 'primereact/button';
import { Info, Play } from 'lucide-react';
import ColumnField from '../../shared/fields/ColumnField.jsx';
import ColumnMultiField from '../../shared/fields/ColumnMultiField.jsx';
import ThresholdField from '../../shared/fields/ThresholdField.jsx';

export default function LookupConfig({ datasets: [a, b], config, onChange, onRun }) {
  const set = (patch) => onChange({ ...config, ...patch });
  const ready = config.keyA && config.keyB && config.pull.length > 0;
  return (
    <div className="card config">
      <div className="config__grid">
        <ColumnField label="Match on: Excel 1 (main table)" dataset={a} value={config.keyA} onChange={(keyA) => set({ keyA })} />
        <ColumnField label="Match on: Excel 2 (reference)" dataset={b} value={config.keyB} onChange={(keyB) => set({ keyB })} />
        <div className="span-2">
          <ColumnMultiField
            label="Columns to bring in from Excel 2"
            dataset={b}
            value={config.pull}
            onChange={(pull) => set({ pull })}
            placeholder="Choose one or more columns, e.g. Rate, Code"
            hint="They are added next to your Excel 1 columns, with their original number and date formats."
          />
        </div>
        <div className="span-2">
          <ThresholdField
            label="Minimum match"
            value={config.threshold}
            min={50}
            max={100}
            onChange={(threshold) => set({ threshold })}
            hint="Rows scoring lower are reported as “Not found” and left blank. Ignores word order and case, weighs rare words more, forgives one-letter typos."
          />
        </div>
      </div>
      <div className="config__foot">
        <p className="hint">
          <Info size={14} aria-hidden="true" />
          <span>
            Every Excel 1 row is kept. Where two reference rows match almost equally well, the row is marked “Ambiguous” so you can check it. A plain lookup would pick one silently.
          </span>
        </p>
        <Button label="Run lookup" size="small" icon={<Play size={14} />} disabled={!ready} onClick={onRun} />
      </div>
    </div>
  );
}
