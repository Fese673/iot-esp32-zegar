import type { ChartPoint } from '../../../shared/types';
import type { ComfortDescriptor } from './comfortAlgorithms';

const ROLLOFF_TOLERANCE_MS = 90 * 60_000;
const BAROMETRIC_LOOKBACK_MS = 3 * 60 * 60_000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function describeNull(detail: string): ComfortDescriptor {
  return {
    tone: 'muted',
    label: 'Brak danych',
    detail,
  };
}

function describeTrend(deltaHpa: number | null): ComfortDescriptor {
  if (deltaHpa == null) {
    return describeNull('Wymagany aktualny pomiar ciśnienia i historia z ostatnich 3 godzin.');
  }

  if (deltaHpa <= -1) {
    return {
      tone: 'warn',
      label: 'Opadający',
      detail: 'Szybki spadek ciśnienia zwykle poprzedza front, zachmurzenie i opady.',
    };
  }

  if (deltaHpa >= 1) {
    return {
      tone: 'good',
      label: 'Rosnący',
      detail: 'Wzrost ciśnienia zwykle oznacza stabilizację pogody w najbliższych godzinach.',
    };
  }

  return {
    tone: 'info',
    label: 'Stabilny',
    detail: 'Zmiana ciśnienia jest niewielka i nie wskazuje jeszcze gwałtownej zmiany pogody.',
  };
}

export function computeRespiratoryLoadIndex(pm25: number | null | undefined, eco2: number | null | undefined, tvoc: number | null | undefined): number | null {
  const finitePm25 = pm25;
  const finiteEco2 = eco2;
  const finiteTvoc = tvoc;

  if (!isFiniteNumber(finitePm25) || !isFiniteNumber(finiteEco2) || !isFiniteNumber(finiteTvoc)) {
    return null;
  }

  const score = 0.8 + finitePm25 * 0.04 + finiteEco2 * 0.001 + finiteTvoc * 0.004;
  return roundTo(score, 2);
}

export function describeRespiratoryLoadIndex(value: number | null): ComfortDescriptor {
  if (value == null) {
    return describeNull('Wymagane jednocześnie PM2.5, eCO2 i TVOC.');
  }

  if (value < 1) {
    return {
      tone: 'info',
      label: 'Bardzo niskie',
      detail: 'Mieszanka zanieczyszczeń nie obciąża jeszcze wyraźnie układu oddechowego.',
    };
  }

  if (value <= 2.5) {
    return {
      tone: 'good',
      label: 'Norma',
      detail: 'Obciążenie pozostaje w bezpiecznej strefie referencyjnej.',
    };
  }

  if (value <= 4) {
    return {
      tone: 'warn',
      label: 'Podwyższony',
      detail: 'Mieszanka pyłów i gazów zaczyna być odczuwalna dla organizmu.',
    };
  }

  return {
    tone: 'danger',
    label: 'Wysoki',
    detail: 'Zanieczyszczenie powietrza jest już wyraźnie uciążliwe dla układu oddechowego.',
  };
}

export function computeEns160SourceRatio(tvoc: number | null | undefined, eco2: number | null | undefined): number | null {
  if (!isFiniteNumber(tvoc) || !isFiniteNumber(eco2) || eco2 <= 0) {
    return null;
  }

  return roundTo(tvoc / eco2, 3);
}

export function describeEns160SourceAttribution(ratio: number | null): ComfortDescriptor {
  if (ratio == null) {
    return describeNull('Wymagane są jednocześnie wartości TVOC i eCO2.');
  }

  if (ratio < 0.25) {
    return {
      tone: 'info',
      label: 'Metaboliczne',
      detail: 'Dominują sygnały oddechowe ludzi i słabsza wentylacja, a nie chemia.',
    };
  }

  if (ratio < 0.45) {
    return {
      tone: 'warn',
      label: 'Mieszane',
      detail: 'Źródło pogorszenia jest częściowo metaboliczne, częściowo chemiczne.',
    };
  }

  return {
    tone: 'danger',
    label: 'Chemiczne',
    detail: 'Wzrasta udział lotnych związków i źródeł technicznych w pomieszczeniu.',
  };
}

function findPressurePoint(points: ChartPoint[], targetTimestamp: number): number | null {
  let bestPoint: ChartPoint | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const point of points) {
    if (point.series !== 'p') {
      continue;
    }

    const distance = Math.abs(point.x - targetTimestamp);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = point;
    }
  }

  if (!bestPoint || bestDistance > ROLLOFF_TOLERANCE_MS) {
    return null;
  }

  return bestPoint.y;
}

export interface BarometricTrendResult {
  deltaHpa: number | null;
  referencePressureHpa: number | null;
  descriptor: ComfortDescriptor;
}

export function computeBarometricTrend(points: ChartPoint[], currentTimestamp: number, currentPressure: number | null | undefined): BarometricTrendResult {
  if (!isFiniteNumber(currentTimestamp) || !isFiniteNumber(currentPressure)) {
    return {
      deltaHpa: null,
      referencePressureHpa: null,
      descriptor: describeTrend(null),
    };
  }

  const referencePressureHpa = findPressurePoint(points, currentTimestamp - BAROMETRIC_LOOKBACK_MS);
  if (referencePressureHpa == null) {
    return {
      deltaHpa: null,
      referencePressureHpa: null,
      descriptor: describeTrend(null),
    };
  }

  const deltaHpa = roundTo(currentPressure - referencePressureHpa, 1);

  return {
    deltaHpa,
    referencePressureHpa: roundTo(referencePressureHpa, 1),
    descriptor: describeTrend(deltaHpa),
  };
}

export interface HygroscopicPmCorrectionResult {
  correctedPm25: number | null;
  reductionPercent: number | null;
  descriptor: ComfortDescriptor;
}

export function computeHygroscopicPmCorrection(pm25: number | null | undefined, relativeHumidity: number | null | undefined): HygroscopicPmCorrectionResult {
  if (!isFiniteNumber(pm25) || !isFiniteNumber(relativeHumidity)) {
    return {
      correctedPm25: null,
      reductionPercent: null,
      descriptor: describeNull('Wymagane są jednocześnie PM2.5 i wilgotność względna.'),
    };
  }

  const reductionPercent = clamp((relativeHumidity - 25) * 1.8, 0, 32);
  const correctedPm25 = roundTo(pm25 * (1 - reductionPercent / 100), 1);

  let descriptor: ComfortDescriptor;
  if (correctedPm25 <= 25) {
    descriptor = {
      tone: 'good',
      label: 'W normie WHO',
      detail: 'Skorygowany wynik mieści się w akceptowalnej strefie referencyjnej.',
    };
  } else if (correctedPm25 <= 35) {
    descriptor = {
      tone: 'warn',
      label: 'Lekko podwyższone',
      detail: 'Po korekcji nadal widać podwyższone stężenie pyłu.',
    };
  } else {
    descriptor = {
      tone: 'danger',
      label: 'Wysokie',
      detail: 'Nawet po korekcji higroskopijnej pyłu jest zbyt dużo.',
    };
  }

  return {
    correctedPm25,
    reductionPercent: roundTo(reductionPercent, 0),
    descriptor,
  };
}