import { useMemo } from 'react';
import type { ChartPoint, Ens160Raw, LoadState } from '../../../shared/types';
import { toDateKey } from '../../../shared/lib/dateHelpers';
import { useEns160History } from './useEns160History';
import { useEns160Live } from './useEns160Live';
import { mergeEns160ChartPoints } from '../lib/ens160ChartHelpers';

const EMPTY_POINTS: ChartPoint[] = [];

interface Ens160DataResult {
  points: ChartPoint[];
  loadState: LoadState;
  dataDensity: number;
  liveData: Ens160Raw | null;
  liveStatus: LoadState;
  liveTimestamp: number | null;
}

export function useEns160Data(selectedDate: string): Ens160DataResult {
  const history = useEns160History(selectedDate);
  const live = useEns160Live();
  const isSelectedToday = selectedDate === toDateKey(new Date());
  const livePointsForDate = isSelectedToday ? live.points : EMPTY_POINTS;

  const combinedPoints = useMemo(() => {
    if (!livePointsForDate.length) {
      return history.points;
    }

    return mergeEns160ChartPoints(history.points, livePointsForDate);
  }, [history.points, livePointsForDate]);

  const loadState: LoadState = combinedPoints.length > 0
    ? 'loaded'
    : (isSelectedToday && live.status === 'loaded' ? 'loaded' : history.loadState);

  return {
    points: combinedPoints,
    loadState,
    dataDensity: combinedPoints.length,
    liveData: live.data,
    liveStatus: live.status,
    liveTimestamp: live.timestamp,
  };
}
