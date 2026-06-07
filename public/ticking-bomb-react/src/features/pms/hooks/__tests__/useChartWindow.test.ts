import { expect, test } from 'vitest';
import { panWindow, zoomWindow } from '../useChartWindow';
import type { WindowRange } from '../../../../shared/lib/chartHelpers';

test('panWindow shifts by quarter width and clamps to bounds', () => {
  const bounds: WindowRange = { start: 0, end: 1_000 };
  const current: WindowRange = { start: 100, end: 300 };

  const movedRight = panWindow(current, bounds, 1, 60);
  expect(movedRight).toEqual({ start: 150, end: 350 });

  const nearEdge: WindowRange = { start: 850, end: 1_000 };
  const clamped = panWindow(nearEdge, bounds, 1, 60);
  expect(clamped).toEqual({ start: 850, end: 1_000 });
});

test('zoomWindow zooms in and respects minimum width', () => {
  const bounds: WindowRange = { start: 0, end: 1_000 };
  const current: WindowRange = { start: 100, end: 500 };

  const zoomedIn = zoomWindow(current, bounds, 0.5, 60);
  expect(zoomedIn).toEqual({ start: 200, end: 400 });

  const tiny = zoomWindow({ start: 490, end: 510 }, bounds, 0.1, 60);
  expect(tiny.end - tiny.start).toBe(60);
});

test('zoomWindow zooms out and clamps to full bounds', () => {
  const bounds: WindowRange = { start: 0, end: 1_000 };
  const current: WindowRange = { start: 300, end: 700 };

  const zoomedOut = zoomWindow(current, bounds, 4, 60);
  expect(zoomedOut).toEqual({ start: 0, end: 1_000 });
});
