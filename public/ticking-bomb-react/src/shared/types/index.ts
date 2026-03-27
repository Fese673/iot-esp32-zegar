export interface LiveRecord {
  t: number;
  h: number;
  p: number;
  ts: number;
}

export interface PmsRaw {
  pm1: number;
  pm25: number;
  pm10: number;
}

export interface PmsRecord {
  A?: PmsRaw;
  F?: PmsRaw;
  ts: number;
}

export interface HistoryRecord {
  t: number;
  h: number;
  p: number;
  ts: number;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface ClockState {
  displayTime: string;
  source: 'device' | 'local';
  startMs: number | null;
  rtt: number | null;
}

export type ChartSeriesKey = 't' | 'h' | 'p';

export interface ChartPoint {
  series: ChartSeriesKey;
  x: number;
  y: number;
}

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error' | 'empty';

export interface CalendarState {
  selectedDate: string;
  viewDate: string;
  today: string;
}

export interface AlertItem {
  id: string;
  level: 'success' | 'warn' | 'error';
  message: string;
  autoDismiss?: boolean;
}
