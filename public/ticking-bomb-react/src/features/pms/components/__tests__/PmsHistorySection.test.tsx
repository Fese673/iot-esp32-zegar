// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const usePmsLiveMock = vi.hoisted(() => vi.fn());
const usePmsHistoryMock = vi.hoisted(() => vi.fn());
const useCalendarMock = vi.hoisted(() => vi.fn());

vi.mock('../PmsChartController', () => ({
  default: () => null,
}));

vi.mock('../../../../shared/components/Calendar', () => ({
  default: () => null,
}));

vi.mock('../../hooks/usePmsLive', () => ({
  usePmsLive: usePmsLiveMock,
}));

vi.mock('../../hooks/usePmsHistory', () => ({
  usePmsHistory: usePmsHistoryMock,
}));

vi.mock('../../../../shared/hooks/useCalendar', () => ({
  useCalendar: useCalendarMock,
}));

describe('PmsHistorySection live tiles', () => {
  beforeEach(() => {
    usePmsLiveMock.mockReturnValue({
      data: {
        particles: { '0p3': 8 },
        A: { pm1: 1.2, pm25: 2.3, pm10: 3.4 },
        ts: 1_700_000_000_000,
      },
      status: 'loaded',
      timestamp: 1_700_000_000_000,
    });

    usePmsHistoryMock.mockReturnValue({
      points: [],
      loadState: 'empty',
      dataDensity: 0,
    });

    useCalendarMock.mockReturnValue({
      state: {
        selectedDate: '2026-03-28',
        today: '2026-03-28',
        viewDate: '2026-03-28',
      },
      selectDate: vi.fn(),
      nextMonth: vi.fn(),
      prevMonth: vi.fn(),
    });
  });

  test('renders live PM values in all three cards', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const PmsHistorySection = (await import('../PmsHistorySection')).default;

    await act(async () => {
      root.render(<PmsHistorySection />);
    });

    expect(container.querySelector('#pm1Value')?.textContent).toBe('1.2');
    expect(container.querySelector('#pm25Value')?.textContent).toBe('2.3');
    expect(container.querySelector('#pm10Value')?.textContent).toBe('3.4');

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});