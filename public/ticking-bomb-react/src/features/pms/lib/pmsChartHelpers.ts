import { toEpochMs } from '../../../shared/lib/timeHelpers';
import { pickPmsRaw } from './pmsHelpers';
import type { PmsRaw, PmsRecord } from '../../../shared/types';

export type PmsSeriesKey = 'pm1' | 'pm25' | 'pm10';

export interface PmsChartPoint {
  series: PmsSeriesKey;
  x: number;
  y: number;
}

const SERIES_SORT_ORDER: Record<PmsSeriesKey, number> = {
  pm1: 0,
  pm25: 1,
  pm10: 2,
};

function pointCompositeKey(point: Pick<PmsChartPoint, 'series' | 'x'>): string {
  return `${point.series}:${point.x}`;
}

export function sortPmsChartPoints(points: PmsChartPoint[]): PmsChartPoint[] {
  return [...points].sort((left, right) => left.x - right.x || SERIES_SORT_ORDER[left.series] - SERIES_SORT_ORDER[right.series]);
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
  return mergePmsChartPoints(points, [point]);
}

export function mergePmsChartPoints(basePoints: PmsChartPoint[], incomingPoints: PmsChartPoint[]): PmsChartPoint[] {
  if (!incomingPoints.length) {
    return basePoints;
  }

  const nextPoints = [...basePoints];
  const indexByKey = new Map<string, number>();

  for (let index = 0; index < nextPoints.length; index += 1) {
    indexByKey.set(pointCompositeKey(nextPoints[index]), index);
  }

  let changed = false;

  for (const incoming of incomingPoints) {
    const key = pointCompositeKey(incoming);
    const existingIndex = indexByKey.get(key);

    if (existingIndex == null) {
      nextPoints.push(incoming);
      indexByKey.set(key, nextPoints.length - 1);
      changed = true;
      continue;
    }

    const existingPoint = nextPoints[existingIndex];
    if (existingPoint.y !== incoming.y) {
      nextPoints[existingIndex] = incoming;
      changed = true;
    }
  }

  if (!changed) {
    return basePoints;
  }

  return sortPmsChartPoints(nextPoints);
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