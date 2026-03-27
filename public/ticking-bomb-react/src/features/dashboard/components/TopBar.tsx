interface TopBarProps {
  motionEnabled: boolean;
  onToggleMotion: () => void;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
}

function TopBar({ motionEnabled, onToggleMotion, connectionStatus }: TopBarProps) {
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
            <img src="/bomba.gif" id="bombGif" alt="Bomba" />
          </div>
        </div>
        <div className="status-pill" id="statusIndicator" role="status" aria-live="polite">
          <span className={`dot ${statusClass}`} aria-hidden="true"></span>
          <span className="status-label">{statusLabel}</span>
        </div>
      </div>

      <div className="topbar-center" aria-label="Tytuł Projektu">
        <div className="title-box">
          <h1 className="title-text">T I C K I N G • B O M B</h1>
        </div>
      </div>

      <div className="topbar-right">
        <button className="ghost-btn" id="toggleMotion" aria-pressed={motionEnabled} onClick={onToggleMotion}>
          Animacje: {motionEnabled ? 'włączone' : 'wyłączone'}
        </button>
        <button className="primary-btn" id="btnRefresh">⏳ Odśwież</button>
      </div>
    </header>
  );
}

export default TopBar;
