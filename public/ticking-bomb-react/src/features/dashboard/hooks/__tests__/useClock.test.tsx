// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { AppContext, type AppContextValue } from '../../../../shared/context/AppContext';
import { useClock } from '../useClock';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ ts }: { ts?: number }) {
  const clock = useClock(ts);
  return (
    <div>
      <span data-testid="epoch-time">{clock.displayTime}</span>
      <span data-testid="clock-source">{clock.source}</span>
    </div>
  );
}

describe('useClock', () => {
  const value: AppContextValue = {
    state: {
      connectionStatus: 'disconnected',
      motionEnabled: true,
      alerts: [],
      toast: null,
    },
    dispatch: () => undefined,
    pushAlert: vi.fn(),
    dismissAlert: () => undefined,
    hideToast: () => undefined,
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test('updates displayTime faster than 1 second for NTP source', async () => {
    const baseNow = 1_700_000_000_000;
    vi.setSystemTime(baseNow);

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AppContext.Provider value={value}>
          <Probe ts={baseNow} />
        </AppContext.Provider>,
      );
    });

    const initial = container.querySelector('[data-testid="epoch-time"]')?.textContent;
    expect(initial).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    const afterFast = container.querySelector('[data-testid="epoch-time"]')?.textContent;
    expect(afterFast).toBeTruthy();
    expect(afterFast).not.toEqual(initial);

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});
