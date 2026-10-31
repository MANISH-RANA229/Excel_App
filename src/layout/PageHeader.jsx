export default function PageHeader({ title, subtitle, badge, actions }) {
  return (
    <div className="page-header">
      <div className="page-header__text">
        <div className="page-header__title">
          <h1>{title}</h1>
          {badge && <span className="page-header__badge">{badge}</span>}
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </div>
  );
}
