import { fmtCount, trendArrow } from '../lib/particlesUtils';
import type { ParticleMetrics } from '../types';

interface PmsParticlesMetricTilesProps {
  metrics: ParticleMetrics;
}

export default function PmsParticlesMetricTiles({ metrics }: PmsParticlesMetricTilesProps) {
  const dominantLabel = metrics.dominant?.label ?? '—';
  const dominantMeta = metrics.dominant?.interpretation ?? '—';
  const trendValue = `${trendArrow(metrics.trend)} ${metrics.trendLabel}`;

  return (
    <section className="particles3-kpi-grid" aria-label="Podsumowanie metryk wykresu particles">
      <article className="stat-card particles3-kpi-card particles3-kpi-accent">
        <div className="stat-top">
          <p className="label">NAJWYŻSZY ODCZYT</p>
          <span className="tag">PEAK</span>
        </div>
        <p className="value particles3-kpi-value">{fmtCount(metrics.peak)}</p>
        <p className="muted particles3-kpi-meta">{metrics.peakLabel || '—'}</p>
      </article>

      <article className="stat-card particles3-kpi-card particles3-kpi-warn">
        <div className="stat-top">
          <p className="label">ŚREDNIE WYPEŁNIENIE</p>
          <span className="tag">AVG</span>
        </div>
        <p className="value particles3-kpi-value">{`${metrics.avgFill}%`}</p>
        <p className="muted particles3-kpi-meta">Wizualna gęstość próbki</p>
      </article>

      <article className="stat-card particles3-kpi-card particles3-kpi-good">
        <div className="stat-top">
          <p className="label">DOMINUJĄCA FRAKCJA</p>
          <span className="tag">DOM</span>
        </div>
        <p className="value particles3-kpi-value">{dominantLabel}</p>
        <p className="muted particles3-kpi-meta">{dominantMeta}</p>
      </article>

      <article className="stat-card particles3-kpi-card particles3-kpi-alert">
        <div className="stat-top">
          <p className="label">TREND</p>
          <span className="tag">Δ</span>
        </div>
        <p className="value particles3-kpi-value">{trendValue}</p>
        <p className="muted particles3-kpi-meta">Zmiana względem poprzednich próbek</p>
      </article>
    </section>
  );
}
