// @vitest-environment jsdom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { toDateKey } from '../../../../shared/lib/dateHelpers';
import type { PmsRecord } from '../../../../shared/types';
import { usePmsHistory } from '../usePmsHistory';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pushAlert = vi.hoisted(() => vi.fn());

vi.mock('../../../../shared/context/AppContext', () => ({
  useAppContext: () => ({ pushAlert }),
}));

const adapterMocks = vi.hoisted(() => ({
  loadPmsHistoryByDay: vi.fn(),
  loadPmsHistoryFallback: vi.fn(),
}));

vi.mock('../../api/pmsAdapter', () => adapterMocks);

function createRecord(timestampMs: number): PmsRecord {
  return {
    ts: timestampMs,
    A: { pm1: 11, pm25: 22, pm10: 33 },
  };
}

describe('usePmsHistory', () => {
  beforeEach(() => {
    pushAlert.mockClear();
    adapterMocks.loadPmsHistoryByDay.mockReset();
    adapterMocks.loadPmsHistoryFallback.mockReset();
  });

  test('falls back to archived history when the daily bucket is empty', async () => {
    const selectedDate = toDateKey(new Date());
    const midday = new Date();
    midday.setHours(12, 0, 0, 0);
    const fallbackRecord = createRecord(midday.getTime());

    adapterMocks.loadPmsHistoryByDay.mockResolvedValue([]);
    adapterMocks.loadPmsHistoryFallback.mockResolvedValue([fallbackRecord]);

    const snapshots: Array<{ loadState: string; points: number }> = [];

    function Probe() {
      const result = usePmsHistory(selectedDate);

      useEffect(() => {
        snapshots.push({ loadState: result.loadState, points: result.points.length });
      }, [result.loadState, result.points.length]);

      return null;
    }

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Probe />);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(adapterMocks.loadPmsHistoryByDay).toHaveBeenCalledWith('device1', selectedDate);
    expect(adapterMocks.loadPmsHistoryFallback).toHaveBeenCalledWith('device1', selectedDate);
    expect(snapshots.some((snapshot) => snapshot.loadState === 'loaded' && snapshot.points === 3)).toBe(true);
    expect(pushAlert).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});