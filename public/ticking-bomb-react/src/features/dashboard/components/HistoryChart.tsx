import { useEffect, useMemo, useRef } from 'react';
import { Chart, registerables, type ChartDataset, type TooltipItem } from 'chart.js';
import { clampWindow, groupChartPointsBySeries, sortChartPoints } from '../../../shared/lib/chartHelpers';
import type { ChartPoint, LoadState } from '../../../shared/types';

Chart.register(...registerables);

type PlotPoint = {
  x: number;
  y: number;
};

type HistoryChartInstance = Chart<'line', PlotPoint[], number>;

interface HistoryCanvasElement extends HTMLCanvasElement {
  __historyChart?: HistoryChartInstance;
}

interface ChartBounds {
  start: number;
  end: number;
}

interface ChartPalette {
  temp: string;
  hum: string;
  press: string;
  text: string;
  muted: string;
  stroke: string;
  panel: string;
  grid: string;
}

interface SeriesConfig {
  key: string;
  label: string;
  color: string;
  yAxisID: 'y' | 'y1';
  unit?: string;
  tension?: number;
  borderDash?: number[];
}

interface HistoryChartProps {
  points: ChartPoint[];
  loadState: LoadState;
  selectedDate: string;
  seriesConfig?: SeriesConfig[];
}

const MIN_WINDOW_MS = 60_000;
const REALTIME_WINDOW_MS = 10 * 60_000;
const RIGHT_PADDING_RATIO = 0.08;
const RIGHT_PADDING_MAX_MS = 60_000;
const INITIAL_ZOOM_MS = MIN_WINDOW_MS;
const INITIAL_PAN_STEPS = 4;

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
    temp: readCssVar('--warn', '#f97316'),
    hum: readCssVar('--accent', '#4be1ec'),
    press: readCssVar('--accent-2', '#a78bfa'),
    text: readCssVar('--text', '#e6edf7'),
    muted: readCssVar('--muted', '#9fb0c7'),
    stroke: readCssVar('--stroke', '#1f2a3d'),
    panel: readCssVar('--panel-2', '#0b101a'),
    grid: 'rgba(255,255,255,0.04)',
  };
}

function computeRightPadding(windowMs: number): number {
  const padding = Math.round(windowMs * RIGHT_PADDING_RATIO);
  return Math.min(padding, RIGHT_PADDING_MAX_MS);
}

function formatAxisTime(value: number): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatTooltipLabel(dataset: ChartDataset<'line', PlotPoint[]>, value: number): string {
  const label = dataset.label || 'Wartość';
  const unit = (dataset as unknown as { _unit?: string })._unit || '';
  const formatted = Number.isInteger(value) ? `${Math.round(value)}` : `${value.toFixed(1)}`;
  return `${label}: ${formatted}${unit ? ` ${unit}` : ''}`;
}

function createDataset(config: SeriesConfig): ChartDataset<'line', PlotPoint[]> {
  const dataset: ChartDataset<'line', PlotPoint[]> = {
    label: config.label,
    data: [],
    borderColor: config.color,
    backgroundColor: withAlpha(config.color, 0.08),
    tension: config.tension ?? 0.25,
    pointRadius: 0,
    pointHitRadius: 6,
    borderWidth: 2,
    borderJoinStyle: 'round',
    borderCapStyle: 'round',
    parsing: false,
    yAxisID: config.yAxisID,
    borderDash: config.borderDash,
  };

  (dataset as unknown as { _seriesKey: string; _unit?: string })._seriesKey = config.key;
  (dataset as unknown as { _unit?: string })._unit = config.unit;

  return dataset;
}

function createDefaultSeriesConfig(palette: ChartPalette): SeriesConfig[] {
  return [
    { key: 't', label: 'Temperatura (°C)', color: palette.temp, yAxisID: 'y', unit: '°C' },
    { key: 'h', label: 'Wilgotność (%)', color: palette.hum, yAxisID: 'y', unit: '%' },
    { key: 'p', label: 'Ciśnienie (hPa)', color: palette.press, yAxisID: 'y1', unit: 'hPa', borderDash: [4, 4], tension: 0.1 },
  ];
}

