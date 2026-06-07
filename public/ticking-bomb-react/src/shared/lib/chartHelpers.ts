import type { ChartPoint } from '../types';

export interface WindowRange {
  start: number;
  end: number;
}

export function sortChartPoints(points: ChartPoint[]): ChartPoint[] {
  return [...points].sort((left, right) => left.x - right.x || left.series.localeCompare(right.series));
}

export function groupChartPointsBySeries(points: ChartPoint[]): Record<string, ChartPoint[]> {
  return points.reduce<Record<string, ChartPoint[]>>((groups, point) => {
    if (!groups[point.series]) {
      groups[point.series] = [];
    }
    groups[point.series].push(point);
    return groups;
  }, {});
}

export function appendUniqueChartPoint(points: ChartPoint[], point: ChartPoint): ChartPoint[] {
  if (points.some((existing) => existing.series === point.series && existing.x === point.x)) {
    return points;
  }

  return sortChartPoints([...points, point]);
}

export function clampWindow(start: number, end: number, bounds: WindowRange, minWidthMs: number): WindowRange {
  if (bounds.end <= bounds.start) {
    return { start, end };
  }

  let width = end - start;
  width = Math.min(width, bounds.end - bounds.start);
  width = Math.max(width, minWidthMs);

  const center = (start + end) / 2;
  const half = width / 2;
  let nextStart = center - half;
  let nextEnd = center + half;

  if (nextStart < bounds.start) {
    nextStart = bounds.start;
    nextEnd = nextStart + width;
  }

  if (nextEnd > bounds.end) {
    nextEnd = bounds.end;
    nextStart = nextEnd - width;
  }

  return { start: nextStart, end: nextEnd };
}