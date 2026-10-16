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
  type AirQualityInput,
  type MicroclimateInput,
  type ThermalMetrics,
} from '../comfortAlgorithms';

const emptyAir: AirQualityInput = { pm25: null, eco2: null, tvoc: null };

function scoreFor(metrics: ThermalMetrics | null): ReturnType<typeof computeComfortScore> {
  const input: MicroclimateInput = {
    thermal: metrics,
    airQuality: emptyAir,
    pressureDelta: null,
  };
  return computeComfortScore(input);
}

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

    const score = scoreFor(metrics);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });

  test('dewPointAlduchovEskridge returns null for RH=0 and score can skip dewPoint bucket', () => {
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

    const score = scoreFor(fallbackMetrics);
    expect(score.score).toBeGreaterThan(0);
  });

  test('air quality subindices penalize score when PM2.5 is elevated', () => {
    const metrics = computeThermalMetrics({ temperatureC: 22, relativeHumidity: 50 });
    const clean = scoreFor(metrics);

    const polluted: MicroclimateInput = {
      thermal: metrics,
      airQuality: { pm25: 80, eco2: 600, tvoc: 200 },
      pressureDelta: null,
    };

    expect(computeComfortScore(polluted).score).toBeLessThan(clean.score);
  });

  test('pressure delta outside comfort band lowers score', () => {
    const metrics = computeThermalMetrics({ temperatureC: 22, relativeHumidity: 50 });
    const stable = scoreFor(metrics);

    const falling: MicroclimateInput = {
      thermal: metrics,
      airQuality: emptyAir,
      pressureDelta: -3,
    };

    expect(computeComfortScore(falling).score).toBeLessThan(stable.score);
  });

  test('score clamps to 0-100 with missing data', () => {
    const empty: MicroclimateInput = {
      thermal: null,
      airQuality: emptyAir,
      pressureDelta: null,
    };
    expect(computeComfortScore(empty).score).toBe(0);
  });
});
