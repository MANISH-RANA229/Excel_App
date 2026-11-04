import { forwardRef, useId } from 'react';
import { Dropdown as PrimeDropdown } from 'primereact/dropdown';

/**
 * Standard UI Dropdown / Select Component.
 * Encapsulates PrimeReact Dropdown with:
 * - Unified design system styling
 * - Option array normalization (strings or objects)
 * - Accessible label & error binding
 * - Clearable and filterable options
 */
const Dropdown = forwardRef(function Dropdown(
  {
    label,
    value,
    options = [],
    onChange,
    placeholder = 'Select an option',
    disabled = false,
    error,
    helperText,
    hint,
    required = false,
    clearable = false,
    showClear,
    filter = false,
    size = 'md',
    className = '',
    style,
    id,
    inputId,
    ariaLabel,
    optionLabel,
    optionValue,
    itemTemplate,
    valueTemplate,
    emptyMessage = 'No options available',
    ...restProps
  },
  ref,
) {
  const generatedId = useId();
  const actualId = id || inputId || generatedId;
  const isClearable = showClear !== undefined ? showClear : clearable;
  const displayHint = hint || helperText;

  // Normalize string array options if optionLabel/optionValue are not explicitly supplied
  const normalizedOptions = Array.isArray(options) ? options : [];

  const dropdownElement = (
    <div className={`ui-dropdown-wrapper ${size === 'sm' ? 'ui-dropdown-wrapper--sm' : ''} ${className}`}>
      <PrimeDropdown
        ref={ref}
        id={actualId}
        inputId={actualId}
        value={value}
        options={normalizedOptions}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        showClear={isClearable}
        filter={filter}
        optionLabel={optionLabel}
        optionValue={optionValue}
        itemTemplate={itemTemplate}
        valueTemplate={valueTemplate}
        emptyMessage={emptyMessage}
        aria-label={ariaLabel || label || placeholder}
        className={`w-full ${error ? 'p-invalid' : ''}`}
        style={style}
        {...restProps}
      />
    </div>
  );

  // If no label or hint is provided, return just the dropdown wrapper
  if (!label && !displayHint && !error) {
    return dropdownElement;
  }

  return (
    <label className="ui-field" htmlFor={actualId}>
      {label && (
        <span className="ui-field__label">
          <span className="ui-field__label-text">
            {label}
            {required && <span className="ui-field__required">*</span>}
          </span>
          {!required && label && typeof required === 'boolean' && null}
        </span>
      )}
      {dropdownElement}
      {displayHint && !error && <small className="ui-field__hint">{displayHint}</small>}
      {error && (
        <small className="ui-field__error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
});

export default Dropdown;
export { Dropdown as Select };

