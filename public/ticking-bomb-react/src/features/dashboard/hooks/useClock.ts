import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../../shared/context/AppContext';
import { formatClock, toEpochMs } from '../../../shared/lib/timeHelpers';
import type { ClockState } from '../../../shared/types';

const CLOCK_HIDDEN_UPDATE_MS = 1_000;
const CLOCK_UPDATE_ANIMATION_MS = 140;
const MAX_DEVICE_CLOCK_DRIFT_MS = 5 * 60_000;

function createLocalClockState(): ClockState {
  const now = Date.now();
  return {
    displayTime: formatClock(now),
    source: 'local',
    startMs: now,
    rtt: null,
  };
}

function shouldUseDeviceClock(deviceMs: number, currentMs: number): boolean {
  return Number.isFinite(deviceMs) && Math.abs(deviceMs - currentMs) <= MAX_DEVICE_CLOCK_DRIFT_MS;
}

export function useClock(ts: number | undefined): ClockState {
  const { pushAlert } = useAppContext();
  const [state, setState] = useState<ClockState>(() => createLocalClockState());

  const hasAnnouncedFallbackRef = useRef(false);
  const baseMsRef = useRef<number>(0);
  const timeoutIdRef = useRef<number | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastPaintedTextRef = useRef(state.displayTime);

  const clockNodeRef = useRef<HTMLParagraphElement | null>(null);

  const stopLoop = () => {
    if (timeoutIdRef.current != null) {
      window.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    if (animationFrameIdRef.current != null) {
      window.cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  useEffect(() => {
    if (baseMsRef.current === 0) {
      baseMsRef.current = Date.now() - performance.now();
    }

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

    const paintClock = (animate = false) => {
      const nextText = formatClock(baseMsRef.current + performance.now());

      if (lastPaintedTextRef.current === nextText) {
        return;
      }

      lastPaintedTextRef.current = nextText;

      if (clockNodeRef.current == null) {
        clockNodeRef.current = document.getElementById('ntpClockValue') as HTMLParagraphElement | null;
      }

      const node = clockNodeRef.current;
      if (!node) {
        return;
      }

      node.textContent = nextText;

      if (animate && typeof node.animate === 'function') {
        node.animate(
          [
            { opacity: 0.88, transform: 'translateY(1px) scale(0.998)' },
            { opacity: 1, transform: 'translateY(0) scale(1)' },
          ],
          {
            duration: CLOCK_UPDATE_ANIMATION_MS,
            easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
          },
        );
      }
    };

    const tick = () => {
      paintClock();

      if (document.hidden) {
        timeoutIdRef.current = window.setTimeout(tick, CLOCK_HIDDEN_UPDATE_MS);
        return;
      }

      animationFrameIdRef.current = window.requestAnimationFrame(tick);
    };

    const syncClock = () => {
      const currentMs = Date.now();

      if (ts == null) {
        baseMsRef.current = currentMs - performance.now();

        if (!hasAnnouncedFallbackRef.current) {
          hasAnnouncedFallbackRef.current = true;
          pushAlert({
            level: 'warn',
            message: 'Brak czasu z urządzenia — używam czasu lokalnego.',
            autoDismiss: true,
          });
        }

        const displayTime = formatClock(currentMs);

        updateState({
          source: 'local',
          rtt: null,
          startMs: currentMs,
          displayTime,
        });

        lastPaintedTextRef.current = displayTime;
        paintClock(true);
        return;
      }

      const deviceMs = toEpochMs(ts);
      if (!shouldUseDeviceClock(deviceMs, currentMs)) {
        baseMsRef.current = currentMs - performance.now();

        if (!hasAnnouncedFallbackRef.current) {
          hasAnnouncedFallbackRef.current = true;
          pushAlert({
            level: 'warn',
            message: 'Czas z urządzenia jest poza zakresem synchronizacji - używam czasu lokalnego.',
            autoDismiss: true,
          });
        }

        const displayTime = formatClock(currentMs);

        updateState({
          source: 'local',
          rtt: null,
          startMs: currentMs,
          displayTime,
        });

        lastPaintedTextRef.current = displayTime;
        paintClock(true);
        return;
      }

      baseMsRef.current = deviceMs - performance.now();
      hasAnnouncedFallbackRef.current = false;
      const rtt = Math.max(0, currentMs - deviceMs);
      const displayTime = formatClock(baseMsRef.current + performance.now());

      updateState({
        source: 'device',
        startMs: deviceMs,
        rtt,
        displayTime,
      });

      lastPaintedTextRef.current = displayTime;
      paintClock(true);
    };

    const handleVisibilityChange = () => {
      stopLoop();
      paintClock(true);
      tick();
    };

    const startLoop = () => {
      stopLoop();
      tick();
    };

    syncClock();
    startLoop();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopLoop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [pushAlert, ts]);

  return state;
}
