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

const HISTORY_CACHE_PREFIX = 'tb:history:v1:';
const HISTORY_CACHE_TTL_MS = 20 * 60 * 1000;
const HISTORY_CACHE_MAX_POINTS = 2_400;

type CachedHistoryTuple = [ChartPoint['series'], number, number];

interface CachedHistoryPayload {
  v: 1;
  savedAt: number;
  points: CachedHistoryTuple[];
}

function historyCacheKey(dateKey: string): string {
  return `${HISTORY_CACHE_PREFIX}${dateKey}`;
}

function readCachedHistoryPoints(dateKey: string): ChartPoint[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.sessionStorage.getItem(historyCacheKey(dateKey));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CachedHistoryPayload;
    if (
      parsed.v !== 1
      || !Number.isFinite(parsed.savedAt)
      || Date.now() - parsed.savedAt > HISTORY_CACHE_TTL_MS
      || !Array.isArray(parsed.points)
    ) {
      window.sessionStorage.removeItem(historyCacheKey(dateKey));
      return [];
    }

    const points = parsed.points.flatMap((entry) => {
      if (!Array.isArray(entry) || entry.length !== 3) {
        return [];
      }

      const [series, x, y] = entry;
      if ((series !== 't' && series !== 'h' && series !== 'p') || !Number.isFinite(x) || !Number.isFinite(y)) {
        return [];
      }

      return [{ series, x, y } satisfies ChartPoint];
    });

    return points.length > 0 ? sortChartPoints(points) : [];
  } catch {
    return [];
  }
}

function writeCachedHistoryPoints(dateKey: string, points: ChartPoint[]): void {
  if (typeof window === 'undefined' || points.length === 0) {
    return;
  }

  const serializedPoints: CachedHistoryTuple[] = points
    .slice(-HISTORY_CACHE_MAX_POINTS)
    .map((point) => [point.series, point.x, point.y]);

  const payload: CachedHistoryPayload = {
    v: 1,
    savedAt: Date.now(),
    points: serializedPoints,
  };

  try {
    window.sessionStorage.setItem(historyCacheKey(dateKey), JSON.stringify(payload));
  } catch {
    // Ignore storage quota errors and continue with network data only.
  }
}

export function useHistoryData(selectedDate: string): HistoryDataResult {
  const { pushAlert } = useAppContext();
  const initialCachedPoints = readCachedHistoryPoints(selectedDate);
  const [state, setState] = useState<HistoryDataState>(() => ({
    dateKey: selectedDate,
    points: initialCachedPoints,
    loadState: initialCachedPoints.length > 0 ? 'loaded' : 'loading',
    dataDensity: initialCachedPoints.length,
  }));

  useEffect(() => {
    const cachedPoints = readCachedHistoryPoints(selectedDate);

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
        loadState: 'error',
      });
    }, 8_000);

    async function loadHistory() {
      try {
        const deviceId = getRuntimeDeviceId();
        const primaryPromise = loadHistoryByDay(deviceId, selectedDate);
        const fallbackPromise = loadHistoryFallback(deviceId, selectedDate).catch(() => [] as HistoryRecord[]);

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
          pushAlert({ level: 'warn', message: `Brak danych dla ${selectedDate}.`, autoDismiss: true });
          return;
        }

        const nextPoints = recordsToPoints(records);
        writeCachedHistoryPoints(selectedDate, nextPoints);
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
          loadState: cachedPoints.length > 0 ? 'loaded' : 'error',
        });
        pushAlert({
          level: cachedPoints.length > 0 ? 'warn' : 'error',
          message: cachedPoints.length > 0
            ? 'Używam ostatnich danych historycznych z pamięci przeglądarki.'
            : 'Błąd pobierania danych historycznych.',
          autoDismiss: cachedPoints.length > 0,
        });
      }
    }

    void loadHistory();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [pushAlert, selectedDate]);

  if (state.dateKey !== selectedDate) {
    const cachedPoints = readCachedHistoryPoints(selectedDate);
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