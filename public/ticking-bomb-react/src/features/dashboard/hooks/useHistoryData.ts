import { useEffect, useState } from 'react';
import { useAppContext } from '../../../App';
import { loadHistoryByDay, loadHistoryFallback } from '../api/firebaseAdapter';
import { dateRangeForDay, isDateKeyInRange } from '../../../shared/lib/dateHelpers';
import { sortChartPoints } from '../../../shared/lib/chartHelpers';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { ChartPoint, HistoryRecord, LoadState } from '../../../shared/types';

function getDeviceId(): string {
  return window.__DEVICE_ID__ || localStorage.getItem('firebaseDeviceId') || 'device1';
}

function filterRecordsForDay(records: HistoryRecord[], date: string): HistoryRecord[] {
  const range = dateRangeForDay(date);

  return records.filter((record) => isDateKeyInRange(toEpochMs(record.ts), range));
}

function historyRecordToPoints(record: HistoryRecord): ChartPoint[] {
  const x = toEpochMs(record.ts);
  const points: ChartPoint[] = [];

  if (Number.isFinite(record.t)) {
    points.push({ series: 't', x, y: record.t });
  }
  if (Number.isFinite(record.h)) {
    points.push({ series: 'h', x, y: record.h });
  }
  if (Number.isFinite(record.p)) {
    points.push({ series: 'p', x, y: record.p });
  }

  return points;
}

function recordsToPoints(records: HistoryRecord[]): ChartPoint[] {
  return sortChartPoints(records.flatMap(historyRecordToPoints));
}

interface HistoryDataResult {
  points: ChartPoint[];
  loadState: LoadState;
  dataDensity: number;
}

export function useHistoryData(selectedDate: string): HistoryDataResult {
  const { pushAlert } = useAppContext();
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [dataDensity, setDataDensity] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled || settled) {
        return;
      }

      settled = true;
      setPoints([]);
      setDataDensity(0);
      setLoadState('error');
    }, 8_000);

    setLoadState('loading');
    setPoints([]);
    setDataDensity(0);

    async function loadHistory() {
      try {
        const deviceId = getDeviceId();
        const primaryRecords = filterRecordsForDay(await loadHistoryByDay(deviceId, selectedDate), selectedDate);
        const records = primaryRecords.length > 0 ? primaryRecords : filterRecordsForDay(await loadHistoryFallback(deviceId, selectedDate), selectedDate);

        if (cancelled || settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);

        if (records.length === 0) {
          setPoints([]);
          setDataDensity(0);
          setLoadState('empty');
          pushAlert({ level: 'warn', message: `Brak danych dla ${selectedDate}.`, autoDismiss: true });
          return;
        }

        const nextPoints = recordsToPoints(records);
        setPoints(nextPoints);
        setDataDensity(nextPoints.length);
        setLoadState('loaded');
      } catch {
        if (cancelled || settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        setPoints([]);
        setDataDensity(0);
        setLoadState('error');
        pushAlert({ level: 'error', message: 'Błąd pobierania danych historycznych.', autoDismiss: false });
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [selectedDate]);

  return { points, loadState, dataDensity };
}