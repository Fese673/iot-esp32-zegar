import { expect, test } from 'vitest';
import { normalizePmsLiveTimestamp } from '../usePmsLive';

test('normalizePmsLiveTimestamp converts seconds and milliseconds to epoch ms', () => {
  expect(normalizePmsLiveTimestamp({ ts: 1_700_000_000 })).toBe(1_700_000_000_000);
  expect(normalizePmsLiveTimestamp({ timestamp: 1_700_000_000_000 })).toBe(1_700_000_000_000);
});

test('normalizePmsLiveTimestamp returns null when the timestamp is missing', () => {
  expect(normalizePmsLiveTimestamp({})).toBeNull();
});