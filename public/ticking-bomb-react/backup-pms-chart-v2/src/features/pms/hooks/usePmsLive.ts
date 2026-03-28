import { useEffect, useRef, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { useAppContext } from '../../../App';
import { getFirebaseDb } from '../../../shared/lib/firebaseClient';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { LoadState } from '../../../shared/types';

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

export function usePmsLive(): { data: Record<string, unknown> | null; status: LoadState; timestamp: number | null } {
  const { pushAlert } = useAppContext();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');
  const hasReceivedDataRef = useRef(false);

  useEffect(() => {
    setStatus('loading');
    hasReceivedDataRef.current = false;

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setStatus('empty');
      }
    }, 4000);

    const deviceId = window.__DEVICE_ID__ || localStorage.getItem('firebaseDeviceId') || 'device1';
    const liveRef = ref(getFirebaseDb(), `devices/${deviceId}/latest`);
    const unsubscribe = onValue(liveRef, (snapshot) => {
      const value = snapshot.val();
      if (!value || typeof value !== 'object') {
        return;
      }

      hasReceivedDataRef.current = true;
      const record = value as Record<string, unknown>;
      setData(record);
      setTimestamp(normalizePmsLiveTimestamp(record));
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
  }, []);

  return { data, status, timestamp };
}