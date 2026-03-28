import { expect, test } from 'vitest';
import { pointerDistance, resolveWheelGesture } from '../useChartInteractions';

test('resolveWheelGesture detects horizontal pan gestures', () => {
  expect(resolveWheelGesture(40, 10, false, false)).toBe('pan-right');
  expect(resolveWheelGesture(-40, 10, false, false)).toBe('pan-left');
});

test('resolveWheelGesture detects zoom gestures with ctrl/meta', () => {
  expect(resolveWheelGesture(0, -20, true, false)).toBe('zoom-in');
  expect(resolveWheelGesture(0, 20, false, true)).toBe('zoom-out');
});

test('resolveWheelGesture returns none for ordinary vertical scroll', () => {
  expect(resolveWheelGesture(0, 20, false, false)).toBe('none');
});

test('pointerDistance computes euclidean distance', () => {
  expect(pointerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
});
