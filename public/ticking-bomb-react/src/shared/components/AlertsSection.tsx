import { useAppContext } from '../../App';

function AlertsSection() {
  const { state, dismissAlert } = useAppContext();

  return (
    <section className="system">
      <article className="system-card">
        <header>
          <p className="eyebrow">Stany</p>
          <h3>Powiadomienia i błędy</h3>
        </header>
        <div id="alertStack" className="alert-stack" aria-live="polite">
          {state.alerts.length === 0 ? (
            <p className="muted">Brak aktywnych alertów.</p>
          ) : (
            state.alerts.map((alert) => (
              <article key={alert.id} className={`alert ${alert.level}`}>
                <p>{alert.message}</p>
                <button type="button" className="ghost-btn" onClick={() => dismissAlert(alert.id)} aria-label="Usuń alert">
                  ×
                </button>
              </article>
            ))
          )}
        </div>
      </article>
    </section>
  );
}

export default AlertsSection;
