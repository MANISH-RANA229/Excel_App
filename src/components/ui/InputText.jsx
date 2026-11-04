import { forwardRef, useId } from 'react';
import { InputText as PrimeInputText } from 'primereact/inputtext';
import { X } from 'lucide-react';

/**
 * Standard UI InputText Component.
 * Encapsulates PrimeReact InputText with:
 * - Clean modern styling
 * - Label & error handling
 * - Left/Right icon support
 * - Clear button support
 * - Accessible aria-binding
 */
const InputText = forwardRef(function InputText(
  {
    label,
    value = '',
    onChange,
    placeholder,
    type = 'text',
    disabled = false,
    readOnly = false,
    error,
    helperText,
    hint,
    required = false,
    clearable = false,
    onClear,
    iconLeft: IconLeft,
    iconRight: IconRight,
    size = 'md',
    className = '',
    id,
    name,
    fullWidth = true,
    style,
    'aria-label': ariaLabel,
    ...restProps
  },
  ref,
) {
  const generatedId = useId();
  const actualId = id || generatedId;
  const displayHint = hint || helperText;

  const handleClear = (e) => {
    e.stopPropagation();
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '', name } });
    }
  };

  const inputSizeClass = size === 'sm' ? 'p-inputtext-sm ui-input--sm' : size === 'lg' ? 'ui-input--lg' : '';
  const iconPaddingClass = IconLeft ? 'ui-input--has-icon-left' : IconRight ? 'ui-input--has-icon-right' : '';

  const inputElement = (
    <div className={`ui-input-container ${fullWidth ? 'w-full' : ''}`}>
      {IconLeft && (
        <span className="ui-input__icon-left" aria-hidden="true">
          {typeof IconLeft === 'function' ? <IconLeft size={16} /> : IconLeft}
        </span>
      )}
      <PrimeInputText
        ref={ref}
        id={actualId}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        aria-label={ariaLabel || label || placeholder}
        aria-invalid={!!error}
        className={`ui-input ${inputSizeClass} ${iconPaddingClass} ${error ? 'p-invalid is-invalid' : ''} ${className}`}
        style={style}
        {...restProps}
      />
      {clearable && value && !disabled && !readOnly && (
        <button
          type="button"
          onClick={handleClear}
          className="ui-input__clear-btn"
          aria-label="Clear input"
        >
          <X size={13} />
        </button>
      )}
      {!clearable && IconRight && (
        <span className="ui-input__icon-right" aria-hidden="true">
          {typeof IconRight === 'function' ? <IconRight size={16} /> : IconRight}
        </span>
      )}
    </div>
  );

  if (!label && !displayHint && !error) {
    return inputElement;
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
      {inputElement}
      {displayHint && !error && <small className="ui-field__hint">{displayHint}</small>}
      {error && (
        <small className="ui-field__error" role="alert">
          {error}
        </small>
      )}
    </label>
  );
});

export default InputText;
export { InputText as Input };

