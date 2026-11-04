/**
 * Standard UI Card Component and sub-components.
 */
export function Card({ children, className = '', hoverable = false, ...props }) {
  return (
    <div className={`ui-card ${hoverable ? 'ui-card--hoverable' : ''} ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div className={`ui-card__header ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3 className={`ui-card__title ${className}`} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p className={`ui-card__description ${className}`} {...props}>
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`ui-card__body ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div className={`ui-card__footer ${className}`} {...props}>
      {children}
    </div>
  );
}

export default Card;

