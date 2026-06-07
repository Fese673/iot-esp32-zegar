import { useEffect, useMemo, useRef, useState } from 'react';
import type { PmsRaw } from '../../../../shared/types';
import { toEpochMs } from '../../../../shared/lib/timeHelpers';
import { extractPmRawLike } from '../../lib/pmsHelpers';
import type { PmsChartPoint } from '../../lib/pmsChartHelpers';
import { FRACTIONS } from '../constants';
import { clamp, severityFor } from '../lib/particlesUtils';
import type { ParticleDataSource, ParticleFractionKey, ParticleFrame, ParticleRow, ParticleTrend } from '../types';

interface UseParticlesSimulationInput {
  liveData?: Record<string, unknown> | null;
  points?: PmsChartPoint[];
  preferLive?: boolean;
}

interface ParticleSourceSnapshot {
  source: ParticleDataSource;
  readings: Record<ParticleFractionKey, number>;
  timestamp: number | null;
}

interface LatestPmSnapshot {
  raw: PmsRaw;
  timestamp: number;
}

const EMPTY_POINTS: PmsChartPoint[] = [];
const SPARK_LENGTH = 48;
const MAX_SENSOR_MULTIPLIER = 1.2;

const PARTICLE_KEY_ALIAS: Record<string, ParticleFractionKey> = {
  '03': '0p3',
  '0p3': '0p3',
  '05': '0p5',
  '0p5': '0p5',
  '10': '1p0',
  '1p0': '1p0',
  '25': '2p5',
  '2p5': '2p5',
  '50': '5p0',
  '5p0': '5p0',
  '100': '10p0',
  '10p0': '10p0',
};

const PM_TO_PARTICLE_FACTORS: Record<ParticleFractionKey, number> = {
  '0p3': 7_000,
  '0p5': 2_000,
  '1p0': 420,
  '2p5': 120,
  '5p0': 22,
  '10p0': 6,
};

function createReadingMap(builder: (key: ParticleFractionKey) => number): Record<ParticleFractionKey, number> {
  return FRACTIONS.reduce<Record<ParticleFractionKey, number>>((acc, fraction) => {
    acc[fraction.key] = builder(fraction.key);
    return acc;
  }, {} as Record<ParticleFractionKey, number>);
}

function normalizeReading(reading: number, maxVal: number): number {
  if (!Number.isFinite(reading)) {
    return 1;
  }

  return clamp(reading, 1, maxVal * MAX_SENSOR_MULTIPLIER);
}

function readingToFill(reading: number, maxVal: number): number {
  const safeMax = Math.max(maxVal, 1);
  const boundedReading = normalizeReading(reading, safeMax);
  const normalized = Math.log1p(boundedReading) / Math.log1p(safeMax);
  return clamp(normalized * 100, 0, 100);
}

function normalizeParticleKey(rawKey: string): ParticleFractionKey | null {
  const normalized = rawKey
    .toLowerCase()
    .replace(/µ/g, 'u')
    .replace(/um/g, '')
    .replace(/[^a-z0-9]/g, '');

  return PARTICLE_KEY_ALIAS[normalized] ?? null;
}

function extractParticlesMap(candidate: unknown): Partial<Record<ParticleFractionKey, number>> {
  if (!candidate || typeof candidate !== 'object') {
    return {};
  }

  const source = candidate as Record<string, unknown>;
  const output: Partial<Record<ParticleFractionKey, number>> = {};

  for (const [rawKey, rawValue] of Object.entries(source)) {
    const key = normalizeParticleKey(rawKey);
    if (!key) {
      continue;
    }

    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) {
      continue;
    }

    output[key] = Math.max(1, parsed);
  }

  return output;
}

function extractParticlesFromLiveRecord(liveData: Record<string, unknown> | null): Partial<Record<ParticleFractionKey, number>> | null {
  if (!liveData || typeof liveData !== 'object') {
    return null;
  }

  const candidates: unknown[] = [
    liveData.particles,
    liveData.particleCounts,
    liveData.P,
    liveData,
  ];

  for (const candidate of candidates) {
    const map = extractParticlesMap(candidate);
    if (Object.keys(map).length > 0) {
      return map;
    }
  }

  return null;
}

