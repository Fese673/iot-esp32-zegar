import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Calendar from '../../../shared/components/Calendar';
import { useCalendar } from '../../../shared/hooks/useCalendar';
import { useEns160Data } from '../hooks/useEns160Data';
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

type AqiCategory = { label: string; color: string };

function getAqiCategory(aqi: number | null): AqiCategory {
  if (aqi == null) return { label: 'Brak danych', color: '#9fb0c7' };
  if (aqi <= 1) return { label: 'Bardzo dobre', color: '#2dc937' };
  if (aqi === 2) return { label: 'Dobre', color: '#77d500' };
  if (aqi === 3) return { label: 'Umiarkowane', color: '#f7e41f' };
  if (aqi === 4) return { label: 'Słabe', color: '#ff9600' };
  return { label: 'Niezdrowe', color: '#ff3b30' };
}

type Ens160TileKey = 'aqi' | 'tvoc' | 'eco2';

type TooltipState = {
  key: Ens160TileKey;
  x: number;
  y: number;
} | null;

function getTooltipPosition(hover: { x: number; y: number }, tooltipSize: { width: number; height: number }) {
  const viewport = typeof window === 'undefined'
    ? { width: 1280, height: 720 }
    : {
      width: Math.round(window.visualViewport?.width ?? window.innerWidth),
      height: Math.round(window.visualViewport?.height ?? window.innerHeight),
    };

  const tooltipWidth = Math.max(tooltipSize.width, 1);
  const tooltipHeight = Math.max(tooltipSize.height, 1);

  const maxLeft = Math.max(12, viewport.width - tooltipWidth - 12);
  let left = hover.x + 14;
  if (left > maxLeft) {
    left = hover.x - tooltipWidth - 14;
  }
  left = Math.min(Math.max(left, 12), maxLeft);

  const preferredTop = hover.y - tooltipHeight - 14;
  const fallbackTop = hover.y + 18;
  const maxTop = Math.max(12, viewport.height - tooltipHeight - 12);
  const top = Math.min(Math.max(preferredTop >= 12 ? preferredTop : fallbackTop, 12), maxTop);

  return { left, top };
}

const ENS160_SERIES_CONFIG = [
  { key: 'eco2', label: 'eCO2 (ppm)', color: '#38bdf8', yAxisID: 'y' as const, unit: 'ppm' },
  { key: 'tvoc', label: 'TVOC (ppb)', color: '#22c55e', yAxisID: 'y1' as const, unit: 'ppb' },
];

