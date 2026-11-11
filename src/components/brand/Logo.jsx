// The Excel Suite mark: a green tile with sheet grid lines and one selected cell, drawn with Excel's fill handle (the small
// square at the selection's corner you drag to fill a range). public/favicon.svg is the same drawing; keep them in step.

export function LogoMark({ size = 28, className = '', title }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="7" fill="#15804a" />
      <rect width="32" height="32" rx="7" fill="url(#xs-logo-sheen)" />
      <path d="M0 11.5h32M0 21.5h32M12.5 0v32" stroke="#fff" strokeOpacity="0.22" strokeWidth="1.2" />
      <rect x="12.5" y="11.5" width="12" height="10" fill="#fff" fillOpacity="0.16" stroke="#fff" strokeWidth="2.2" />
      <rect x="22.3" y="19.3" width="4.4" height="4.4" fill="#fff" stroke="#15804a" strokeWidth="1.1" />
      <defs>
        <linearGradient id="xs-logo-sheen" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Mark + wordmark. `tag` is the small chip after the name (e.g. "PRO"); omit it for none. */
export default function Logo({ size = 28, tag, className = '' }) {
  return (
    <span className={`logo ${className}`}>
      <LogoMark size={size} />
      <span className="logo__word">Excel<span className="logo__suite">Suite</span></span>
      {tag && <span className="logo__tag">{tag}</span>}
    </span>
  );
}
