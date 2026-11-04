/**
 * Standard UI Badge / Tag Component.
 * High-legibility status pills with accessible contrast.
 */
export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  ...props
}) {
  const variantClass = `ui-badge--${variant}`;
  const sizeClass = size === 'sm' ? 'ui-badge--sm' : '';

  return (
    <span className={`ui-badge ${variantClass} ${sizeClass} ${className}`} {...props}>
      {dot && <span className="ui-badge__dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export { Badge as Tag };

