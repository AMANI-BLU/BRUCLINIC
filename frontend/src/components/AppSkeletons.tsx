import '../pages/login-skeleton.css';

/** Mirrors the real login page so a refresh never flashes the app shell. */
export function LoginSkeleton() {
  return (
    <div className="login-page-container login-skeleton-screen" role="status" aria-label="Loading sign in">
      <span className="login-theme-toggle login-skeleton-toggle">
        <span className="login-skeleton-block login-skeleton-toggle-icon" />
        <span className="login-skeleton-block login-skeleton-toggle-text" />
      </span>

      <div className="login-card-wrapper login-simple-card login-skeleton-card">
        <section className="login-left-panel login-brand-panel login-skeleton-brand-panel" aria-hidden="true">
          <div className="login-brand-header">
            <span className="login-skeleton-logo login-skeleton-block" />
            <div className="login-brand-titles">
              <span className="login-skeleton-block login-skeleton-brand-name" />
              <span className="login-skeleton-block login-skeleton-brand-sub" />
            </div>
          </div>
        </section>

        <section className="login-right-panel" aria-hidden="true">
          <div className="login-form-header">
            <span className="login-skeleton-block login-skeleton-title" />
            <span className="login-skeleton-block login-skeleton-sub" />
          </div>

          <div className="login-skeleton-fields">
            <span className="login-skeleton-block login-skeleton-label" />
            <span className="login-skeleton-block login-skeleton-field" />
            <span className="login-skeleton-block login-skeleton-label" />
            <span className="login-skeleton-block login-skeleton-field" />
            <span className="login-skeleton-block login-skeleton-btn" />
          </div>
        </section>
      </div>
    </div>
  );
}

/** App-shell skeleton used only while a stored staff session is validated. */
export function AppBootstrapSkeleton() {
  return (
    <div className="clinic-bootstrap-skeleton" role="status" aria-label="Loading clinic">
      <div className="clinic-skeleton-topbar">
        <span className="clinic-skeleton-block clinic-skeleton-brand" />
        <span className="clinic-skeleton-block clinic-skeleton-top-actions" />
      </div>
      <div className="clinic-skeleton-workspace">
        <aside className="clinic-skeleton-sidebar" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span className="clinic-skeleton-block clinic-skeleton-nav-item" key={index} />
          ))}
        </aside>
        <main className="page-visit-skeleton clinic-skeleton-main" aria-hidden="true">
          <span className="page-skeleton-block page-skeleton-heading" />
          <div className="page-skeleton-metrics">
            {Array.from({ length: 4 }, (_, index) => (
              <span className="page-skeleton-block" key={index} />
            ))}
          </div>
          <div className="page-skeleton-content">
            <span className="page-skeleton-block page-skeleton-subheading" />
            <span className="page-skeleton-block page-skeleton-line" />
            <span className="page-skeleton-block page-skeleton-line" />
            <span className="page-skeleton-block page-skeleton-line page-skeleton-line-short" />
          </div>
        </main>
      </div>
    </div>
  );
}
