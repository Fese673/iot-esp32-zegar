// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, test, vi } from 'vitest';

import TopBar from '../TopBar';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('TopBar', () => {
  test('invokes motion and refresh callbacks', async () => {
    const onToggleMotion = vi.fn();
    const onRefresh = vi.fn();
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TopBar
          motionEnabled={true}
          onToggleMotion={onToggleMotion}
          onRefresh={onRefresh}
          onOpenAnalysis={vi.fn()}
          connectionStatus="connected"
        />,
      );
    });

    const toggleButton = container.querySelector('#toggleMotion');
    const refreshButton = container.querySelector('#btnRefresh');
    expect(toggleButton).not.toBeNull();
    expect(refreshButton).not.toBeNull();

    toggleButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    refreshButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onToggleMotion).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });

  test('renders status labels for connection states', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <TopBar
          motionEnabled={false}
          onToggleMotion={() => undefined}
          onRefresh={() => undefined}
          onOpenAnalysis={() => undefined}
          connectionStatus="reconnecting"
        />,
      );
    });

    expect(container.querySelector('#statusIndicator')?.textContent).toContain('Brak nowych danych');

    await act(async () => {
      root.render(
        <TopBar
          motionEnabled={false}
          onToggleMotion={() => undefined}
          onRefresh={() => undefined}
          onOpenAnalysis={() => undefined}
          connectionStatus="disconnected"
        />,
      );
    });

    expect(container.querySelector('#statusIndicator')?.textContent).toContain('Brak danych > 60s');

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});
