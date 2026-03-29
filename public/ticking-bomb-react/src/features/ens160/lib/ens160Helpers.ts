import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { Ens160Raw } from '../../../shared/types';

const TVOC_KEYS = ['tvoc', 'tVOC', 'voc'];
const ECO2_KEYS = ['eco2', 'eCO2', 'co2', 'co2eq', 'e_co2'];
const AQI_KEYS = ['aqi', 'AQI', 'airQualityIndex', 'air_quality_index'];
const TS_KEYS = ['ts', 'device_ts', 'timestamp', 'time'];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
}

function readFiniteNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const parsed = Number(source[key]);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function getCandidateRecords(record: Record<string, unknown>): Record<string, unknown>[] {
  const nestedCandidates = [
    record.ens160,
    record.ens,
    record.air,
    record.gas,
    record.sensor,
    record.latest,
  ]
    .map((candidate) => asRecord(candidate))
    .filter((candidate): candidate is Record<string, unknown> => Boolean(candidate));

  return [record, ...nestedCandidates];
}

export function extractEns160RawLike(record: Record<string, unknown> | null): Ens160Raw | null {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const source = record as Record<string, unknown>;
  for (const candidate of getCandidateRecords(source)) {
    const tvoc = readFiniteNumber(candidate, TVOC_KEYS) ?? readFiniteNumber(source, TVOC_KEYS);
    const eco2 = readFiniteNumber(candidate, ECO2_KEYS) ?? readFiniteNumber(source, ECO2_KEYS);

    if (tvoc == null || eco2 == null) {
      continue;
    }

    const aqi = readFiniteNumber(candidate, AQI_KEYS) ?? readFiniteNumber(source, AQI_KEYS);

    if (aqi == null) {
      return { tvoc, eco2 };
    }

    return { tvoc, eco2, aqi };
  }

  return null;
}

export function normalizeEns160Timestamp(record: Record<string, unknown>, fallbackKey?: string): number | null {
  for (const key of TS_KEYS) {
    const parsed = Number(record[key]);
    if (Number.isFinite(parsed)) {
      return toEpochMs(parsed);
    }
  }

  if (!fallbackKey) {
    return null;
  }

  const fallbackTs = Number(fallbackKey);
  if (!Number.isFinite(fallbackTs)) {
    return null;
  }

  return toEpochMs(fallbackTs);
}
