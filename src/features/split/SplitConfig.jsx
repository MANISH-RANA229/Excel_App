import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Info, Play } from 'lucide-react';
import ColumnField from '../../shared/fields/ColumnField.jsx';
import SourcePicker from '../../shared/fields/SourcePicker.jsx';

export default function SplitConfig({ source, config, column, onChange, onRun }) {
  return (
    <div className="card config">
      <div className="config__grid">
        <div className="span-2"><SourcePicker source={source} /></div>
        <ColumnField
          label="Split by column"
          dataset={source.dataset}
          value={column}
          onChange={(v) => onChange({ ...config, column: v })}
          hint="One file (or sheet) is created for each different value in this column."
        />
        <div className="field">
          <span>Matching</span>
          <label className="check">
            <Checkbox checked={config.ignoreCase} onChange={(e) => onChange({ ...config, ignoreCase: e.checked })} />
            <span>Treat “North” and “north” as the same value</span>
          </label>
          <small className="muted">Extra spaces are always ignored. Blank cells go into one “(Blank)” group.</small>
        </div>
      </div>
      <div className="config__foot">
        <p className="hint">
          <Info size={14} aria-hidden="true" />
          <span>All columns, number formats and dates are kept exactly as in your file. You choose what to export on the next screen.</span>
        </p>
        <Button label="Find groups" size="small" icon={<Play size={14} />} disabled={!column} onClick={onRun} />
      </div>
    </div>
  );
}
