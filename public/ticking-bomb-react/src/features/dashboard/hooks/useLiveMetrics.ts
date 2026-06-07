import { useMemo } from 'react';
import { useDeviceTelemetry } from '../../../shared/context/DeviceTelemetryContext';
import { normalizeLiveRecord } from '../api/firebaseAdapter';
import type { LoadState, LiveRecord } from '../../../shared/types';

export function useLiveMetrics(): { data: LiveRecord | null; status: LoadState } {
  const { latestRaw, status } = useDeviceTelemetry();
  const data = useMemo(() => normalizeLiveRecord(latestRaw), [latestRaw]);

  return { data, status };
}
