import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../../shared/context/AppContext';
import { formatClock, toEpochMs } from '../../../shared/lib/timeHelpers';
import type { ClockState } from '../../../shared/types';

function createLocalClockState(): ClockState {
  const now = Date.now();
  return {
    displayTime: formatClock(now),
    source: 'local',
    startMs: null,
    rtt: null,
  };
}

export function useClock(ts: number | undefined): ClockState {
  const { pushAlert } = useAppContext();
  const [state, setState] = useState<ClockState>(() => createLocalClockState());
  const hasAnnouncedFallbackRef = useRef(false);

  useEffect(() => {
    let baseMs = Date.now();

    const syncTimeFromDevice = () => {
      if (ts == null) {
        baseMs = Date.now();
        if (!hasAnnouncedFallbackRef.current) {
          hasAnnouncedFallbackRef.current = true;
          pushAlert({ level: 'warn', message: 'Brak czasu z urządzenia — używam czasu lokalnego.', autoDismiss: true });
        }
        setState((currentState) => ({
          ...currentState,
          source: 'local',
          rtt: null,
          startMs: null,
          displayTime: formatClock(baseMs),
        }));
        return;
      }

      baseMs = toEpochMs(ts) - performance.now();
      hasAnnouncedFallbackRef.current = false;
      const deviceMs = toEpochMs(ts);
      const rtt = Math.max(0, Date.now() - deviceMs);
      setState({
        displayTime: formatClock(baseMs + performance.now()),
        source: 'device',
        startMs: deviceMs,
        rtt,
      });
    };

    syncTimeFromDevice();

    const intervalId = window.setInterval(() => {
      setState((currentState) => ({
        ...currentState,
        displayTime: formatClock(baseMs + performance.now()),
      }));
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [pushAlert, ts]);

  return state;
}