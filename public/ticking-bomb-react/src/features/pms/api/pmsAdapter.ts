import { get, limitToLast, onValue, query, ref } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/lib/firebaseClient';
import { dateRangeForDay, isDateKeyInRange } from '../../../shared/lib/dateHelpers';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { PmsRaw, PmsRecord } from '../../../shared/types';

function getDevicePath(deviceId: string): string {
  return `devices/${deviceId}`;
}

function normalizePmsRaw(value: unknown): PmsRaw | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const raw = value as Partial<PmsRaw>;
  const pm1 = Number(raw.pm1);
  const pm25 = Number(raw.pm25);
  const pm10 = Number(raw.pm10);

  if (![pm1, pm25, pm10].every(Number.isFinite)) {
    return null;
  }

  return { pm1, pm25, pm10 };
}

function normalizePmsRecord(key: string, value: unknown): PmsRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<PmsRecord>;
  const ts = Number.isFinite(Number(record.ts)) ? Number(record.ts) : Number(key);
  const A = normalizePmsRaw(record.A);
  const F = normalizePmsRaw(record.F);

  if (!Number.isFinite(ts)) {
    return null;
  }

  return {
    ...(A ? { A } : {}),
    ...(F ? { F } : {}),
    ts,
  };
}

function snapshotToPmsRecords(snapshotValue: unknown): PmsRecord[] {
  if (!snapshotValue || typeof snapshotValue !== 'object') {
    return [];
  }

  const records = Object.entries(snapshotValue as Record<string, unknown>)
    .map(([key, value]) => normalizePmsRecord(key, value))
    .filter((record): record is PmsRecord => Boolean(record));

  return records.sort((left, right) => toEpochMs(left.ts) - toEpochMs(right.ts));
}

export function subscribePmsLive(
  deviceId: string,
  callback: (data: PmsRecord) => void,
  onError?: (error: Error) => void,
): () => void {
  try {
    const liveRef = ref(getFirebaseDb(), `${getDevicePath(deviceId)}/latest`);

    const unsubscribe = onValue(liveRef, (snapshot) => {
      const record = normalizePmsRecord('0', snapshot.val());
      if (record) {
        callback(record);
      }
    }, onError);

    return () => unsubscribe();
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)));
    return () => undefined;
  }
}

export async function loadPmsHistoryByDay(deviceId: string, date: string): Promise<PmsRecord[]> {
  const dayRef = ref(getFirebaseDb(), `${getDevicePath(deviceId)}/historyByDay/${date}`);
  const snapshot = await get(dayRef);
  return snapshotToPmsRecords(snapshot.val());
}

export async function loadPmsHistoryFallback(deviceId: string, date: string): Promise<PmsRecord[]> {
  const historyRef = ref(getFirebaseDb(), `${getDevicePath(deviceId)}/history`);
  const snapshot = await get(query(historyRef, limitToLast(20_000)));
  const records = snapshotToPmsRecords(snapshot.val());
  const range = dateRangeForDay(date);

  return records.filter((record) => isDateKeyInRange(toEpochMs(record.ts), range));
}