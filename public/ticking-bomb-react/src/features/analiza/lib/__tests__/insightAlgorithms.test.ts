import { describe, expect, test } from 'vitest';
import {
  computeBarometricTrend,
  computeEns160SourceRatio,
  computeHygroscopicPmCorrection,
  computeRespiratoryLoadIndex,
  describeEns160SourceAttribution,
  describeRespiratoryLoadIndex,
} from '../insightAlgorithms';

const baseTimestamp = 1_700_000_000_000;

describe('insightAlgorithms', () => {
  test('computes respiratory load index and classifies elevated load', () => {
    const value = computeRespiratoryLoadIndex(18.3, 1080, 210);

    expect(value).toBeCloseTo(3.45, 2);
    expect(describeRespiratoryLoadIndex(value).label).toBe('Podwyższony');
  });

  test('classifies metabolic ENS160 source attribution from TVOC/eCO2 ratio', () => {
    const ratio = computeEns160SourceRatio(220, 1196);

    expect(ratio).toBeCloseTo(0.184, 3);
    expect(describeEns160SourceAttribution(ratio).label).toBe('Metaboliczne');
  });

  test('computes a falling barometric trend over three hours', () => {
    const result = computeBarometricTrend(
      [
        { series: 'p', x: baseTimestamp - 3 * 60 * 60_000, y: 1013.2 },
        { series: 'p', x: baseTimestamp - 60 * 60_000, y: 1012.1 },
      ],
      baseTimestamp,
      1011.4,
    );

    expect(result.deltaHpa).toBeCloseTo(-1.8, 1);
    expect(result.descriptor.label).toBe('Opadający');
  });

  test('applies a hygroscopic PM correction for elevated humidity', () => {
    const result = computeHygroscopicPmCorrection(23.3, 37);

    expect(result.reductionPercent).toBe(22);
    expect(result.correctedPm25).toBeCloseTo(18.3, 1);
    expect(result.descriptor.label).toBe('W normie WHO');
  });
});