function deriveParticleReadingsFromPm(raw: PmsRaw): Record<ParticleFractionKey, number> {
  return {
    '0p3': Math.max(1, raw.pm1 * PM_TO_PARTICLE_FACTORS['0p3']),
    '0p5': Math.max(1, raw.pm1 * PM_TO_PARTICLE_FACTORS['0p5']),
    '1p0': Math.max(1, raw.pm1 * PM_TO_PARTICLE_FACTORS['1p0']),
    '2p5': Math.max(1, raw.pm25 * PM_TO_PARTICLE_FACTORS['2p5']),
    '5p0': Math.max(1, raw.pm10 * PM_TO_PARTICLE_FACTORS['5p0']),
    '10p0': Math.max(1, raw.pm10 * PM_TO_PARTICLE_FACTORS['10p0']),
  };
}

function extractLatestPmFromPoints(points: PmsChartPoint[]): LatestPmSnapshot | null {
  let pm1: PmsChartPoint | null = null;
  let pm25: PmsChartPoint | null = null;
  let pm10: PmsChartPoint | null = null;

  for (let index = points.length - 1; index >= 0; index -= 1) {
    const point = points[index];
    if (point.series === 'pm1' && pm1 === null) {
      pm1 = point;
      continue;
    }

    if (point.series === 'pm25' && pm25 === null) {
      pm25 = point;
      continue;
    }

    if (point.series === 'pm10' && pm10 === null) {
      pm10 = point;
      continue;
    }

    if (pm1 && pm25 && pm10) {
      break;
    }
  }

  if (!pm1 || !pm25 || !pm10) {
    return null;
  }

  return {
    raw: {
      pm1: pm1.y,
      pm25: pm25.y,
      pm10: pm10.y,
    },
    timestamp: Math.max(pm1.x, pm25.x, pm10.x),
  };
}

function extractLiveTimestamp(liveData: Record<string, unknown> | null): number | null {
  if (!liveData || typeof liveData !== 'object') {
    return null;
  }

  const candidates = [liveData.ts, liveData.device_ts, liveData.timestamp];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return toEpochMs(parsed);
    }
  }

  return null;
}

function createFallbackSnapshot(): ParticleSourceSnapshot {
  return {
    source: 'fallback',
    timestamp: null,
    readings: createReadingMap((key) => {
      const fraction = FRACTIONS.find((item) => item.key === key);
      return fraction ? fraction.baseReading : 1;
    }),
  };
}

function buildLiveSnapshot(liveData: Record<string, unknown> | null): ParticleSourceSnapshot | null {
  const liveTimestamp = extractLiveTimestamp(liveData);
  const liveParticles = extractParticlesFromLiveRecord(liveData);
  const livePm = extractPmRawLike(liveData);

  if (liveParticles && Object.keys(liveParticles).length > 0) {
    const derivedReadings = livePm ? deriveParticleReadingsFromPm(livePm) : createFallbackSnapshot().readings;
    return {
      source: 'live-particles',
      timestamp: liveTimestamp,
      readings: {
        ...derivedReadings,
        ...liveParticles,
      },
    };
  }

  if (livePm) {
    return {
      source: 'live-derived',
      timestamp: liveTimestamp,
      readings: deriveParticleReadingsFromPm(livePm),
    };
  }

  return null;
}

function buildHistorySnapshot(points: PmsChartPoint[]): ParticleSourceSnapshot | null {
  const latestPm = extractLatestPmFromPoints(points);
  if (!latestPm) {
    return null;
  }

  return {
    source: 'history-derived',
    timestamp: latestPm.timestamp,
    readings: deriveParticleReadingsFromPm(latestPm.raw),
  };
}

function selectSourceSnapshot(
  preferLive: boolean,
  liveData: Record<string, unknown> | null,
  points: PmsChartPoint[],
): ParticleSourceSnapshot {
  const liveSnapshot = buildLiveSnapshot(liveData);
  const historySnapshot = buildHistorySnapshot(points);

  if (preferLive) {
    return liveSnapshot ?? historySnapshot ?? createFallbackSnapshot();
  }

  return historySnapshot ?? liveSnapshot ?? createFallbackSnapshot();
}

function createInitialSparkMap(): Record<ParticleFractionKey, number[]> {
  return FRACTIONS.reduce<Record<ParticleFractionKey, number[]>>((acc, fraction) => {
    const fill = readingToFill(fraction.baseReading, fraction.maxVal);
    acc[fraction.key] = new Array<number>(SPARK_LENGTH).fill(fill);
    return acc;
  }, {} as Record<ParticleFractionKey, number[]>);
}

function createInitialReadingMap(): Record<ParticleFractionKey, number> {
  return FRACTIONS.reduce<Record<ParticleFractionKey, number>>((acc, fraction) => {
    acc[fraction.key] = fraction.baseReading;
    return acc;
  }, {} as Record<ParticleFractionKey, number>);
}

