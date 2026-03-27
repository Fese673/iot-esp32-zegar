function PmsSection() {
  return (
    <section className="panel pms-section" aria-label="Moduł czujnika pyłów PMS5003">
      <header className="panel-head pms-master-head">
        <div>
          <p className="eyebrow"></p>
          <h2></h2>
          <p></p>
        </div>
        <div className="panel-actions">
          <span className="chip live"><span className="pulse"></span></span>
          <span className="chip"></span>
          <span className="chip"></span>
        </div>
      </header>

      <div className="pms-stack">
        <section className="pms-embed-panel" aria-label="Frakcje PM w układzie warstwowym">
          <header className="panel-head pms-subhead">
            <div>
              <p className="eyebrow"></p>
              <h3></h3>
              <p></p>
            </div>
            <div className="panel-actions">
              <span className="chip"></span>
              <span className="chip"></span>
            </div>
          </header>

          <div className="pm-embed-shell">
            <iframe
              id="pmEmbed"
              className="pm-embed"
              src="/Kreatywna%20sekcja/pm_chart1.html"
              title="PM Frakcje - warstwowy panel z danych Firebase"
              scrolling="no"
              loading="lazy"
            ></iframe>
          </div>
        </section>

        <section className="pms-inner-panel" aria-label="Historia i trend dla PMS5003">
          <header className="panel-head">
            <div>
              <p className="eyebrow">Widok archiwalny</p>
              <h3>Trend dobowy i korelacja z kalendarzem</h3>
            </div>
            <div className="panel-actions">
              <button className="primary-btn" id="pmsBtnToday">Dziś</button>
              <button className="ghost-btn" id="pmsBtnClear">Wyczyść</button>
            </div>
          </header>

          <section className="pms5003-grid" aria-label="PMS5003 live view">
            <article className="stat-card pm-card pm1-card">
              <div className="stat-top">
                <p className="label">PM 1.0</p>
                <span className="tag">μg/m³</span>
              </div>
              <p className="value" id="pm1Value">--</p>
              <p className="muted" id="pm1Meta">Czekam na dane</p>
            </article>

            <article className="stat-card pm-card pm25-card">
              <div className="stat-top">
                <p className="label">PM 2.5</p>
                <span className="tag">μg/m³</span>
              </div>
              <p className="value" id="pm25Value">--</p>
              <p className="muted" id="pm25Meta">Czekam na dane</p>
            </article>

            <article className="stat-card pm-card pm10-card">
              <div className="stat-top">
                <p className="label">PM 10.0</p>
                <span className="tag">μg/m³</span>
              </div>
              <p className="value" id="pm10Value">--</p>
              <p className="muted" id="pm10Meta">Czekam na dane</p>
            </article>
          </section>

          <div className="panel-body split">
            <div className="chart-stack">
              <div className="chart-head">
                <div>
                  <p className="muted" id="pmsModeInfo">Wybierz dzień w kalendarzu</p>
                  <p className="chart-hint">Ctrl ⌃ + scroll / pinch aby przybliżyć. Przesuń gdy jesteś nad wykresem.</p>
                </div>
                <span className="chip" id="pmsDataDensity">–</span>
              </div>
              <div className="chart-frame" id="pmsChartFrame">
                <canvas id="pmsChart" aria-label="Wykres historii pyłów PM" role="img"></canvas>
                <div className="chart-overlay" id="pmsChartLoading">Ładowanie danych…</div>
                <div className="chart-overlay" id="pmsChartNote">Wybierz dzień, aby wczytać dane z bazy.</div>
                <div className="chart-overlay error" id="pmsChartError">Brak danych dla tego dnia.</div>
                <div className="chart-controls" aria-hidden="true">
                  <button type="button" className="chart-control" data-pms-pan="-1" aria-label="Przesuń wykres w lewo">‹</button>
                  <button type="button" className="chart-control" data-pms-pan="1" aria-label="Przesuń wykres w prawo">›</button>
                </div>
              </div>
            </div>

            <aside className="calendar" aria-label="Kalendarz wyboru dnia — pyły">
              <div className="cal-head">
                <button className="cal-btn" id="pmsCalPrev" title="Poprzedni miesiąc" aria-label="Poprzedni miesiąc">◀</button>
                <div>
                  <p className="eyebrow">Dzień</p>
                  <h3 className="cal-title" id="pmsCalTitle">—</h3>
                </div>
                <button className="cal-btn" id="pmsCalNext" title="Następny miesiąc" aria-label="Następny miesiąc">▶</button>
              </div>
              <div className="cal-weekdays">
                <span>Pn</span><span>Wt</span><span>Śr</span><span>Cz</span><span>Pt</span><span>Sb</span><span>Nd</span>
              </div>
              <div className="cal-grid" id="pmsCalGrid"></div>
              <div className="cal-legend">
                <span className="legend-dot today"></span> dziś
                <span className="legend-dot selected"></span> wybrany
              </div>
            </aside>
          </div>
        </section>
      </div>
    </section>
  );
}

export default PmsSection;
