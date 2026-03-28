import { useEffect, useMemo, useRef, useState } from 'react';
import { usePmsLive } from '../hooks/usePmsLive';
import {
  buildParticleRows,
  formatParticleCount,
  getParticleStatusLabel,
  getParticleTrendLabel,
  guideFor,
  rowDescription,
  rowTitle,
  severityLabel,
  type PmsParticleRow,
} from '../lib/pmsLiveHelpers';

export default function PmsLivePanel() {
  const { data: liveRecord, status: liveStatus, timestamp: liveTimestamp } = usePmsLive();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const previousRowsRef = useRef<PmsParticleRow[] | null>(null);
  const rows = useMemo(() => buildParticleRows(liveRecord), [liveRecord]);
  const dominantRow = rows.reduce((best, row) => (row.value > best.value ? row : best), rows[0]);
  const averageFill = rows.reduce((sum, row) => sum + row.fill, 0) / rows.length;
  const selectedRow = rows[selectedIndex] ?? dominantRow;
  const sourceLabel = liveTimestamp ? new Date(liveTimestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'bez daty';
  const statusLabel = getParticleStatusLabel(liveStatus);
  const trendLabel = getParticleTrendLabel(rows, previousRowsRef.current);
  const story = liveStatus === 'loaded'
    ? `Dominują teraz <strong>${dominantRow.fraction}</strong>. To jest Wykres 1 z PMS5003, więc pokazuje liczbę cząstek w binach sensora, a nie klasyczne stężenie masowe PM. ${guideFor(dominantRow.fraction).story} Etykiety PM2.5 i PM10 traktuj tutaj jako orientację, nie jako osobny pomiar referencyjny.`
    : 'Czekam na dane live, aby pokazać Wykres 1 z PMS5003 i rozkład cząstek w kolejnych binach.';

  useEffect(() => {
    previousRowsRef.current = rows;
  }, [rows]);

  return (
    <section className="pm-live-panel" aria-label="Wykres 1 PMS5003 - licznik cząstek i interpretacja frakcji">
      <header className="pm-live-hero">
        <div className="pm-live-hero-copy">
          <p className="eyebrow">Wykres 1 · PMS5003 / React</p>
          <h3>Licznik cząstek zamiast surowego PM</h3>
          <p>
            Ten widok pokazuje live bins z PMS5003 pobierane bezpośrednio z Firebase. Najpierw widać sensor i liczbę cząstek,
            dopiero potem względną intensywność i orientacyjną interpretację PM.
          </p>
          <div className="pm-live-badges">
            <span className="badge"><span className="swatch"></span>{statusLabel}</span>
            <span className="badge">Wykres 1</span>
            <span className="badge">licznik cząstek</span>
          </div>
        </div>

        <div className="pm-live-hero-stats">
          <article className="pm-live-mini-card good">
            <p className="label">Najmocniejszy bin</p>
            <p className="value">{formatParticleCount(dominantRow.value)}</p>
            <p className="meta">{dominantRow.fraction} · peak względny</p>
          </article>
          <article className="pm-live-mini-card warn">
            <p className="label">Średnia intensywność</p>
            <p className="value">{Math.round(averageFill)}%</p>
            <p className="meta">Względna gęstość w próbce</p>
          </article>
          <article className="pm-live-mini-card accent">
            <p className="label">Warstwa dominująca</p>
            <p className="value">{dominantRow.fraction}</p>
            <p className="meta">Odczyt z {sourceLabel} · PMS5003</p>
          </article>
          <article className="pm-live-mini-card alert">
            <p className="label">Kierunek</p>
            <p className="value">{trendLabel}</p>
            <p className="meta">{liveStatus === 'loaded' ? 'Aktywne odczyty z urządzenia' : 'Brak potwierdzonego strumienia'}</p>
          </article>
        </div>
      </header>

      <div className="pm-live-layout">
        <section className="pm-live-chart" aria-label="Wykres 1 cząstek z PMS5003">
          <header className="pm-live-chart-head">
            <div>
              <p className="eyebrow">Warstwa 2 · wykres</p>
              <h4>Surowe cząstki z PMS5003</h4>
              <p>Każda kolumna pokazuje bieżący udział binu w próbce. PM2.5 i PM10 są tu tylko etykietą orientacyjną.</p>
            </div>
            <button type="button" className="chip chip-action" onClick={() => setDetailsOpen(true)}>Jak czytać</button>
          </header>

          <div className="pm-live-chart-shell">
            <div className="pm-live-y-axis" aria-hidden="true">
              <span>100%</span>
              <span>75%</span>
              <span>50%</span>
              <span>25%</span>
              <span>0%</span>
            </div>

            <div className="pm-live-bars" role="list" aria-label="Odczyty cząstek z PMS5003">
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
                  <span className={`pm-live-label-val ${row.severity}`}>{formatParticleCount(row.value)}</span>
                  <span className="pm-live-axis-label">
                    <strong>{row.fraction}</strong>
                    <span>{row.title}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <footer className="pm-live-chart-footer">
            <span>Źródło: devices/device1/latest</span>
            <span>Interpretacja: licznik cząstek, nie stężenie masowe</span>
            <span>Tryb: {statusLabel}</span>
          </footer>
          <p className="pm-live-story" dangerouslySetInnerHTML={{ __html: story }} />

          <div className="pm-live-info" aria-label="Jak czytać ten wykres">
            <article className="pm-live-info-block">
              <p className="eyebrow">Krok 1</p>
              <p className="story-copy">PMS5003 zlicza cząstki w kolejnych binach wielkości. To pokazuje strukturę aerozolu, a nie klasyczne stężenie masowe PM.</p>
              <div className="story-tags">
                <span className="story-tag"><span className="dot"></span>sensor PMS5003</span>
                <span className="story-tag"><span className="dot"></span>licznik cząstek</span>
              </div>
            </article>

            <article className="pm-live-info-block">
              <p className="eyebrow">Krok 2</p>
              <p className="story-copy">Słupki są normalizowane do najmocniejszego binu w bieżącej próbce, żeby łatwiej zobaczyć relację między frakcjami.</p>
              <div className="story-tags">
                <span className="story-tag warn"><span className="dot"></span>Wykres 1</span>
                <span className="story-tag"><span className="dot"></span>skala względna</span>
              </div>
            </article>

            <article className="pm-live-info-block">
              <p className="eyebrow">Krok 3</p>
              <p className="story-copy">PM2.5 i PM10 są tu wskazówką interpretacyjną. W praktyce panel nadal opisuje cząstki z sensora, nie laboratoryjny pomiar masowy.</p>
              <div className="story-tags">
                <span className="story-tag alert"><span className="dot"></span>PM jako orientacja</span>
                <span className="story-tag"><span className="dot"></span>bez iframe</span>
              </div>
            </article>
          </div>
        </section>
      </div>

      {detailsOpen ? (
        <>
          <button type="button" className="pm-live-backdrop" aria-label="Zamknij szczegóły" onClick={() => setDetailsOpen(false)}></button>
          <section className="pm-live-drawer" aria-label="Szczegóły frakcji">
            <header className="pm-live-drawer-head">
              <div>
                <p className="eyebrow">Szczegóły</p>
                <h4>{selectedRow.title} · {rowTitle(selectedRow.key)}</h4>
              </div>
              <button type="button" className="pm-live-drawer-close" aria-label="Zamknij" onClick={() => setDetailsOpen(false)}>×</button>
            </header>

            <div className="pm-live-drawer-grid">
              <article className="pm-live-drawer-card">
                <span>Odczyt</span>
                <strong>{formatParticleCount(selectedRow.value)}</strong>
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
              {rowDescription(selectedRow.key)} To jest zintegrowany Reactowy odpowiednik wcześniejszego iframe, opisany jako licznik cząstek PMS5003 zamiast klasycznego PM.
            </p>
          </section>
        </>
      ) : null}
    </section>
  );
}