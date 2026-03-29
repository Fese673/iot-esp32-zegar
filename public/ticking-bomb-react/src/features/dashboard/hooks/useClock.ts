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
  const baseMsRef = useRef<number>(Date.now() - performance.now());
  const timeoutIdRef = useRef<number | null>(null);

  useEffect(() => {
    const CLOCK_VISIBLE_UPDATE_MS = 125;
    const CLOCK_HIDDEN_UPDATE_MS = 1_000;

    const updateState = (next: Partial<ClockState>) => {
      setState((prev) => {
        const merged: ClockState = {
          ...prev,
          ...next,
        };

        if (
          prev.displayTime === merged.displayTime &&
          prev.source === merged.source &&
          prev.startMs === merged.startMs &&
          prev.rtt === merged.rtt
        ) {
          return prev;
        }

        return merged;
      });
    };

    const syncClock = () => {
      if (ts == null) {
        baseMsRef.current = Date.now() - performance.now();

        if (!hasAnnouncedFallbackRef.current) {
          hasAnnouncedFallbackRef.current = true;
          pushAlert({
            level: 'warn',
            message: 'Brak czasu z urządzenia — używam czasu lokalnego.',
            autoDismiss: true,
          });
        }

        updateState({
          source: 'local',
          rtt: null,
          startMs: null,
          displayTime: formatClock(baseMsRef.current + performance.now()),
        });
        return;
      }

      const deviceMs = toEpochMs(ts);
      baseMsRef.current = deviceMs - performance.now();
      hasAnnouncedFallbackRef.current = false;
      const rtt = Math.max(0, Date.now() - deviceMs);

      updateState({
        source: 'device',
        startMs: deviceMs,
        rtt,
        displayTime: formatClock(baseMsRef.current + performance.now()),
      });
    };

    const tick = () => {
      updateState({ displayTime: formatClock(baseMsRef.current + performance.now()) });

      const delay = document.hidden ? CLOCK_HIDDEN_UPDATE_MS : CLOCK_VISIBLE_UPDATE_MS;
      timeoutIdRef.current = window.setTimeout(tick, delay);
    };

    const handleVisibilityChange = () => {
      if (timeoutIdRef.current != null) {
        window.clearTimeout(timeoutIdRef.current);
      }

      updateState({ displayTime: formatClock(baseMsRef.current + performance.now()) });
      tick();
    };

    syncClock();
    tick();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (timeoutIdRef.current != null) {
        window.clearTimeout(timeoutIdRef.current);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pushAlert, ts]);

  return state;
}
