import { useMemo, useState } from 'react';
import type { LoadState, PmsRaw } from '../../../shared/types';

type Severity = 'good' | 'warn' | 'alert';

interface LiveRow {
  key: 'pm1' | 'pm25' | 'pm10';
  label: string;
  fraction: string;
  value: number;
  fill: number;
  severity: Severity;
}

interface PmsLivePanelProps {
  liveData: PmsRaw | null;
  liveStatus: LoadState;
  liveTimestamp: number | null;
}

function formatCount(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  return Number(value).toFixed(1);
}

function severityFor(fill: number): Severity {
  if (fill >= 78) {
    return 'alert';
  }

  if (fill >= 52) {
    return 'warn';
  }

  return 'good';
}

function severityLabel(fill: number): string {
  if (fill >= 78) {
    return 'alarm';
  }

  if (fill >= 52) {
    return 'uwaga';
  }

  return 'norma';
}

function rowTitle(key: LiveRow['key']): string {
  if (key === 'pm1') {
    return 'Pył średni (PM1.0)';
  }

  if (key === 'pm25') {
    return 'Pył zawieszony (PM2.5)';
  }

  return 'Pył gruby (PM10)';
}

function rowDescription(key: LiveRow['key']): string {
  if (key === 'pm1') {
    return 'Szybka odpowiedź na drobny aerozol i spalanie.';
  }

  if (key === 'pm25') {
    return 'Najważniejszy wskaźnik jakości powietrza.';
  }

  return 'Sygnalizuje kurz, pył mechaniczny i osad.';
}

function buildRows(liveData: PmsRaw | null): LiveRow[] {
  const values = {
    pm1: liveData?.pm1 ?? 0,
    pm25: liveData?.pm25 ?? 0,
    pm10: liveData?.pm10 ?? 0,
  };
  const peak = Math.max(values.pm1, values.pm25, values.pm10, 1);

  return ([
    { key: 'pm1', label: 'PM 1.0', fraction: 'PM1.0', value: values.pm1 },
    { key: 'pm25', label: 'PM 2.5', fraction: 'PM2.5', value: values.pm25 },
    { key: 'pm10', label: 'PM 10.0', fraction: 'PM10.0', value: values.pm10 },
  ] as const).map((row) => {
    const fill = peak > 0 ? Math.min(100, (row.value / peak) * 100) : 0;

    return {
      ...row,
      fill,
      severity: severityFor(fill),
    };
  });
}

