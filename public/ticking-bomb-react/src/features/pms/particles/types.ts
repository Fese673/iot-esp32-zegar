export type ParticleFractionKey = '0p3' | '0p5' | '1p0' | '2p5' | '5p0' | '10p0';

export type ParticleSeverity = 'good' | 'warn' | 'alert';

export type ParticleTrend = 'up' | 'down' | 'flat';

export type ParticleDataSource = 'live-particles' | 'live-derived' | 'history-derived' | 'fallback';

export interface ParticleFraction {
  key: ParticleFractionKey;
  label: string;
  title: string;
  maxVal: number;
  baseReading: number;
  baseFill: number;
  speed: number;
  swing: number;
  phase: number;
  what: string;
  sources: string;
  health: string;
  examples: string;
  interpretation: string;
}

export interface ParticleRow {
  key: ParticleFractionKey;
  fill: number;
  reading: number;
  maxVal: number;
  sessionMaxFill: number;
  severity: ParticleSeverity;
  spark: number[];
}

export interface ParticleFrame {
  rows: ParticleRow[];
  frame: number;
  peakKey: ParticleFractionKey;
  dominantKey: ParticleFractionKey;
  avgFill: number;
  trendDir: ParticleTrend;
  trendLabel: string;
  source: ParticleDataSource;
  sampleTimestamp: number | null;
}

export interface ParticleDominantMetrics {
  label: string;
  severity: ParticleSeverity;
  interpretation: string;
}

export interface ParticleMetrics {
  peak: number;
  peakLabel: string;
  avgFill: number;
  dominant: ParticleDominantMetrics | null;
  trend: ParticleTrend;
  trendLabel: string;
}
