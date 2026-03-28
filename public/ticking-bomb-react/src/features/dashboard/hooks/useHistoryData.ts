import { useEffect, useState } from 'react';
import { useAppContext } from '../../../shared/context/AppContext';
import { loadHistoryByDay, loadHistoryFallback } from '../api/firebaseAdapter';
import { dateRangeForDay, isDateKeyInRange } from '../../../shared/lib/dateHelpers';
import { sortChartPoints } from '../../../shared/lib/chartHelpers';
import { getRuntimeDeviceId } from '../../../shared/lib/runtimeConfig';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { ChartPoint, HistoryRecord, LoadState } from '../../../shared/types';

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

interface HistoryDataState {
  dateKey: string;
  points: ChartPoint[];
  loadState: LoadState;
  dataDensity: number;
}

export function useHistoryData(selectedDate: string): HistoryDataResult {
  const { pushAlert } = useAppContext();
  const [state, setState] = useState<HistoryDataState>(() => ({
    dateKey: selectedDate,
    points: [],
    loadState: 'loading',
    dataDensity: 0,
  }));

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled || settled) {
        return;
      }

      settled = true;
      setState({
        dateKey: selectedDate,
        points: [],
        dataDensity: 0,
        loadState: 'error',
      });
    }, 8_000);

    async function loadHistory() {
      try {
        const deviceId = getRuntimeDeviceId();
        const primaryRecords = filterRecordsForDay(await loadHistoryByDay(deviceId, selectedDate), selectedDate);
        const records = primaryRecords.length > 0 ? primaryRecords : filterRecordsForDay(await loadHistoryFallback(deviceId, selectedDate), selectedDate);

        if (cancelled || settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);

        if (records.length === 0) {
          setState({
            dateKey: selectedDate,
            points: [],
            dataDensity: 0,
            loadState: 'empty',
          });
          pushAlert({ level: 'warn', message: `Brak danych dla ${selectedDate}.`, autoDismiss: true });
          return;
        }

        const nextPoints = recordsToPoints(records);
        setState({
          dateKey: selectedDate,
          points: nextPoints,
          dataDensity: nextPoints.length,
          loadState: 'loaded',
        });
      } catch {
        if (cancelled || settled) {
          return;
        }

        settled = true;
        window.clearTimeout(timeoutId);
        setState({
          dateKey: selectedDate,
          points: [],
          dataDensity: 0,
          loadState: 'error',
        });
        pushAlert({ level: 'error', message: 'Błąd pobierania danych historycznych.', autoDismiss: false });
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [pushAlert, selectedDate]);

  if (state.dateKey !== selectedDate) {
    return { points: [], loadState: 'loading', dataDensity: 0 };
  }

  return {
    points: state.points,
    loadState: state.loadState,
    dataDensity: state.dataDensity,
  };
}