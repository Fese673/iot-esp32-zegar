import type { PmsRaw, PmsRecord } from '../../../shared/types';

export function pickPmsRaw(record: PmsRecord): PmsRaw | null {
  return record.A ?? record.F ?? null;
}

export function extractPmRawLike(record: Record<string, unknown> | null): PmsRaw | null {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const candidates = [record.A, record.F, record.P, record];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const source = candidate as Record<string, unknown>;
    const pm1 = Number(source.pm1);
    const pm25 = Number(source.pm25);
    const pm10 = Number(source.pm10);

    if ([pm1, pm25, pm10].every(Number.isFinite)) {
      return { pm1, pm25, pm10 };
    }
  }

  return null;
}