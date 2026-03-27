import { useMemo } from 'react';
import Calendar from '../../../shared/components/Calendar';
import { useCalendar } from '../../../shared/hooks/useCalendar';
import { appendUniquePmsChartPoint, rawToPmsChartPoints } from '../lib/pmsChartHelpers';
import { usePmsHistory } from '../hooks/usePmsHistory';
import { usePmsLive } from '../hooks/usePmsLive';
import PmsLivePanel from './PmsLivePanel';
import PmsChart from './PmsChart';

function formatPmsValue(value: number | null | undefined): string {
  if (!Number.isFinite(Number(value))) {
    return '--';
  }

  return Number(value).toFixed(1);
}

function PmsSection() {
  const calendar = useCalendar();
  const history = usePmsHistory(calendar.state.selectedDate);
  const pmsLive = usePmsLive();
  const liveData = pmsLive.status === 'loaded' ? pmsLive.data : null;
  const liveReady = Boolean(liveData);
  const pm1Value = liveReady ? formatPmsValue(liveData?.pm1) : '--';
  const pm25Value = liveReady ? formatPmsValue(liveData?.pm25) : '--';
  const pm10Value = liveReady ? formatPmsValue(liveData?.pm10) : '--';
  const liveMeta = pmsLive.status === 'loaded' ? 'LIVE' : pmsLive.status === 'empty' ? 'Brak danych' : 'Czekam na dane';
  const chartPoints = useMemo(() => {
    if (history.loadState !== 'loaded') {
      return history.points;
    }

    if (calendar.state.selectedDate !== calendar.state.today || !liveData || pmsLive.timestamp == null) {
      return history.points;
    }

    return rawToPmsChartPoints(liveData, pmsLive.timestamp).reduce(appendUniquePmsChartPoint, history.points);
  }, [calendar.state.selectedDate, calendar.state.today, history.loadState, history.points, liveData, pmsLive.timestamp]);

  const densityLabel = history.loadState === 'loaded' || history.loadState === 'empty'
    ? history.dataDensity === 0
      ? 'brak próbek'
      : history.dataDensity < 80
        ? `${history.dataDensity} próbek · lekki`
        : history.dataDensity < 200
          ? `${history.dataDensity} próbek · umiarkowany`
          : `${history.dataDensity} próbek · gęsty`
    : '–';
  const modeInfo = `Wybrany dzień: ${calendar.state.selectedDate}`;

  return (
    <section className="panel pms-section" aria-label="Moduł czujnika pyłów PMS5003">
      <header className="panel-head pms-master-head">
        <div>
          <p className="eyebrow">PMS5003</p>
          <h2>Pyły w osobnym widoku</h2>
          <p>Live feed, archiwum i kalendarz dla pyłów z zachowaniem fallbacku A → F.</p>
        </div>
        <div className="panel-actions">
          <span className="chip live"><span className="pulse"></span> LIVE</span>
          <span className="chip">A → F</span>
          <span className="chip">historia</span>
        </div>
      </header>

      <div className="pms-stack">
        <section className="pms-embed-panel" aria-label="Frakcje PM w układzie warstwowym">
          <header className="panel-head pms-subhead">
            <div>
              <p className="eyebrow">Widok live</p>
              <h3>Zintegrowany panel React</h3>
              <p>Wcześniejszy iframe został przeniesiony do normalnego komponentu, bez odrębnego dokumentu.</p>
            </div>
            <div className="panel-actions">
              <span className="chip">PM1.0</span>
              <span className="chip">PM2.5</span>
            </div>
          </header>

          <PmsLivePanel liveData={liveData} liveStatus={pmsLive.status} liveTimestamp={pmsLive.timestamp} />
        </section>

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
                <span className="chip" id="pmsDataDensity">{densityLabel}</span>
              </header>
              <PmsChart points={chartPoints} loadState={history.loadState} selectedDate={calendar.state.selectedDate} />
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
      </div>
    </section>
  );
}

export default PmsSection;
