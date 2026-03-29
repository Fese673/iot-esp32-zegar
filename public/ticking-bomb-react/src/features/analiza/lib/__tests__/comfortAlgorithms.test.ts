import { describe, expect, test } from 'vitest';
import {
  absoluteHumidityFromTempRh,
  actualVaporPressureHpa,
  computeComfortScore,
  computeThermalMetrics,
  dewPointAlduchovEskridge,
  heatIndexNwsRothfusz,
  humidexFromTempRh,
  saturationVaporPressureHpa,
  type ThermalMetrics,
} from '../comfortAlgorithms';

describe('comfortAlgorithms', () => {
  test('calculates dew point with Alduchov/Eskridge approximation', () => {
    const dewPoint = dewPointAlduchovEskridge(30, 70);
    expect(dewPoint).not.toBeNull();
    expect(dewPoint).toBeCloseTo(23.9, 1);
  });

  test('calculates humidex from temperature and RH', () => {
    const humidex = humidexFromTempRh(30, 70);
    expect(humidex).not.toBeNull();
    expect(humidex).toBeCloseTo(40.93, 2);
  });

  test('uses Rothfusz regression only within NWS threshold', () => {
    expect(heatIndexNwsRothfusz(25, 50)).toBeNull();

    const activeHeatIndex = heatIndexNwsRothfusz(32, 70);
    expect(activeHeatIndex).not.toBeNull();
    expect(activeHeatIndex).toBeCloseTo(40.4, 1);
  });

  test('calculates absolute humidity in g/m3', () => {
    const ah = absoluteHumidityFromTempRh(22, 50);
    expect(ah).not.toBeNull();
    expect(ah).toBeCloseTo(9.7, 1);
  });

  test('builds complete thermal metrics payload and score', () => {
    const metrics = computeThermalMetrics({ temperatureC: 27, relativeHumidity: 55 });
    expect(metrics).not.toBeNull();

    if (!metrics) {
      throw new Error('Expected metrics to be present');
    }

    expect(metrics.relativeHumidity).toBe(55);
    expect(metrics.humidex).toBeGreaterThan(27);
    expect(metrics.actualVaporPressureHpa).toBeGreaterThan(0);

    const score = computeComfortScore(metrics);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  test('dewPointAlduchovEskridge returns null for RH=0 and computeComfortScore can skip dewPoint bucket', () => {
    expect(dewPointAlduchovEskridge(30, 0)).toBeNull();

    const fallbackMetrics: ThermalMetrics = {
      temperatureC: 30,
      relativeHumidity: 45,
      saturationVaporPressureHpa: saturationVaporPressureHpa(30),
      actualVaporPressureHpa: actualVaporPressureHpa(30, 45),
      dewPointC: null,
      humidex: humidexFromTempRh(30, 45),
      heatIndexC: heatIndexNwsRothfusz(30, 45),
      absoluteHumidityGm3: absoluteHumidityFromTempRh(30, 45),
    };

    const score = computeComfortScore(fallbackMetrics);
    expect(score.score).toBeGreaterThan(0);
  });
});
