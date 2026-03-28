// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useCalendarMock = vi.hoisted(() => vi.fn());
const useHistoryDataMock = vi.hoisted(() => vi.fn());
const selectDateMock = vi.hoisted(() => vi.fn());

vi.mock('../HistoryChart.tsx', () => ({
  default: () => null,
}));

vi.mock('../../../../shared/components/Calendar', () => ({
  default: () => null,
}));

vi.mock('../../../../shared/hooks/useCalendar', () => ({
  useCalendar: useCalendarMock,
}));

vi.mock('../../hooks/useHistoryData.ts', () => ({
  useHistoryData: useHistoryDataMock,
}));

describe('HistoryPanel', () => {
  beforeEach(() => {
    selectDateMock.mockReset();

    useCalendarMock.mockReturnValue({
      state: {
        selectedDate: '2026-03-28',
        today: '2026-03-28',
        viewDate: '2026-03-01',
      },
      selectDate: selectDateMock,
      nextMonth: vi.fn(),
      prevMonth: vi.fn(),
    });

    useHistoryDataMock.mockReturnValue({
      points: [],
      loadState: 'empty',
      dataDensity: 0,
    });
  });

  test('wires Today/Clear actions to calendar date selection', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const HistoryPanel = (await import('../HistoryPanel')).default;

    await act(async () => {
      root.render(<HistoryPanel liveRecord={null} />);
    });

    const todayButton = container.querySelector('#btnToday');
    const clearButton = container.querySelector('#btnClear');
    expect(todayButton).not.toBeNull();
    expect(clearButton).not.toBeNull();

    todayButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    clearButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(selectDateMock).toHaveBeenNthCalledWith(1, '2026-03-28');
    expect(selectDateMock).toHaveBeenNthCalledWith(2, '2026-03-28');
    expect(container.querySelector('#dataDensity')?.textContent).toContain('brak próbek');

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});
