import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../../App';
import { subscribeLiveMetrics } from '../api/firebaseAdapter';
import type { LoadState, LiveRecord } from '../../../shared/types';

function getDeviceId(): string {
  return window.__DEVICE_ID__ || localStorage.getItem('firebaseDeviceId') || 'device1';
}

export function useLiveMetrics(): { data: LiveRecord | null; status: LoadState } {
  const { pushAlert } = useAppContext();
  const [data, setData] = useState<LiveRecord | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');
  const hasReceivedDataRef = useRef(false);
  const hasAnnouncedSuccessRef = useRef(false);

  useEffect(() => {
    setStatus('loading');
    hasReceivedDataRef.current = false;

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setStatus('empty');
        pushAlert({ level: 'warn', message: 'Brak danych live z urządzenia.', autoDismiss: true });
      }
    }, 4000);

    const unsubscribe = subscribeLiveMetrics(getDeviceId(), (record) => {
      hasReceivedDataRef.current = true;
      setData(record);
      setStatus('loaded');

      if (!hasAnnouncedSuccessRef.current) {
        hasAnnouncedSuccessRef.current = true;
        pushAlert({ level: 'success', message: 'Połączenie z urządzeniem aktywne.', autoDismiss: true });
      }
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  return { data, status };
}
