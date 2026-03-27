import { get, limitToLast, onValue, query, ref } from 'firebase/database';
import { db } from '../../../shared/lib/firebaseClient';
import { dateRangeForDay, isDateKeyInRange } from '../../../shared/lib/dateHelpers';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { HistoryRecord, LiveRecord } from '../../../shared/types';

function getDevicePath(deviceId: string): string {
  return `devices/${deviceId}`;
}

function normalizeLiveRecord(value: unknown): LiveRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<LiveRecord>;
  const t = Number(record.t);
  const h = Number(record.h);
  const p = Number(record.p);
  const ts = Number(record.ts);

  if (![t, h, p, ts].every(Number.isFinite)) {
    return null;
  }

  return { t, h, p, ts };
}

function normalizeHistoryRecord(key: string, value: unknown): HistoryRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Partial<HistoryRecord>;
  const t = Number(record.t);
  const h = Number(record.h);
  const p = Number(record.p);
  const fallbackTimestamp = Number(key);
  const ts = Number.isFinite(Number(record.ts)) ? Number(record.ts) : fallbackTimestamp;

  if (![t, h, p, ts].every(Number.isFinite)) {
    return null;
  }

  return { t, h, p, ts };
}

function snapshotToHistoryRecords(snapshotValue: unknown): HistoryRecord[] {
  if (!snapshotValue || typeof snapshotValue !== 'object') {
    return [];
  }

  const records = Object.entries(snapshotValue as Record<string, unknown>)
    .map(([key, value]) => normalizeHistoryRecord(key, value))
    .filter((record): record is HistoryRecord => Boolean(record));

  return records.sort((left, right) => toEpochMs(left.ts) - toEpochMs(right.ts));
}

export function subscribeLiveMetrics(deviceId: string, callback: (data: LiveRecord) => void): () => void {
  const liveRef = ref(db, `${getDevicePath(deviceId)}/latest`);

  const unsubscribe = onValue(liveRef, (snapshot) => {
    const record = normalizeLiveRecord(snapshot.val());
    if (record) {
      callback(record);
    }
  });

  return () => unsubscribe();
}

export async function loadHistoryByDay(deviceId: string, date: string): Promise<HistoryRecord[]> {
  const dayRef = ref(db, `${getDevicePath(deviceId)}/historyByDay/${date}`);
  const snapshot = await get(dayRef);
  return snapshotToHistoryRecords(snapshot.val());
}

export async function loadHistoryFallback(deviceId: string, date: string): Promise<HistoryRecord[]> {
  const historyRef = ref(db, `${getDevicePath(deviceId)}/history`);
  const snapshot = await get(query(historyRef, limitToLast(20_000)));
  const records = snapshotToHistoryRecords(snapshot.val());
  const range = dateRangeForDay(date);

  return records.filter((record) => isDateKeyInRange(toEpochMs(record.ts), range));
}