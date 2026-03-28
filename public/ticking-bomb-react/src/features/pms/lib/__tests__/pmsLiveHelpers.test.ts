import { expect, test } from 'vitest';
import { buildParticleRows, extractParticleSource, extractPmRawLike, severityLabel } from '../pmsLiveHelpers';

test('buildParticleRows maps baseline particle counts to six frictions', () => {
  const record = {
    particles: {
      '0p3': 12,
      '0p5': 24,
      '1p0': 48,
      '2p5': 96,
      '5p0': 24,
      '10p0': 12,
    },
  };

  const rows = buildParticleRows(record);
  expect(rows).toHaveLength(6);
  expect(rows.map((row) => row.key)).toEqual(['0p3', '0p5', '1p0', '2p5', '5p0', '10p0']);
  expect(rows[3].value).toBe(96);
  expect(rows[3].fraction).toBe('2.5 μm');
  expect(severityLabel(rows[3].fill)).toBe('alarm');
});

test('buildParticleRows uses history peak to preserve range baseline', () => {
  const record = {
    particles: {
      '0p3': 10,
      '0p5': 20,
      '1p0': 30,
      '2p5': 40,
      '5p0': 20,
      '10p0': 10,
    },
  };

  const historyPeak = {
    '0p3': 100,
    '0p5': 50,
    '1p0': 60,
    '2p5': 80,
    '5p0': 90,
    '10p0': 120,
  };

  const rows = buildParticleRows(record, historyPeak);
  expect(rows.map((row) => row.peak)).toEqual([100, 50, 60, 80, 90, 120]);
  expect(rows[3].fill).toBe(100); // highest current value gives full bar
});

test('extractParticleSource prefers particles and falls back to P', () => {
  const particles = { particles: { '0p3': 1 } };
  const fallback = { P: { '0p3': 2 } };

  expect(extractParticleSource(particles)).toEqual({ '0p3': 1 });
  expect(extractParticleSource(fallback)).toEqual({ '0p3': 2 });
});

test('extractPmRawLike reads pm values from a raw fallback object', () => {
  const record = {
    A: { pm1: 1.1, pm25: 2.2, pm10: 3.3 },
  };

  expect(extractPmRawLike(record)).toEqual({ pm1: 1.1, pm25: 2.2, pm10: 3.3 });
});

test('extractPmRawLike prefers A/F data over particle containers', () => {
  const record = {
    particles: { '0p3': 12 },
    A: { pm1: 4.4, pm25: 5.5, pm10: 6.6 },
  };

  expect(extractPmRawLike(record)).toEqual({ pm1: 4.4, pm25: 5.5, pm10: 6.6 });
});