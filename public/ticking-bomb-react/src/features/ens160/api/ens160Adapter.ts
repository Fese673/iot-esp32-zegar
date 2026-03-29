import { get, limitToLast, onValue, query, ref } from 'firebase/database';
import { getFirebaseDb } from '../../../shared/lib/firebaseClient';
import { dateRangeForDay, isDateKeyInRange } from '../../../shared/lib/dateHelpers';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { Ens160Record } from '../../../shared/types';
import { extractEns160RawLike, normalizeEns160Timestamp } from '../lib/ens160Helpers';

function getDevicePath(deviceId: string): string {
  return `devices/${deviceId}`;
}

function normalizeEns160Record(key: string, value: unknown): Ens160Record | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const raw = extractEns160RawLike(record);
  const ts = normalizeEns160Timestamp(record, key);

  if (!raw || ts == null) {
    return null;
  }

  return {
    tvoc: raw.tvoc,
    eco2: raw.eco2,
    ...(raw.aqi != null ? { aqi: raw.aqi } : {}),
    ts,
  };
}

function snapshotToEns160Records(snapshotValue: unknown): Ens160Record[] {
  if (!snapshotValue || typeof snapshotValue !== 'object') {
    return [];
  }

  const records = Object.entries(snapshotValue as Record<string, unknown>)
    .map(([key, value]) => normalizeEns160Record(key, value))
    .filter((record): record is Ens160Record => Boolean(record));

  return records.sort((left, right) => toEpochMs(left.ts) - toEpochMs(right.ts));
}

export function subscribeEns160Live(
  deviceId: string,
  callback: (data: Ens160Record) => void,
  onError?: (error: Error) => void,
): () => void {
  try {
    const liveRef = ref(getFirebaseDb(), `${getDevicePath(deviceId)}/latest`);

    const unsubscribe = onValue(liveRef, (snapshot) => {
      const record = normalizeEns160Record('0', snapshot.val());
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

export async function loadEns160HistoryByDay(deviceId: string, date: string): Promise<Ens160Record[]> {
  const dayRef = ref(getFirebaseDb(), `${getDevicePath(deviceId)}/historyByDay/${date}`);
  const snapshot = await get(dayRef);
  return snapshotToEns160Records(snapshot.val());
}

export async function loadEns160HistoryFallback(deviceId: string, date: string): Promise<Ens160Record[]> {
  const historyRef = ref(getFirebaseDb(), `${getDevicePath(deviceId)}/history`);
  const snapshot = await get(query(historyRef, limitToLast(20_000)));
  const records = snapshotToEns160Records(snapshot.val());
  const range = dateRangeForDay(date);

  return records.filter((record) => isDateKeyInRange(toEpochMs(record.ts), range));
}
