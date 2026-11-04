import { forwardRef } from 'react';
import { SelectButton as PrimeSelectButton } from 'primereact/selectbutton';

/**
 * Standard UI SelectButton / Segmented Control Component.
 * Supports modern pill segment switching with clean elevation.
 */
const SelectButton = forwardRef(function SelectButton(
  {
    value,
    options = [],
    onChange,
    optionLabel = 'label',
    optionValue = 'value',
    disabled = false,
    className = '',
    unselectable = false,
    ...restProps
  },
  ref,
) {
  return (
    <PrimeSelectButton
      ref={ref}
      value={value}
      options={options}
      onChange={onChange}
      optionLabel={optionLabel}
      optionValue={optionValue}
      disabled={disabled}
      unselectable={unselectable}
      className={`ui-segmented-control ${className}`}
      {...restProps}
    />
  );
});

export default SelectButton;
export { SelectButton as SegmentedControl };

