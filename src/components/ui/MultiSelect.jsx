import { forwardRef, useId } from 'react';
import { MultiSelect as PrimeMultiSelect } from 'primereact/multiselect';

/**
 * Standard UI MultiSelect Component.
 * Supports:
 * - Chip-based selection
 * - Filterable search
 * - Label and error bindings
 */
const MultiSelect = forwardRef(function MultiSelect(
  {
    label,
    value = [],
    options = [],
    onChange,
    placeholder = 'Select items',
    disabled = false,
    error,
    helperText,
    hint,
    required = false,
    filter = true,
    display = 'chip',
    className = '',
    id,
    inputId,
    ariaLabel,
    optionLabel,
    optionValue,
    ...restProps
  },
  ref,
) {
  const generatedId = useId();
  const actualId = id || inputId || generatedId;
  const displayHint = hint || helperText;

  const multiselectElement = (
    <div className={`ui-dropdown-wrapper ${className}`}>
      <PrimeMultiSelect
        ref={ref}
        id={actualId}
        inputId={actualId}
        value={value}
        options={options}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        filter={filter}
        display={display}
        optionLabel={optionLabel}
        optionValue={optionValue}
        aria-label={ariaLabel || label || placeholder}
        className={`w-full ${error ? 'p-invalid' : ''}`}
        {...restProps}
      />
    </div>
  );

  if (!label && !displayHint && !error) {
    return multiselectElement;
  }

  return (
    <label className="ui-field" htmlFor={actualId}>
      {label && (
        <span className="ui-field__label">
          <span className="ui-field__label-text">
            {label}
            {required && <span className="ui-field__required">*</span>}
          </span>
        </span>
      )}
      {multiselectElement}
      {displayHint && !error && <small className="ui-field__hint">{displayHint}</small>}
      {error && (
        <small className="ui-field__error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
});

export default MultiSelect;

