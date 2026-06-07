export interface DateRange {
  startMs: number;
  endMs: number;
}

export function toDateKey(input: Date | number | string): string {
  const date = input instanceof Date ? input : new Date(input);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dateRangeForDay(dateKey: string): DateRange {
  const startDate = new Date(`${dateKey}T00:00:00`);
  const startMs = startDate.getTime();
  return {
    startMs,
    endMs: startMs + 86_400_000,
  };
}

export function isDateKeyInRange(timestampMs: number, range: DateRange): boolean {
  return timestampMs >= range.startMs && timestampMs < range.endMs;
}

export function isSameDateKey(left: string, right: string): boolean {
  return left === right;
}