import { useEffect } from 'react';
import { Chart, registerables, type ChartDataset, type TooltipItem } from 'chart.js';
import type { RefObject } from 'react';
import type { WindowRange } from '../../../shared/lib/chartHelpers';
import type { PmsSeriesKey } from '../lib/pmsChartHelpers';
import type { LoadState } from '../../../shared/types';

Chart.register(...registerables);

export type PmsPlotPoint = {
  x: number;
  y: number;
};

export type PmsSeriesData = Record<PmsSeriesKey, PmsPlotPoint[]>;

export type PmsChartInstance = Chart<'line', PmsPlotPoint[], number>;

export interface PmsCanvasElement extends HTMLCanvasElement {
  __pmsChart?: PmsChartInstance;
}

interface ChartPalette {
  pm1: string;
  pm25: string;
  pm10: string;
  text: string;
  muted: string;
  stroke: string;
  panel: string;
  grid: string;
}

interface PmsChartProps {
  seriesData: PmsSeriesData;
  windowRange: WindowRange | null;
  loadState: LoadState;
  frameRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<PmsCanvasElement | null>;
  chartRef: RefObject<PmsChartInstance | null>;
  onPanLeft: () => void;
  onPanRight: () => void;
}

function readCssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name);
  return value ? value.trim() || fallback : fallback;
}

function withAlpha(color: string, alpha: number): string {
  if (!color) {
    return `rgba(0,0,0,${alpha})`;
  }

  const normalized = color.trim();
  if (normalized.startsWith('#')) {
    const expanded = normalized.length === 4
      ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
      : normalized;
    const red = Number.parseInt(expanded.slice(1, 3), 16);
    const green = Number.parseInt(expanded.slice(3, 5), 16);
    const blue = Number.parseInt(expanded.slice(5, 7), 16);
    return `rgba(${red},${green},${blue},${alpha})`;
  }

  if (normalized.startsWith('rgb')) {
    return normalized.replace(')', `, ${alpha})`).replace('rgb', 'rgba');
  }

  return color;
}

function readChartPalette(): ChartPalette {
  return {
    pm1: readCssVar('--pm1', '#34d399'),
    pm25: readCssVar('--pm25', '#fcd34d'),
    pm10: readCssVar('--pm10', '#f87171'),
    text: readCssVar('--text', '#e6edf7'),
    muted: readCssVar('--muted', '#9fb0c7'),
    stroke: readCssVar('--stroke', '#1f2a3d'),
    panel: readCssVar('--panel-2', '#0b101a'),
    grid: 'rgba(255,255,255,0.04)',
  };
}

function formatAxisTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTooltipLabel(datasetIndex: number, value: number): string {
  if (datasetIndex === 0) {
    return `PM 1.0: ${value.toFixed(1)} µg/m³`;
  }

  if (datasetIndex === 1) {
    return `PM 2.5: ${value.toFixed(1)} µg/m³`;
  }

  return `PM 10: ${value.toFixed(1)} µg/m³`;
}

function createDataset(
  label: string,
  color: string,
  data: PmsPlotPoint[] = [],
  extra: Partial<ChartDataset<'line', PmsPlotPoint[]>> = {},
): ChartDataset<'line', PmsPlotPoint[]> {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: withAlpha(color, 0.1),
    tension: extra.tension ?? 0.3,
    pointRadius: 0,
    pointHitRadius: 6,
    borderWidth: 2.5,
    borderJoinStyle: 'round',
    borderCapStyle: 'round',
    parsing: false,
    fill: extra.fill ?? false,
    yAxisID: 'y',
    ...extra,
  };
}

