import { useEffect, useState } from 'react';
import { useAppContext } from '../../../shared/context/AppContext';
import { loadPmsHistoryByDay, loadPmsHistoryFallback } from '../api/pmsAdapter';
import { dateRangeForDay, isDateKeyInRange, toDateKey } from '../../../shared/lib/dateHelpers';
import { getRuntimeDeviceId } from '../../../shared/lib/runtimeConfig';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import { recordToPmsChartPoints, sortPmsChartPoints, type PmsChartPoint } from '../lib/pmsChartHelpers';
import type { LoadState, PmsRecord } from '../../../shared/types';

function filterRecordsForDay(records: PmsRecord[], date: string): PmsRecord[] {
  const range = dateRangeForDay(date);

  return records.filter((record) => isDateKeyInRange(toEpochMs(record.ts), range));
}

function recordsToPoints(records: PmsRecord[]): PmsChartPoint[] {
  return sortPmsChartPoints(records.flatMap(recordToPmsChartPoints));
}

interface PmsHistoryResult {
  points: PmsChartPoint[];
  loadState: LoadState;
  dataDensity: number;
}

interface PmsHistoryState {
  dateKey: string;
  points: PmsChartPoint[];
  loadState: LoadState;
  dataDensity: number;
}

export function usePmsHistory(selectedDate: string): PmsHistoryResult {
  const { pushAlert } = useAppContext();
  const [state, setState] = useState<PmsHistoryState>(() => ({
    dateKey: selectedDate,
    points: [],
    loadState: 'loading',
    dataDensity: 0,
  }));

  useEffect(() => {
    const selectedIsToday = selectedDate === toDateKey(new Date());
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
        loadState: 'empty',
      });

      if (!selectedIsToday) {
        pushAlert({ level: 'error', message: 'Błąd pobierania historii PMS.', autoDismiss: false });
      }
    }, 8_000);

    async function loadHistory() {
      try {
        const deviceId = getRuntimeDeviceId();
        const primaryRecords = filterRecordsForDay(await loadPmsHistoryByDay(deviceId, selectedDate), selectedDate);
        const records = primaryRecords.length > 0
          ? primaryRecords
          : filterRecordsForDay(await loadPmsHistoryFallback(deviceId, selectedDate), selectedDate);

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
          if (!selectedIsToday) {
            pushAlert({ level: 'warn', message: `Brak danych PMS dla ${selectedDate}.`, autoDismiss: true });
          }
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
          loadState: 'empty',
        });

        if (!selectedIsToday) {
          pushAlert({ level: 'error', message: 'Błąd pobierania historii PMS.', autoDismiss: false });
        }
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