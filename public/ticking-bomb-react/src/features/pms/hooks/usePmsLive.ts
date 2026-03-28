import { useEffect, useRef, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { useAppContext } from '../../../shared/context/AppContext';
import { getFirebaseDb } from '../../../shared/lib/firebaseClient';
import { getRuntimeDeviceId } from '../../../shared/lib/runtimeConfig';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { LoadState } from '../../../shared/types';
import { extractPmRawLike } from '../lib/pmsHelpers';
import { mergePmsChartPoints, rawToPmsChartPoints, type PmsChartPoint } from '../lib/pmsChartHelpers';

const MAX_LIVE_POINTS = 7_200;

function getDayStartTimestamp(epochMs: number): number {
  const date = new Date(epochMs);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function extractTimestamp(value: Record<string, unknown>): number | null {
  const candidates = [value['ts'], value['device_ts'], value['timestamp']];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function normalizePmsLiveTimestamp(value: Record<string, unknown>): number | null {
  const timestamp = extractTimestamp(value);
  return timestamp == null ? null : toEpochMs(timestamp);
}

export function usePmsLive(): {
  data: Record<string, unknown> | null;
  status: LoadState;
  timestamp: number | null;
  points: PmsChartPoint[];
} {
  const { pushAlert } = useAppContext();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [points, setPoints] = useState<PmsChartPoint[]>([]);
  const [status, setStatus] = useState<LoadState>('loading');
  const hasReceivedDataRef = useRef(false);

  useEffect(() => {
    hasReceivedDataRef.current = false;

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setStatus('empty');
      }
    }, 4000);

    const deviceId = getRuntimeDeviceId();
    const liveRef = ref(getFirebaseDb(), `devices/${deviceId}/latest`);
    const unsubscribe = onValue(liveRef, (snapshot) => {
      const value = snapshot.val();
      if (!value || typeof value !== 'object') {
        return;
      }

      hasReceivedDataRef.current = true;
      const record = value as Record<string, unknown>;
      const normalizedTimestamp = normalizePmsLiveTimestamp(record);
      const pmsRaw = extractPmRawLike(record);

      setData(record);
      setTimestamp(normalizedTimestamp);
      if (normalizedTimestamp != null && pmsRaw) {
        const incomingPoints = rawToPmsChartPoints(pmsRaw, normalizedTimestamp);
        setPoints((prev) => {
          const dayStart = getDayStartTimestamp(normalizedTimestamp);
          const shouldDropPreviousDay = prev.length > 0 && prev[0].x < dayStart;
          const dayPoints = shouldDropPreviousDay ? prev.filter((point) => point.x >= dayStart) : prev;
          const merged = mergePmsChartPoints(dayPoints, incomingPoints);

          if (merged.length > MAX_LIVE_POINTS) {
            return merged.slice(merged.length - MAX_LIVE_POINTS);
          }

          if (merged === dayPoints && !shouldDropPreviousDay) {
            return prev;
          }

          return merged;
        });
      }
      setStatus('loaded');
    }, (error) => {
      hasReceivedDataRef.current = true;
      setData(null);
      setTimestamp(null);
      setStatus('error');
      pushAlert({
        level: 'error',
        message: error.message.toLowerCase().includes('permission')
          ? 'Brak dostępu do Firebase — sprawdź reguły bazy.'
          : 'Błąd odczytu danych PMS z Firebase.',
        autoDismiss: false,
      });
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [pushAlert]);

  return { data, status, timestamp, points };
}