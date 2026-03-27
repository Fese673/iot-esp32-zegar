import type { LoadState, LiveRecord } from '../../../shared/types';

interface LiveGridProps {
  liveRecord: LiveRecord | null;
  loadState: LoadState;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  lastSeen: string;
}

function LiveGrid({ liveRecord, loadState, connectionStatus, lastSeen }: LiveGridProps) {
  const isLive = Boolean(liveRecord) && loadState === 'loaded';
  const connectionLabel =
    connectionStatus === 'connected'
      ? 'online'
      : connectionStatus === 'reconnecting'
        ? 'reconnecting'
        : 'offline';

  return (
    <section className="live-grid" aria-label="Widok LIVE">
      <article className="stat-card sensor-card temp-card">
        <header className="stat-top">
          <p className="label">Temperatura</p>
          <span className="tag">°C</span>
        </header>
        <p className="value" id="tempValue">{liveRecord ? liveRecord.t.toFixed(1) : '--'}</p>
        <p className="muted" id="tempMeta">{isLive ? 'LIVE' : 'Czekam na dane'}</p>
        <div className="card-accent-bar temp-bar"></div>
      </article>

      <article className="stat-card sensor-card hum-card">
        <header className="stat-top">
          <p className="label">Wilgotność</p>
          <span className="tag">%</span>
        </header>
        <p className="value" id="humValue">{liveRecord ? Math.round(liveRecord.h) : '--'}</p>
        <p className="muted" id="humMeta">{isLive ? 'LIVE' : 'Czekam na dane'}</p>
        <div className="card-accent-bar hum-bar"></div>
      </article>

      <article className="stat-card sensor-card press-card">
        <header className="stat-top">
          <p className="label">Ciśnienie atmosferyczne</p>
          <span className="tag">hPa</span>
        </header>
        <p className="value" id="pressValue">{liveRecord ? Math.round(liveRecord.p) : '--'}</p>
        <p className="muted" id="pressMeta">{isLive ? 'LIVE' : 'Czekam na dane'}</p>
        <div className="card-accent-bar press-bar"></div>
      </article>

      <article className="stat-card connection-card">
        <header className="stat-top">
          <p className="label">Połączenie</p>
          <span className="tag live">LIVE</span>
        </header>
        <p className="value" id="connectionLabel">{connectionLabel}</p>
        <p className="muted">Ostatni odczyt <span id="lastSeen">{lastSeen}</span></p>
        <div className="card-accent-bar conn-bar"></div>
      </article>
    </section>
  );
}

export default LiveGrid;
