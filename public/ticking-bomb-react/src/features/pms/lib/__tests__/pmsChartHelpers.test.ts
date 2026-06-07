import { expect, test } from 'vitest';
import {
  rawToPmsChartPoints,
  sortPmsChartPoints,
  appendUniquePmsChartPoint,
  groupPmsChartPointsBySeries,
} from '../pmsChartHelpers';
import type { PmsChartPoint } from '../pmsChartHelpers';
import type { PmsRaw } from '../../../../shared/types';

test('rawToPmsChartPoints maps raw values to three series points', () => {
  const raw: PmsRaw = { pm1: 1, pm25: 2, pm10: 3 };
  const pts = rawToPmsChartPoints(raw, 1000);
  expect(pts).toHaveLength(3);
  expect(pts.map((p) => p.series)).toEqual(['pm1', 'pm25', 'pm10']);
  expect(pts.map((p) => p.y)).toEqual([1, 2, 3]);
});

test('sortPmsChartPoints sorts by x then series', () => {
  const pts = [
    { series: 'pm25', x: 2, y: 0 },
    { series: 'pm1', x: 1, y: 0 },
    { series: 'pm10', x: 1, y: 0 },
  ] as PmsChartPoint[];
  const sorted = sortPmsChartPoints(pts);
  expect(sorted[0].series).toBe('pm1');
  expect(sorted[1].series).toBe('pm10');
  expect(sorted[2].series).toBe('pm25');
});

test('appendUniquePmsChartPoint replaces same-series points at the same timestamp and keeps sorted', () => {
  const pts: PmsChartPoint[] = [{ series: 'pm1', x: 1, y: 1 }];
  const same: PmsChartPoint = { series: 'pm1', x: 1, y: 9 };
  const res = appendUniquePmsChartPoint(pts, same);
  expect(res).toHaveLength(1);
  expect(res[0].y).toBe(9);

  const newPt: PmsChartPoint = { series: 'pm25', x: 0, y: 2 };
  const res2 = appendUniquePmsChartPoint(pts, newPt);
  expect(res2).toHaveLength(2);
  expect(res2[0].x).toBe(0);
});

test('groupPmsChartPointsBySeries groups into three arrays', () => {
  const pts = [
    { series: 'pm1', x: 1, y: 1 },
    { series: 'pm25', x: 2, y: 2 },
    { series: 'pm10', x: 3, y: 3 },
  ] as PmsChartPoint[];
  const grouped = groupPmsChartPointsBySeries(pts);
  expect(grouped.pm1).toHaveLength(1);
  expect(grouped.pm25).toHaveLength(1);
  expect(grouped.pm10).toHaveLength(1);
});
