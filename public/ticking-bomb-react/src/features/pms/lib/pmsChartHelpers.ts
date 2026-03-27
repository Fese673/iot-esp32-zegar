import { toEpochMs } from '../../../shared/lib/timeHelpers';
import { pickPmsRaw } from './pmsHelpers';
import type { PmsRaw, PmsRecord } from '../../../shared/types';

export type PmsSeriesKey = 'pm1' | 'pm25' | 'pm10';

export interface PmsChartPoint {
  series: PmsSeriesKey;
  x: number;
  y: number;
}

export function sortPmsChartPoints(points: PmsChartPoint[]): PmsChartPoint[] {
  return [...points].sort((left, right) => left.x - right.x || left.series.localeCompare(right.series));
}

export function groupPmsChartPointsBySeries(points: PmsChartPoint[]): Record<PmsSeriesKey, PmsChartPoint[]> {
  return points.reduce<Record<PmsSeriesKey, PmsChartPoint[]>>(
    (groups, point) => {
      groups[point.series].push(point);
      return groups;
    },
    { pm1: [], pm25: [], pm10: [] },
  );
}

export function appendUniquePmsChartPoint(points: PmsChartPoint[], point: PmsChartPoint): PmsChartPoint[] {
  if (points.some((existing) => existing.series === point.series && existing.x === point.x)) {
    return points;
  }

  return sortPmsChartPoints([...points, point]);
}

export function rawToPmsChartPoints(raw: PmsRaw, timestamp: number): PmsChartPoint[] {
  return [
    { series: 'pm1', x: timestamp, y: raw.pm1 },
    { series: 'pm25', x: timestamp, y: raw.pm25 },
    { series: 'pm10', x: timestamp, y: raw.pm10 },
  ];
}

export function recordToPmsChartPoints(record: PmsRecord): PmsChartPoint[] {
  const raw = pickPmsRaw(record);
  if (!raw) {
    return [];
  }

  return rawToPmsChartPoints(raw, toEpochMs(record.ts));
}