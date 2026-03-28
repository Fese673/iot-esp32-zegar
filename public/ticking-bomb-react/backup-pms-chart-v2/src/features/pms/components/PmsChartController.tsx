import { useCallback, useEffect, useMemo, useRef } from 'react';
import { clampWindow, type WindowRange } from '../../../shared/lib/chartHelpers';
import { toDateKey } from '../../../shared/lib/dateHelpers';
import type { LoadState } from '../../../shared/types';
import {
  groupPmsChartPointsBySeries,
  sortPmsChartPoints,
  type PmsChartPoint,
} from '../lib/pmsChartHelpers';
import PmsChart, { type PmsCanvasElement, type PmsChartInstance, type PmsPlotPoint, type PmsSeriesData } from './PmsChart';
import { useChartWindow } from '../hooks/useChartWindow';
import { useChartInteractions } from '../hooks/useChartInteractions';

interface PmsChartControllerProps {
  points: PmsChartPoint[];
  loadState: LoadState;
  selectedDate: string;
}

const MIN_WINDOW_MS = 60_000;
const REALTIME_WINDOW_MS = 10 * 60_000;
const RIGHT_PADDING_RATIO = 0.08;
const RIGHT_PADDING_MAX_MS = 60_000;
const INITIAL_ZOOM_MS = REALTIME_WINDOW_MS;
const INITIAL_PAN_STEPS = 4;

function toPlotPoints(points: PmsChartPoint[]): PmsPlotPoint[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function getBoundsFromPoints(points: PmsChartPoint[]): WindowRange | null {
  if (!points.length) {
    return null;
  }

  const firstPoint = points[0];
  const startDate = new Date(firstPoint.x);
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();

  return {
    start,
    end: start + 24 * 60 * 60 * 1000,
  };
}

function getLatestPoint(points: PmsChartPoint[]): number {
  return points.reduce((latest, point) => Math.max(latest, point.x), 0);
}

function computeRightPadding(windowMs: number): number {
  const padding = Math.round(windowMs * RIGHT_PADDING_RATIO);
  return Math.min(padding, RIGHT_PADDING_MAX_MS);
}

export function shouldAutoFollowLatest(windowRange: WindowRange | null, latestPoint: number, paddingMs: number): boolean {
  if (!windowRange || !Number.isFinite(latestPoint) || latestPoint <= 0) {
    return false;
  }

  return latestPoint >= windowRange.end - paddingMs;
}

export function buildFollowWindow(
  windowRange: WindowRange,
  bounds: WindowRange,
  latestPoint: number,
  minWindowMs: number,
  paddingMs: number,
): WindowRange {
  const width = Math.max(minWindowMs, windowRange.end - windowRange.start);
  const targetEnd = latestPoint + paddingMs;
  return clampWindow(targetEnd - width, targetEnd, bounds, minWindowMs);
}

function getSeriesData(points: PmsChartPoint[]): PmsSeriesData {
  const grouped = groupPmsChartPointsBySeries(sortPmsChartPoints(points));
  return {
    pm1: toPlotPoints(grouped.pm1),
    pm25: toPlotPoints(grouped.pm25),
    pm10: toPlotPoints(grouped.pm10),
  };
}

export default function PmsChartController({ points, loadState, selectedDate }: PmsChartControllerProps) {
  const canvasRef = useRef<PmsCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<PmsChartInstance | null>(null);
  const latestBoundsRef = useRef<WindowRange | null>(null);
  const latestWindowRef = useRef<WindowRange | null>(null);
  const lastSelectedDateRef = useRef<string | null>(null);
  const initializedDateRef = useRef<string | null>(null);

  const sortedPoints = useMemo(() => sortPmsChartPoints(points), [points]);
  const bounds = useMemo(() => getBoundsFromPoints(sortedPoints), [sortedPoints]);
  const seriesData = useMemo(() => getSeriesData(sortedPoints), [sortedPoints]);
  const isSelectedToday = selectedDate === toDateKey(new Date());

  const { windowRange, setWindow, pan, zoom, reset } = useChartWindow({ bounds, minWindowMs: MIN_WINDOW_MS });

  useEffect(() => {
    latestBoundsRef.current = bounds;
  }, [bounds]);

  useEffect(() => {
    latestWindowRef.current = windowRange;
  }, [windowRange]);

  const getValueAtClientX = useCallback((clientX: number): number | null => {
    const chart = chartInstanceRef.current;
    const canvas = canvasRef.current;
    const scale = chart?.scales.x;

    if (!canvas || !scale) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const pixel = clientX - rect.left;
    return scale.getValueForPixel(pixel) ?? null;
  }, []);

  useChartInteractions({
    canvasRef,
    frameRef,
    enabled: loadState === 'loaded' && Boolean(bounds),
    minWindowMs: MIN_WINDOW_MS,
    getValueAtClientX,
    getWindow: () => latestWindowRef.current,
    getBounds: () => latestBoundsRef.current,
    setWindow,
    pan,
    zoom,
  });

  useEffect(() => {
    const selectedDateChanged = lastSelectedDateRef.current !== selectedDate;
    if (selectedDateChanged) {
      initializedDateRef.current = null;
      lastSelectedDateRef.current = selectedDate;
    }

    if (loadState !== 'loaded' || sortedPoints.length === 0 || !bounds) {
      reset(null);
      return;
    }

    if (initializedDateRef.current === selectedDate) {
      return;
    }

    const latest = getLatestPoint(sortedPoints);
    const pad = computeRightPadding(REALTIME_WINDOW_MS);
    const end = Math.max(bounds.start + MIN_WINDOW_MS, latest - pad);
    const start = Math.max(bounds.start, end - INITIAL_ZOOM_MS);
    setWindow(start, end);

    for (let index = 0; index < INITIAL_PAN_STEPS; index += 1) {
      pan(1);
    }

    initializedDateRef.current = selectedDate;
  }, [bounds, loadState, pan, reset, selectedDate, setWindow, sortedPoints]);

  useEffect(() => {
    if (!isSelectedToday || loadState !== 'loaded' || !bounds || !windowRange || sortedPoints.length === 0) {
      return;
    }

    if (initializedDateRef.current !== selectedDate) {
      return;
    }

    const latest = getLatestPoint(sortedPoints);
    const padding = computeRightPadding(REALTIME_WINDOW_MS);

    if (!shouldAutoFollowLatest(windowRange, latest, padding)) {
      return;
    }

    const nextWindow = buildFollowWindow(windowRange, bounds, latest, MIN_WINDOW_MS, padding);
    if (nextWindow.start === windowRange.start && nextWindow.end === windowRange.end) {
      return;
    }

    setWindow(nextWindow.start, nextWindow.end);
  }, [bounds, isSelectedToday, loadState, selectedDate, setWindow, sortedPoints, windowRange]);

  return (
    <PmsChart
      seriesData={seriesData}
      windowRange={windowRange}
      loadState={loadState}
      frameRef={frameRef}
      canvasRef={canvasRef}
      chartRef={chartInstanceRef}
      onPanLeft={() => pan(-1)}
      onPanRight={() => pan(1)}
    />
  );
}