function createChart(canvas: HistoryCanvasElement, palette: ChartPalette, seriesConfig: SeriesConfig[]): HistoryChartInstance {
  const hasY = seriesConfig.some((item) => item.yAxisID === 'y');
  const hasY1 = seriesConfig.some((item) => item.yAxisID === 'y1');

  return new Chart<'line', PlotPoint[], number>(canvas, {
    type: 'line',
    data: {
      datasets: seriesConfig.map(createDataset),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      interaction: { mode: 'index', intersect: false },
      layout: { padding: { top: 6, right: 8, bottom: 0, left: 0 } },
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
          displayColors: false,
          padding: 10,
          callbacks: {
            label: (context: TooltipItem<'line'>) => formatTooltipLabel(context.dataset as ChartDataset<'line', PlotPoint[]>, Number(context.parsed.y ?? 0)),
            title: (items: TooltipItem<'line'>[]) => {
              if (!items.length) {
                return '';
              }

              return formatAxisTime(Number(items[0].parsed.x ?? 0));
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
          ticks: { color: palette.muted },
          title: {
            display: hasY,
            text: hasY ? seriesConfig.filter((item) => item.yAxisID === 'y').map((item) => item.unit || item.label).join(' / ') : undefined,
            color: palette.muted,
          },
        },
        y1: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: palette.text },
          title: {
            display: hasY1,
            text: hasY1 ? seriesConfig.filter((item) => item.yAxisID === 'y1').map((item) => item.unit || item.label).join(' / ') : undefined,
            color: palette.text,
          },
          beginAtZero: false,
        },
      },
    },
  });
}

