import { useEffect, useRef, useState } from 'react';
import { useDeviceTelemetry } from '../../../shared/context/DeviceTelemetryContext';
import type { ChartPoint, Ens160Raw, LoadState } from '../../../shared/types';
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
  const { latestRaw, latestRevision, status } = useDeviceTelemetry();
  const [data, setData] = useState<Ens160Raw | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const lastConsumedRevisionRef = useRef(0);

  useEffect(() => {
    if (status !== 'loaded' || !latestRaw || latestRevision === lastConsumedRevisionRef.current) {
      if (status === 'error') {
        setData(null);
        setTimestamp(null);
      }

      return;
    }

    lastConsumedRevisionRef.current = latestRevision;

    const rawRecord = latestRaw;
    const nextRaw: Ens160Raw = {
      tvoc: Number(rawRecord.tvoc),
      eco2: Number(rawRecord.eco2),
      ...(rawRecord.aqi != null ? { aqi: Number(rawRecord.aqi) } : {}),
    };
    const normalizedTimestamp = Number(rawRecord.ts);

    setData(nextRaw);
    setTimestamp(normalizedTimestamp);

    if (!Number.isFinite(normalizedTimestamp)) {
      return;
    }

    const incomingPoints = rawToEns160ChartPoints(nextRaw, normalizedTimestamp);
    setPoints((prev) => {
      const dayStart = getDayStartTimestamp(normalizedTimestamp);
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
  }, [latestRaw, latestRevision, status]);

  return { data, status, timestamp, points };
}
