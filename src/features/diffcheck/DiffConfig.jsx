import { Dropdown } from 'primereact/dropdown';
import { MultiSelect } from 'primereact/multiselect';
import { InputNumber } from 'primereact/inputnumber';
import { Button } from 'primereact/button';
import { Info, Play } from 'lucide-react';

function SidePicker({ label, data, column, carry, onColumn, onCarry }) {
  const samples = column ? data.rows.map((r) => r[column]).filter(Boolean).slice(0, 4) : [];
  return (
    <div className="side">
      <div className="side__head">
        <span className="card__label">{label}</span>
        <span className="muted clip" title={data.fileName}>{data.fileName} · {data.sheet}</span>
      </div>
      <label className="field">
        <span>Column to compare</span>
        <Dropdown value={column} options={data.columns} onChange={(e) => onColumn(e.value)} placeholder="Select a column" filter className="w-full" />
      </label>
      <p className="samples clip" title={samples.join(', ')}>{samples.length ? `e.g. ${samples.join(' · ')}` : ' '}</p>
      <label className="field">
        <span>Extra columns in result <em>(optional)</em></span>
        <MultiSelect
          value={carry}
          options={data.columns.filter((c) => c !== column)}
          onChange={(e) => onCarry(e.value)}
          placeholder="None"
          display="chip"
          filter
          className="w-full"
        />
      </label>
    </div>
  );
}

export default function DiffConfig({ datasets: [a, b], config, onChange, onRun }) {
  const set = (patch) => onChange({ ...config, ...patch });
  const pairs = a.rows.length * b.rows.length;

  return (
    <div className="card config">
      <div className="config__sides">
        <SidePicker label="Excel 1" data={a} column={config.colA} carry={config.carryA}
          onColumn={(colA) => set({ colA, carryA: config.carryA.filter((c) => c !== colA) })} onCarry={(carryA) => set({ carryA })} />
        <SidePicker label="Excel 2" data={b} column={config.colB} carry={config.carryB}
          onColumn={(colB) => set({ colB, carryB: config.carryB.filter((c) => c !== colB) })} onCarry={(carryB) => set({ carryB })} />
      </div>
      <div className="config__foot">
        <label className="field field--inline">
          <span>Matches per row</span>
          <InputNumber value={config.topK} onValueChange={(e) => set({ topK: e.value ?? 1 })} min={1} max={10}
            showButtons buttonLayout="horizontal" inputClassName="num-input" />
        </label>
        <p className="hint">
          <Info size={14} aria-hidden="true" />
          <span>{pairs.toLocaleString()} pairs · ignores word order and case · rare keywords weigh more · tolerates 1-letter typos</span>
        </p>
        <Button label="Run Diff Check" size="small" icon={<Play size={14} />} disabled={!config.colA || !config.colB} onClick={onRun} />
      </div>
    </div>
  );
}