function createChart(canvas: PmsCanvasElement, palette: ChartPalette): PmsChartInstance {
  return new Chart<'line', PmsPlotPoint[], number>(canvas, {
    type: 'line',
    data: {
      datasets: [
        createDataset('PM 1.0 (µg/m³)', palette.pm1, [], { fill: true, tension: 0.35 }),
        createDataset('PM 2.5 (µg/m³)', palette.pm25, [], { fill: true, tension: 0.35 }),
        createDataset('PM 10 (µg/m³)', palette.pm10, [], { fill: true, tension: 0.35, borderDash: [6, 3] }),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 6, right: 8, bottom: 0, left: 0 } },
      parsing: false,
      plugins: {
        legend: {
          labels: {
            color: palette.text,
            font: { family: 'Space Grotesk', size: 12 },
            usePointStyle: false,
          },
        },
        tooltip: {
          backgroundColor: palette.panel,
          borderColor: palette.stroke,
          borderWidth: 1,
          titleColor: palette.text,
          bodyColor: palette.text,
          displayColors: true,
          padding: 10,
          callbacks: {
            label: (context: TooltipItem<'line'>) => formatTooltipLabel(context.datasetIndex, Number(context.parsed.y ?? 0)),
            title: (items: TooltipItem<'line'>[]) => {
              if (!items.length) {
                return '';
              }

              return new Date(Number(items[0].parsed.x ?? 0)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',
          grid: { color: palette.grid },
          ticks: {
            color: palette.muted,
            maxTicksLimit: 8,
            callback: (value) => formatAxisTime(Number(value)),
          },
        },
        y: {
          type: 'linear',
          position: 'left',
          grid: { color: palette.grid },
          ticks: {
            color: palette.muted,
          },
          beginAtZero: true,
        },
      },
    },
  });
}

function applyWindowToChart(chart: PmsChartInstance, windowRange: WindowRange | null): void {
  const xScale = chart.options.scales?.x as { min?: number; max?: number } | undefined;
  if (!xScale) {
    return;
  }

  xScale.min = windowRange?.start;
  xScale.max = windowRange?.end;
}

export default function PmsChart({
  seriesData,
  windowRange,
  loadState,
  frameRef,
  canvasRef,
  chartRef,
  onPanLeft,
  onPanRight,
}: PmsChartProps) {
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const palette = readChartPalette();
    const chart = createChart(canvas, palette);

    chartRef.current = chart;
    canvas.__pmsChart = chart;

    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
      delete canvas.__pmsChart;
    };
  }, [canvasRef, chartRef]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const hasSeriesData = seriesData.pm1.length > 0 || seriesData.pm25.length > 0 || seriesData.pm10.length > 0;

    if (loadState !== 'loaded' && !hasSeriesData) {
      chart.data.datasets[0].data = [];
      chart.data.datasets[1].data = [];
      chart.data.datasets[2].data = [];
      applyWindowToChart(chart, null);
      chart.update('none');
      return;
    }

    chart.data.datasets[0].data = seriesData.pm1;
    chart.data.datasets[1].data = seriesData.pm25;
    chart.data.datasets[2].data = seriesData.pm10;
    applyWindowToChart(chart, windowRange);

    chart.update('none');
  }, [chartRef, loadState, seriesData, windowRange]);

  const showLoading = loadState === 'loading';
  const showNote = loadState === 'empty';
  const showError = loadState === 'error';

  return (
    <div className="chart-frame" id="pmsChartFrame" ref={frameRef}>
      <canvas id="pmsChart" ref={canvasRef} aria-label="Wykres historii pyłów PM" role="img"></canvas>
      <div className="chart-overlay" id="pmsChartLoading" hidden={!showLoading}>Ładowanie danych…</div>
      <div className="chart-overlay" id="pmsChartNote" hidden={!showNote}>Brak danych dla tego dnia.</div>
      <div className="chart-overlay error" id="pmsChartError" hidden={!showError}>Błąd pobierania danych z Firebase.</div>
      <nav className="chart-controls" aria-hidden="true">
        <button type="button" className="chart-control" data-pms-pan="-1" aria-label="Przesuń wykres w lewo" onClick={onPanLeft}>◀</button>
        <button type="button" className="chart-control" data-pms-pan="1" aria-label="Przesuń wykres w prawo" onClick={onPanRight}>▶</button>
      </nav>
    </div>
  );
}