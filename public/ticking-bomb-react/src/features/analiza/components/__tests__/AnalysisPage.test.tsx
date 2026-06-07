// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const useHistoryDataMock = vi.hoisted(() => vi.fn());
const useEns160LiveMock = vi.hoisted(() => vi.fn());
const usePmsLiveMock = vi.hoisted(() => vi.fn());

vi.mock('../../../dashboard/hooks/useHistoryData', () => ({
  useHistoryData: useHistoryDataMock,
}));

vi.mock('../../../ens160/hooks/useEns160Live', () => ({
  useEns160Live: useEns160LiveMock,
}));

vi.mock('../../../pms/hooks/usePmsLive', () => ({
  usePmsLive: usePmsLiveMock,
}));

const AnalysisPage = (await import('../AnalysisPage')).default;

describe('AnalysisPage extended tiles', () => {
  beforeEach(() => {
    useHistoryDataMock.mockReturnValue({
      points: [
        { series: 'p', x: 1_699_989_200_000, y: 1013.2 },
        { series: 'p', x: 1_699_996_400_000, y: 1012.1 },
      ],
      loadState: 'loaded',
      dataDensity: 2,
    });

    useEns160LiveMock.mockReturnValue({
      data: { tvoc: 220, eco2: 1196 },
      status: 'loaded',
      timestamp: 1_700_000_000_000,
      points: [],
    });

    usePmsLiveMock.mockReturnValue({
      data: {
        A: { pm1: 8.1, pm25: 23.3, pm10: 31.4 },
        ts: 1_700_000_000_000,
      },
      status: 'loaded',
      timestamp: 1_700_000_000_000,
      points: [],
    });
  });

  test('renders four additional insight cards with the same interactive back face', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <AnalysisPage
          onBack={vi.fn()}
          liveRecord={{ t: 28.0, h: 37, p: 1011.4, ts: 1_700_000_000_000 }}
          loadState="loaded"
          connectionStatus="connected"
          motionEnabled={false}
        />,
      );
    });

    expect(container.querySelectorAll('.analysis-card').length).toBe(8);
    expect(container.querySelectorAll('.analysis-grid').length).toBe(2);

    const secondaryCards = container.querySelectorAll('.analysis-grid--secondary .analysis-card');
    expect(secondaryCards.length).toBe(4);
    expect(Array.from(secondaryCards).every((card) => card.className.includes('analysis-card-clickable'))).toBe(true);

    await act(async () => {
      secondaryCards[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.querySelector('.analysis-grid--secondary .analysis-detail-card')).not.toBeNull();
    expect(container.textContent).toContain('ROI sumuje pyły i gazy');

    expect(container.textContent).toContain('Obciążenie oddechowe');
    expect(container.textContent).toContain('Podwyższony');
    expect(container.textContent).toContain('Metaboliczne');
    expect(container.textContent).toContain('Opadający');
    expect(container.textContent).toContain('W normie WHO');
    expect(container.textContent).toContain('nieliniowy');
    expect(container.textContent).toContain('1 / (1 - RH/100)');

    await act(async () => {
      root.unmount();
    });

    document.body.removeChild(container);
  });
});
