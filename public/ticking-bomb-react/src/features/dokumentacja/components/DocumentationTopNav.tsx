interface DocumentationTopNavProps {
  onBack: () => void;
  totalSections: number;
}

function DocumentationTopNav({ onBack, totalSections }: DocumentationTopNavProps) {
  return (
    <header className="panel docs-topnav">
      <div>
        <p className="eyebrow mono">Tryb dokumentacji</p>
        <h1>Biblia projektu ZEGAR-ESP32</h1>
        <p className="muted">Sekcje aktywne: {totalSections}</p>
      </div>

      <div className="docs-topnav-actions">
        <a className="ghost-btn" href="#dokumentacja">Na poczatek dokumentacji</a>
        <button className="primary-btn" type="button" onClick={onBack}>
          Powrot do dashboardu
        </button>
      </div>
    </header>
  );
}

export default DocumentationTopNav;
