import { useEffect, useRef, useState } from 'react';
import { useAppContext } from '../../../shared/context/AppContext';
import { getRuntimeDeviceId } from '../../../shared/lib/runtimeConfig';
import type { ChartPoint, Ens160Raw, LoadState } from '../../../shared/types';
import { subscribeEns160Live } from '../api/ens160Adapter';
import { mergeEns160ChartPoints, rawToEns160ChartPoints } from '../lib/ens160ChartHelpers';

const MAX_LIVE_POINTS = 7_200;

function getDayStartTimestamp(epochMs: number): number {
  const date = new Date(epochMs);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function useEns160Live(): {
  data: Ens160Raw | null;
  status: LoadState;
  timestamp: number | null;
  points: ChartPoint[];
} {
  const { pushAlert } = useAppContext();
  const [data, setData] = useState<Ens160Raw | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [status, setStatus] = useState<LoadState>('loading');
  const hasReceivedDataRef = useRef(false);

  useEffect(() => {
    hasReceivedDataRef.current = false;

    const timeoutId = window.setTimeout(() => {
      if (!hasReceivedDataRef.current) {
        setStatus('empty');
      }
    }, 4000);

    const unsubscribe = subscribeEns160Live(getRuntimeDeviceId(), (record) => {
      hasReceivedDataRef.current = true;

      const nextRaw: Ens160Raw = {
        tvoc: record.tvoc,
        eco2: record.eco2,
        ...(record.aqi != null ? { aqi: record.aqi } : {}),
      };

      setData(nextRaw);
      setTimestamp(record.ts);
      setStatus('loaded');

      if (!Number.isFinite(record.ts)) {
        return;
      }

      const incomingPoints = rawToEns160ChartPoints(nextRaw, record.ts);
      setPoints((prev) => {
        const dayStart = getDayStartTimestamp(record.ts);
        const shouldDropPreviousDay = prev.length > 0 && prev[0].x < dayStart;
        const dayPoints = shouldDropPreviousDay ? prev.filter((point) => point.x >= dayStart) : prev;
        const merged = mergeEns160ChartPoints(dayPoints, incomingPoints);

        if (merged.length > MAX_LIVE_POINTS) {
          return merged.slice(merged.length - MAX_LIVE_POINTS);
        }

        if (merged === dayPoints && !shouldDropPreviousDay) {
          return prev;
        }

        return merged;
      });
    }, (error) => {
      hasReceivedDataRef.current = true;
      setData(null);
      setTimestamp(null);
      setStatus('error');
      pushAlert({
        level: 'error',
        message: error.message.toLowerCase().includes('permission')
          ? 'Brak dostępu do Firebase — sprawdź reguły bazy.'
          : 'Błąd odczytu danych ENS160 z Firebase.',
        autoDismiss: false,
      });
    });

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [pushAlert]);

  return { data, status, timestamp, points };
}
