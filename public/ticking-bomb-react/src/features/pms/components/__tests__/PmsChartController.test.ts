import { expect, test } from 'vitest';
import { buildFollowWindow, shouldAutoFollowLatest } from '../../lib/pmsFollowWindow';

test('shouldAutoFollowLatest is false when latest point is far from right edge', () => {
  const windowRange = { start: 0, end: 1000 };
  expect(shouldAutoFollowLatest(windowRange, 700, 80)).toBe(false);
});

test('shouldAutoFollowLatest is true when latest point reaches the right edge threshold', () => {
  const windowRange = { start: 0, end: 1000 };
  expect(shouldAutoFollowLatest(windowRange, 950, 80)).toBe(true);
});

test('buildFollowWindow keeps width and follows the latest point', () => {
  const bounds = { start: 0, end: 86_400_000 };
  const current = { start: 1_000_000, end: 1_600_000 };
  const next = buildFollowWindow(current, bounds, 1_580_000, 60_000, 48_000);

  expect(next.end).toBe(1_628_000);
  expect(next.end - next.start).toBe(600_000);
});

test('buildFollowWindow clamps to bounds when following would exceed day range', () => {
  const bounds = { start: 0, end: 86_400_000 };
  const current = { start: 85_900_000, end: 86_300_000 };
  const next = buildFollowWindow(current, bounds, 86_390_000, 60_000, 48_000);

  expect(next.end).toBe(86_400_000);
  expect(next.start).toBe(86_000_000);
});