function createInitialFrame(): ParticleFrame {
  const rows = FRACTIONS.map((fraction) => {
    const fill = readingToFill(fraction.baseReading, fraction.maxVal);
    return {
      key: fraction.key,
      fill,
      reading: fraction.baseReading,
      maxVal: fraction.maxVal,
      sessionMaxFill: fill,
      severity: severityFor(fill),
      spark: new Array<number>(SPARK_LENGTH).fill(fill),
    } satisfies ParticleRow;
  });

  const peak = rows.reduce((currentPeak, row) => {
    return row.reading > currentPeak.reading ? row : currentPeak;
  }, rows[0]);

  const avgFill = rows.reduce((sum, row) => sum + row.fill, 0) / rows.length;

  return {
    rows,
    frame: 0,
    peakKey: peak.key,
    dominantKey: peak.key,
    avgFill,
    trendDir: 'flat',
    trendLabel: 'stabilnie',
    source: 'fallback',
    sampleTimestamp: null,
  };
}

export function useParticlesSimulation(input: UseParticlesSimulationInput = {}): ParticleFrame {
  const liveData = input.liveData ?? null;
  const points = input.points ?? EMPTY_POINTS;
  const preferLive = input.preferLive ?? true;

  const [frame, setFrame] = useState<ParticleFrame>(() => createInitialFrame());

  const frameCounterRef = useRef(0);
  const prevAvgFillRef = useRef<number | null>(null);
  const sessionMaxRef = useRef<Record<ParticleFractionKey, number>>(createInitialReadingMap());
  const sparkRef = useRef<Record<ParticleFractionKey, number[]>>(createInitialSparkMap());
  const snapshotSignatureRef = useRef<string | null>(null);

  const snapshot = useMemo(() => {
    return selectSourceSnapshot(preferLive, liveData, points);
  }, [preferLive, liveData, points]);

  const snapshotSignature = useMemo(() => {
    const readings = FRACTIONS.map((fraction) => Math.round(snapshot.readings[fraction.key])).join('|');
    return `${snapshot.source}:${snapshot.timestamp ?? 'na'}:${readings}`;
  }, [snapshot]);

  useEffect(() => {
    if (snapshotSignatureRef.current === snapshotSignature) {
      return;
    }

    snapshotSignatureRef.current = snapshotSignature;

    const rows = FRACTIONS.map((fraction) => {
      const reading = normalizeReading(snapshot.readings[fraction.key] ?? fraction.baseReading, fraction.maxVal);
      const fill = readingToFill(reading, fraction.maxVal);

      const nextSessionMax = Math.max(sessionMaxRef.current[fraction.key], reading);
      sessionMaxRef.current[fraction.key] = nextSessionMax;
      const sessionMaxFill = readingToFill(nextSessionMax, fraction.maxVal);

      const sparkWindow = sparkRef.current[fraction.key];
      const nextSpark = [...sparkWindow.slice(-(SPARK_LENGTH - 1)), fill];
      sparkRef.current[fraction.key] = nextSpark;

      return {
        key: fraction.key,
        fill,
        reading,
        maxVal: fraction.maxVal,
        sessionMaxFill: clamp(sessionMaxFill, fill, 100),
        severity: severityFor(fill),
        spark: nextSpark,
      } satisfies ParticleRow;
    });

    const peak = rows.reduce((currentPeak, row) => {
      return row.reading > currentPeak.reading ? row : currentPeak;
    }, rows[0]);

    const dominant = rows.reduce((currentDominant, row) => {
      return row.fill > currentDominant.fill ? row : currentDominant;
    }, rows[0]);

    const avgFill = rows.reduce((sum, row) => sum + row.fill, 0) / rows.length;

    let trendDir: ParticleTrend = 'flat';
    let trendLabel = 'stabilnie';
    if (prevAvgFillRef.current !== null) {
      const delta = avgFill - prevAvgFillRef.current;
      if (Math.abs(delta) > 1.5) {
        trendDir = delta > 0 ? 'up' : 'down';
        trendLabel = `${trendDir === 'up' ? 'wzrost' : 'spadek'} ${Math.round(Math.abs(delta))}%`;
      }
    }
    prevAvgFillRef.current = avgFill;

    frameCounterRef.current += 1;

    setFrame({
      rows,
      frame: frameCounterRef.current,
      peakKey: peak.key,
      dominantKey: dominant.key,
      avgFill,
      trendDir,
      trendLabel,
      source: snapshot.source,
      sampleTimestamp: snapshot.timestamp,
    });
  }, [snapshot, snapshotSignature]);

  return frame;
}
