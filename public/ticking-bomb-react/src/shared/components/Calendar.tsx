import type { CalendarState } from '../types';

interface CalendarProps {
  idPrefix: string;
  ariaLabel: string;
  state: CalendarState;
  onSelectDate: (date: string) => void;
  onNextMonth: () => void;
  onPrevMonth: () => void;
  prevButtonLabel?: string;
  nextButtonLabel?: string;
}

const monthNames = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień',
];

function firstDayIndexMonday0(year: number, month: number): number {
  const js = new Date(year, month, 1).getDay();
  return (js + 6) % 7;
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function sameDay(left: string, right: string): boolean {
  return left === right;
}

function formatDateKey(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function Calendar({
  idPrefix,
  ariaLabel,
  state,
  onSelectDate,
  onNextMonth,
  onPrevMonth,
  prevButtonLabel = '◀',
  nextButtonLabel = '▶',
}: CalendarProps) {
  const viewDate = new Date(`${state.viewDate}T00:00:00`);
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const offset = firstDayIndexMonday0(year, month);
  const totalDays = daysInMonth(year, month);

  return (
    <aside className="calendar" aria-label={ariaLabel}>
      <header className="cal-head">
        <button className="cal-btn" id={`${idPrefix}Prev`} title="Poprzedni miesiąc" aria-label="Poprzedni miesiąc" onClick={onPrevMonth}>
          {prevButtonLabel}
        </button>
        <div>
          <p className="eyebrow">Dzień</p>
          <h3 className="cal-title" id={`${idPrefix}Title`}>
            {monthNames[month]} {year}
          </h3>
        </div>
        <button className="cal-btn" id={`${idPrefix}Next`} title="Następny miesiąc" aria-label="Następny miesiąc" onClick={onNextMonth}>
          {nextButtonLabel}
        </button>
      </header>

      <div className="cal-weekdays">
        <span>Pn</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pt</span><span>Sb</span><span>Nd</span>
      </div>

      <div className="cal-grid" id={`${idPrefix}Grid`}>
        {Array.from({ length: offset }).map((_, index) => (
          <div key={`filler-${index}`} className="day muted" aria-hidden="true"></div>
        ))}

        {Array.from({ length: totalDays }).map((_, index) => {
          const day = index + 1;
          const dateKey = formatDateKey(year, month, day);
          const isToday = sameDay(dateKey, state.today);
          const isSelected = sameDay(dateKey, state.selectedDate);

          return (
            <button
              key={dateKey}
              type="button"
              className={`day${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}`}
              onClick={() => onSelectDate(dateKey)}
            >
              {day}
            </button>
          );
        })}
      </div>

      <footer className="cal-legend">
        <span className="legend-dot today"></span> dziś
        <span className="legend-dot selected"></span> wybrany
      </footer>
    </aside>
  );
}

export default Calendar;