import { useCallback, useMemo, useState } from 'react';
import { clampWindow, type WindowRange } from '../../../shared/lib/chartHelpers';

const DEFAULT_PAN_STEP_RATIO = 0.25;
const DEFAULT_MAX_PAN_SHIFT_MS = 60 * 60 * 1000;

export interface UseChartWindowOptions {
  bounds: WindowRange | null;
  minWindowMs: number;
}

export interface UseChartWindowResult {
  windowRange: WindowRange | null;
  setWindow: (start: number, end: number) => void;
  pan: (direction: number, stepRatio?: number, maxShiftMs?: number) => void;
  zoom: (factor: number) => void;
  reset: (next: WindowRange | null) => void;
}

export function panWindow(
  current: WindowRange,
  bounds: WindowRange,
  direction: number,
  minWindowMs: number,
  stepRatio: number = DEFAULT_PAN_STEP_RATIO,
  maxShiftMs: number = DEFAULT_MAX_PAN_SHIFT_MS,
): WindowRange {
  const width = current.end - current.start;
  if (width <= 0 || direction === 0) {
    return current;
  }

  const shift = Math.min(width * stepRatio, maxShiftMs);
  return clampWindow(
    current.start + direction * shift,
    current.end + direction * shift,
    bounds,
    minWindowMs,
  );
}

export function zoomWindow(current: WindowRange, bounds: WindowRange, factor: number, minWindowMs: number): WindowRange {
  if (factor <= 0) {
    return current;
  }

  const width = current.end - current.start;
  if (width <= 0) {
    return current;
  }

  let nextWidth = width * factor;
  nextWidth = Math.min(nextWidth, bounds.end - bounds.start);
  nextWidth = Math.max(nextWidth, minWindowMs);
  const center = (current.start + current.end) / 2;

  return clampWindow(center - nextWidth / 2, center + nextWidth / 2, bounds, minWindowMs);
}

export function useChartWindow({ bounds, minWindowMs }: UseChartWindowOptions): UseChartWindowResult {
  const [windowRange, setWindowRange] = useState<WindowRange | null>(null);

  const setWindow = useCallback((start: number, end: number) => {
    if (!bounds) {
      return;
    }

    setWindowRange(clampWindow(start, end, bounds, minWindowMs));
  }, [bounds, minWindowMs]);

  const pan = useCallback((direction: number, stepRatio: number = DEFAULT_PAN_STEP_RATIO, maxShiftMs: number = DEFAULT_MAX_PAN_SHIFT_MS) => {
    if (!bounds) {
      return;
    }

    setWindowRange((current) => {
      if (!current) {
        return current;
      }

      return panWindow(current, bounds, direction, minWindowMs, stepRatio, maxShiftMs);
    });
  }, [bounds, minWindowMs]);

  const zoom = useCallback((factor: number) => {
    if (!bounds) {
      return;
    }

    setWindowRange((current) => {
      if (!current) {
        return current;
      }

      return zoomWindow(current, bounds, factor, minWindowMs);
    });
  }, [bounds, minWindowMs]);

  const reset = useCallback((next: WindowRange | null) => {
    if (!next || !bounds) {
      setWindowRange(next);
      return;
    }

    setWindowRange(clampWindow(next.start, next.end, bounds, minWindowMs));
  }, [bounds, minWindowMs]);

  return useMemo(() => ({
    windowRange,
    setWindow,
    pan,
    zoom,
    reset,
  }), [windowRange, setWindow, pan, zoom, reset]);
}
