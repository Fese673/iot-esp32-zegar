import { useEffect, useState } from 'react';
import { useAppContext } from '../../../App';
import { loadPmsHistoryByDay, loadPmsHistoryFallback } from '../api/pmsAdapter';
import { dateRangeForDay, isDateKeyInRange } from '../../../shared/lib/dateHelpers';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import { recordToPmsChartPoints, sortPmsChartPoints, type PmsChartPoint } from '../lib/pmsChartHelpers';
import type { LoadState, PmsRecord } from '../../../shared/types';

function getDeviceId(): string {
  return window.__DEVICE_ID__ || localStorage.getItem('firebaseDeviceId') || 'device1';
}

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

export function usePmsHistory(selectedDate: string): PmsHistoryResult {
  const { pushAlert } = useAppContext();
  const [points, setPoints] = useState<PmsChartPoint[]>([]);
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
      pushAlert({ level: 'error', message: 'Błąd pobierania historii PMS.', autoDismiss: false });
    }, 8_000);

    setLoadState('loading');
    setPoints([]);
    setDataDensity(0);

    async function loadHistory() {
      try {
        const deviceId = getDeviceId();
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
          setPoints([]);
          setDataDensity(0);
          setLoadState('empty');
          pushAlert({ level: 'warn', message: `Brak danych PMS dla ${selectedDate}.`, autoDismiss: true });
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
        pushAlert({ level: 'error', message: 'Błąd pobierania historii PMS.', autoDismiss: false });
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [pushAlert, selectedDate]);

  return { points, loadState, dataDensity };
}