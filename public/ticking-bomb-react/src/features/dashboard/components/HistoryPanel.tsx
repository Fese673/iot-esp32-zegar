import { useMemo } from 'react';
import { useCalendar } from '../../../shared/hooks/useCalendar';
import Calendar from '../../../shared/components/Calendar';
import { appendUniqueChartPoint } from '../../../shared/lib/chartHelpers';
import { toEpochMs } from '../../../shared/lib/timeHelpers';
import type { ChartPoint, LiveRecord } from '../../../shared/types';
import { useHistoryData } from '../hooks/useHistoryData.ts';
import HistoryChart from './HistoryChart.tsx';

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

function liveRecordToChartPoints(record: LiveRecord): ChartPoint[] {
  const x = toEpochMs(record.ts);

  return [
    { series: 't', x, y: record.t },
    { series: 'h', x, y: record.h },
    { series: 'p', x, y: record.p },
  ];
}

interface HistoryPanelProps {
  liveRecord: LiveRecord | null;
}

function HistoryPanel({ liveRecord }: HistoryPanelProps) {
  const calendar = useCalendar();
  const history = useHistoryData(calendar.state.selectedDate);
  const chartPoints = useMemo(() => {
    if (history.loadState !== 'loaded') {
      return history.points;
    }

    if (calendar.state.selectedDate !== calendar.state.today || !liveRecord) {
      return history.points;
    }

    return liveRecordToChartPoints(liveRecord).reduce(appendUniqueChartPoint, history.points);
  }, [calendar.state.selectedDate, calendar.state.today, history.loadState, history.points, liveRecord]);

  const densityLabel = history.loadState === 'loaded' || history.loadState === 'empty' ? formatDataDensity(chartPoints.length) : '–';
  const modeInfo = `Wybrany dzień: ${calendar.state.selectedDate}`;

  return (
    <section className="panel" aria-label="Historia danych">
      <header className="panel-head">
        <div>
          <p className="eyebrow">WYKRES 1</p>
          <h2>Parametry środowiskowe</h2>
        </div>
        <div className="panel-actions">
          <button className="primary-btn" id="btnToday" type="button" onClick={() => calendar.selectDate(calendar.state.today)}>Dziś</button>
          <button className="ghost-btn" id="btnClear" type="button" onClick={() => calendar.selectDate(calendar.state.today)}>Wyczyść</button>
        </div>
      </header>

      <div className="panel-body split">
        <div className="chart-stack">
          <header className="chart-head">
            <div>
              <p className="muted" id="modeInfo">{modeInfo}</p>
              <p className="chart-hint">Ctrl ⌃ + scroll / pinch aby przybliżyć. Przesuń gdy jesteś nad wykresem.</p>
            </div>
            <span className="chip" id="dataDensity">{densityLabel}</span>
          </header>

          <HistoryChart
            key={calendar.state.selectedDate}
            points={chartPoints}
            loadState={history.loadState}
            selectedDate={calendar.state.selectedDate}
          />
        </div>

        <Calendar
          idPrefix="cal"
          ariaLabel="Kalendarz wyboru dnia"
          state={calendar.state}
          onSelectDate={calendar.selectDate}
          onNextMonth={calendar.nextMonth}
          onPrevMonth={calendar.prevMonth}
          prevButtonLabel="◀"
          nextButtonLabel="▶"
        />
      </div>
    </section>
  );
}

export default HistoryPanel;
