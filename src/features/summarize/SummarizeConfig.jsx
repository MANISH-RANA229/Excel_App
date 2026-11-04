import { Button, Checkbox, Dropdown, InputText, SelectButton } from '../../components/ui/index.js';
import { Info, Play, Plus, X } from 'lucide-react';
import ColumnField from '../../shared/fields/ColumnField.jsx';
import ColumnMultiField from '../../shared/fields/ColumnMultiField.jsx';
import ConfigSection from '../../shared/fields/ConfigSection.jsx';
import SourcePicker from '../../shared/fields/SourcePicker.jsx';
import { MODES } from './config.js';
import { AGGREGATES, SORTS } from './engine.js';

const DECIMALS = [{ label: 'Point  (1,234.50)', value: '.' }, { label: 'Comma  (1.234,50)', value: ',' }];
const MAX_MEASURES = 8;

function Measures({ ds, config, set }) {
  const update = (i, patch) => set({ measures: config.measures.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  return (
    <ConfigSection title="What to calculate" hint="Each calculation becomes a column of the result." cols={1}>
      <div className="measure-rows">
        {config.measures.map((m, i) => {
          const agg = AGGREGATES.find((a) => a.id === m.agg);
          return (
            <div className={`measure-row${config.measures.length > 1 ? ' has-remove' : ''}`} key={i}>
              <label className="field">
                <span className="sr-only">Calculation {i + 1}</span>
                <Dropdown value={m.agg} options={AGGREGATES} optionLabel="label" optionValue="id" onChange={(e) => update(i, { agg: e.value })} className="w-full" />
              </label>
              {agg.column ? (
                <label className="field">
                  <span className="sr-only">Column for calculation {i + 1}</span>
                  <Dropdown value={m.column} options={ds.columns} onChange={(e) => update(i, { column: e.value })} placeholder="Choose a column" filter className="w-full" />
                </label>
              ) : <span />}
              {config.measures.length > 1 && (
                <Button icon={<X size={14} />} text severity="secondary" size="sm" aria-label={`Remove calculation ${i + 1}`} onClick={() => set({ measures: config.measures.filter((_, j) => j !== i) })} />
              )}
            </div>
          );
        })}
      </div>
      {config.measures.length < MAX_MEASURES && (
        <Button label="Add another calculation" icon={<Plus size={14} />} text size="sm" className="btn-add" onClick={() => set({ measures: [...config.measures, { agg: 'sum', column: null }] })} />
      )}
    </ConfigSection>
  );
}

function GroupFields({ ds, config, set }) {
  return (
    <>
      <ConfigSection title="Groups" hint="What the result is split into.">
        <div className="span-2">
          <ColumnMultiField label="Group by" dataset={ds} value={config.groupBy} onChange={(groupBy) => set({ groupBy })} placeholder="None: one total for all rows" hint="One result row for each different value, or combination of values, in these columns." />
        </div>
        <ColumnField label="Across (optional)" dataset={ds} value={config.across} onChange={(across) => set({ across })} clearable placeholder="None" samples={false} hint="Turns each different value of this column into a column, like the top of a pivot table." />
        <div className="field">
          <span>Order of the groups</span>
          <Dropdown value={config.sort} options={SORTS} optionLabel="label" optionValue="id" onChange={(e) => set({ sort: e.value })} className="w-full" />
        </div>
      </ConfigSection>
      <Measures ds={ds} config={config} set={set} />
      <ConfigSection title="Options">
        <div className="field">
          <span>Matching</span>
          <label className="check"><Checkbox checked={config.ignoreCase} onChange={(e) => set({ ignoreCase: e.checked })} /><span>Treat “North” and “north” as the same group</span></label>
          <label className="check"><Checkbox checked={config.grandTotal} onChange={(e) => set({ grandTotal: e.checked })} /><span>Add a grand total row</span></label>
        </div>
        <div className="field">
          <span>Numbers stored as text are written with</span>
          <Dropdown value={config.decimal} options={DECIMALS} onChange={(e) => set({ decimal: e.value })} className="w-full" />
          <small className="muted">Cells that are not numbers are skipped by Sum, Average, Smallest and Largest.</small>
        </div>
      </ConfigSection>
    </>
  );
}

function UnpivotFields({ ds, config, set }) {
  return (
    <>
      <ConfigSection title="Columns" cols={1}>
        <ColumnMultiField label="Keep these columns on every row" dataset={ds} value={config.idColumns} exclude={config.valueColumns} onChange={(idColumns) => set({ idColumns })} placeholder="None" hint="Usually the ones that describe the row, e.g. Region or Customer." />
        <ColumnMultiField label="Columns to turn into rows" dataset={ds} value={config.valueColumns} exclude={config.idColumns} onChange={(valueColumns) => set({ valueColumns })} placeholder="Choose the columns, e.g. Jan, Feb, Mar" hint="Each cell of these columns becomes its own row: the old column name and the value." />
      </ConfigSection>
      <ConfigSection title="New columns">
        <label className="field"><span>Name of the new column holding the old column names</span><InputText value={config.nameHeader} onChange={(e) => set({ nameHeader: e.target.value })} className="w-full" /></label>
        <label className="field"><span>Name of the new column holding the values</span><InputText value={config.valueHeader} onChange={(e) => set({ valueHeader: e.target.value })} className="w-full" /></label>
        <label className="check span-2"><Checkbox checked={config.skipBlank} onChange={(e) => set({ skipBlank: e.checked })} /><span>Skip blank cells (no row is created for them)</span></label>
      </ConfigSection>
    </>
  );
}

export default function SummarizeConfig({ source, config, problem, onChange, onRun }) {
  const ds = source.dataset;
  const set = (patch) => onChange({ ...config, ...patch });
  const mode = MODES.find((m) => m.id === config.mode);
  return (
    <div className="card config config--form">
      <ConfigSection title="What to summarize">
        <SourcePicker source={source} />
        <div className="field span-2">
          <span>What do you want to do?</span>
          <SelectButton value={config.mode} options={MODES} optionLabel="label" optionValue="id" onChange={(e) => e.value && set({ mode: e.value })} unselectable={false} />
        </div>
      </ConfigSection>
      {config.mode === 'group' && <GroupFields ds={ds} config={config} set={set} />}
      {config.mode === 'unpivot' && <UnpivotFields ds={ds} config={config} set={set} />}
      {config.mode === 'transpose' && (
        <ConfigSection title="Headers" cols={1}>
          <ColumnField label="Use this column as the new headers (optional)" dataset={ds} value={config.headerColumn} onChange={(headerColumn) => set({ headerColumn })} clearable placeholder="None: use row numbers" hint="Every row becomes a column, and the original column names go down the first column. Works for sheets with up to 16,383 rows." />
        </ConfigSection>
      )}
      <div className="config__foot">
        {problem ? <p className="field-error" role="alert">{problem}</p> : (
          <p className="hint"><Info size={14} aria-hidden="true" /><span>Your file is not changed. You get a new Excel file with the result and a Settings sheet that says how it was made.</span></p>
        )}
        <Button label={mode.action} size="sm" icon={<Play size={14} />} disabled={!!problem} onClick={onRun} />
      </div>
    </div>
  );
}
