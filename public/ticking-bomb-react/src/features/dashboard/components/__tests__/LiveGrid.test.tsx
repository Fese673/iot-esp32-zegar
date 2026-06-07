// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, test } from 'vitest';

import LiveGrid from '../LiveGrid';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('LiveGrid', () => {
  test('shows fallback values when live record is missing', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LiveGrid
          liveRecord={null}
          loadState="empty"
          connectionStatus="disconnected"
          lastSeen="--:--"
        />,
      );
    });

    expect(container.querySelector('#tempValue')?.textContent).toBe('--');
    expect(container.querySelector('#humValue')?.textContent).toBe('--');
    expect(container.querySelector('#pressValue')?.textContent).toBe('--');
    expect(container.querySelector('#connectionLabel')?.textContent).toBe('offline');

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });

  test('renders live values and online status for loaded record', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <LiveGrid
          liveRecord={{ t: 21.4, h: 55.6, p: 1012.2, ts: 1_700_000_000_000 }}
          loadState="loaded"
          connectionStatus="connected"
          lastSeen="12:00:00"
        />,
      );
    });

    expect(container.querySelector('#tempValue')?.textContent).toBe('21.4');
    expect(container.querySelector('#humValue')?.textContent).toBe('56');
    expect(container.querySelector('#pressValue')?.textContent).toBe('1012');
    expect(container.querySelector('#connectionLabel')?.textContent).toBe('online');
    expect(container.querySelector('#tempMeta')?.textContent).toBe('LIVE');

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});
