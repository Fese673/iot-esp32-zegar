import { THRESHOLDS } from '../constants';
import type { ParticleFractionKey, ParticleRow, ParticleSeverity, ParticleTrend } from '../types';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

export function fmtCount(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const absolute = Math.abs(value);
  if (absolute >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (absolute >= 10_000) {
    return `${(value / 1_000).toFixed(0)}k`;
  }

  if (absolute >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }

  return `${Math.round(value)}`;
}

export function fmtMax(value: number): string {
  return `max ${fmtCount(value)}`;
}

export function severityFor(fill: number): ParticleSeverity {
  if (fill >= THRESHOLDS.alert) {
    return 'alert';
  }

  if (fill >= THRESHOLDS.warn) {
    return 'warn';
  }

  return 'good';
}

export function severityLabel(fill: number): string {
  const severity = severityFor(fill);
  if (severity === 'alert') {
    return 'ALARM';
  }

  if (severity === 'warn') {
    return 'UWAGA';
  }

  return 'NORMA';
}

export function trendArrow(trend: ParticleTrend): string {
  if (trend === 'up') {
    return '↑';
  }

  if (trend === 'down') {
    return '↓';
  }

  return '→';
}

export function toFractionCode(key: ParticleFractionKey): string {
  return key.replace('p', '.');
}

export function getSeverityColor(severity: ParticleSeverity): string {
  if (severity === 'alert') {
    return '#f87171';
  }

  if (severity === 'warn') {
    return '#fcd34d';
  }

  return '#34d399';
}

export function getPeakLineColor(severity: ParticleSeverity): string {
  if (severity === 'alert') {
    return 'rgba(248,113,113,0.5)';
  }

  if (severity === 'warn') {
    return 'rgba(252,211,77,0.5)';
  }

  return 'rgba(52,211,153,0.45)';
}

export function estimateSessionPeakReading(row: ParticleRow): number {
  const fillRatio = row.fill / 100;
  const normalized = fillRatio > 0 ? row.reading / fillRatio : row.reading;
  return Math.round(normalized * (row.sessionMaxFill / 100));
}

export function buildSparkGeometry(sparkValues: number[]): { linePoints: string; fillPoints: string } {
  const count = sparkValues.length;
  const min = Math.min(...sparkValues);
  const max = Math.max(...sparkValues);
  const range = Math.max(max - min, 1);

  const sparkPoints = sparkValues.map((value, index) => {
    const x = (index / (count - 1)) * 100;
    const y = 32 - ((value - min) / range) * 28 - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const fillPoints = [`0,32`, ...sparkPoints, `100,32`];

  return {
    linePoints: sparkPoints.join(' '),
    fillPoints: fillPoints.join(' '),
  };
}
