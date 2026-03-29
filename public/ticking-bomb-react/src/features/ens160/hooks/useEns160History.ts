import { useEffect, useState } from 'react';
import { useAppContext } from '../../../shared/context/AppContext';
import { dateRangeForDay, isDateKeyInRange, toDateKey } from '../../../shared/lib/dateHelpers';
import { getRuntimeDeviceId } from '../../../shared/lib/runtimeConfig';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import { sortChartPoints } from '../../../shared/lib/chartHelpers';
import type { ChartPoint, Ens160Record, LoadState } from '../../../shared/types';
import { loadEns160HistoryByDay, loadEns160HistoryFallback } from '../api/ens160Adapter';
import { recordToEns160ChartPoints } from '../lib/ens160ChartHelpers';

function filterRecordsForDay(records: Ens160Record[], date: string): Ens160Record[] {
  const range = dateRangeForDay(date);
  return records.filter((record) => isDateKeyInRange(toEpochMs(record.ts), range));
}

function recordsToPoints(records: Ens160Record[]): ChartPoint[] {
  return sortChartPoints(records.flatMap(recordToEns160ChartPoints));
}

interface Ens160HistoryResult {
  points: ChartPoint[];
  loadState: LoadState;
  dataDensity: number;
}

interface Ens160HistoryState {
  dateKey: string;
  points: ChartPoint[];
  loadState: LoadState;
  dataDensity: number;
}

const ENS160_HISTORY_CACHE_PREFIX = 'tb:ens160-history:v1:';
const ENS160_HISTORY_CACHE_TTL_MS = 20 * 60 * 1000;
const ENS160_HISTORY_CACHE_MAX_POINTS = 2_400;

type CachedEns160HistoryTuple = [ChartPoint['series'], number, number];

interface CachedEns160HistoryPayload {
  v: 1;
  savedAt: number;
  points: CachedEns160HistoryTuple[];
}

function ens160HistoryCacheKey(dateKey: string): string {
  return `${ENS160_HISTORY_CACHE_PREFIX}${dateKey}`;
}

function readCachedEns160HistoryPoints(dateKey: string): ChartPoint[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(ens160HistoryCacheKey(dateKey));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CachedEns160HistoryPayload;
    if (
      parsed.v !== 1
      || !Number.isFinite(parsed.savedAt)
      || Date.now() - parsed.savedAt > ENS160_HISTORY_CACHE_TTL_MS
      || !Array.isArray(parsed.points)
    ) {
      window.sessionStorage.removeItem(ens160HistoryCacheKey(dateKey));
      return [];
    }

    const points = parsed.points.flatMap((entry) => {
      if (!Array.isArray(entry) || entry.length !== 3) {
        return [];
      }

      const [series, x, y] = entry;
      if ((series !== 'eco2' && series !== 'tvoc') || !Number.isFinite(x) || !Number.isFinite(y)) {
        return [];
      }

      return [{ series, x, y } satisfies ChartPoint];
    });

    return points.length > 0 ? sortChartPoints(points) : [];
  } catch {
    return [];
  }
}

function writeCachedEns160HistoryPoints(dateKey: string, points: ChartPoint[]): void {
  if (typeof window === 'undefined' || points.length === 0) {
    return;
  }

  const serializedPoints: CachedEns160HistoryTuple[] = points
    .slice(-ENS160_HISTORY_CACHE_MAX_POINTS)
    .map((point) => [point.series, point.x, point.y]);

  const payload: CachedEns160HistoryPayload = {
    v: 1,
    savedAt: Date.now(),
    points: serializedPoints,
  };

  try {
    window.sessionStorage.setItem(ens160HistoryCacheKey(dateKey), JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors and continue with network data only.
  }
}

export function useEns160History(selectedDate: string): Ens160HistoryResult {
  const { pushAlert } = useAppContext();
  const initialCachedPoints = readCachedEns160HistoryPoints(selectedDate);
  const [state, setState] = useState<Ens160HistoryState>(() => ({
    dateKey: selectedDate,
    points: initialCachedPoints,
    loadState: initialCachedPoints.length > 0 ? 'loaded' : 'loading',
    dataDensity: initialCachedPoints.length,
  }));

  useEffect(() => {
    const cachedPoints = readCachedEns160HistoryPoints(selectedDate);
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
        pushAlert({ level: 'error', message: 'Błąd pobierania historii ENS160.', autoDismiss: false });
      }
    }, 8_000);

    async function loadHistory() {
      try {
        const deviceId = getRuntimeDeviceId();
        const primaryPromise = loadEns160HistoryByDay(deviceId, selectedDate);
        const fallbackPromise = loadEns160HistoryFallback(deviceId, selectedDate).catch(() => [] as Ens160Record[]);

        const primaryRecords = filterRecordsForDay(await primaryPromise, selectedDate);
        const records = primaryRecords.length > 0
          ? primaryRecords
          : filterRecordsForDay(await fallbackPromise, selectedDate);

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
            pushAlert({ level: 'warn', message: `Brak danych ENS160 dla ${selectedDate}.`, autoDismiss: true });
          }
          return;
        }

        const nextPoints = recordsToPoints(records);
        writeCachedEns160HistoryPoints(selectedDate, nextPoints);
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
          pushAlert({ level: 'error', message: 'Błąd pobierania historii ENS160.', autoDismiss: false });
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
    const cachedPoints = readCachedEns160HistoryPoints(selectedDate);
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
