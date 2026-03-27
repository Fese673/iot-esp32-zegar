import type { PmsRaw, PmsRecord } from '../../../shared/types';

export function pickPmsRaw(record: PmsRecord): PmsRaw | null {
  return record.A ?? record.F ?? null;
}