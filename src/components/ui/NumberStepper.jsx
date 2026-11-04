import { useEffect, useRef, forwardRef } from 'react';
import { InputNumber as PrimeInputNumber } from 'primereact/inputnumber';

/**
 * Standard UI NumberStepper / NumberInput Component.
 * Ensures accessibility for spinner buttons and provides clean density styling.
 */
const NumberStepper = forwardRef(function NumberStepper(
  {
    label,
    value,
    onChange,
    onValueChange,
    min,
    max,
    step = 1,
    disabled = false,
    showButtons = true,
    buttonLayout = 'horizontal',
    className = '',
    inputClassName = '',
    ...restProps
  },
  ref,
) {
  const localRef = useRef(null);
  const targetRef = ref || localRef;

  useEffect(() => {
    const root = targetRef.current?.getElement?.();
    if (!root) return;
    const input = root.querySelector('input');
    if (input && label) input.setAttribute('aria-label', label);
    root.querySelector('.p-inputnumber-button-up')?.setAttribute('aria-label', `Increase ${label || 'value'}`);
    root.querySelector('.p-inputnumber-button-down')?.setAttribute('aria-label', `Decrease ${label || 'value'}`);
  }, [label, targetRef]);

  return (
    <PrimeInputNumber
      ref={targetRef}
      value={value}
      onChange={onChange}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      showButtons={showButtons}
      buttonLayout={buttonLayout}
      className={`ui-number-stepper ${className}`}
      inputClassName={inputClassName}
      {...restProps}
    />
  );
});

export default NumberStepper;
export { NumberStepper as NumberInput };

