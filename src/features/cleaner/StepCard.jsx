import { Button } from '../../components/ui/index.js';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { OPS } from '../../core/clean/operations.js';
import ColumnMultiField from '../../shared/fields/ColumnMultiField.jsx';
import OptionFields from '../../shared/fields/OptionFields.jsx';

/** One cleaning step: which columns, and the options of its operation. */
export default function StepCard({ step, index, count, dataset, onChange, onRemove, onMove }) {
  const op = OPS[step.op];
  const incomplete = op.columns !== 'none' && step.columns.length === 0;
  return (
    <div className={`step${incomplete ? ' is-incomplete' : ''}`}>
      <div className="step__head">
        <span className="step__no">{index + 1}</span>
        <div className="step__title">
          <strong>{op.label}</strong>
          <p className="muted">{op.description}</p>
        </div>
        <div className="step__actions">
          <Button icon={<ArrowUp size={14} />} text rounded size="sm" severity="secondary" aria-label="Move step up" disabled={index === 0} onClick={() => onMove(-1)} />
          <Button icon={<ArrowDown size={14} />} text rounded size="sm" severity="secondary" aria-label="Move step down" disabled={index === count - 1} onClick={() => onMove(1)} />
          <Button icon={<X size={14} />} text rounded size="sm" severity="secondary" aria-label="Remove step" onClick={onRemove} />
        </div>
      </div>
      <div className="step__body">
        {op.columns !== 'none' && (
          <ColumnMultiField
            label="Apply to columns"
            dataset={dataset}
            value={step.columns}
            onChange={(columns) => onChange({ columns })}
            placeholder="Choose columns"
            error={incomplete ? 'Pick at least one column' : null}
          />
        )}
        <OptionFields op={op} options={step.options} onChange={(options) => onChange({ options })} columns={dataset.columns} />
      </div>
    </div>
  );
}
