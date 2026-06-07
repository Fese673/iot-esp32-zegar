import { onValue, ref } from 'firebase/database';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAppContext } from './AppContext';
import { getFirebaseDb } from '../lib/firebaseClient';
import { getRuntimeDeviceId } from '../lib/runtimeConfig';
import type { LoadState } from '../types';

interface DeviceTelemetryContextValue {
  latestRaw: Record<string, unknown> | null;
  latestRevision: number;
  status: LoadState;
}

const DeviceTelemetryContext = createContext<DeviceTelemetryContextValue | null>(null);

export function DeviceTelemetryProvider({ children }: { children: ReactNode }) {
  const { pushAlert } = useAppContext();
  const [latestRaw, setLatestRaw] = useState<Record<string, unknown> | null>(null);
  const [latestRevision, setLatestRevision] = useState(0);
  const [status, setStatus] = useState<LoadState>('loading');
  const hasReceivedDataRef = useRef(false);
  const hasAnnouncedSuccessRef = useRef(false);

  useEffect(() => {
    hasReceivedDataRef.current = false;
    hasAnnouncedSuccessRef.current = false;

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setLatestRaw(null);
        setStatus('empty');
        pushAlert({ level: 'warn', message: 'Brak danych live z urządzenia.', autoDismiss: true });
      }
    }, 4_000);

    let unsubscribe: (() => void) | null = null;

    try {
      const deviceId = getRuntimeDeviceId();
      const liveRef = ref(getFirebaseDb(), `devices/${deviceId}/latest`);

      unsubscribe = onValue(
        liveRef,
        (snapshot) => {
          const value = snapshot.val();
          if (!value || typeof value !== 'object') {
            return;
          }

          hasReceivedDataRef.current = true;
          setLatestRaw(value as Record<string, unknown>);
          setLatestRevision((current) => current + 1);
          setStatus('loaded');

          if (!hasAnnouncedSuccessRef.current) {
            hasAnnouncedSuccessRef.current = true;
            pushAlert({ level: 'success', message: 'Połączenie z urządzeniem aktywne.', autoDismiss: true });
          }
        },
        (error) => {
          hasReceivedDataRef.current = true;
          setLatestRaw(null);
          setStatus('error');
          pushAlert({
            level: 'error',
            message: error.message.includes('permission')
              ? 'Brak dostępu do Firebase — sprawdź reguły bazy.'
              : 'Błąd odczytu danych live z Firebase.',
            autoDismiss: false,
          });
        },
      );
    } catch (error) {
      hasReceivedDataRef.current = true;
      setLatestRaw(null);
      setStatus('error');

      const rawMessage = error instanceof Error ? error.message : String(error);
      const normalizedMessage = rawMessage.toLowerCase();

      pushAlert({
        level: 'error',
        message: normalizedMessage.includes('database') && normalizedMessage.includes('url')
          ? 'Nieprawidłowy databaseURL Firebase — użyj adresu root bazy (bez /devices/.../latest).'
          : 'Błąd inicjalizacji Firebase — sprawdź konfigurację bazy.',
        autoDismiss: false,
      });
    }

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe?.();
    };
  }, [pushAlert]);

  const value = useMemo<DeviceTelemetryContextValue>(
    () => ({ latestRaw, latestRevision, status }),
    [latestRaw, latestRevision, status],
  );

  return <DeviceTelemetryContext.Provider value={value}>{children}</DeviceTelemetryContext.Provider>;
}

export function useDeviceTelemetry(): DeviceTelemetryContextValue {
  const context = useContext(DeviceTelemetryContext);
  if (!context) {
    throw new Error('useDeviceTelemetry must be used within DeviceTelemetryProvider');
  }

  return context;
}