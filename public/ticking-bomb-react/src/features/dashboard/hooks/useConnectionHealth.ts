import { useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../../../shared/context/AppContext';
import { humanTime, toEpochMs } from '../../../shared/lib/timeHelpers';
import type { ConnectionStatus, LiveRecord } from '../../../shared/types';

function getConnectionStatus(ageMs: number): 'connected' | 'reconnecting' | 'disconnected' {
  if (ageMs < 20_000) {
    return 'connected';
  }

  if (ageMs < 60_000) {
    return 'reconnecting';
  }

  return 'disconnected';
}

export function useConnectionHealth(latestRecord: LiveRecord | null): { lastSeen: string } {
  const { dispatch } = useAppContext();
  const lastStatusRef = useRef<ConnectionStatus | null>(null);
  const lastSeen = useMemo(() => (latestRecord ? humanTime(latestRecord.ts) : '--:--'), [latestRecord]);

  useEffect(() => {
    if (!latestRecord) {
      if (lastStatusRef.current !== 'disconnected') {
        lastStatusRef.current = 'disconnected';
        dispatch({ type: 'SET_CONNECTION', payload: 'disconnected' });
      }
      return;
    }

    const updateHealth = () => {
      const ageMs = Date.now() - toEpochMs(latestRecord.ts);
      const nextStatus = getConnectionStatus(ageMs);
      if (lastStatusRef.current !== nextStatus) {
        lastStatusRef.current = nextStatus;
        dispatch({ type: 'SET_CONNECTION', payload: nextStatus });
      }
    };

    updateHealth();
    const intervalId = window.setInterval(updateHealth, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dispatch, latestRecord]);

  return { lastSeen };
}
