// @vitest-environment jsdom
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { PmsChartInstance, PmsSeriesData } from '../PmsChart';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mockChartState = vi.hoisted(() => ({
  instances: [] as Array<{
    data: { datasets: Array<{ data: unknown[] }> };
    config: {
      data: { datasets: Array<{ label?: string; fill?: boolean; tension?: number; borderDash?: number[]; yAxisID?: string }> };
      options: { plugins: { tooltip: { displayColors?: boolean } }; parsing?: boolean };
    };
    update: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
  }>,
}));

class MockChart {
  static register = vi.fn();
  data: { datasets: Array<{ data: unknown[] }> };
  options: { scales: { x: { min?: number; max?: number }; y: { beginAtZero?: boolean } }; plugins: { tooltip: { displayColors?: boolean } } };
  config: {
    data: { datasets: Array<{ label?: string; fill?: boolean; tension?: number; borderDash?: number[]; yAxisID?: string }> };
    options: { plugins: { tooltip: { displayColors?: boolean } }; parsing?: boolean };
  };
  update = vi.fn();
  destroy = vi.fn();

  constructor(
    _canvas: HTMLCanvasElement,
    config: {
      data: { datasets: Array<{ data: unknown[]; label?: string; fill?: boolean; tension?: number; borderDash?: number[]; yAxisID?: string }> };
      options: { plugins: { tooltip: { displayColors?: boolean } }; parsing?: boolean };
    },
  ) {
    this.data = {
      datasets: config.data.datasets.map((dataset) => ({ data: [...dataset.data] })),
    };
    this.options = { scales: { x: {}, y: {} }, plugins: { tooltip: { displayColors: config.options.plugins.tooltip.displayColors } } };
    this.config = config;
    mockChartState.instances.push(this);
  }
}

vi.mock('chart.js', () => ({
  Chart: MockChart,
  registerables: [],
}));

function createSeriesData(pm1: number, pm25: number, pm10: number): PmsSeriesData {
  return {
    pm1: [{ x: 1, y: pm1 }],
    pm25: [{ x: 1, y: pm25 }],
    pm10: [{ x: 1, y: pm10 }],
  };
}

describe('PmsChart lifecycle', () => {
  beforeEach(() => {
    mockChartState.instances.length = 0;
    MockChart.register.mockClear();
  });

  test('reuses the existing Chart.js instance and updates datasets on rerender', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const frameRef: { current: HTMLDivElement | null } = { current: null };
    const canvasRef: { current: HTMLCanvasElement | null } = { current: null };
    const chartRef: { current: PmsChartInstance | null } = { current: null };

    const PmsChartModule = await import('../PmsChart');
    const PmsChart = PmsChartModule.default;

    const firstData = createSeriesData(10, 20, 30);
    const secondData = createSeriesData(11, 21, 31);

    await act(async () => {
      root.render(
        <PmsChart
          seriesData={firstData}
          windowRange={null}
          loadState="loaded"
          frameRef={frameRef}
          canvasRef={canvasRef}
          chartRef={chartRef}
          onPanLeft={() => undefined}
          onPanRight={() => undefined}
        />,
      );
    });

    expect(mockChartState.instances).toHaveLength(1);
    expect(mockChartState.instances[0].data.datasets[0].data).toEqual(firstData.pm1);
    expect(mockChartState.instances[0].update).toHaveBeenCalled();
    expect(mockChartState.instances[0].config.data.datasets[0]).toMatchObject({
      label: 'PM 1.0 (µg/m³)',
      fill: true,
      tension: 0.35,
      yAxisID: 'y',
    });
    expect(mockChartState.instances[0].config.data.datasets[2]).toMatchObject({
      label: 'PM 10 (µg/m³)',
      fill: true,
      tension: 0.35,
      borderDash: [6, 3],
      yAxisID: 'y',
    });
    expect(mockChartState.instances[0].config.options.plugins.tooltip.displayColors).toBe(true);

    await act(async () => {
      root.render(
        <PmsChart
          seriesData={secondData}
          windowRange={null}
          loadState="loaded"
          frameRef={frameRef}
          canvasRef={canvasRef}
          chartRef={chartRef}
          onPanLeft={() => undefined}
          onPanRight={() => undefined}
        />,
      );
    });

    expect(mockChartState.instances).toHaveLength(1);
    expect(mockChartState.instances[0].data.datasets[0].data).toEqual(secondData.pm1);
    expect(mockChartState.instances[0].update).toHaveBeenCalledTimes(2);

    await act(async () => {
      root.unmount();
    });

    expect(mockChartState.instances[0].destroy).toHaveBeenCalled();
    document.body.removeChild(container);
  });
});