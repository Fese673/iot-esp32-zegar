import { useMemo } from 'react';
import Calendar from '../../../shared/components/Calendar';
import { useCalendar } from '../../../shared/hooks/useCalendar';
import { extractPmRawLike } from '../lib/pmsHelpers';
import { usePmsData } from '../hooks/usePmsData';
import PmsChartController from './PmsChartController';
import PmsParticlesChart from '../particles/components/PmsParticlesChart';

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
  const isSelectedToday = calendar.state.selectedDate === calendar.state.today;
  const {
    points: chartPoints,
    loadState,
    dataDensity,
    liveData,
    liveStatus,
  } = usePmsData(calendar.state.selectedDate);
  const livePmsRaw = useMemo(() => extractPmRawLike(liveData), [liveData]);

  const modeInfo = `Wybrany dzień: ${calendar.state.selectedDate}`;
  const density = loadState === 'loaded' || loadState === 'empty'
    ? densityLabel(dataDensity)
    : '–';
  const liveMeta = liveStatus === 'loaded' ? 'LIVE' : liveStatus === 'empty' ? 'Brak danych' : 'Czekam na dane';
  const pm1Value = livePmsRaw ? Number(livePmsRaw.pm1).toFixed(1) : '--';
  const pm25Value = livePmsRaw ? Number(livePmsRaw.pm25).toFixed(1) : '--';
  const pm10Value = livePmsRaw ? Number(livePmsRaw.pm10).toFixed(1) : '--';

  return (
    <section className="pms-section pms-history-stack" aria-label="Historia i trend dla PMS5003">
      <section className="pms-inner-panel" aria-label="Wykres 2 i dane live dla PMS5003">
        <header className="panel-head">
          <div>
            <p className="eyebrow">WYKRES 2</p>
            <h3>Zanieczyszczenie pyłowe</h3>
            <p>Wybierz dzień, aby zobaczyć historyczne pomiary PM; dla dnia dzisiejszego wykres obejmuje także dane bieżące.</p>
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
            <div className="chart-stack-item">
              <PmsChartController key={calendar.state.selectedDate} points={chartPoints} loadState={loadState} selectedDate={calendar.state.selectedDate} />
            </div>
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

      <div className="pms-separator" aria-hidden="true">
        <span className="pms-separator-line"></span>
        <span className="chip pms-separator-chip">WYKRES 3</span>
        <span className="pms-separator-line"></span>
      </div>

      <div className="pms-particles-stage">
        <PmsParticlesChart
          points={chartPoints}
          liveData={liveData}
          liveStatus={liveStatus}
          preferLive={isSelectedToday}
        />
      </div>
    </section>
  );
}