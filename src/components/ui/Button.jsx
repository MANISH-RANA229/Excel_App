import { forwardRef } from 'react';
import { Button as PrimeButton } from 'primereact/button';
import { Loader2 } from 'lucide-react';

/**
 * Standard UI Button Component.
 * Supports design-system variants while maintaining full PrimeReact backwards compatibility.
 *
 * Variants:
 * - primary: Forest green CTA
 * - secondary: Slate bordered neutral
 * - outline: Bordered transparent
 * - ghost: Flat borderless
 * - danger: Destructive red
 * - brand-subtle: Soft green pill/chip style
 */
const Button = forwardRef(function Button(
  {
    children,
    label,
    icon,
    iconRight,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    fullWidth = false,
    className = '',
    severity,
    outlined,
    text,
    rounded,
    onClick,
    type = 'button',
    ...restProps
  },
  ref,
) {
  // Determine variant class mapping if custom variant is used and not overridden by PrimeReact severity
  let variantClass = '';
  if (!severity && !outlined && !text) {
    switch (variant) {
      case 'secondary':
        variantClass = 'ui-button--secondary';
        break;
      case 'outline':
        variantClass = 'ui-button--outline';
        break;
      case 'ghost':
        variantClass = 'ui-button--ghost';
        break;
      case 'danger':
        variantClass = 'ui-button--danger';
        break;
      case 'brand-subtle':
        variantClass = 'ui-button--brand-subtle';
        break;
      case 'primary':
      default:
        variantClass = 'ui-button--primary';
        break;
    }
  }

  const sizeClass = size === 'sm' ? 'p-button-sm ui-button--sm' : size === 'lg' ? 'p-button-lg ui-button--lg' : '';
  const fullWidthClass = fullWidth ? 'w-full' : '';

  const renderIcon = (iconProp) => {
    if (!iconProp) return null;
    if (typeof iconProp === 'function') {
      const IconComponent = iconProp;
      return <IconComponent size={size === 'sm' ? 14 : 16} />;
    }
    return iconProp;
  };

  const loadingSpinner = loading ? <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" /> : null;

  return (
    <PrimeButton
      ref={ref}
      type={type}
      label={label}
      icon={loading ? loadingSpinner : renderIcon(icon)}
      iconPos={iconRight ? 'right' : 'left'}
      severity={severity}
      outlined={outlined}
      text={text}
      rounded={rounded}
      disabled={disabled || loading}
      onClick={onClick}
      className={`ui-button ${variantClass} ${sizeClass} ${fullWidthClass} ${className}`}
      {...restProps}
    >
      {children}
    </PrimeButton>
  );
});

export default Button;