function toPlotPoints(points: ChartPoint[]): PlotPoint[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function getBoundsFromPoints(points: ChartPoint[]): ChartBounds | null {
  if (!points.length) {
    return null;
  }

  const firstPoint = points[0];
  const startDate = new Date(firstPoint.x);
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();

  return {
    start,
    end: start + 24 * 60 * 60 * 1000,
  };
}

function getLatestPoint(points: ChartPoint[]): number {
  return points.reduce((latest, point) => Math.max(latest, point.x), 0);
}

function getSeriesData(points: ChartPoint[]): Record<string, PlotPoint[]> {
  const grouped = groupChartPointsBySeries(sortChartPoints(points));
  const result: Record<string, PlotPoint[]> = {};

  Object.entries(grouped).forEach(([series, seriesPoints]) => {
    result[series] = toPlotPoints(seriesPoints);
  });

  return result;
}

export default function HistoryChart({ points, loadState, selectedDate, seriesConfig }: HistoryChartProps) {
  const canvasRef = useRef<HistoryCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<HistoryChartInstance | null>(null);
  const panChartRef = useRef<(direction: number) => void>(() => undefined);
  const setChartWindowRef = useRef<(start: number, end: number) => void>(() => undefined);
  const lastSelectedDateRef = useRef<string | null>(null);
  const initializedDateRef = useRef<string | null>(null);
  const chartWindowRef = useRef<ChartBounds>({ start: 0, end: 0 });
  const boundsRef = useRef<ChartBounds | null>(null);
  const sortedPoints = useMemo(() => sortChartPoints(points), [points]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;

    if (!canvas || !frame) {
      return undefined;
    }

    const chartCanvas = canvas;
    const chartFrame = frame;

    if (chartRef.current) {
      return undefined;
    }

    const palette = readChartPalette();
    const chartSeries = seriesConfig ?? createDefaultSeriesConfig(palette);
    const chart = createChart(canvas, palette, chartSeries);
    const activePointers = new Map<number, { x: number; y: number }>();
    let pinchStartDist: number | null = null;
    let pinchStartWidth: number | null = null;
    let pinchStartCenterValue: number | null = null;
    let panLastValue: number | null = null;

    chartRef.current = chart;
    chartCanvas.__historyChart = chart;
    chartCanvas.style.touchAction = 'none';

    function getScaleX() {
      return chartRef.current?.scales.x ?? null;
    }

    function updateChartWindow(start: number, end: number) {
      const bounds = boundsRef.current;
      const activeChart = chartRef.current;
      if (!bounds || !activeChart) {
        return;
      }

      const window = clampWindow(start, end, bounds, MIN_WINDOW_MS);
      chartWindowRef.current = window;

      const scaleOptions = activeChart.options.scales?.x;
      if (scaleOptions) {
        scaleOptions.min = window.start;
        scaleOptions.max = window.end;
      }
      activeChart.update('none');
    }

    function panChart(direction: number) {
      const bounds = boundsRef.current;
      if (!bounds || chartWindowRef.current.end <= chartWindowRef.current.start) {
        return;
      }

      const range = chartWindowRef.current.end - chartWindowRef.current.start;
      const shift = Math.min(range * 0.25, 60 * 60 * 1000);
      updateChartWindow(chartWindowRef.current.start + direction * shift, chartWindowRef.current.end + direction * shift);
    }

    function zoomChart(factor: number) {
      const bounds = boundsRef.current;
      if (!bounds || chartWindowRef.current.end <= chartWindowRef.current.start) {
        return;
      }

      const width = chartWindowRef.current.end - chartWindowRef.current.start;
      let nextWidth = width * factor;
      nextWidth = Math.min(nextWidth, bounds.end - bounds.start);
      nextWidth = Math.max(nextWidth, MIN_WINDOW_MS);
      const center = (chartWindowRef.current.end + chartWindowRef.current.start) / 2;
      updateChartWindow(center - nextWidth / 2, center + nextWidth / 2);
    }

    function valueAtClientX(clientX: number): number | null {
      const scale = getScaleX();
      if (!scale) {
        return null;
      }

      const rect = chartCanvas.getBoundingClientRect();
      const pixel = clientX - rect.left;
      return scale.getValueForPixel(pixel) ?? null;
    }

    function pointerDistance(first: { x: number; y: number }, second: { x: number; y: number }): number {
      return Math.hypot(first.x - second.x, first.y - second.y);
    }

    function handlePointerDown(event: PointerEvent) {
      if (!boundsRef.current) {
        return;
      }

      chartCanvas.setPointerCapture?.(event.pointerId);
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activePointers.size === 1) {
        panLastValue = valueAtClientX(event.clientX);
        pinchStartDist = null;
        pinchStartWidth = null;
        pinchStartCenterValue = null;
      } else if (activePointers.size === 2) {
        const pointsArray = Array.from(activePointers.values());
        pinchStartDist = pointerDistance(pointsArray[0], pointsArray[1]);
        pinchStartWidth = chartWindowRef.current.end - chartWindowRef.current.start;
        const centerX = (pointsArray[0].x + pointsArray[1].x) / 2;
        pinchStartCenterValue = valueAtClientX(centerX);
        panLastValue = null;
      }
    }

    function handlePointerMove(event: PointerEvent) {
      if (!boundsRef.current || !activePointers.has(event.pointerId)) {
        return;
      }

      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (activePointers.size === 1 && panLastValue != null) {
        const currentValue = valueAtClientX(event.clientX);
        if (currentValue == null) {
          return;
        }

        const delta = currentValue - panLastValue;
        if (delta !== 0) {
          updateChartWindow(chartWindowRef.current.start - delta, chartWindowRef.current.end - delta);
          panLastValue = currentValue;
        }
      } else if (activePointers.size === 2 && pinchStartDist && pinchStartWidth && pinchStartCenterValue != null) {
        const pointsArray = Array.from(activePointers.values());
        const distance = pointerDistance(pointsArray[0], pointsArray[1]);
        if (distance <= 0) {
          return;
        }

        const ratio = distance / pinchStartDist;
        const bounds = boundsRef.current;
        const nextWidth = Math.max(MIN_WINDOW_MS, Math.min(pinchStartWidth / ratio, (bounds?.end ?? 0) - (bounds?.start ?? 0)));
        const center = pinchStartCenterValue;
        updateChartWindow(center - nextWidth / 2, center + nextWidth / 2);
      }
    }

    function handlePointerUp(event: PointerEvent) {
      activePointers.delete(event.pointerId);

      if (activePointers.size === 1) {
        const remaining = Array.from(activePointers.values())[0];
        panLastValue = valueAtClientX(remaining.x);
        pinchStartDist = null;
        pinchStartWidth = null;
        pinchStartCenterValue = null;
      } else {
        panLastValue = null;
        pinchStartDist = null;
        pinchStartWidth = null;
        pinchStartCenterValue = null;
      }
    }

    function handleChartWheel(event: WheelEvent) {
      const isHorizontalPan = Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 0;
      const isZoomGesture = event.ctrlKey || event.metaKey;

      if (!isHorizontalPan && !isZoomGesture) {
        return;
      }

      event.preventDefault();

      if (isHorizontalPan) {
        panChart(event.deltaX > 0 ? 1 : -1);
        return;
      }

      zoomChart(event.deltaY < 0 ? 0.8 : 1.25);
    }

    panChartRef.current = panChart;
    setChartWindowRef.current = updateChartWindow;

    frame.addEventListener('wheel', handleChartWheel, { passive: false });
    chartCanvas.addEventListener('pointerdown', handlePointerDown);
    chartCanvas.addEventListener('pointermove', handlePointerMove);
    const pointerEventNames: Array<'pointerup' | 'pointercancel' | 'pointerleave' | 'pointerout'> = ['pointerup', 'pointercancel', 'pointerleave', 'pointerout'];
    const pointerEventListener = handlePointerUp as EventListener;
    pointerEventNames.forEach((type) => {
      chartCanvas.addEventListener(type, pointerEventListener);
    });

    return () => {
      chartFrame.removeEventListener('wheel', handleChartWheel);
      chartCanvas.removeEventListener('pointerdown', handlePointerDown);
      chartCanvas.removeEventListener('pointermove', handlePointerMove);
      pointerEventNames.forEach((type) => {
        chartCanvas.removeEventListener(type, pointerEventListener);
      });

      panChartRef.current = () => undefined;
      setChartWindowRef.current = () => undefined;
      chart.destroy();
      chartRef.current = null;
      delete chartCanvas.__historyChart;
    };
  }, [seriesConfig]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) {
      return;
    }

    const seriesData = getSeriesData(sortedPoints);
    const bounds = getBoundsFromPoints(sortedPoints);
    boundsRef.current = bounds;

    const selectedDateChanged = lastSelectedDateRef.current !== selectedDate;
    if (selectedDateChanged) {
      initializedDateRef.current = null;
      lastSelectedDateRef.current = selectedDate;
    }

    if (loadState !== 'loaded' || sortedPoints.length === 0 || !bounds) {
      chart.data.datasets.forEach((dataset) => {
        dataset.data = [];
      });
      chart.update('none');
      return;
    }

    chart.data.datasets.forEach((dataset) => {
      const seriesKey = (dataset as unknown as { _seriesKey?: string })._seriesKey;
      if (seriesKey && Object.prototype.hasOwnProperty.call(seriesData, seriesKey)) {
        dataset.data = seriesData[seriesKey];
      } else {
        dataset.data = [];
      }
    });

    if (initializedDateRef.current === selectedDate && chartWindowRef.current.end > chartWindowRef.current.start) {
      setChartWindowRef.current(chartWindowRef.current.start, chartWindowRef.current.end);
      return;
    }

    chart.update('none');

    if (initializedDateRef.current !== selectedDate) {
      const latest = getLatestPoint(sortedPoints);
      const pad = computeRightPadding(REALTIME_WINDOW_MS);
      const end = Math.max(bounds.start + MIN_WINDOW_MS, latest - pad);
      const start = Math.max(bounds.start, end - INITIAL_ZOOM_MS);
      setChartWindowRef.current(start, end);

      for (let index = 0; index < INITIAL_PAN_STEPS; index += 1) {
        panChartRef.current(1);
      }

      initializedDateRef.current = selectedDate;
    }
  }, [loadState, selectedDate, sortedPoints]);

  const showLoading = loadState === 'loading';
  const showNote = loadState === 'empty';
  const showError = loadState === 'error';

  return (
    <div className="chart-frame" ref={frameRef}>
      <canvas id="mainChart" ref={canvasRef} aria-label="Wykres historii pomiarów" role="img"></canvas>
      <div className="chart-overlay" id="chartLoading" hidden={!showLoading}>Ładowanie danych…</div>
      <div className="chart-overlay" id="chartNote" hidden={!showNote}>Brak danych dla tego dnia.</div>
      <div className="chart-overlay error" id="chartError" hidden={!showError}>Błąd pobierania danych z Firebase.</div>
      <nav className="chart-controls" aria-hidden="true">
        <button type="button" className="chart-control" data-pan="-1" aria-label="Przesuń wykres w lewo" onClick={() => panChartRef.current(-1)}>◀</button>
        <button type="button" className="chart-control" data-pan="1" aria-label="Przesuń wykres w prawo" onClick={() => panChartRef.current(1)}>▶</button>
      </nav>
    </div>
  );
}