import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../../App';
import { subscribePmsLive } from '../api/pmsAdapter';
import { pickPmsRaw } from '../lib/pmsHelpers';
import type { LoadState, PmsRaw, PmsRecord } from '../../../shared/types';

function getDeviceId(): string {
  return window.__DEVICE_ID__ || localStorage.getItem('firebaseDeviceId') || 'device1';
}

export function usePmsLive(): { data: PmsRaw | null; status: LoadState; timestamp: number | null } {
  const { pushAlert } = useAppContext();
  const [data, setData] = useState<PmsRaw | null>(null);
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

    const unsubscribe = subscribePmsLive(getDeviceId(), (record: PmsRecord) => {
      const raw = pickPmsRaw(record);
      if (!raw) {
        return;
      }

      hasReceivedDataRef.current = true;
      setData(raw);
      setTimestamp(record.ts);
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