// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from 'vitest';

import { useCalendar } from '../../../../shared/hooks/useCalendar';
import { useEns160Data } from '../../hooks/useEns160Data';

vi.mock('../../../../shared/hooks/useCalendar', () => ({
  useCalendar: vi.fn(),
}));

vi.mock('../../../../shared/components/Calendar', () => ({
  default: () => null,
}));

vi.mock('../../hooks/useEns160Data', () => ({
  useEns160Data: vi.fn(),
}));

vi.mock('../../../dashboard/components/HistoryChart', () => ({
  default: () => null,
}));

const Ens160Section = (await import('../Ens160Section')).default;

describe('Ens160Section', () => {
  const selectDateMock = vi.fn();

  beforeEach(() => {
    (useCalendar as unknown as Mock).mockReturnValue({
      state: {
        selectedDate: '2026-03-29',
        today: '2026-03-29',
        viewDate: '2026-03-01',
      },
      selectDate: selectDateMock,
      nextMonth: vi.fn(),
      prevMonth: vi.fn(),
    });

    (useEns160Data as unknown as Mock).mockReturnValue({
      points: [],
      loadState: 'loaded',
      dataDensity: 0,
      liveData: { tvoc: 320, eco2: 550, aqi: 2 },
      liveStatus: 'loaded',
      liveTimestamp: 1_742_000_000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test('renders ENS160 section and actions', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<Ens160Section />);
    });

    expect(container.querySelector('p.eyebrow')?.textContent).toBe('WYKRES ENS160');
    expect(container.querySelectorAll('button').length).toBeGreaterThanOrEqual(2);

    expect(container.querySelectorAll('.stat-card').length).toBe(3);
    expect(container.querySelector('#ens160Aqi')?.textContent).toBe('2');
    expect(container.querySelector('#ens160Tvoc')?.textContent).toBe('320');
    expect(container.querySelector('#ens160Eco2')?.textContent).toBe('550');
    expect(container.querySelector('#ens160TvocMeta')?.textContent).toBe('LIVE');
    expect(container.querySelector('.aqi-scale')).not.toBeNull();

    const indicator = container.querySelector('.aqi-indicator') as HTMLElement;
    expect(indicator).not.toBeNull();
    expect(indicator.style.left).toBe('30%');

    await act(async () => { root.unmount(); });
    document.body.removeChild(container);
  });
});
