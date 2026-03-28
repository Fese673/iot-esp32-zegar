import { expect, test } from 'vitest';
import { pickPmsRaw } from '../pmsHelpers';
import type { PmsRecord } from '../../../../shared/types';

test('pickPmsRaw returns A when present', () => {
  const record: PmsRecord = {
    A: { pm1: 1, pm25: 2, pm10: 3 },
    F: { pm1: 9, pm25: 9, pm10: 9 },
    ts: 123,
  };
  expect(pickPmsRaw(record)).toEqual({ pm1: 1, pm25: 2, pm10: 3 });
});

test('pickPmsRaw falls back to F when A missing', () => {
  const record: PmsRecord = { F: { pm1: 5, pm25: 6, pm10: 7 }, ts: 123 };
  expect(pickPmsRaw(record)).toEqual({ pm1: 5, pm25: 6, pm10: 7 });
});

test('pickPmsRaw returns null when neither present', () => {
  const record: PmsRecord = { ts: 123 };
  expect(pickPmsRaw(record)).toBeNull();
});
