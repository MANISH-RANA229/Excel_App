import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { Info, Play } from 'lucide-react';
import ColumnMultiField from '../../shared/fields/ColumnMultiField.jsx';
import SourcePicker from '../../shared/fields/SourcePicker.jsx';
import ThresholdField from '../../shared/fields/ThresholdField.jsx';
import { KEEP_RULES } from './engine.js';

const MODES = [{ label: 'Exact match', value: 'exact' }, { label: 'Similar (typos, word order)', value: 'similar' }];
const KEEP_OPTIONS = Object.entries(KEEP_RULES).map(([value, { label }]) => ({ value, label }));

export default function DuplicatesConfig({ source, config, onChange, onRun }) {
  const set = (patch) => onChange({ ...config, ...patch });
  const setNormalize = (patch) => set({ normalize: { ...config.normalize, ...patch } });
  const ready = config.keyColumns.length > 0;
  const n = source.dataset.rowCount;

  return (
    <div className="card config">
      <div className="config__grid">
        <div className="span-2"><SourcePicker source={source} /></div>
        <div className="span-2">
          <ColumnMultiField
            label="Columns that identify a duplicate"
            dataset={source.dataset}
            value={config.keyColumns}
            onChange={(keyColumns) => set({ keyColumns })}
            placeholder="Choose one or more columns, e.g. Company Name"
            hint="Rows are duplicates when ALL of these columns match."
          />
        </div>

        <div className="field">
          <span>How to compare</span>
          <SelectButton value={config.mode} options={MODES} onChange={(e) => e.value && set({ mode: e.value })} allowEmpty={false} />
        </div>
        {config.mode === 'similar' ? (
          <ThresholdField
            label="Minimum similarity"
            value={config.threshold}
            min={60}
            max={99}
            onChange={(threshold) => set({ threshold })}
            hint="Ignores word order and letter case, weighs rare words more, and forgives one-letter typos."
          />
        ) : (
          <div className="field">
            <span>Ignore when comparing</span>
            <label className="check"><Checkbox checked={config.normalize.ignoreCase} onChange={(e) => setNormalize({ ignoreCase: e.checked })} /><span>Upper / lower case</span></label>
            <label className="check"><Checkbox checked={config.normalize.collapseSpaces} onChange={(e) => setNormalize({ collapseSpaces: e.checked })} /><span>Extra spaces</span></label>
            <label className="check"><Checkbox checked={config.normalize.ignorePunctuation} onChange={(e) => setNormalize({ ignorePunctuation: e.checked })} /><span>Punctuation (dots, commas, dashes)</span></label>
          </div>
        )}

        <label className="field">
          <span>Which row to keep in each group</span>
          <Dropdown value={config.keep} options={KEEP_OPTIONS} onChange={(e) => set({ keep: e.value })} className="w-full" />
          <small className="muted">You can change this for any group while reviewing.</small>
        </label>
      </div>

      <div className="config__foot">
        <p className="hint">
          <Info size={14} aria-hidden="true" />
          <span>{n.toLocaleString()} rows will be checked. Nothing is deleted from your file; you review the groups and then download a cleaned copy.</span>
        </p>
        <Button label="Find duplicates" size="small" icon={<Play size={14} />} disabled={!ready} onClick={onRun} />
      </div>
    </div>
  );
}
