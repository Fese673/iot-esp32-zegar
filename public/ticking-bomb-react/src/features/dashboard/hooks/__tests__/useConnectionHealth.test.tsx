// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { AppContext, type AppContextValue } from '../../../../shared/context/AppContext';
import { useConnectionHealth } from '../useConnectionHealth';
import type { LiveRecord } from '../../../../shared/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ record }: { record: LiveRecord | null }) {
  useConnectionHealth(record);
  return null;
}

describe('useConnectionHealth', () => {
  const dispatchMock = vi.fn();

  const value: AppContextValue = {
    state: {
      connectionStatus: 'disconnected',
      motionEnabled: true,
      alerts: [],
      toast: null,
    },
    dispatch: dispatchMock,
    pushAlert: () => 'alert-id',
    dismissAlert: () => undefined,
    hideToast: () => undefined,
  };

  beforeEach(() => {
    dispatchMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('dispatches connection status transitions as live record gets stale', async () => {
    const baseNow = 1_700_000_000_000;
    vi.setSystemTime(baseNow);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppContext.Provider value={value}>
          <Probe record={{ t: 21.3, h: 50, p: 1011, ts: baseNow }} />
        </AppContext.Provider>,
      );
    });

    expect(dispatchMock).toHaveBeenNthCalledWith(1, { type: 'SET_CONNECTION', payload: 'connected' });

    await act(async () => {
      vi.setSystemTime(baseNow + 25_000);
      vi.advanceTimersByTime(1_000);
    });

    expect(dispatchMock).toHaveBeenNthCalledWith(2, { type: 'SET_CONNECTION', payload: 'reconnecting' });

    await act(async () => {
      vi.setSystemTime(baseNow + 65_000);
      vi.advanceTimersByTime(1_000);
    });

    expect(dispatchMock).toHaveBeenNthCalledWith(3, { type: 'SET_CONNECTION', payload: 'disconnected' });

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});