export default function PmsLivePanel({ liveData, liveStatus, liveTimestamp }: PmsLivePanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rows = useMemo(() => buildRows(liveData), [liveData]);
  const dominantRow = rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]);
  const averageFill = rows.reduce((sum, row) => sum + row.fill, 0) / rows.length;
  const selectedRow = rows[selectedIndex] ?? dominantRow;
  const sourceLabel = liveTimestamp ? new Date(liveTimestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'bez daty';
  const statusLabel = liveStatus === 'loaded' ? 'dane live z Firebase' : liveStatus === 'empty' ? 'brak danych' : liveStatus === 'error' ? 'błąd odczytu' : 'ładowanie';
  const story = liveStatus === 'loaded'
    ? `Dominują teraz ${dominantRow.label}. To wskazuje, że największy udział ma ${dominantRow.fraction} i właśnie tę frakcję warto obserwować najbliżej.`
    : 'Czekam na dane live, aby pokazać dominującą frakcję i rozkład odczytów.';

  return (
    <section className="pm-live-panel" aria-label="PM Frakcje - warstwowy panel z danych Firebase">
      <header className="pm-live-hero">
        <div className="pm-live-hero-copy">
          <p className="eyebrow">PMS5003 / React</p>
          <h3>PM Frakcje</h3>
          <p>
            Ten widok pokazuje aktualny rozkład frakcji pyłu bez iframe. Panel działa jako normalny komponent React i czyta
            dane live bezpośrednio z Firebase.
          </p>
          <div className="pm-live-badges">
            <span className="badge"><span className="swatch"></span>{statusLabel}</span>
            <span className="badge">A → F</span>
            <span className="badge">komponent React</span>
          </div>
        </div>

        <div className="pm-live-hero-stats">
          <article className="pm-live-mini-card good">
            <p className="label">Najwyższy odczyt</p>
            <p className="value">{formatCount(dominantRow.value)}</p>
            <p className="meta">{dominantRow.label} · {dominantRow.fraction}</p>
          </article>
          <article className="pm-live-mini-card warn">
            <p className="label">Średnie wypełnienie</p>
            <p className="value">{Math.round(averageFill)}%</p>
            <p className="meta">Wizualna gęstość panelu</p>
          </article>
          <article className="pm-live-mini-card accent">
            <p className="label">Strefa dominująca</p>
            <p className="value">{dominantRow.fraction}</p>
            <p className="meta">Odczyt z {sourceLabel}</p>
          </article>
          <article className="pm-live-mini-card alert">
            <p className="label">Kierunek</p>
            <p className="value">{liveStatus === 'loaded' ? 'LIVE' : '—'}</p>
            <p className="meta">{liveStatus === 'loaded' ? 'Aktywne odczyty z urządzenia' : 'Brak potwierdzonego strumienia'}</p>
          </article>
        </div>
      </header>

      <div className="pm-live-layout">
        <section className="pm-live-chart" aria-label="Wykres historii pyłów PM">
          <header className="pm-live-chart-head">
            <div>
              <p className="eyebrow">Wykres</p>
              <h4>Frakcje PM w układzie warstwowym</h4>
              <p>Każda kolumna pokazuje bieżący udział frakcji w aktualnej próbce.</p>
            </div>
            <button type="button" className="chip chip-action" onClick={() => setDetailsOpen(true)}>Szczegóły</button>
          </header>

          <div className="pm-live-chart-shell">
            <div className="pm-live-y-axis" aria-hidden="true">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>

            <div className="pm-live-bars" role="list" aria-label="Odczyty frakcji PM">
              {rows.map((row, index) => (
                <button
                  key={row.key}
                  type="button"
                  className={`pm-live-bar-col${selectedIndex === index ? ' selected' : ''}`}
                  role="listitem"
                  onClick={() => setSelectedIndex(index)}
                >
                  <span className={`pm-live-topline ${row.severity}`}>{severityLabel(row.fill)}</span>
                  <span className="pm-live-bar-outer">
                    <span className="pm-live-bar-vessel">
                      <span className="pm-live-bar-fill">
                        <span className="pm-live-bar-base"></span>
                        <span className="pm-live-bar-mid"></span>
                        <span className={`pm-live-bar-top ${row.severity}${selectedIndex === index ? ' flash' : ''}`}></span>
                      </span>
                    </span>
                  </span>
                  <span className="pm-live-label-pct">{Math.round(row.fill)}%</span>
                  <span className={`pm-live-label-val ${row.severity}`}>{formatCount(row.value)}</span>
                  <span className="pm-live-axis-label">
                    <strong>{row.fraction}</strong>
                    <span>{row.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <footer className="pm-live-chart-footer">
            <span>Źródło: devices/device1/latest</span>
            <span>Tryb: {statusLabel}</span>
          </footer>
        </section>

        <aside className="pm-live-info" aria-label="Historia i kontekst frakcji">
          <div className="pm-live-info-block story-block">
            <p className="eyebrow">Historia</p>
            <p className="story-copy">{story}</p>
            <div className="story-tags">
              <span className={`story-tag ${dominantRow.severity}`}><span className="dot"></span>{dominantRow.fraction}</span>
              <span className={`story-tag ${dominantRow.severity}`}><span className="dot"></span>{rowTitle(dominantRow.key)}</span>
              <span className="story-tag"><span className="dot"></span>{statusLabel}</span>
            </div>
          </div>

          <div className="pm-live-info-block thresholds">
            <p className="eyebrow">Progi</p>
            {rows.map((row) => (
              <div key={row.key} className={`threshold-row ${row.severity}`}>
                <span className="dot"></span>
                <strong>{row.label}</strong>
                <span>{rowDescription(row.key)}</span>
              </div>
            ))}
          </div>

          <div className="pm-live-info-block">
            <p className="eyebrow">Kontekst</p>
            <ul className="info-list">
              <li>Ten panel jest już częścią aplikacji React, nie osobnym dokumentem.</li>
              <li>Wartości pochodzą z tego samego live feedu, który zasila kartę PMS5003.</li>
              <li>Kontrola A → F pozostaje aktywna w warstwie danych.</li>
            </ul>
          </div>
        </aside>
      </div>

      {detailsOpen ? (
        <>
          <button type="button" className="pm-live-backdrop" aria-label="Zamknij szczegóły" onClick={() => setDetailsOpen(false)}></button>
          <section className="pm-live-drawer" aria-label="Szczegóły frakcji">
            <header className="pm-live-drawer-head">
              <div>
                <p className="eyebrow">Szczegóły</p>
                <h4>{selectedRow.label} · {rowTitle(selectedRow.key)}</h4>
              </div>
              <button type="button" className="pm-live-drawer-close" aria-label="Zamknij" onClick={() => setDetailsOpen(false)}>×</button>
            </header>

            <div className="pm-live-drawer-grid">
              <article className="pm-live-drawer-card">
                <span>Odczyt</span>
                <strong>{formatCount(selectedRow.value)}</strong>
              </article>
              <article className="pm-live-drawer-card">
                <span>Wypełnienie</span>
                <strong>{Math.round(selectedRow.fill)}%</strong>
              </article>
              <article className="pm-live-drawer-card">
                <span>Stan</span>
                <strong>{severityLabel(selectedRow.fill).toUpperCase()}</strong>
              </article>
            </div>

            <p className="pm-live-drawer-foot">
              {rowDescription(selectedRow.key)} To jest zintegrowany Reactowy odpowiednik wcześniejszego iframe.
            </p>
          </section>
        </>
      ) : null}
    </section>
  );
}