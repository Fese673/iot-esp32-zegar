import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { LoadState } from '../../../../shared/types';
import type { PmsChartPoint } from '../../lib/pmsChartHelpers';
import { FRACTIONS } from '../constants';
import { useParticlesFrame } from '../hooks/useParticlesFrame';
import {
  buildSparkGeometry,
  clamp,
  estimateSessionPeakReading,
  fmtCount,
  fmtMax,
  getPeakLineColor,
  getSeverityColor,
  severityLabel,
} from '../lib/particlesUtils';
import type { ParticleDataSource, ParticleFraction, ParticleFractionKey, ParticleMetrics, ParticleRow } from '../types';
import PmsParticlesMetricTiles from './PmsParticlesMetricTiles';
import './PmsParticlesChart.css';

interface PmsParticlesChartProps {
  points?: PmsChartPoint[];
  liveData?: Record<string, unknown> | null;
  preferLive?: boolean;
  liveStatus?: LoadState;
  onMetrics?: (metrics: ParticleMetrics) => void;
}

interface HoverState {
  key: ParticleFractionKey;
  x: number;
  y: number;
}

interface TooltipSize {
  width: number;
  height: number;
}

function getTooltipPosition(hover: HoverState, tooltipSize: TooltipSize): { left: number; top: number } {
  const viewport = typeof window === 'undefined'
    ? { width: 1280, height: 720 }
    : {
      width: Math.round(window.visualViewport?.width ?? window.innerWidth),
      height: Math.round(window.visualViewport?.height ?? window.innerHeight),
    };

  const tooltipWidth = Math.max(tooltipSize.width, 1);
  const tooltipHeight = Math.max(tooltipSize.height, 1);

  const maxLeft = Math.max(12, viewport.width - tooltipWidth - 12);
  let left = hover.x + 14;
  if (left > maxLeft) {
    left = hover.x - tooltipWidth - 14;
  }
  left = clamp(left, 12, maxLeft);

  const preferredTop = hover.y - tooltipHeight - 14;
  const fallbackTop = hover.y + 18;
  const maxTop = Math.max(12, viewport.height - tooltipHeight - 12);
  const top = clamp(preferredTop >= 12 ? preferredTop : fallbackTop, 12, maxTop);

  return { left, top };
}

function createFallbackRow(fraction: ParticleFraction): ParticleRow {
  return {
    key: fraction.key,
    fill: fraction.baseFill,
    reading: fraction.baseReading,
    maxVal: fraction.maxVal,
    sessionMaxFill: fraction.baseFill,
    severity: 'good',
    spark: new Array(48).fill(fraction.baseFill),
  };
}

function getVesselStyle(row: ParticleRow): CSSProperties {
  const intensity = clamp(row.fill / 100, 0, 1);

  if (row.severity === 'alert') {
    return {
      height: `${row.fill.toFixed(1)}%`,
      borderColor: `rgba(248,113,113,${0.2 + intensity * 0.08})`,
      boxShadow: `inset 0 0 0 1px rgba(248,113,113,0.08), 0 0 ${20 + intensity * 10}px rgba(248,113,113,${0.1 + intensity * 0.08})`,
    };
  }

  if (row.severity === 'warn') {
    return {
      height: `${row.fill.toFixed(1)}%`,
      borderColor: `rgba(252,211,77,${0.18 + intensity * 0.08})`,
      boxShadow: `inset 0 0 0 1px rgba(252,211,77,0.08), 0 0 ${18 + intensity * 10}px rgba(252,211,77,${0.1 + intensity * 0.08})`,
    };
  }

  return {
    height: `${row.fill.toFixed(1)}%`,
    borderColor: `rgba(52,211,153,${0.16 + intensity * 0.08})`,
    boxShadow: `inset 0 0 0 1px rgba(52,211,153,0.06), 0 0 ${16 + intensity * 10}px rgba(52,211,153,${0.08 + intensity * 0.07})`,
  };
}

function getPeakLineStyle(row: ParticleRow): CSSProperties {
  const sessionMaxFill = clamp(row.sessionMaxFill, row.fill, 100);
  const showPeakLine = sessionMaxFill > row.fill + 1.5;

  return {
    bottom: `${sessionMaxFill.toFixed(1)}%`,
    opacity: showPeakLine ? 1 : 0,
    borderTopColor: getPeakLineColor(row.severity),
  };
}

