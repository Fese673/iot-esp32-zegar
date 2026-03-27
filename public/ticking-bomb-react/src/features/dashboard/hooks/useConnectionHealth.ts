import { useEffect, useState } from 'react';
import { useAppContext } from '../../../App';
import { humanTime, toEpochMs } from '../../../shared/lib/timeHelpers';
import type { LiveRecord } from '../../../shared/types';

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
  const [lastSeen, setLastSeen] = useState('--:--');

  useEffect(() => {
    if (!latestRecord) {
      setLastSeen('--:--');
      dispatch({ type: 'SET_CONNECTION', payload: 'disconnected' });
      return;
    }

    const updateHealth = () => {
      const ageMs = Date.now() - toEpochMs(latestRecord.ts);
      setLastSeen(humanTime(latestRecord.ts));
      dispatch({ type: 'SET_CONNECTION', payload: getConnectionStatus(ageMs) });
    };

    updateHealth();
    const intervalId = window.setInterval(updateHealth, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [dispatch, latestRecord]);

  return { lastSeen };
}
