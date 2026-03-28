import { useEffect, useMemo, useState } from 'react';
import { usePmsHistory } from './usePmsHistory';
import { usePmsLive } from './usePmsLive';
import { extractPmRawLike } from '../lib/pmsLiveHelpers';
import { rawToPmsChartPoints, sortPmsChartPoints, type PmsChartPoint } from '../lib/pmsChartHelpers';
import type { LoadState } from '../../../shared/types';
import { toDateKey } from '../../../shared/lib/dateHelpers';

interface PmsDataResult {
  points: PmsChartPoint[];
  loadState: LoadState;
  dataDensity: number;
}

export function usePmsData(selectedDate: string): PmsDataResult {
  const history = usePmsHistory(selectedDate);
  const live = usePmsLive();
  const isSelectedToday = selectedDate === toDateKey(new Date());

  // Stan lokalny dla skumulowanych punktów "live"
  // Dzięki temu punkty, które przyszły w trakcie sesji, zostają w pamięci
  const [accumulatedLivePoints, setAccumulatedLivePoints] = useState<PmsChartPoint[]>([]);

  // Resetujemy akumulator przy zmianie daty
  useEffect(() => {
    setAccumulatedLivePoints([]);
  }, [selectedDate]);

  // Efekt dodający nową próbkę "live" do akumulatora
  useEffect(() => {
    if (!isSelectedToday || live.status !== 'loaded' || live.timestamp == null) {
      return;
    }

    const livePmsRaw = extractPmRawLike(live.data);
    if (!livePmsRaw) {
      return;
    }

    const newPoints = rawToPmsChartPoints(livePmsRaw, live.timestamp);
    
    setAccumulatedLivePoints((prev) => {
      // Unikamy duplikowania punktów o tym samym timestampie
      const firstNew = newPoints[0];
      const exists = prev.some(p => p.x === firstNew.x);
      if (exists) {
        return prev;
      }
      return sortPmsChartPoints([...prev, ...newPoints]);
    });
  }, [isSelectedToday, live.data, live.status, live.timestamp]);

  const combinedPoints = useMemo(() => {
    if (!accumulatedLivePoints.length) {
      return history.points;
    }

    // Łączymy historię z sesją live
    // history.points są statyczne (zaciągnięte raz przy wejściu na "dzisiaj")
    // accumulatedLivePoints to wszystko co przyszło od tego momentu
    const merged = [...history.points];
    const historyLastTs = history.points.length > 0 ? history.points[history.points.length - 1].x : 0;

    // Dodajemy tylko te punkty z sesji, których nie ma w historii pobranej na starcie
    for (const lp of accumulatedLivePoints) {
      if (lp.x > historyLastTs) {
        merged.push(lp);
      }
    }

    return sortPmsChartPoints(merged);
  }, [history.points, accumulatedLivePoints]);

  const loadState: LoadState = combinedPoints.length > 0 
    ? 'loaded' 
    : (isSelectedToday && live.status === 'loaded' ? 'loaded' : history.loadState);

  return {
    points: combinedPoints,
    loadState,
    dataDensity: combinedPoints.length,
  };
}
