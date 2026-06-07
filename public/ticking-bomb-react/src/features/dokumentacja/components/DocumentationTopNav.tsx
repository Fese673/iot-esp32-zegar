interface DocumentationTopNavProps {
  onBack: () => void;
}

function DocumentationTopNav({ onBack }: DocumentationTopNavProps) {
  return (
    <header className="panel docs-topnav">
      <div>
        <p className="eyebrow mono">Tryb dokumentacji</p>
        <h1>ZEGAR-ESP32 — Dokumentacja</h1>
        <p className="muted">Dokumentacja w fazie rozwoju — niepełna</p>
      </div>

      <div className="docs-topnav-actions">
        <button className="primary-btn" type="button" onClick={onBack}>
          Powrot do dashboardu
        </button>
      </div>
    </header>
  );
}

export default DocumentationTopNav;