export default function Ens160Section() {
  const calendar = useCalendar();
  const {
    points: chartPoints,
    loadState,
    dataDensity,
    liveData,
    liveStatus,
  } = useEns160Data(calendar.state.selectedDate);
  const modeInfo = `Wybrany dzień: ${calendar.state.selectedDate}`;

  const aqiValue = liveData?.aqi ?? null;
  const clampedAqi = aqiValue == null ? null : Math.min(5, Math.max(1, Math.round(aqiValue)));
  const aqiIndicatorOffset = clampedAqi == null ? 50 : 10 + (clampedAqi - 1) * 20;

  const aqiCategory = getAqiCategory(aqiValue);
  const density = useMemo(() => {
    if (loadState === 'loaded' || loadState === 'empty') {
      return formatDataDensity(dataDensity);
    }

    return '–';
  }, [dataDensity, loadState]);

  const liveMeta = liveStatus === 'loaded' ? 'LIVE' : liveStatus === 'empty' ? 'Brak danych' : 'Czekam na dane';
  const aqiDisplay = aqiValue == null ? '--' : `${Math.round(aqiValue)}`;
  const tvocDisplay = liveData ? `${Math.round(liveData.tvoc)}` : '--';
  const eco2Display = liveData ? `${Math.round(liveData.eco2)}` : '--';

  const [hoverTooltip, setHoverTooltip] = useState<TooltipState>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 285, height: 160 });
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!hoverTooltip || !tooltipRef.current) {
      return;
    }

    const bounds = tooltipRef.current.getBoundingClientRect();
    const nextSize = {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
    };

    setTooltipSize((prev) => {
      if (Math.abs(prev.width - nextSize.width) <= 1 && Math.abs(prev.height - nextSize.height) <= 1) {
        return prev;
      }
      return nextSize;
    });
  }, [hoverTooltip, aqiDisplay, tvocDisplay, eco2Display, liveMeta, aqiCategory]);

  const severityLabelMap: Record<'good' | 'warn' | 'alert' | 'unknown', string> = {
    good: 'Dobry',
    warn: 'Umiarkowany',
    alert: 'Zły',
    unknown: 'Nieznany',
  };

  const hoverEntries: Record<Ens160TileKey, { label: string; unit: string; value: string; severity: 'good' | 'warn' | 'alert' | 'unknown'; note: string; detail: string }> = {
    aqi: {
      label: 'AQI',
      unit: 'punkty',
      value: aqiDisplay,
      severity: aqiValue == null ? 'unknown' : aqiValue <= 2 ? 'good' : aqiValue === 3 ? 'warn' : 'alert',
      note: aqiCategory.label,
      detail: 'Indeks jakości powietrza bazujący na eCO2 i TVOC',
    },
    tvoc: {
      label: 'TVOC',
      unit: 'ppb',
      value: tvocDisplay,
      severity: liveData && typeof liveData.tvoc === 'number'
        ? liveData.tvoc < 65 ? 'good' : liveData.tvoc < 220 ? 'warn' : 'alert'
        : 'unknown',
      note: 'Im większa wartość, tym gorsza jakość powietrza',
      detail: 'TVOC = lotne związki organiczne. Wysokie wartości mogą oznaczać złe przewietrzenie.',
    },
    eco2: {
      label: 'eCO2',
      unit: 'ppm',
      value: eco2Display,
      severity: liveData && typeof liveData.eco2 === 'number'
        ? liveData.eco2 < 1000 ? 'good' : liveData.eco2 < 2000 ? 'warn' : 'alert'
        : 'unknown',
      note: 'Szacowany wynik - nie pomiar bezpośredni',
      detail: 'eCO2 (Ekwiwalent CO₂)',
    },
  };

  const tooltipMetric = hoverTooltip ? hoverEntries[hoverTooltip.key] : null;
  const tooltipPosition = hoverTooltip ? getTooltipPosition(hoverTooltip, tooltipSize) : null;

  return (
    <section className="pms-section pms-history-stack" aria-label="Wykres ENS160">
      <section className="pms-inner-panel" aria-label="ENS160 live i historia">
        <header className="panel-head">
          <div>
            <p className="eyebrow">WYKRES ENS160</p>
            <h2>ENS160: historia i live</h2>
            <p>Wykres pokazuje wyłącznie TVOC i eCO2. Dla dnia dzisiejszego obejmuje także dane bieżące.</p>
          </div>
          <div className="panel-actions">
            <button className="primary-btn" type="button" onClick={() => calendar.selectDate(calendar.state.today)}>Dziś</button>
            <button className="ghost-btn" type="button" onClick={() => calendar.selectDate(calendar.state.today)}>Wyczyść</button>
          </div>
        </header>

        <section className="pms5003-grid" aria-label="ENS160 live view">
          <article
            className="stat-card pm-card pm1-card"
            tabIndex={0}
            onMouseEnter={(event) => setHoverTooltip({ key: 'aqi', x: event.clientX, y: event.clientY })}
            onMouseMove={(event) => setHoverTooltip({ key: 'aqi', x: event.clientX, y: event.clientY })}
            onMouseLeave={() => setHoverTooltip(null)}
            onFocus={(event) => setHoverTooltip({ key: 'aqi', x: event.target.getBoundingClientRect().right, y: event.target.getBoundingClientRect().top })}
            onBlur={() => setHoverTooltip(null)}
          >
            <div className="stat-top">
              <p className="label">AQI</p>
              <span className="tag">{aqiCategory.label}</span>
            </div>
            <p className="value" id="ens160Aqi">{aqiDisplay}</p>

            <div className="aqi-scale" role="img" aria-label={`AQI ${aqiDisplay} ${aqiCategory.label}`}>
              <div className="aqi-scale-track">
                <div className="aqi-step aqi-1" />
                <div className="aqi-step aqi-2" />
                <div className="aqi-step aqi-3" />
                <div className="aqi-step aqi-4" />
                <div className="aqi-step aqi-5" />
                <div className="aqi-indicator" style={{ left: `${aqiIndicatorOffset}%`, background: '#000', opacity: aqiValue == null ? 0.35 : 1 }} />
              </div>
              <div className="aqi-scale-labels">
                <span>1</span><span>2</span><span>3</span><span>4</span><span>5</span>
              </div>
            </div>
            <p className="muted aqi-scale-meta" id="ens160AqiMeta">{aqiCategory.label}</p>
          </article>

          <article
            className="stat-card pm-card pm25-card"
            tabIndex={0}
            onMouseEnter={(event) => setHoverTooltip({ key: 'tvoc', x: event.clientX, y: event.clientY })}
            onMouseMove={(event) => setHoverTooltip({ key: 'tvoc', x: event.clientX, y: event.clientY })}
            onMouseLeave={() => setHoverTooltip(null)}
            onFocus={(event) => setHoverTooltip({ key: 'tvoc', x: event.target.getBoundingClientRect().right, y: event.target.getBoundingClientRect().top })}
            onBlur={() => setHoverTooltip(null)}
          >
            <div className="stat-top">
              <p className="label">TVOC</p>
              <span className="tag">ppb</span>
            </div>
            <p className="value" id="ens160Tvoc">{tvocDisplay}</p>
            <p className="muted" id="ens160TvocMeta">{liveMeta}</p>
          </article>

          <article
            className="stat-card pm-card pm10-card"
            tabIndex={0}
            onMouseEnter={(event) => setHoverTooltip({ key: 'eco2', x: event.clientX, y: event.clientY })}
            onMouseMove={(event) => setHoverTooltip({ key: 'eco2', x: event.clientX, y: event.clientY })}
            onMouseLeave={() => setHoverTooltip(null)}
            onFocus={(event) => setHoverTooltip({ key: 'eco2', x: event.target.getBoundingClientRect().right, y: event.target.getBoundingClientRect().top })}
            onBlur={() => setHoverTooltip(null)}
          >
            <div className="stat-top">
              <p className="label">eCO2</p>
              <span className="tag">ppm</span>
            </div>
            <p className="value" id="ens160Eco2">{eco2Display}</p>
            <p className="muted" id="ens160Eco2Meta">{liveMeta}</p>
          </article>
        </section>

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
                points={chartPoints}
                loadState={loadState}
                selectedDate={calendar.state.selectedDate}
                seriesConfig={ENS160_SERIES_CONFIG}
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
            nextButtonLabel="▶"
          />
        </div>
      </section>

      {tooltipMetric && tooltipPosition && typeof document !== 'undefined' ? createPortal(
        <div
          ref={tooltipRef}
          className="particles3-tooltip"
          style={{ left: `${tooltipPosition.left}px`, top: `${tooltipPosition.top}px` }}
          role="tooltip"
        >
          {hoverTooltip?.key === 'aqi' ? (
            <>
              <b>AQI (Indeks Jakości Powietrza)</b>
              <span>Odczyt: {tooltipMetric.value} / 5 (Stan: {severityLabelMap[tooltipMetric.severity]})</span>
              <strong>Co to jest?</strong>
              <span>Ogólna ocena czystości powietrza w pomieszczeniu. Łączy dane z eCO2 oraz TVOC w jedną, łatwą do zrozumienia cyfrę.</span>
              <strong>Dlaczego sprawdzamy?</strong>
              <span>Pozwala jednym rzutem oka ocenić, czy środowisko jest zdrowe. Im niższa wartość, tym czystsze powietrze.</span>
              <strong>Interpretacja skali:</strong>
              <ul>
                <li>1: Doskonałe – idealne warunki.</li>
                <li>2: Dobre – normalne warunki domowe.</li>
                <li>3: Przeciętne – warto pomyśleć o wietrzeniu.</li>
                <li>4-5: Słabe/Złe – natychmiast otwórz okna!</li>
              </ul>
              <span>INFO: Wartość ta reaguje dynamicznie na nagłe zanieczyszczenia, jak dym papierosowy czy chemia domowa.</span>
            </>
          ) : hoverTooltip?.key === 'eco2' ? (
            <>
              <b>eCO2 (Ekwiwalent CO₂)</b>
              <span>Odczyt: {tooltipMetric.value} {tooltipMetric.unit} (Stan: {severityLabelMap[tooltipMetric.severity]})</span>
              <strong>Co to jest?</strong>
              <span>Szacowane stężenie CO₂ obliczone na podstawie lotnych zanieczyszczeń (TVOC) i Twojego oddechu.</span>
              <strong>Dlaczego sprawdzamy?</strong>
              <span>Wysokie eCO2 oznacza „zużyte” powietrze. Powoduje senność, bóle głowy i spadek koncentracji.</span>
              <strong>Kiedy wietrzyć?</strong>
              <ul>
                <li>&lt; 600 ppm: Świetnie</li>
                <li>600-1000 ppm: Przeciętnie</li>
                <li>&gt; 1000 ppm: Przewietrz pokój!</li>
              </ul>
              <span>INFO: To wynik z algorytmu (TVOC), a nie bezpośredni pomiar gazu.</span>
            </>
          ) : hoverTooltip?.key === 'tvoc' ? (
            <>
              <b>TVOC (Lotne Związki Organiczne)</b>
              <span>Odczyt: {tooltipMetric.value} {tooltipMetric.unit} (Stan: {severityLabelMap[tooltipMetric.severity]})</span>
              <strong>Co to jest?</strong>
              <span>Suma oparów chemicznych w powietrzu (np. z detergentów, farb, mebli, kosmetyków czy gotowania).</span>
              <strong>Dlaczego sprawdzamy?</strong>
              <span>Długotrwałe wysokie stężenie może powodować podrażnienie oczu, gardła, zmęczenie, a nawet zawroty głowy.</span>
              <strong>Kiedy wietrzyć?</strong>
              <ul>
                <li>0-220 ppb: Dobrze (standard)</li>
                <li>220-660 ppb: Akceptowalnie</li>
                <li>&gt; 660 ppb: Przewietrz! Coś "gazuje" w pokoju.</li>
              </ul>
              <span>INFO: Nagłe skoki TVOC często występują podczas sprzątania lub używania aerozoli.</span>
            </>
          ) : (
            <>
              <b>{`${tooltipMetric.label} (${tooltipMetric.unit})`}</b>
              <span>Odczyt: {tooltipMetric.value}</span>
              <span>
                Stan: <span className={`particles3-${tooltipMetric.severity}`}>{tooltipMetric.note}</span>
              </span>
              <span>Status: {liveMeta}</span>
              <i style={{ display: 'block', whiteSpace: 'pre-line', marginTop: '0.25em' }}>{tooltipMetric.detail}</i>
            </>
          )}
        </div>,
        document.body,
      ) : null}
    </section>
  );
}
