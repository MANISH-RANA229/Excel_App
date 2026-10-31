import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { OPS } from '../../core/columns/operations.js';
import OptionFields from '../../shared/fields/OptionFields.jsx';

/** One new column: its name, and the options of the operation that works it out. */
export default function BuilderStepCard({ step, index, count, available, finalName, problem, onChange, onRemove, onMove }) {
  const op = OPS[step.op];
  return (
    <div className={`step${problem ? ' is-incomplete' : ''}`}>
      <div className="step__head">
        <span className="step__no">{index + 1}</span>
        <div className="step__title">
          <strong>{op.label}</strong>
          <p className="muted">{op.description}</p>
        </div>
        <div className="step__actions">
          <Button icon={<ArrowUp size={14} />} text rounded size="small" severity="secondary" aria-label="Move step up" disabled={index === 0} onClick={() => onMove(-1)} />
          <Button icon={<ArrowDown size={14} />} text rounded size="small" severity="secondary" aria-label="Move step down" disabled={index === count - 1} onClick={() => onMove(1)} />
          <Button icon={<X size={14} />} text rounded size="small" severity="secondary" aria-label="Remove step" onClick={onRemove} />
        </div>
      </div>
      <div className="step__body">
        <label className="field">
          <span>Name of the new column</span>
          <InputText value={step.name} onChange={(e) => onChange({ name: e.target.value })} placeholder={op.defaultName(step.options)} maxLength={120} />
          {step.name.trim() && finalName !== step.name.trim() && <small className="muted">Another column has this name, so it will be called “{finalName}”.</small>}
        </label>
        <OptionFields op={op} options={step.options} onChange={(options) => onChange({ options })} columns={available} />
        {problem && <small className="field-error span-2" role="alert">{problem}</small>}
      </div>
    </div>
  );
}
