import { Button } from 'primereact/button';
import { Checkbox } from 'primereact/checkbox';
import { Dropdown } from 'primereact/dropdown';
import { InputText } from 'primereact/inputtext';
import { MultiSelect } from 'primereact/multiselect';
import { ArrowRight, Plus, X } from 'lucide-react';
import { COMPARATORS, comparatorOf } from '../../core/columns/conditions.js';
import NumberInput from './NumberInput.jsx';

function Pairs({ value, onChange, labels = ['Find', 'Replace with'] }) {
  const set = (i, patch) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  return (
    <div className="pairs">
      {value.map((p, i) => (
        <div className="pairs__row" key={i}>
          <InputText value={p.find} onChange={(e) => set(i, { find: e.target.value })} placeholder={labels[0]} aria-label={labels[0]} className="p-inputtext-sm" />
          <ArrowRight size={14} aria-hidden="true" className="muted" />
          <InputText value={p.with} onChange={(e) => set(i, { with: e.target.value })} placeholder={labels[1]} aria-label={labels[1]} className="p-inputtext-sm" />
          <Button icon={<X size={14} />} text rounded size="small" severity="secondary" aria-label="Remove this pair" disabled={value.length === 1} onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      <Button label="Add another" icon={<Plus size={14} />} text size="small" onClick={() => onChange([...value, { find: '', with: '' }])} />
    </div>
  );
}

const NEW_RULE = { column: null, cmp: 'eq', value: '', value2: '', result: '' };

/** "IF column <test> value THEN result" rules, one card each. */
function Conditions({ value, onChange, columns }) {
  const set = (i, patch) => onChange(value.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="rules">
      {value.map((rule, i) => {
        const { args } = comparatorOf(rule.cmp);
        return (
          <div className="rule" key={i}>
            <div className="rule__if">
              <span className="rule__word">{i === 0 ? 'If' : 'Otherwise, if'}</span>
              <label className="rule__cell"><span className="sr-only">Rule {i + 1}: column</span>
                <Dropdown value={rule.column} options={columns} onChange={(e) => set(i, { column: e.value })} placeholder="Column" filter className="w-full" />
              </label>
              <label className="rule__cell"><span className="sr-only">Rule {i + 1}: test</span>
                <Dropdown value={rule.cmp} options={COMPARATORS} optionLabel="label" optionValue="id" onChange={(e) => set(i, { cmp: e.value })} className="w-full" />
              </label>
              {args > 0 && <InputText value={rule.value} onChange={(e) => set(i, { value: e.target.value })} aria-label={`Rule ${i + 1}: value`} className="p-inputtext-sm rule__value" />}
              {args === 2 && (
                <>
                  <span className="rule__word">and</span>
                  <InputText value={rule.value2} onChange={(e) => set(i, { value2: e.target.value })} aria-label={`Rule ${i + 1}: upper value`} className="p-inputtext-sm rule__value" />
                </>
              )}
            </div>
            <div className="rule__then">
              <span className="rule__word">then give</span>
              <InputText value={rule.result} onChange={(e) => set(i, { result: e.target.value })} placeholder="(blank)" aria-label={`Rule ${i + 1}: result`} className="p-inputtext-sm rule__value" />
              <Button icon={<X size={14} />} text rounded size="small" severity="secondary" aria-label={`Remove rule ${i + 1}`} disabled={value.length === 1} onClick={() => onChange(value.filter((_, j) => j !== i))} />
            </div>
          </div>
        );
      })}
      <div><Button label="Add a rule" icon={<Plus size={14} />} text size="small" onClick={() => onChange([...value, { ...NEW_RULE }])} /></div>
    </div>
  );
}

/**
 * Renders the options of an operation from its `fields` description (see core/clean/operations.js and core/columns/ops/text.js).
 * `columns` = the column names a 'column' / 'columns' / 'conditions' field may offer.
 */
export default function OptionFields({ op, options, onChange, columns = [] }) {
  return op.fields.filter((f) => !f.showIf || f.showIf(options)).map((f) => {
    const value = options[f.key];
    const set = (v) => onChange({ ...options, [f.key]: v });
    if (f.type === 'checkbox') {
      return <label key={f.key} className="check"><Checkbox checked={!!value} onChange={(e) => set(e.checked)} /><span>{f.label}</span></label>;
    }
    const Wrapper = f.type === 'pairs' || f.type === 'conditions' ? 'div' : 'label';
    return (
      <Wrapper key={f.key} className={`field${f.type === 'conditions' ? ' span-2' : ''}`}>
        <span>{f.label}</span>
        {f.type === 'select' && <Dropdown value={value} options={f.options} optionLabel="label" optionValue="value" onChange={(e) => set(e.value)} className="w-full" />}
        {f.type === 'text' && <InputText value={value ?? ''} onChange={(e) => set(e.target.value)} placeholder={f.placeholder} />}
        {f.type === 'number' && <NumberInput label={f.label} value={value} onValueChange={(e) => e.value != null && set(e.value)} min={f.min} max={f.max} maxFractionDigits={f.digits ?? 0} inputClassName="num-input" />}
        {f.type === 'pairs' && <Pairs value={value} onChange={set} labels={f.labels} />}
        {f.type === 'column' && <Dropdown value={value} options={columns} onChange={(e) => set(e.value ?? null)} placeholder="Choose a column" filter showClear={!!f.optional} className="w-full" />}
        {f.type === 'columns' && <MultiSelect value={value} options={columns} onChange={(e) => set(e.value)} placeholder={f.optional ? 'None' : 'Choose columns'} display="chip" filter className="w-full" />}
        {f.type === 'conditions' && <Conditions value={value} onChange={set} columns={columns} />}
      </Wrapper>
    );
  });
}
