import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { ChartPoint, Ens160Raw, Ens160Record } from '../../../shared/types';

const ENS_SERIES_ORDER: Record<'eco2' | 'tvoc', number> = {
  eco2: 0,
  tvoc: 1,
};

function pointCompositeKey(point: Pick<ChartPoint, 'series' | 'x'>): string {
  return `${point.series}:${point.x}`;
}

function isEns160Series(series: ChartPoint['series']): series is 'eco2' | 'tvoc' {
  return series === 'eco2' || series === 'tvoc';
}

export function sortEns160ChartPoints(points: ChartPoint[]): ChartPoint[] {
  return [...points].sort((left, right) => {
    if (left.x !== right.x) {
      return left.x - right.x;
    }

    if (isEns160Series(left.series) && isEns160Series(right.series)) {
      return ENS_SERIES_ORDER[left.series] - ENS_SERIES_ORDER[right.series];
    }

    return left.series.localeCompare(right.series);
  });
}

export function mergeEns160ChartPoints(basePoints: ChartPoint[], incomingPoints: ChartPoint[]): ChartPoint[] {
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

  return sortEns160ChartPoints(nextPoints);
}

export function rawToEns160ChartPoints(raw: Ens160Raw, timestamp: number): ChartPoint[] {
  return [
    { series: 'eco2', x: timestamp, y: raw.eco2 },
    { series: 'tvoc', x: timestamp, y: raw.tvoc },
  ];
}

export function recordToEns160ChartPoints(record: Ens160Record): ChartPoint[] {
  if (!Number.isFinite(record.tvoc) || !Number.isFinite(record.eco2)) {
    return [];
  }

  return rawToEns160ChartPoints({ tvoc: record.tvoc, eco2: record.eco2, aqi: record.aqi }, toEpochMs(record.ts));
}
