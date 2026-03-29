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

const PMS_HISTORY_CACHE_PREFIX = 'tb:pms-history:v1:';
const PMS_HISTORY_CACHE_TTL_MS = 20 * 60 * 1000;
const PMS_HISTORY_CACHE_MAX_POINTS = 2_400;

type CachedPmsHistoryTuple = [PmsChartPoint['series'], number, number];

interface CachedPmsHistoryPayload {
  v: 1;
  savedAt: number;
  points: CachedPmsHistoryTuple[];
}

function pmsHistoryCacheKey(dateKey: string): string {
  return `${PMS_HISTORY_CACHE_PREFIX}${dateKey}`;
}

function readCachedPmsHistoryPoints(dateKey: string): PmsChartPoint[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(pmsHistoryCacheKey(dateKey));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CachedPmsHistoryPayload;
    if (
      parsed.v !== 1
      || !Number.isFinite(parsed.savedAt)
      || Date.now() - parsed.savedAt > PMS_HISTORY_CACHE_TTL_MS
      || !Array.isArray(parsed.points)
    ) {
      window.sessionStorage.removeItem(pmsHistoryCacheKey(dateKey));
      return [];
    }

    const points = parsed.points.flatMap((entry) => {
      if (!Array.isArray(entry) || entry.length !== 3) {
        return [];
      }

      const [series, x, y] = entry;
      if ((series !== 'pm1' && series !== 'pm25' && series !== 'pm10') || !Number.isFinite(x) || !Number.isFinite(y)) {
        return [];
      }

      return [{ series, x, y } satisfies PmsChartPoint];
    });

    return points.length > 0 ? sortPmsChartPoints(points) : [];
  } catch {
    return [];
  }
}

function writeCachedPmsHistoryPoints(dateKey: string, points: PmsChartPoint[]): void {
  if (typeof window === 'undefined' || points.length === 0) {
    return;
  }

  const serializedPoints: CachedPmsHistoryTuple[] = points
    .slice(-PMS_HISTORY_CACHE_MAX_POINTS)
    .map((point) => [point.series, point.x, point.y]);

  const payload: CachedPmsHistoryPayload = {
    v: 1,
    savedAt: Date.now(),
    points: serializedPoints,
  };

  try {
    window.sessionStorage.setItem(pmsHistoryCacheKey(dateKey), JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors and continue with network data only.
  }
}

export function usePmsHistory(selectedDate: string): PmsHistoryResult {
  const { pushAlert } = useAppContext();
  const initialCachedPoints = readCachedPmsHistoryPoints(selectedDate);
  const [state, setState] = useState<PmsHistoryState>(() => ({
    dateKey: selectedDate,
    points: initialCachedPoints,
    loadState: initialCachedPoints.length > 0 ? 'loaded' : 'loading',
    dataDensity: initialCachedPoints.length,
  }));

  useEffect(() => {
    const cachedPoints = readCachedPmsHistoryPoints(selectedDate);

    const selectedIsToday = selectedDate === toDateKey(new Date());
    let cancelled = false;
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (cancelled || settled) {
        return;
      }

      settled = true;
      if (cachedPoints.length > 0) {
        setState({
          dateKey: selectedDate,
          points: cachedPoints,
          dataDensity: cachedPoints.length,
          loadState: 'loaded',
        });
        return;
      }

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
          : filterRecordsForDay(await loadPmsHistoryFallback(deviceId, selectedDate).catch(() => [] as PmsRecord[]), selectedDate);

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
        writeCachedPmsHistoryPoints(selectedDate, nextPoints);
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
          points: cachedPoints,
          dataDensity: cachedPoints.length,
          loadState: cachedPoints.length > 0 ? 'loaded' : 'empty',
        });

        if (!selectedIsToday && cachedPoints.length === 0) {
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
    const cachedPoints = readCachedPmsHistoryPoints(selectedDate);
    if (cachedPoints.length > 0) {
      return {
        points: cachedPoints,
        loadState: 'loaded',
        dataDensity: cachedPoints.length,
      };
    }

    return { points: [], loadState: 'loading', dataDensity: 0 };
  }

  return {
    points: state.points,
    loadState: state.loadState,
    dataDensity: state.dataDensity,
  };
}