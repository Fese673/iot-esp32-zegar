import { clampWindow, type WindowRange } from '../../../shared/lib/chartHelpers';

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