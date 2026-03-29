import { useMemo } from 'react';
import Calendar from '../../../shared/components/Calendar';
import { useCalendar } from '../../../shared/hooks/useCalendar';
import type { ChartPoint } from '../../../shared/types';
import HistoryChart from '../../dashboard/components/HistoryChart';

function formatDataDensity(totalPoints: number): string {
  if (totalPoints === 0) {
    return 'brak próbek';
  }

  if (totalPoints < 80) {
    return `${totalPoints} próbek · lekki`;
  }

  if (totalPoints < 200) {
    return `${totalPoints} próbek · umiarkowany`;
  }

  return `${totalPoints} próbek · gęsty`;
}

const EMPTY_ENS160_POINTS: ChartPoint[] = [];

export default function Ens160Section() {
  const calendar = useCalendar();
  const modeInfo = `Wybrany dzień: ${calendar.state.selectedDate}`;

  const density = useMemo(() => formatDataDensity(EMPTY_ENS160_POINTS.length), []);

  return (
    <section className="panel" aria-label="Wykres ENS160">
      <header className="panel-head">
        <div>
          <p className="eyebrow">WYKRES ENS160</p>
          <h2>ENS160: historia i prognoza (placeholder)</h2>
          <p>Tu pojawi się wykres ENS160. Dane zostaną później podpięte we właściwym źródle.</p>
        </div>
        <div className="panel-actions">
          <button className="primary-btn" type="button" onClick={() => calendar.selectDate(calendar.state.today)}>Dziś</button>
          <button className="ghost-btn" type="button" onClick={() => calendar.selectDate(calendar.state.today)}>Wyczyść</button>
        </div>
      </header>

      <div className="panel-body split">
        <div className="chart-stack">
          <header className="chart-head">
            <div>
              <p className="muted">{modeInfo}</p>
              <p className="chart-hint">Ctrl ⌃ + scroll / pinch aby przybliżyć. Przesuń gdy jesteś nad wykresem.</p>
            </div>
            <span className="chip">{density}</span>
          </header>
          <div className="chart-stack-item">
            <HistoryChart
              points={EMPTY_ENS160_POINTS}
              loadState="empty"
              selectedDate={calendar.state.selectedDate}
            />
          </div>
        </div>

        <Calendar
          idPrefix="ens160Cal"
          ariaLabel="Kalendarz wyboru dnia — ENS160"
          state={calendar.state}
          onSelectDate={calendar.selectDate}
          onNextMonth={calendar.nextMonth}
          onPrevMonth={calendar.prevMonth}
          prevButtonLabel="◀"
          nextButtonLabel="◆"
        />
      </div>
    </section>
  );
}
