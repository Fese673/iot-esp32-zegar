import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../../shared/context/AppContext';
import { subscribeLiveMetrics } from '../api/firebaseAdapter';
import { getRuntimeDeviceId } from '../../../shared/lib/runtimeConfig';
import type { LoadState, LiveRecord } from '../../../shared/types';

export function useLiveMetrics(): { data: LiveRecord | null; status: LoadState } {
  const { pushAlert } = useAppContext();
  const [data, setData] = useState<LiveRecord | null>(null);
  const [status, setStatus] = useState<LoadState>('loading');
  const hasReceivedDataRef = useRef(false);
  const hasAnnouncedSuccessRef = useRef(false);

  useEffect(() => {
    hasReceivedDataRef.current = false;

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setStatus('empty');
        pushAlert({ level: 'warn', message: 'Brak danych live z urządzenia.', autoDismiss: true });
      }
    }, 4000);

    const unsubscribe = subscribeLiveMetrics(getRuntimeDeviceId(), (record) => {
      hasReceivedDataRef.current = true;
      setData(record);
      setStatus('loaded');

      if (!hasAnnouncedSuccessRef.current) {
        hasAnnouncedSuccessRef.current = true;
        pushAlert({ level: 'success', message: 'Połączenie z urządzeniem aktywne.', autoDismiss: true });
      }
    }, (error) => {
      hasReceivedDataRef.current = true;
      setData(null);
      setStatus('error');
      pushAlert({
        level: 'error',
        message: error.message.includes('permission')
          ? 'Brak dostępu do Firebase — sprawdź reguły bazy.'
          : 'Błąd odczytu danych live z Firebase.',
        autoDismiss: false,
      });
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [pushAlert]);

  return { data, status };
}
