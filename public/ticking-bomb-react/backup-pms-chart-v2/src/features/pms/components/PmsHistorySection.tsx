import { useMemo } from 'react';
import Calendar from '../../../shared/components/Calendar';
import { useCalendar } from '../../../shared/hooks/useCalendar';
import { appendUniquePmsChartPoint, rawToPmsChartPoints } from '../lib/pmsChartHelpers';
import { extractPmRawLike } from '../lib/pmsLiveHelpers';
import { usePmsHistory } from '../hooks/usePmsHistory';
import { usePmsLive } from '../hooks/usePmsLive';
import PmsChartController from './PmsChartController';

function densityLabel(totalPoints: number): string {
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

export default function PmsHistorySection() {
  const calendar = useCalendar();
  const history = usePmsHistory(calendar.state.selectedDate);
  const live = usePmsLive();
  const isSelectedToday = calendar.state.selectedDate === calendar.state.today;
  const livePmsRaw = useMemo(() => extractPmRawLike(live.data), [live.data]);

  const liveChartPoints = useMemo(() => {
    if (!isSelectedToday || !livePmsRaw || live.timestamp == null) {
      return [];
    }

    return rawToPmsChartPoints(livePmsRaw, live.timestamp);
  }, [isSelectedToday, live.timestamp, livePmsRaw]);

  const chartPoints = useMemo(() => {
    if (!liveChartPoints.length) {
      return history.points;
    }

    return liveChartPoints.reduce(appendUniquePmsChartPoint, history.points);
  }, [history.points, liveChartPoints]);

  const chartLoadState = chartPoints.length > 0 ? 'loaded' : (isSelectedToday && liveChartPoints.length > 0 ? 'loaded' : history.loadState);
  const modeInfo = `Wybrany dzień: ${calendar.state.selectedDate}`;
  const density = history.loadState === 'loaded' || history.loadState === 'empty'
    ? densityLabel(history.dataDensity)
    : '–';
  const liveMeta = live.status === 'loaded' ? 'LIVE' : live.status === 'empty' ? 'Brak danych' : 'Czekam na dane';
  const pm1Value = livePmsRaw ? Number(livePmsRaw.pm1).toFixed(1) : '--';
  const pm25Value = livePmsRaw ? Number(livePmsRaw.pm25).toFixed(1) : '--';
  const pm10Value = livePmsRaw ? Number(livePmsRaw.pm10).toFixed(1) : '--';

  return (
    <section className="pms-inner-panel" aria-label="Historia i trend dla PMS5003">
      <header className="panel-head">
        <div>
          <p className="eyebrow">WYKRES 2</p>
          <h3>Drugi wykres dla samych przetworzonych danych PM</h3>
          <p>Wybierz dzień, aby zobaczyć historię PM i dołączyć dzisiejszy live feed, gdy patrzysz na dziś. NIE usuwać tej sekcji</p>
        </div>
        <div className="panel-actions">
          <button className="primary-btn" id="pmsBtnToday" type="button" onClick={() => calendar.selectDate(calendar.state.today)}>Dziś</button>
          <button className="ghost-btn" id="pmsBtnClear" type="button" onClick={() => calendar.selectDate(calendar.state.today)}>Wyczyść</button>
        </div>
      </header>

      <section className="pms5003-grid" aria-label="PMS5003 live view">
        <article className="stat-card pm-card pm1-card">
          <div className="stat-top">
            <p className="label">PM 1.0</p>
            <span className="tag">μg/m³</span>
          </div>
          <p className="value" id="pm1Value">{pm1Value}</p>
          <p className="muted" id="pm1Meta">{liveMeta}</p>
        </article>

        <article className="stat-card pm-card pm25-card">
          <div className="stat-top">
            <p className="label">PM 2.5</p>
            <span className="tag">μg/m³</span>
          </div>
          <p className="value" id="pm25Value">{pm25Value}</p>
          <p className="muted" id="pm25Meta">{liveMeta}</p>
        </article>

        <article className="stat-card pm-card pm10-card">
          <div className="stat-top">
            <p className="label">PM 10.0</p>
            <span className="tag">μg/m³</span>
          </div>
          <p className="value" id="pm10Value">{pm10Value}</p>
          <p className="muted" id="pm10Meta">{liveMeta}</p>
        </article>
      </section>

      <div className="panel-body split">
        <div className="chart-stack">
          <header className="chart-head">
            <div>
              <p className="muted" id="pmsModeInfo">{modeInfo}</p>
              <p className="chart-hint">Ctrl ⌃ + scroll / pinch aby przybliżyć. Przesuń gdy jesteś nad wykresem.</p>
            </div>
            <span className="chip" id="pmsDataDensity">{density}</span>
          </header>
          <PmsChartController key={calendar.state.selectedDate} points={chartPoints} loadState={chartLoadState} selectedDate={calendar.state.selectedDate} />
        </div>

        <Calendar
          idPrefix="pmsCal"
          ariaLabel="Kalendarz wyboru dnia — pyły"
          state={calendar.state}
          onSelectDate={calendar.selectDate}
          onNextMonth={calendar.nextMonth}
          onPrevMonth={calendar.prevMonth}
        />
      </div>
    </section>
  );
}