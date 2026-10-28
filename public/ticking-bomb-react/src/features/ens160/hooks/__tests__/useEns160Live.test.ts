// @vitest-environment jsdom
import { expect, test } from 'vitest';
import { normalizeEns160LiveTimestamp } from '../useEns160Live';

test('normalizeEns160LiveTimestamp converts seconds and milliseconds to epoch ms', () => {
  expect(normalizeEns160LiveTimestamp({ ts: 1_700_000_000 })).toBe(1_700_000_000_000);
  expect(normalizeEns160LiveTimestamp({ timestamp: 1_700_000_000_000 })).toBe(1_700_000_000_000);
});

test('normalizeEns160LiveTimestamp returns null when the timestamp is missing', () => {
  expect(normalizeEns160LiveTimestamp({})).toBeNull();
  expect(normalizeEns160LiveTimestamp(null)).toBeNull();
});
