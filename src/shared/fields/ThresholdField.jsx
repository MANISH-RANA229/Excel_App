import { useId } from 'react';
import { Slider } from 'primereact/slider';
import NumberInput from './NumberInput.jsx';

/** A percentage with a slider and an exact input, e.g. "minimum match". */
export default function ThresholdField({ label, value, onChange, min = 50, max = 100, hint }) {
  const labelId = useId();
  return (
    <div className="field">
      <span id={labelId}>{label}</span>
      <div className="threshold">
        <Slider value={value} onChange={(e) => onChange(e.value)} min={min} max={max} aria-labelledby={labelId} className="threshold__slider" />
        <NumberInput label={label} showButtons={false} value={value} onValueChange={(e) => e.value != null && onChange(Math.min(max, Math.max(min, e.value)))} min={min} max={max} suffix="%" inputClassName="num-input" />
      </div>
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}
