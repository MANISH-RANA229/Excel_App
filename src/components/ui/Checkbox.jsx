import { forwardRef, useId } from 'react';
import { Checkbox as PrimeCheckbox } from 'primereact/checkbox';

/**
 * Standard UI Checkbox Component.
 * Supports:
 * - Proper label and optional description
 * - Accessible keyboard and click interaction
 * - Error message display
 */
const Checkbox = forwardRef(function Checkbox(
  {
    checked = false,
    onChange,
    label,
    description,
    disabled = false,
    error,
    id,
    inputId,
    className = '',
    name,
    'aria-label': ariaLabel,
    ...restProps
  },
  ref,
) {
  const generatedId = useId();
  const actualId = id || inputId || generatedId;

  const checkboxElement = (
    <PrimeCheckbox
      ref={ref}
      inputId={actualId}
      name={name}
      checked={!!checked}
      onChange={onChange}
      disabled={disabled}
      aria-label={ariaLabel || (typeof label === 'string' ? label : undefined)}
      className={error ? 'p-invalid' : ''}
      {...restProps}
    />
  );

  if (!label && !description && !error) {
    return checkboxElement;
  }

  return (
    <label
      htmlFor={actualId}
      className={`ui-checkbox-container ${disabled ? 'is-disabled' : ''} ${className}`}
    >
      {checkboxElement}
      {(label || description || error) && (
        <span className="ui-checkbox-content">
          {label && <span className="ui-checkbox-label">{label}</span>}
          {description && <span className="ui-checkbox-desc">{description}</span>}
          {error && (
            <small className="ui-field__error" role="alert">
              {error}
            </small>
          )}
        </span>
      )}
    </label>
  );
});

export default Checkbox;

