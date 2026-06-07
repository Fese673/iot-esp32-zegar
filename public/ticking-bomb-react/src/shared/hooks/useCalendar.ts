import { useCallback, useMemo, useState } from 'react';
import type { CalendarState } from '../types';
import { toDateKey } from '../lib/dateHelpers';

function toMonthStartKey(dateKey: string): string {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return toDateKey(new Date());
  }

  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function shiftMonth(dateKey: string, monthDelta: number): string {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return toMonthStartKey(toDateKey(new Date()));
  }

  return toDateKey(new Date(date.getFullYear(), date.getMonth() + monthDelta, 1));
}

export function useCalendar(initialDate?: string): {
  state: CalendarState;
  selectDate: (date: string) => void;
  nextMonth: () => void;
  prevMonth: () => void;
} {
  const today = useMemo(() => toDateKey(new Date()), []);
  const [state, setState] = useState<CalendarState>(() => {
    const initialKey = initialDate || today;
    return {
      selectedDate: initialKey,
      viewDate: toMonthStartKey(initialKey),
      today,
    };
  });

  const selectDate = useCallback((date: string) => {
    setState((current) => ({
      ...current,
      selectedDate: date,
      viewDate: toMonthStartKey(date),
    }));
  }, []);

  const nextMonth = useCallback(() => {
    setState((current) => ({
      ...current,
      viewDate: shiftMonth(current.viewDate, 1),
    }));
  }, []);

  const prevMonth = useCallback(() => {
    setState((current) => ({
      ...current,
      viewDate: shiftMonth(current.viewDate, -1),
    }));
  }, []);

  return {
    state,
    selectDate,
    nextMonth,
    prevMonth,
  };
}