function sourceChipLabel(source: ParticleDataSource, liveStatus: LoadState): string {
  if (source === 'live-particles') {
    return 'LIVE: particles';
  }

  if (source === 'live-derived') {
    return 'LIVE: PM fallback';
  }

  if (source === 'history-derived') {
    return 'ARCH: PM fallback';
  }

  if (liveStatus === 'loading') {
    return 'LIVE: oczekiwanie';
  }

  return 'LIVE: brak danych';
}

function sourceStatusLabel(source: ParticleDataSource): string {
  if (source === 'live-particles') {
    return 'Dane LIVE particles';
  }

  if (source === 'live-derived') {
    return 'Dane LIVE PM';
  }

  if (source === 'history-derived') {
    return 'Dane historyczne PM';
  }

  return 'Tryb zapasowy';
}

export default function PmsParticlesChart({
  points = [],
  liveData = null,
  preferLive = true,
  liveStatus = 'loading',
  onMetrics,
}: PmsParticlesChartProps) {
  const frame = useParticlesFrame({ liveData, points, preferLive });
  const [selectedKey, setSelectedKey] = useState<ParticleFractionKey>(FRACTIONS[0].key);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [hovered, setHovered] = useState<HoverState | null>(null);
  const [tooltipSize, setTooltipSize] = useState<TooltipSize>({ width: 250, height: 180 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const rowsByKey = useMemo(() => {
    const map = new Map<ParticleFractionKey, ParticleRow>();
    frame.rows.forEach((row) => map.set(row.key, row));
    return map;
  }, [frame.rows]);

  const peakFraction = useMemo(() => {
    return FRACTIONS.find((fraction) => fraction.key === frame.peakKey) ?? FRACTIONS[0];
  }, [frame.peakKey]);

  const dominantFraction = useMemo(() => {
    return FRACTIONS.find((fraction) => fraction.key === frame.dominantKey) ?? FRACTIONS[0];
  }, [frame.dominantKey]);

  const peakRow = rowsByKey.get(frame.peakKey) ?? createFallbackRow(peakFraction);
  const dominantRow = rowsByKey.get(frame.dominantKey) ?? createFallbackRow(dominantFraction);

  const metrics = useMemo<ParticleMetrics>(() => {
    return {
      peak: Math.round(peakRow.reading),
      peakLabel: peakFraction.label,
      avgFill: Math.round(frame.avgFill),
      dominant: {
        label: dominantFraction.label,
        severity: dominantRow.severity,
        interpretation: dominantFraction.interpretation,
      },
      trend: frame.trendDir,
      trendLabel: frame.trendLabel,
    };
  }, [
    dominantFraction.interpretation,
    dominantFraction.label,
    dominantRow.severity,
    frame.avgFill,
    frame.trendDir,
    frame.trendLabel,
    peakFraction.label,
    peakRow.reading,
  ]);

  useEffect(() => {
    onMetrics?.(metrics);
  }, [metrics, onMetrics]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      setDrawerOpen(false);
      setHovered(null);
    };

    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const openDetails = (key: ParticleFractionKey) => {
    setSelectedKey(key);
    setDrawerOpen(true);
  };

  const closeDetails = () => {
    setDrawerOpen(false);
  };

  const handleBarKeyDown = (key: ParticleFractionKey) => (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openDetails(key);
    }
  };

  const handleBarMouseEnter = (key: ParticleFractionKey) => (event: ReactMouseEvent<HTMLDivElement>) => {
    setSelectedKey(key);
    setHovered({ key, x: event.clientX, y: event.clientY });
  };

  const handleBarMouseMove = (key: ParticleFractionKey) => (event: ReactMouseEvent<HTMLDivElement>) => {
    setHovered({ key, x: event.clientX, y: event.clientY });
  };

  const statusText = `${sourceStatusLabel(frame.source)} · pik ${fmtCount(Math.round(peakRow.reading))} @ ${peakFraction.label} · próbka ${frame.frame}`;
  const chipLabel = sourceChipLabel(frame.source, liveStatus);
  const chartEyebrow = frame.source === 'history-derived' ? 'WYKRES 3 · HISTORIA' : 'WYKRES 3 · LIVE';

  const selectedFraction = FRACTIONS.find((fraction) => fraction.key === selectedKey) ?? FRACTIONS[0];
  const selectedRow = rowsByKey.get(selectedKey) ?? createFallbackRow(selectedFraction);

  const tooltipFraction = hovered ? FRACTIONS.find((fraction) => fraction.key === hovered.key) : null;
  const tooltipRow = hovered && tooltipFraction
    ? rowsByKey.get(hovered.key) ?? createFallbackRow(tooltipFraction)
    : null;
  const tooltipPosition = hovered ? getTooltipPosition(hovered, tooltipSize) : null;

  useLayoutEffect(() => {
    if (!hovered || !tooltipRef.current) {
      return;
    }

    const bounds = tooltipRef.current.getBoundingClientRect();
    const next = {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    };

    setTooltipSize((prev) => {
      if (Math.abs(prev.width - next.width) <= 1 && Math.abs(prev.height - next.height) <= 1) {
        return prev;
      }

      return next;
    });
  }, [hovered, frame.frame]);

  const tooltipContent = tooltipFraction && tooltipRow && tooltipPosition ? (
    <div ref={tooltipRef} className="particles3-tooltip" style={{ left: `${tooltipPosition.left}px`, top: `${tooltipPosition.top}px` }}>
      <b>{`${tooltipFraction.label} - ${tooltipFraction.title}`}</b>
      <span>
        Stan: <span className={`particles3-${tooltipRow.severity}`}>{severityLabel(tooltipRow.fill)}</span>
      </span>
      <span>{`Odczyt: ${fmtCount(Math.round(tooltipRow.reading))} cząstek`}</span>
      <span>{`Max czujnika: ${fmtCount(tooltipFraction.maxVal)}`}</span>
      <span>{`Sesyjne maks: ${fmtCount(estimateSessionPeakReading(tooltipRow))}`}</span>
      <span>{`Wypełnienie: ${Math.round(tooltipRow.fill)}%`}</span>
      <i>{tooltipFraction.interpretation}</i>
    </div>
  ) : null;

  return (
    <section className="particles3-card" aria-label="Wykres 3 - frakcje PM z danych rzeczywistych">
      <header className="panel-head particles3-panel-head">
        <div>
          <p className="eyebrow">{chartEyebrow}</p>
          <h3>Frakcje PM w układzie warstwowym</h3>
          <p>
            Słupki pokazują stosunek bieżącego odczytu do maksimum sesji dla każdej z 6 frakcji.
            Kliknij kolumnę aby zobaczyć szczegóły. Linia przerywana = szczyt sesji.
          </p>
        </div>
        <div className="particles3-chip-row">
          <span className="particles3-chip particles3-chip-live"><span className="particles3-pulse"></span> {chipLabel}</span>
          <button className="particles3-chip particles3-chip-action" type="button" onClick={() => setDrawerOpen(true)}>
            Szczegóły
          </button>
          <span className="particles3-chip">stacked bars</span>
        </div>
      </header>

      <PmsParticlesMetricTiles metrics={metrics} />
      <div className="particles3-panel">
        <div className="particles3-shell">
          <div className="particles3-y-axis" aria-hidden="true">
            <span>100%</span>
            <span>75%</span>
            <span>50%</span>
            <span>25%</span>
            <span>0%</span>
          </div>

          <div className="particles3-main-col">
            <div className="particles3-area">
              <div className="particles3-data-glow"></div>
              <div className="particles3-grid"></div>

              <div className="particles3-bars-row">
                {FRACTIONS.map((fraction) => {
                  const row = rowsByKey.get(fraction.key) ?? createFallbackRow(fraction);
                  const isDominant = row.key === frame.dominantKey;
                  const isSelected = drawerOpen && selectedKey === fraction.key;

                  const arrow = frame.trendDir === 'up' && isDominant
                    ? '↑'
                    : frame.trendDir === 'down' && isDominant
                      ? '↓'
                      : '→';

                  const columnClassName = [
                    'particles3-bar-col',
                    isSelected ? 'particles3-column-selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <div
                      key={fraction.key}
                      className={columnClassName}
                      data-key={fraction.key}
                      tabIndex={0}
                      role="button"
                      aria-label={fraction.label}
                      onMouseEnter={handleBarMouseEnter(fraction.key)}
                      onMouseMove={handleBarMouseMove(fraction.key)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => openDetails(fraction.key)}
                      onKeyDown={handleBarKeyDown(fraction.key)}
                    >
                      <div
                        className={`particles3-topline particles3-${row.severity}`}
                      >
                        {`${arrow} ${severityLabel(row.fill)}`}
                      </div>

                      <div className="particles3-bar-outer">
                        <div className="particles3-bar-vessel" style={getVesselStyle(row)}>
                          <div className="particles3-bar-fill">
                            <div className="particles3-seg particles3-seg-base"></div>
                            <div className="particles3-seg particles3-seg-mid">
                              <span className="particles3-lbl-pct">{`${Math.round(row.fill)}%`}</span>
                            </div>
                            <div className={`particles3-seg particles3-seg-top particles3-${row.severity}`}>
                              <span className={`particles3-lbl-val particles3-${row.severity}`}>{fmtCount(Math.round(row.reading))}</span>
                            </div>
                          </div>
                        </div>

                        <div className="particles3-peak-line" style={getPeakLineStyle(row)}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="particles3-spark-row" aria-hidden="true">
              {FRACTIONS.map((fraction) => {
                const row = rowsByKey.get(fraction.key) ?? createFallbackRow(fraction);
                const sparkGeometry = buildSparkGeometry(row.spark);
                const sparkColor = getSeverityColor(row.severity);

                return (
                  <svg key={fraction.key} className="particles3-spark-svg" viewBox="0 0 100 32" preserveAspectRatio="none">
                    <polygon points={sparkGeometry.fillPoints} fill={sparkColor} opacity="0.22" />
                    <polyline
                      points={sparkGeometry.linePoints}
                      fill="none"
                      stroke={sparkColor}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                );
              })}
            </div>

            <div className="particles3-x-axis" aria-hidden="true">
              {FRACTIONS.map((fraction) => (
                <div key={fraction.key} className="particles3-x-col">
                  <span className="particles3-x-max">{fmtMax(fraction.maxVal)}</span>
                  <span className="particles3-x-frac">{fraction.label}</span>
                </div>
              ))}
            </div>

            <footer className="particles3-footer">
              <div className="particles3-legend">
                <span className="particles3-legend-item"><span className="particles3-legend-dot particles3-good"></span> norma</span>
                <span className="particles3-legend-item"><span className="particles3-legend-dot particles3-warn"></span> uwaga</span>
                <span className="particles3-legend-item"><span className="particles3-legend-dot particles3-alert"></span> alarm</span>
              </div>
              <div className="particles3-status" aria-live="polite">{statusText}</div>
            </footer>
          </div>
        </div>
      </div>

      {tooltipContent && typeof document !== 'undefined' ? createPortal(tooltipContent, document.body) : null}

      <div className={`particles3-backdrop${drawerOpen ? ' open' : ''}`} onClick={closeDetails}></div>

      <aside className={`particles3-drawer${drawerOpen ? ' open' : ''}`} role="dialog" aria-modal="true" aria-hidden={!drawerOpen}>
        <div className="particles3-drawer-head">
          <div>
            <p className="eyebrow">{`Frakcja · ${severityLabel(selectedRow.fill)}`}</p>
            <h4>{`${selectedFraction.label} - ${selectedFraction.title}`}</h4>
          </div>
          <button className="particles3-drawer-close" type="button" aria-label="Zamknij" onClick={closeDetails}>×</button>
        </div>

        <div className="particles3-drawer-grid">
          <article className="particles3-drawer-card"><span>Co to jest</span><p>{selectedFraction.what}</p></article>
          <article className="particles3-drawer-card"><span>Skąd pochodzi</span><p>{selectedFraction.sources}</p></article>
          <article className="particles3-drawer-card"><span>Zdrowie</span><p>{selectedFraction.health}</p></article>
          <article className="particles3-drawer-card"><span>Przykłady</span><p>{selectedFraction.examples}</p></article>
        </div>

        <p className="particles3-drawer-foot">
          {`Aktualny odczyt: ${fmtCount(Math.round(selectedRow.reading))} cząstek · fill ${Math.round(selectedRow.fill)}% · ${selectedFraction.interpretation}`}
        </p>
      </aside>
    </section>
  );
}
