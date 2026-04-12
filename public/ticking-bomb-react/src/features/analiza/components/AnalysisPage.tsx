import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import katex from 'katex';
import type { ConnectionStatus, LiveRecord, LoadState } from '../../../shared/types';
import { formatDateTime, toEpochMs } from '../../../shared/lib/timeHelpers';
import { toDateKey } from '../../../shared/lib/dateHelpers';
import { useHistoryData } from '../../dashboard/hooks/useHistoryData';
import { useEns160Live } from '../../ens160/hooks/useEns160Live';
import { usePmsLive } from '../../pms/hooks/usePmsLive';
import { extractPmRawLike } from '../../pms/lib/pmsHelpers';
import {
  computeComfortScore,
  computeThermalMetrics,
  describeAbsoluteHumidity,
  describeDewPoint,
  describeHeatIndex,
  describeHumidex,
  type ComfortDescriptor,
  type ComfortTone,
} from '../lib/comfortAlgorithms';
import {
  computeBarometricTrend,
  computeEns160SourceRatio,
  computeHygroscopicPmCorrection,
  computeRespiratoryLoadIndex,
  describeEns160SourceAttribution,
  describeRespiratoryLoadIndex,
} from '../lib/insightAlgorithms';
import '../analysis.css';
import 'katex/dist/katex.min.css';

interface AnalysisPageProps {
  onBack: () => void;
  liveRecord: LiveRecord | null;
  loadState: LoadState;
  connectionStatus: ConnectionStatus;
  motionEnabled: boolean;
}

interface MetricCardModel {
  id: string;
  title: string;
  shortLabel: string;
  value: number | null;
  unit: string;
  precision: number;
  formula: string;
  helper: string;
  descriptor: ComfortDescriptor;
  scaleLabel?: string;
  min: number;
  max: number;
  idealMin: number;
  idealMax: number;
}

interface MetricInsightCopy {
  headline: string;
  impact: string;
  action: string;
}

const ANALYSIS_CARD_ORDER = [
  'dew-point',
  'humidex',
  'heat-index',
  'absolute-humidity',
  'respiratory-load',
  'source-attribution',
  'barometric-trend',
  'pm-hygroscopic-correction',
] as const;
const INTRO_DURATION_MS = 860;
const INTRO_STAGGER_MS = 90;
const FLYOUT_DURATION_MS = 430;
const DETAIL_APPEAR_DELAY_MS = 170;
const DETAIL_ENTER_DURATION_MS = 620;
const ANALYSIS_CARD_TRAVEL_MARGIN = 72;

