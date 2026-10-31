import { useEffect, useRef } from 'react';
import { InputNumber } from 'primereact/inputnumber';

/**
 * The app's number box: − / + buttons beside the value, and a name for every part so screen readers can announce
 * them (PrimeReact leaves the spinner buttons unnamed). `label` says what the number is.
 */
export default function NumberInput({ label, showButtons = true, ...props }) {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current?.getElement?.();
    if (!root) return;
    root.querySelector('input')?.setAttribute('aria-label', label);
    root.querySelector('.p-inputnumber-button-up')?.setAttribute('aria-label', `Increase ${label}`);
    root.querySelector('.p-inputnumber-button-down')?.setAttribute('aria-label', `Decrease ${label}`);
  });
  return <InputNumber ref={ref} showButtons={showButtons} buttonLayout="horizontal" {...props} />;
}
