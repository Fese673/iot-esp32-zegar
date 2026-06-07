import { useEffect, useRef, useState } from 'react';
import { useDeviceTelemetry } from '../../../shared/context/DeviceTelemetryContext';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { LoadState } from '../../../shared/types';
import { extractPmRawLike } from '../lib/pmsHelpers';
import { mergePmsChartPoints, rawToPmsChartPoints, type PmsChartPoint } from '../lib/pmsChartHelpers';

const MAX_LIVE_POINTS = 7_200;

function getDayStartTimestamp(epochMs: number): number {
  const date = new Date(epochMs);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function extractTimestamp(value: Record<string, unknown>): number | null {
  const candidates = [value['ts'], value['device_ts'], value['timestamp']];
  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function normalizePmsLiveTimestamp(value: Record<string, unknown>): number | null {
  const timestamp = extractTimestamp(value);
  return timestamp == null ? null : toEpochMs(timestamp);
}

export function usePmsLive(): {
  data: Record<string, unknown> | null;
  status: LoadState;
  timestamp: number | null;
  points: PmsChartPoint[];
} {
  const { latestRaw, latestRevision, status } = useDeviceTelemetry();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [points, setPoints] = useState<PmsChartPoint[]>([]);
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
    const record = latestRaw;
    const normalizedTimestamp = normalizePmsLiveTimestamp(record);
    const pmsRaw = extractPmRawLike(record);

    setData(record);
    setTimestamp(normalizedTimestamp);
    if (normalizedTimestamp != null && pmsRaw) {
      const incomingPoints = rawToPmsChartPoints(pmsRaw, normalizedTimestamp);
      setPoints((prev) => {
        const dayStart = getDayStartTimestamp(normalizedTimestamp);
        const shouldDropPreviousDay = prev.length > 0 && prev[0].x < dayStart;
        const dayPoints = shouldDropPreviousDay ? prev.filter((point) => point.x >= dayStart) : prev;
        const merged = mergePmsChartPoints(dayPoints, incomingPoints);

        if (merged.length > MAX_LIVE_POINTS) {
          return merged.slice(merged.length - MAX_LIVE_POINTS);
        }

        if (merged === dayPoints && !shouldDropPreviousDay) {
          return prev;
        }

        return merged;
      });
    }
  }, [latestRaw, latestRevision, status]);

  return { data, status, timestamp, points };
}