import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { SelectButton } from 'primereact/selectbutton';
import { Play } from 'lucide-react';
import ColumnField from '../../shared/fields/ColumnField.jsx';
import NumberInput from '../../shared/fields/NumberInput.jsx';
import ThresholdField from '../../shared/fields/ThresholdField.jsx';

const AMOUNT_KINDS = [{ label: 'One amount column', value: 'single' }, { label: 'Debit & Credit columns', value: 'drcr' }];
const MODES = [{ label: 'Line by line', value: 'line' }, { label: 'Total per reference', value: 'sum' }];
const DECIMALS = [{ label: 'Dot  (1,234.50)', value: '.' }, { label: 'Comma  (1.234,50)', value: ',' }];

function SideConfig({ label, dataset, cfg, onChange }) {
  const set = (patch) => onChange({ ...cfg, ...patch });
  return (
    <div className="side">
      <div className="side__head">
        <span className="card__label">{label}</span>
        <span className="muted clip" title={dataset.fileName}>{dataset.fileName} · {dataset.sheet}</span>
      </div>
      <ColumnField label="Reference column (invoice no., UTR …)" dataset={dataset} value={cfg.key} onChange={(key) => set({ key })} clearable placeholder="Optional" />
      <div className="field">
        <span>Amount</span>
        <SelectButton value={cfg.amountKind} options={AMOUNT_KINDS} onChange={(e) => e.value && set({ amountKind: e.value })} allowEmpty={false} />
      </div>
      {cfg.amountKind === 'drcr' ? (
        <>
          <ColumnField label="Debit column" dataset={dataset} value={cfg.debit} onChange={(debit) => set({ debit })} samples={false} />
          <ColumnField label="Credit column" dataset={dataset} value={cfg.credit} onChange={(credit) => set({ credit })} samples={false} hint="Amount = credit − debit." />
        </>
      ) : (
        <ColumnField label="Amount column" dataset={dataset} value={cfg.amount} onChange={(amount) => set({ amount })} />
      )}
      <ColumnField label="Date column" dataset={dataset} value={cfg.date} onChange={(date) => set({ date })} clearable placeholder="Optional" samples={false} />
    </div>
  );
}

export default function ReconcileConfig({ datasets: [a, b], config, problem, onChange, onRun }) {
  const set = (patch) => onChange({ ...config, ...patch });
  const bothDates = config.a.date && config.b.date;
  const line = config.mode === 'line';
  return (
    <div className="card config">
      <div className="config__sides">
        <SideConfig label="Excel 1" dataset={a} cfg={config.a} onChange={(cfg) => set({ a: cfg })} />
        <SideConfig label="Excel 2" dataset={b} cfg={config.b} onChange={(cfg) => set({ b: cfg })} />
      </div>

      <div className="config__grid recon-options">
        <div className="field">
          <span>Compare</span>
          <SelectButton value={config.mode} options={MODES} onChange={(e) => e.value && set({ mode: e.value })} allowEmpty={false} />
          <small className="muted">{line ? 'Each row is matched with at most one row in the other file.' : 'All lines with the same reference are added up and the totals compared (e.g. an invoice paid in parts).'}</small>
        </div>
        <label className="field">
          <span>Amounts count as equal when they differ by up to</span>
          <NumberInput label="amount tolerance" value={config.tolerance} onValueChange={(e) => set({ tolerance: e.value ?? 0 })} min={0} minFractionDigits={0} maxFractionDigits={4} step={0.01} inputClassName="num-input recon-tol" />
        </label>
        <div className="field">
          <span>Amount format</span>
          <label className="check"><Checkbox checked={config.absolute} onChange={(e) => set({ absolute: e.checked })} /><span>Ignore the sign (compare 100 with −100)</span></label>
          <Dropdown value={config.decimal} options={DECIMALS} onChange={(e) => set({ decimal: e.value })} className="w-full" />
        </div>
        {bothDates && (
          <div className="field">
            <span>Dates</span>
            <label className="field--inline field">
              <span>Within</span>
              <NumberInput label="date window in days" value={config.windowDays} onValueChange={(e) => set({ windowDays: e.value ?? 0 })} min={0} max={366} suffix=" days" inputClassName="num-input days-input" />
            </label>
            <label className="check"><Checkbox checked={config.dayFirst} onChange={(e) => set({ dayFirst: e.checked })} /><span>Read 05/03/2026 as 5 March (day first)</span></label>
          </div>
        )}
        {line && (
          <>
            <div className="field">
              <span>Also try</span>
              <label className="check"><Checkbox checked={config.amountOnly} onChange={(e) => set({ amountOnly: e.checked })} /><span>Matching on amount{bothDates ? ' and date' : ''} alone (marked “Probable”)</span></label>
              <label className="check"><Checkbox checked={config.fuzzyKey} onChange={(e) => set({ fuzzyKey: e.checked })} /><span>Similar references (typos, word order)</span></label>
            </div>
            {config.fuzzyKey && <ThresholdField label="Minimum reference similarity" value={config.fuzzyThreshold} min={60} max={99} onChange={(fuzzyThreshold) => set({ fuzzyThreshold })} />}
          </>
        )}
      </div>

      <div className="config__foot">
        {problem ? <p className="field-error" role="alert">{problem}</p> : <p className="hint">Rows are matched in order of confidence: same reference and amount first, then same reference with a different amount, and so on.</p>}
        <Button label="Reconcile" size="small" icon={<Play size={14} />} disabled={!!problem} onClick={onRun} />
      </div>
    </div>
  );
}
