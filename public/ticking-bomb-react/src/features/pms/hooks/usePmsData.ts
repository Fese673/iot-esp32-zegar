import { useMemo } from 'react';
import { usePmsHistory } from './usePmsHistory';
import { usePmsLive } from './usePmsLive';
import { mergePmsChartPoints, type PmsChartPoint } from '../lib/pmsChartHelpers';
import type { LoadState } from '../../../shared/types';
import { toDateKey } from '../../../shared/lib/dateHelpers';

const EMPTY_POINTS: PmsChartPoint[] = [];

interface PmsDataResult {
  points: PmsChartPoint[];
  loadState: LoadState;
  dataDensity: number;
  liveData: Record<string, unknown> | null;
  liveStatus: LoadState;
  liveTimestamp: number | null;
}

export function usePmsData(selectedDate: string): PmsDataResult {
  const history = usePmsHistory(selectedDate);
  const live = usePmsLive();
  const isSelectedToday = selectedDate === toDateKey(new Date());
  const livePointsForDate = isSelectedToday ? live.points : EMPTY_POINTS;

  const combinedPoints = useMemo(() => {
    if (!livePointsForDate.length) {
      return history.points;
    }

    return mergePmsChartPoints(history.points, livePointsForDate);
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
