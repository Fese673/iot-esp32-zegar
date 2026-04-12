interface TopBarProps {
  motionEnabled: boolean;
  onToggleMotion: () => void;
  onRefresh: () => void;
  onOpenAnalysis: () => void;
  onOpenDocumentation: () => void;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
}

const TITLE_TEXT = 'T I C K I N G • B O M B';

function TopBar({
  motionEnabled,
  onToggleMotion,
  onRefresh,
  onOpenAnalysis,
  onOpenDocumentation,
  connectionStatus,
}: TopBarProps) {
  const statusLabel =
    connectionStatus === 'connected'
      ? 'Online'
      : connectionStatus === 'reconnecting'
        ? 'Brak nowych danych'
        : 'Brak danych > 60s';
  const statusClass =
    connectionStatus === 'connected'
      ? 'online'
      : connectionStatus === 'reconnecting'
        ? 'reconnecting'
        : '';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="brand">
          <div className="brand-mark" aria-label="Bomba">
            <img src="/bomba-2.gif" id="bombGif" alt="Bomba" />
          </div>
        </div>
        <div className="status-pill" id="statusIndicator" role="status" aria-live="polite">
          <span className={`dot ${statusClass}`} aria-hidden="true"></span>
          <span className="status-label">{statusLabel}</span>
        </div>
      </div>

      <div className="topbar-center" aria-label="Tytuł Projektu">
        <div className="title-box">
          <h1 className="title-text" aria-label="TICKING BOMB" data-title={TITLE_TEXT}>
            {Array.from(TITLE_TEXT).map((character, index) => (
              <span
                key={`${character}-${index}`}
                className="title-letter animate"
                style={{ animationDelay: `${index * 80}ms` }}
                aria-hidden="true"
              >
                {character === ' ' ? '\u00a0' : character}
              </span>
            ))}
          </h1>
        </div>
      </div>

      <div className="topbar-right">
        <button className="ghost-btn" id="toggleMotion" type="button" aria-pressed={motionEnabled} onClick={onToggleMotion}>
          Animacje: {motionEnabled ? 'włączone' : 'wyłączone'}
        </button>
        <button className="primary-btn" id="btnDocumentation" type="button" onClick={onOpenDocumentation}>
          📘 Dokumentacja
        </button>
        <button className="primary-btn" id="btnDataAnalysis" type="button" onClick={onOpenAnalysis}>
          📊 Analiza danych
        </button>
        <button className="primary-btn" id="btnRefresh" type="button" onClick={onRefresh}>⏳ Odśwież</button>
      </div>
    </header>
  );
}

export default TopBar;