const ANALYSIS_DETAIL_COPY: Record<string, MetricInsightCopy> = {
  'dew-point': {
    headline: 'Określa temperaturę, przy której para wodna zaczyna się skraplać.',
    impact: 'Im wyższy punkt rosy, tym szybciej pojawia się uczucie duszności i ryzyko kondensacji na chłodnych powierzchniach.',
    action: 'Zalecany zakres dla wnętrz: 10–16°C.',
  },
  humidex: {
    headline: 'Humidex łączy temperaturę i wilgotność w jeden indeks odczuwalnego ciepła.',
    impact: 'Wyżej oznacza, że organizm trudniej oddaje ciepło, nawet gdy sama temperatura nie wygląda groźnie.',
    action: 'Gdy indeks rośnie ponad strefę komfortu, priorytetem jest przewietrzenie i ograniczenie zysków ciepła.',
  },
  'heat-index': {
    headline: 'Heat Index NWS to model obciążenia cieplnego dla ciepłego i wilgotnego powietrza.',
    impact: 'Model aktywuje się dla wyższych temperatur i wilgotności, gdzie ryzyko przegrzania rośliny i człowieka rośnie szybciej.',
    action: 'Po przekroczeniu progu ostrzegawczego warto schładzać pomieszczenie i ograniczać intensywny wysiłek.',
  },
  'absolute-humidity': {
    headline: 'Absolutna wilgotność to realna masa pary wodnej w metrze sześciennym powietrza.',
    impact: 'Ten parametr lepiej od RH pokazuje, ile wilgoci faktycznie jest w pomieszczeniu i jak obciąża wentylację.',
    action: 'Najczęściej dobry punkt pracy dla wnętrz to okolice 5–15 g/m³, zależne od sezonu i typu budynku.',
  },
  'respiratory-load': {
    headline: 'ROI sumuje pyły i gazy, żeby szybciej wychwycić obciążenie układu oddechowego.',
    impact: 'Wysoki wynik zwykle oznacza, że jednocześnie rosną PM2.5, eCO2 i TVOC, więc problem dotyczy nie jednego, a kilku kanałów jakości powietrza.',
    action: 'Najpierw przewietrz, potem sprawdź, który składnik podbija ROI najbardziej.',
  },
  'source-attribution': {
    headline: 'Stosunek TVOC do eCO2 pomaga odróżnić źródła metaboliczne od chemicznych.',
    impact: 'Niski wskaźnik zwykle wskazuje na dominację oddechu ludzi i zwierząt. Wyższy poziom częściej oznacza emisję z materiałów, klejów albo środków czystości.',
    action: 'Jeśli wskaźnik rośnie, szukaj źródła lotnych związków i popraw wymianę powietrza.',
  },
  'barometric-trend': {
    headline: 'Trend 3h pokazuje kierunek zmian ciśnienia i daje szybki sygnał pogody.',
    impact: 'Spadek ciśnienia nie mówi jeszcze wszystkiego, ale dobrze ostrzega przed pogorszeniem warunków atmosferycznych, zanim zmiana będzie odczuwalna.',
    action: 'Łącz trend z historią kilku godzin, a nie z pojedynczym pomiarem.',
  },
  'pm-hygroscopic-correction': {
    headline: 'Korekta higroskopijna usuwa część błędu wynikającego z wilgotności.',
    impact: 'Przy wysokim RH sensor pyłu potrafi zawyżać wynik, bo cząstki chłoną wodę i optycznie wyglądają na większe. Korekta przybliża odczyt do rzeczywistego aerozolu.',
    action: 'Przy RH powyżej 60% traktuj surowy PM z ostrożnością i patrz na trend.',
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toPercent(value: number, min: number, max: number): number {
  if (max <= min) {
    return 0;
  }

  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function computeOffscreenTravel(element: HTMLElement, direction: -1 | 1, viewportWidth: number): number {
  const rect = element.getBoundingClientRect();
  const travel = direction === 1
    ? viewportWidth - rect.left + ANALYSIS_CARD_TRAVEL_MARGIN
    : rect.right + ANALYSIS_CARD_TRAVEL_MARGIN;

  return Math.max(ANALYSIS_CARD_TRAVEL_MARGIN, travel);
}

function formatMetricWithUnit(value: number | null, precision: number, unit: string): string {
  if (value == null) {
    return '--';
  }

  const trimmedUnit = unit.trim();
  const unitSpacer = trimmedUnit === '' || trimmedUnit === '°C' || trimmedUnit === '%' ? '' : ' ';
  return `${value.toFixed(precision)}${unitSpacer}${trimmedUnit}`;
}

function formatRangeWithUnit(min: number, max: number, unit: string): string {
  const trimmedUnit = unit.trim();
  const unitSpacer = trimmedUnit === '' || trimmedUnit === '°C' || trimmedUnit === '%' ? '' : ' ';
  return `${min}–${max}${unitSpacer}${trimmedUnit}`;
}

function toneClass(tone: ComfortTone): string {
  return `tone-${tone}`;
}

function loadStateLabel(loadState: LoadState): string {
  if (loadState === 'loading') {
    return 'Ładowanie strumienia live...';
  }
  if (loadState === 'empty') {
    return 'Brak próbki z urządzenia.';
  }
  if (loadState === 'error') {
    return 'Błąd odczytu, sprawdź Firebase.';
  }
  if (loadState === 'loaded') {
    return 'Dane napływają poprawnie.';
  }

  return 'Oczekiwanie na aktywację strumienia.';
}

function connectionLabel(status: ConnectionStatus): string {
  if (status === 'connected') {
    return 'LIVE aktywny';
  }
  if (status === 'reconnecting') {
    return 'Przerwa w próbkach';
  }

  return 'Offline';
}

function MathFormula({ formula, variant = 'compact' }: { formula: string; variant?: 'compact' | 'detail' }) {
  const firstDelimiter = formula.indexOf('$');
  const lastDelimiter = formula.lastIndexOf('$');
  const hasMathExpression = firstDelimiter !== -1 && lastDelimiter > firstDelimiter;
  const prefix = hasMathExpression ? formula.slice(0, firstDelimiter) : formula;
  const mathExpression = hasMathExpression ? formula.slice(firstDelimiter + 1, lastDelimiter) : null;

  const renderedMath = useMemo(() => {
    if (!mathExpression) {
      return null;
    }

    return katex.renderToString(mathExpression, {
      displayMode: false,
      throwOnError: false,
      strict: 'ignore',
    });
  }, [mathExpression]);

  if (!mathExpression) {
    return <p className={`analysis-formula analysis-formula--plain analysis-formula--${variant}`}>{formula}</p>;
  }

  return (
    <div className={`analysis-formula analysis-formula--structured analysis-formula--${variant}`}>
      <span className="analysis-formula-prefix">{prefix}</span>
      <span className="analysis-formula-math" dangerouslySetInnerHTML={{ __html: renderedMath ?? '' }} />
    </div>
  );
}

function AnalysisMetricCard({
  metric,
  onSelect,
  additionalClass,
  cardRef,
}: {
  metric: MetricCardModel;
  onSelect?: () => void;
  additionalClass?: string;
  cardRef?: (element: HTMLElement | null) => void;
}) {
  const pointer = metric.value == null ? null : toPercent(metric.value, metric.min, metric.max);
  const idealStart = toPercent(metric.idealMin, metric.min, metric.max);
  const idealEnd = toPercent(metric.idealMax, metric.min, metric.max);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onSelect) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  };

  const className = `analysis-card ${toneClass(metric.descriptor.tone)} ${additionalClass ?? ''}`.trim();

  return (
    <article
      ref={cardRef}
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      className={className}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      aria-label={onSelect ? `${metric.title} (otworz opis)` : undefined}
    >
      <header className="analysis-card-head">
        <p className="analysis-card-kicker mono">{metric.shortLabel}</p>
        <span className={`analysis-tone-pill ${toneClass(metric.descriptor.tone)}`}>{metric.descriptor.label}</span>
      </header>

      <h3>{metric.title}</h3>

      <p className="analysis-value mono">
        {formatMetricWithUnit(metric.value, metric.precision, metric.unit)}
      </p>

      <p className="analysis-detail">{metric.descriptor.detail}</p>

      <div className="analysis-scale" aria-hidden="true">
        <div className="analysis-scale-track">
          <span
            className="analysis-scale-ideal"
            style={{
              left: `${idealStart}%`,
              width: `${Math.max(idealEnd - idealStart, 2)}%`,
            }}
          ></span>
          {pointer != null ? <span className="analysis-scale-pointer" style={{ left: `${pointer}%` }}></span> : null}
        </div>
        <p className="analysis-scale-label">
          {metric.scaleLabel ?? 'Komfort'}: {formatRangeWithUnit(metric.idealMin, metric.idealMax, metric.unit)}
        </p>
      </div>

      <MathFormula formula={metric.formula} />
      <p className="analysis-helper">{metric.helper}</p>
    </article>
  );
}

function AnalysisDetailCard({
  metric,
  onClose,
  cardRef,
}: {
  metric: MetricCardModel;
  onClose: () => void;
  cardRef?: (element: HTMLElement | null) => void;
}) {
  const insight = ANALYSIS_DETAIL_COPY[metric.id] ?? {
    headline: metric.descriptor.detail,
    impact: metric.helper,
    action: 'Utrzymuj ten wskaźnik w strefie komfortu i monitoruj trend godzinowy.',
  };

  return (
    <article ref={cardRef} className="analysis-card analysis-detail-card">
      <header className="analysis-detail-head">
        <div className="analysis-detail-head-copy">
          <p className="analysis-card-kicker mono">{metric.shortLabel}</p>
          <span className={`analysis-tone-pill ${toneClass(metric.descriptor.tone)}`}>{metric.descriptor.label}</span>
        </div>
        <button className="analysis-detail-close" type="button" onClick={onClose} aria-label="Zamknij">
          ×
        </button>
      </header>
      <h3>{metric.title}</h3>
      <p className="analysis-detail">{insight.headline}</p>
      <p className="analysis-detail">{insight.impact}</p>
      <MathFormula formula={metric.formula} variant="detail" />
      <p className="analysis-helper">{insight.action}</p>
    </article>
  );
}

function AnalysisPage({ onBack, liveRecord, loadState, connectionStatus, motionEnabled }: AnalysisPageProps) {
  const [flyOutCardId, setFlyOutCardId] = useState<string | null>(null);
  const [detailCardId, setDetailCardId] = useState<string | null>(null);
  const [openDetailIds, setOpenDetailIds] = useState<Set<string>>(new Set());
  const [introRunning, setIntroRunning] = useState(false);
  const [desktopMotionEnabled, setDesktopMotionEnabled] = useState(false);
  const [analysisFallbackDateKey] = useState(() => toDateKey(Date.now()));

  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const detailCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const introPlayedRef = useRef(false);
  const introRunningFrameRef = useRef<number | null>(null);
  const detailRevealTimeoutRef = useRef<number | null>(null);
  const detailEntranceDirectionRef = useRef<-1 | 1>(1);
  const detailEnterAnimationRef = useRef<Animation | null>(null);

  const analysisDateKey = liveRecord ? toDateKey(liveRecord.ts) : analysisFallbackDateKey;
  const historyData = useHistoryData(analysisDateKey);
  const pmsLive = usePmsLive();
  const ens160Live = useEns160Live();

  const thermal = useMemo(() => {
    if (!liveRecord) {
      return null;
    }

    return computeThermalMetrics({
      temperatureC: liveRecord.t,
      relativeHumidity: liveRecord.h,
    });
  }, [liveRecord]);

  const score = useMemo(() => (thermal ? computeComfortScore(thermal) : null), [thermal]);

  const pmsRaw = useMemo(() => extractPmRawLike(pmsLive.data), [pmsLive.data]);

  const metricCards = useMemo<MetricCardModel[]>(() => {
    if (!thermal) {
      return [];
    }

    return [
      {
        id: 'dew-point',
        title: 'Punkt rosy',
        shortLabel: 'Punkt rosy',
        value: thermal.dewPointC,
        unit: '°C',
        precision: 1,
        formula: 'Punkt rosy (Alduchov/Eskridge 1996): $T_d = \\frac{b \\cdot \\gamma}{a - \\gamma}, \\gamma = \\ln\\left(\\frac{RH}{100}\\right) + \\frac{a \\cdot T}{b + T}$',
        helper: 'Dokładność około 0,1°C dla przedziału −40–60°C.',
        descriptor: describeDewPoint(thermal.dewPointC),
        scaleLabel: 'Komfort',
        min: -20,
        max: 30,
        idealMin: 10,
        idealMax: 16,
      },
      {
        id: 'humidex',
        title: 'Humidex',
        shortLabel: 'Komfort cieplny',
        value: thermal.humidex,
        unit: 'indeks',
        precision: 1,
        formula: 'Humidex: $H = T + \\frac{5}{9}(e - 10),\\; e = \\frac{RH}{100} \\cdot 6.112 \\cdot \\exp\\left(\\frac{17.67T}{T + 243.5}\\right)$',
        helper: 'Łączy temperaturę i parę rzeczywistą w jeden indeks odczuwalny.',
        descriptor: describeHumidex(thermal.humidex),
        scaleLabel: 'Komfort',
        min: 10,
        max: 50,
        idealMin: 20,
        idealMax: 29,
      },
      {
        id: 'heat-index',
        title: 'Heat Index NWS',
        shortLabel: 'Indeks ciepła',
        value: thermal.heatIndexC,
        unit: '°C',
        precision: 1,
        formula: 'Indeks ciepła NWS: $HI_F = -42.379 + 2.04901523T_F + 10.14333127RH - 0.22475541T_FRH - 0.00683783T_F^2 - 0.05481717RH^2 + 0.00122874T_F^2RH + 0.00085282T_FRH^2 - 0.00000199T_F^2RH^2$',
        helper: 'Wynik N/A oznacza, że warunki są poza zakresem modelu NWS.',
        descriptor: describeHeatIndex(thermal.heatIndexC),
        scaleLabel: 'Strefa',
        min: 20,
        max: 60,
        idealMin: 23,
        idealMax: 31,
      },
      {
        id: 'absolute-humidity',
        title: 'Absolutna wilgotność',
        shortLabel: 'AH',
        value: thermal.absoluteHumidityGm3,
        unit: 'g/m³',
        precision: 2,
        formula: 'Wilgotność bezwzględna: $\\rho_v = \\frac{216.7 \\cdot e}{273.15 + T}$',
        helper: 'Docelowo dla pomieszczeń zwykle 5–15 g/m³.',
        descriptor: describeAbsoluteHumidity(thermal.absoluteHumidityGm3),
        scaleLabel: 'Norma',
        min: 0,
        max: 24,
        idealMin: 5,
        idealMax: 15,
      },
    ];
  }, [thermal]);

  const insightCards = useMemo<MetricCardModel[]>(() => {
    if (!thermal) {
      return [];
    }

    const pm25 = pmsRaw?.pm25 ?? null;
    const tvoc = ens160Live.data?.tvoc ?? null;
    const eco2 = ens160Live.data?.eco2 ?? null;

    const respiratoryLoad = computeRespiratoryLoadIndex(pm25, eco2, tvoc);
    const sourceRatio = computeEns160SourceRatio(tvoc, eco2);
    const barometricTrend = computeBarometricTrend(historyData.points, liveRecord?.ts ?? Number.NaN, liveRecord?.p ?? Number.NaN);
    const hygroscopicCorrection = computeHygroscopicPmCorrection(pm25, thermal.relativeHumidity);

    return [
      {
        id: 'respiratory-load',
        title: 'Obciążenie oddechowe',
        shortLabel: 'ROI',
        value: respiratoryLoad,
        unit: 'ROI',
        precision: 2,
        formula: 'Obciążenie oddechowe: $ROI = 0.8 + 0.04\\,PM_{2.5} + 0.001\\,eCO_2 + 0.004\\,TVOC$ (model przybliżony)',
        helper: respiratoryLoad == null
          ? 'Wymagane są jednocześnie PM2.5, eCO2 i TVOC.'
          : `ROI = ${respiratoryLoad.toFixed(2)} to liniowe przybliżenie obciążenia układu oddechowego. W praktyce wpływ zanieczyszczeń rośnie nieliniowo, a powyżej PM2.5 > 50 powinien szybciej narastać.`,
        descriptor: describeRespiratoryLoadIndex(respiratoryLoad),
        scaleLabel: 'Norma',
        min: 0.5,
        max: 6,
        idealMin: 1,
        idealMax: 2.5,
      },
      {
        id: 'source-attribution',
        title: 'Klasyfikacja źródła emisji',
        shortLabel: 'ENS160 Source',
        value: sourceRatio,
        unit: '',
        precision: 3,
        formula: 'Stosunek źródła: $R = TVOC / eCO_2$',
        helper: sourceRatio == null
          ? 'Wymagane są jednocześnie TVOC i eCO2.'
          : `TVOC/eCO2 = ${sourceRatio.toFixed(3)}. Niska wartość zwykle oznacza źródło metaboliczne, a nie chemiczne.`,
        descriptor: describeEns160SourceAttribution(sourceRatio),
        scaleLabel: 'Próg metaboliczny',
        min: 0,
        max: 0.6,
        idealMin: 0,
        idealMax: 0.25,
      },
      {
        id: 'barometric-trend',
        title: 'Trend barometryczny',
        shortLabel: 'BMP280',
        value: barometricTrend.deltaHpa,
        unit: 'hPa/3h',
        precision: 1,
        formula: 'Trend 3h: $\\Delta P = P_t - P_{t-3h}$',
        helper: barometricTrend.deltaHpa == null
          ? 'Wymagany jest aktualny odczyt ciśnienia oraz co najmniej jeden punkt wsteczny z ostatnich 3 godzin.'
          : `Zmiana ciśnienia o ${barometricTrend.deltaHpa.toFixed(1)} hPa w 3 godziny pozwala ocenić kierunek lokalnej pogody.`,
        descriptor: barometricTrend.descriptor,
        scaleLabel: 'Stabilność',
        min: -5,
        max: 5,
        idealMin: -0.5,
        idealMax: 0.5,
      },
      {
        id: 'pm-hygroscopic-correction',
        title: 'Korekta higroskopijna PM',
        shortLabel: 'PMS5003 x AHT21',
        value: hygroscopicCorrection.correctedPm25,
        unit: 'µg/m³',
        precision: 1,
        formula: 'Korekta wilgotności: $PM_{2.5}^{corr} = PM_{2.5} \\cdot (1 - C_{RH})$ (przybliżenie)',
        helper: hygroscopicCorrection.correctedPm25 == null
          ? 'Wymagane są jednocześnie PM2.5 i wilgotność względna.'
          : `Wilgotność obniżyła wynik o ${hygroscopicCorrection.reductionPercent?.toFixed(0) ?? '0'}%, więc pokazujemy ${hygroscopicCorrection.correctedPm25.toFixed(1)} µg/m³ jako bliższy rzeczywistości odczyt. Najdokładniejszy model korekty jest nieliniowy: 1 / (1 - RH/100), a wzór liniowy jest dobrym przybliżeniem dla 30–60% RH.`,
        descriptor: hygroscopicCorrection.descriptor,
        scaleLabel: 'WHO',
        min: 0,
        max: 40,
        idealMin: 0,
        idealMax: 15,
      },
    ];
  }, [ens160Live.data, historyData.points, liveRecord, pmsRaw, thermal]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const desktopQuery = window.matchMedia('(min-width: 961px)');

    const updateDesktopMotion = () => {
      setDesktopMotionEnabled(motionEnabled && desktopQuery.matches);
    };

    updateDesktopMotion();

    desktopQuery.addEventListener('change', updateDesktopMotion);

    return () => {
      desktopQuery.removeEventListener('change', updateDesktopMotion);
    };
  }, [motionEnabled]);

  useEffect(() => {
    return () => {
      if (detailRevealTimeoutRef.current != null) {
        window.clearTimeout(detailRevealTimeoutRef.current);
      }
      detailEnterAnimationRef.current?.cancel();
    };
  }, []);

  useLayoutEffect(() => {
    if (!desktopMotionEnabled || !detailCardId) {
      return;
    }

    const detailElement = detailCardRefs.current[detailCardId];
    if (!detailElement || typeof detailElement.animate !== 'function') {
      return;
    }

    const direction = detailEntranceDirectionRef.current;
    const travel = computeOffscreenTravel(detailElement, direction, window.innerWidth);

    detailEnterAnimationRef.current?.cancel();
    detailElement.classList.add('analysis-card-animating');

    const animation = detailElement.animate(
      [
        { transform: `translate3d(${direction * travel}px, 0, 0) scale(0.93)`, opacity: 0 },
        { transform: `translate3d(${direction * 16}px, 0, 0) scale(0.985)`, opacity: 0.94, offset: 0.72 },
        { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
      ],
      {
        duration: DETAIL_ENTER_DURATION_MS,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both',
      },
    );

    detailEnterAnimationRef.current = animation;

    void animation.finished
      .catch(() => undefined)
      .finally(() => {
        detailElement.classList.remove('analysis-card-animating');
        if (detailEnterAnimationRef.current === animation) {
          detailEnterAnimationRef.current = null;
        }
        setDetailCardId(null);
      });

    return () => {
      animation.cancel();
      detailElement.classList.remove('analysis-card-animating');
      if (detailEnterAnimationRef.current === animation) {
        detailEnterAnimationRef.current = null;
      }
    };
  }, [detailCardId, desktopMotionEnabled]);

  const registerCardRef = useCallback(
    (cardId: string) => (element: HTMLElement | null) => {
      cardRefs.current[cardId] = element;
    },
    [],
  );

  const registerDetailCardRef = useCallback(
    (cardId: string) => (element: HTMLElement | null) => {
      detailCardRefs.current[cardId] = element;
    },
    [],
  );

  const analysisCards = useMemo(() => [...metricCards, ...insightCards], [insightCards, metricCards]);
  const analysisCardIdsKey = useMemo(() => analysisCards.map((card) => card.id).join('|'), [analysisCards]);

  useLayoutEffect(() => {
    if (!desktopMotionEnabled || introPlayedRef.current || detailCardId || flyOutCardId || analysisCards.length === 0) {
      return;
    }

    if (analysisCardIdsKey !== ANALYSIS_CARD_ORDER.join('|')) {
      return;
    }

    const elements = ANALYSIS_CARD_ORDER
      .map((cardId) => cardRefs.current[cardId])
      .filter((element): element is HTMLElement => Boolean(element));

    if (elements.length !== ANALYSIS_CARD_ORDER.length || typeof elements[0].animate !== 'function') {
      introPlayedRef.current = true;
      return;
    }

    introPlayedRef.current = true;
    introRunningFrameRef.current = window.requestAnimationFrame(() => {
      introRunningFrameRef.current = null;
      setIntroRunning(true);
    });

    const viewportWidth = typeof window === 'undefined' ? 1200 : window.innerWidth;
    const animations = elements.map((element, index) => {
      const direction = index % 2 === 0 ? -1 : 1;
      const travel = computeOffscreenTravel(element, direction, viewportWidth);

      element.classList.add('analysis-card-animating');

      return element.animate(
        [
          { transform: `translate3d(${direction * travel}px, 0, 0) scale(0.86)`, opacity: 0 },
          { transform: `translate3d(${direction * 16}px, 0, 0) scale(0.94)`, opacity: 0.92, offset: 0.68 },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        ],
        {
          duration: INTRO_DURATION_MS,
          delay: index * INTRO_STAGGER_MS,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'both',
        },
      );
    });

    let cancelled = false;

    void Promise.all(animations.map((animation) => animation.finished.catch(() => undefined))).then(() => {
      if (cancelled) {
        return;
      }

      elements.forEach((element) => {
        element.classList.remove('analysis-card-animating');
        element.style.removeProperty('transform');
        element.style.removeProperty('opacity');
      });

      setIntroRunning(false);
    });

    return () => {
      cancelled = true;
      if (introRunningFrameRef.current != null) {
        window.cancelAnimationFrame(introRunningFrameRef.current);
        introRunningFrameRef.current = null;
      }
      animations.forEach((animation) => animation.cancel());
      elements.forEach((element) => {
        element.classList.remove('analysis-card-animating');
        element.style.removeProperty('transform');
        element.style.removeProperty('opacity');
      });
      setIntroRunning(false);
    };
  }, [analysisCardIdsKey, analysisCards.length, detailCardId, desktopMotionEnabled, flyOutCardId]);

  const recommendations = useMemo(() => {
    if (!thermal) {
      return [
        'Po otrzymaniu pierwszej próbki LIVE strona automatycznie policzy wskaźniki fizyczne.',
        'Weryfikacja Heat Index uruchamia się dopiero przy T ≥ 27°C i RH ≥ 40%.',
        'AH i punkt rosy są liczone zawsze, jeśli RH > 0%.',
      ];
    }

    const next: string[] = [];

    if (thermal.absoluteHumidityGm3 != null) {
      if (thermal.absoluteHumidityGm3 < 5) {
        next.push('Powietrze jest suche. Rozważ nawilżanie lub mniejszą intensywność wentylacji.');
      } else if (thermal.absoluteHumidityGm3 > 15) {
        next.push('AH przekracza 15 g/m³. Warto zwiększyć wymianę powietrza.');
      } else {
        next.push('AH mieści się w zalecanym zakresie 5–15 g/m³.');
      }
    }

    if (thermal.dewPointC != null && thermal.dewPointC > 18) {
      next.push('Wysoki punkt rosy może powodować uczucie duszności.');
    }

    if (thermal.heatIndexC != null && thermal.heatIndexC >= 32) {
      next.push('Heat Index wskazuje wysokie obciążenie cieplne. Ogranicz wysiłek.');
    } else {
      next.push('Heat Index pozostaje pod kontrolą lub model nie jest aktywny.');
    }

    if (thermal.humidex != null && thermal.humidex >= 40) {
      next.push('Humidex > 40: priorytetem jest chłodzenie i nawodnienie.');
    }

    return next.slice(0, 3);
  }, [thermal]);

  const handleCardClick = useCallback(
    (cardId: string) => {
      if (flyOutCardId || detailCardId || introRunning) {
        return;
      }

      if (!desktopMotionEnabled) {
        setOpenDetailIds((previous) => new Set(previous).add(cardId));
        setDetailCardId(cardId);
        setFlyOutCardId(null);
        return;
      }

      const cardElement = cardRefs.current[cardId];
      if (!cardElement || typeof cardElement.animate !== 'function') {
        setDetailCardId(cardId);
        return;
      }

      const cardIndex = Math.max(0, ANALYSIS_CARD_ORDER.indexOf(cardId as (typeof ANALYSIS_CARD_ORDER)[number]));
      const direction = cardIndex % 2 === 0 ? -1 : 1;
      detailEntranceDirectionRef.current = direction;
      const travel = computeOffscreenTravel(cardElement, direction, window.innerWidth);

      setFlyOutCardId(cardId);
      cardElement.classList.add('analysis-card-animating');

      const animation = cardElement.animate(
        [
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
          { transform: `translate3d(${direction * travel}px, 0, 0) scale(0.86)`, opacity: 0 },
        ],
        {
          duration: FLYOUT_DURATION_MS,
          easing: 'cubic-bezier(0.4, 0, 1, 1)',
          fill: 'both',
        },
      );

      void animation.finished
        .then(() => {
          detailRevealTimeoutRef.current = window.setTimeout(() => {
            setOpenDetailIds((previous) => new Set(previous).add(cardId));
            setDetailCardId(cardId);
            setFlyOutCardId((current) => (current === cardId ? null : current));
            detailRevealTimeoutRef.current = null;
          }, DETAIL_APPEAR_DELAY_MS);
        })
        .catch(() => {
          if (detailRevealTimeoutRef.current != null) {
            window.clearTimeout(detailRevealTimeoutRef.current);
            detailRevealTimeoutRef.current = null;
          }
          cardElement.classList.remove('analysis-card-animating');
          cardElement.style.removeProperty('transform');
          cardElement.style.removeProperty('opacity');
          setFlyOutCardId((current) => (current === cardId ? null : current));
        });
    },
    [desktopMotionEnabled, detailCardId, flyOutCardId, introRunning],
  );

  const closeDetailCard = (cardId: string) => {
    if (detailRevealTimeoutRef.current != null) {
      window.clearTimeout(detailRevealTimeoutRef.current);
      detailRevealTimeoutRef.current = null;
    }

    setOpenDetailIds((previous) => {
      const updated = new Set(previous);
      updated.delete(cardId);
      return updated;
    });
    setDetailCardId((current) => (current === cardId ? null : current));
    setFlyOutCardId((current) => (current === cardId ? null : current));
  };

  const scoreStyle = useMemo<CSSProperties>(() => {
    if (!score) {
      return { '--score': '0' } as CSSProperties;
    }

    return { '--score': String(score.score) } as CSSProperties;
  }, [score]);

  const cockpitStyle = useMemo<CSSProperties>(() => {
    if (!thermal) {
      return {
        '--map-x': '50%',
        '--map-y': '50%',
        '--temp-fill': '0%',
        '--rh-fill': '0%',
        '--vapor-fill': '0%',
      } as CSSProperties;
    }

    return {
      '--map-x': `${toPercent(thermal.temperatureC, 10, 36)}%`,
      '--map-y': `${toPercent(thermal.relativeHumidity, 20, 90)}%`,
      '--temp-fill': `${toPercent(thermal.temperatureC, 10, 36)}%`,
      '--rh-fill': `${toPercent(thermal.relativeHumidity, 0, 100)}%`,
      '--vapor-fill': `${toPercent(thermal.actualVaporPressureHpa ?? 0, 0, 40)}%`,
    } as CSSProperties;
  }, [thermal]);

  const updatedLabel = liveRecord ? formatDateTime(toEpochMs(liveRecord.ts)) : '--';
  const interactionLocked = introRunning || flyOutCardId !== null || detailCardId !== null;

  return (
    <main className="app-shell analysis-shell">
      <section className="panel analysis-hero">
        <div className="analysis-hero-main">
          <p className="analysis-eyebrow mono">TRYB LAB / ANALIZA MIKROKLIMATU</p>
          <h2>Algorytmiczna analiza warunków fizycznych</h2>
          <p className="analysis-lead">
            Oddzielny moduł analityczny oparty na pomiarach temperatury i wilgotności. Liczy punkt rosy,
            humidex, Heat Index NWS oraz absolutną wilgotność z aktualnych danych LIVE.
          </p>
          <div className="analysis-methods" aria-label="Zastosowane metody">
            <span>Alduchov/Eskridge 1996</span>
            <span>Humidex: para rzeczywista i indeks komfortu</span>
            <span>Rothfusz NWS 1990</span>
            <span>AH w g/m³</span>
          </div>
        </div>

        <div className="analysis-hero-side">
          <button className="ghost-btn" type="button" onClick={onBack}>
            ← Powrót do dashboardu
          </button>

          <div className={`analysis-connection ${connectionStatus}`} role="status" aria-live="polite">
            <span className="analysis-connection-dot" aria-hidden="true"></span>
            <span>{connectionLabel(connectionStatus)}</span>
          </div>

          <p className="analysis-status-line">{loadStateLabel(loadState)}</p>
          <p className="analysis-status-line">Ostatnia próbka: {updatedLabel}</p>
          <p className="analysis-status-line mono">
            Wejście: T={liveRecord ? `${liveRecord.t.toFixed(1)}°C` : '--'}, RH={liveRecord ? Math.round(liveRecord.h) : '--'}%, P={liveRecord ? Math.round(liveRecord.p) : '--'} hPa
          </p>
        </div>
      </section>

      {thermal && score ? (
        <>
          <section className={`panel analysis-score-panel ${toneClass(score.tone)}`}>
            <div>
              <p className="analysis-score-kicker">Syntetyczna ocena mikroklimatu</p>
              <h3>{score.label}</h3>
              <p className="analysis-score-desc">
                Wynik łączy punkt rosy, humidex, AH i Heat Index (gdy model NWS jest aktywny). Im wyższa wartość,
                tym bardziej stabilne warunki wewnątrz pomieszczenia.
              </p>
            </div>

            <div className={`analysis-score-gauge ${toneClass(score.tone)}`} style={scoreStyle}>
              <span className="analysis-score-value mono">{score.score}</span>
              <span className="analysis-score-unit">/100</span>
            </div>

            <div className="analysis-vapor-cards">
              <article>
                <p className="label">Para nasycona</p>
                <p className="value mono">{thermal.saturationVaporPressureHpa.toFixed(2)} hPa</p>
              </article>
              <article>
                <p className="label">Para rzeczywista</p>
                <p className="value mono">{thermal.actualVaporPressureHpa != null ? thermal.actualVaporPressureHpa.toFixed(2) : '--'} hPa</p>
              </article>
            </div>
          </section>

          <section className="analysis-grid" aria-label="Wskaźniki fizyczne">
            {metricCards.map((card) => {
              const isDetail = openDetailIds.has(card.id);
              const cardClasses = !interactionLocked ? 'analysis-card-clickable' : '';

              if (isDetail) {
                return (
                  <AnalysisDetailCard
                    key={card.id}
                    metric={card}
                    onClose={() => closeDetailCard(card.id)}
                    cardRef={registerDetailCardRef(card.id)}
                  />
                );
              }

              return (
                <AnalysisMetricCard
                  key={card.id}
                  metric={card}
                  onSelect={!interactionLocked ? () => handleCardClick(card.id) : undefined}
                  additionalClass={cardClasses}
                  cardRef={registerCardRef(card.id)}
                />
              );
            })}
          </section>

          <section className="analysis-grid analysis-grid--secondary" aria-label="Wskaźniki rozszerzone">
            {insightCards.map((card) => {
              const isDetail = openDetailIds.has(card.id);
              const cardClasses = !interactionLocked ? 'analysis-card-clickable' : '';

              if (isDetail) {
                return (
                  <AnalysisDetailCard
                    key={card.id}
                    metric={card}
                    onClose={() => closeDetailCard(card.id)}
                    cardRef={registerDetailCardRef(card.id)}
                  />
                );
              }

              return (
                <AnalysisMetricCard
                  key={card.id}
                  metric={card}
                  onSelect={!interactionLocked ? () => handleCardClick(card.id) : undefined}
                  additionalClass={cardClasses}
                  cardRef={registerCardRef(card.id)}
                />
              );
            })}
          </section>

          <section className="panel analysis-cockpit" style={cockpitStyle}>
            <article className="analysis-map-board">
              <p className="analysis-card-kicker mono">Macierz komfortu</p>
              <h3>Mapa T × RH</h3>
              <p className="analysis-map-desc">
                Kropka LIVE pokazuje aktualne położenie temperatury i wilgotności względnej na siatce stref
                komfortu.
              </p>

              <div className="analysis-map-grid" role="img" aria-label="Mapa temperatury i wilgotnosci">
                <span className="analysis-map-zone zone-cool">Chłodno / wilgotno</span>
                <span className="analysis-map-zone zone-dry">Sucho</span>
                <span className="analysis-map-zone zone-wet">Mokro</span>
                <span className="analysis-map-zone zone-hot">Gorąco</span>
                <span className="analysis-map-zone zone-comfort">Komfort</span>
                <span className="analysis-map-point" aria-hidden="true"></span>
              </div>

              <p className="analysis-map-meta mono">
                X: {thermal.temperatureC.toFixed(1)}°C | Y: {Math.round(thermal.relativeHumidity)}%
              </p>
            </article>

            <article className="analysis-signal-board">
              <p className="analysis-card-kicker mono">Kanały sygnałowe</p>
              <h3>Kanały wejścia i pary</h3>

              <div className="analysis-signal-list" aria-label="Kanały pomiarowe">
                <div className="analysis-signal-row">
                  <div className="analysis-signal-head">
                    <span>Temperatura</span>
                    <strong className="mono">{formatMetricWithUnit(thermal.temperatureC, 1, '°C')}</strong>
                  </div>
                  <div className="analysis-signal-track temp">
                    <span></span>
                  </div>
                </div>

                <div className="analysis-signal-row">
                  <div className="analysis-signal-head">
                    <span>Wilgotność względna</span>
                    <strong className="mono">{formatMetricWithUnit(Math.round(thermal.relativeHumidity), 0, '%')}</strong>
                  </div>
                  <div className="analysis-signal-track rh">
                    <span></span>
                  </div>
                </div>

                <div className="analysis-signal-row">
                  <div className="analysis-signal-head">
                    <span>Para rzeczywista</span>
                    <strong className="mono">{formatMetricWithUnit(thermal.actualVaporPressureHpa, 2, 'hPa')}</strong>
                  </div>
                  <div className="analysis-signal-track vapor">
                    <span></span>
                  </div>
                </div>
              </div>
            </article>
          </section>

          <section className="panel analysis-actions">
            <h3>Rekomendacje operacyjne</h3>
            <ul>
              {recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <section className="panel analysis-empty" aria-live="polite">
          <h3>Moduł gotowy, czeka na próbkę LIVE</h3>
          <p>
            Po otrzymaniu danych temperatura i wilgotność strona natychmiast policzy wszystkie wskaźniki fizyczne.
          </p>
          <div className="analysis-empty-grid">
            <article>
              <h4>Punkt rosy</h4>
              <p>Alduchov/Eskridge 1996, dokładność około 0,1°C dla −40–60°C.</p>
            </article>
            <article>
              <h4>Humidex</h4>
              <p>Wyliczany z pary rzeczywistej i temperatury do indeksu odczuwalnego.</p>
            </article>
            <article>
              <h4>Heat Index NWS</h4>
              <p>Regresja Rothfusza, aktywna dla T ≥ 27°C i RH ≥ 40%.</p>
            </article>
            <article>
              <h4>Absolutna wilgotność</h4>
              <p>Wynik w g/m³, docelowy zakres pomieszczeń: 5–15 g/m³.</p>
            </article>
          </div>
        </section>
      )}
    </main>
  );
}

export default AnalysisPage;
