const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04;
const MAGNUS_BASE_PRESSURE_HPA = 6.112;

const HUMIDITY_MIN = 0;
const HUMIDITY_MAX = 100;
const HUMIDEX_COEFF = 5 / 9;

const HEAT_INDEX_MIN_TEMP_C = 27;
const HEAT_INDEX_MIN_RH = 40;

const CELSIUS_TO_FAHRENHEIT = 9 / 5;
const FAHRENHEIT_OFFSET = 32;

export type ComfortTone = 'good' | 'warn' | 'danger' | 'info' | 'muted';

export interface ThermalInput {
  temperatureC: number;
  relativeHumidity: number;
}

export interface ThermalMetrics {
  temperatureC: number;
  relativeHumidity: number;
  saturationVaporPressureHpa: number;
  actualVaporPressureHpa: number | null;
  dewPointC: number | null;
  humidex: number | null;
  heatIndexC: number | null;
  absoluteHumidityGm3: number | null;
}

export interface ComfortDescriptor {
  tone: ComfortTone;
  label: string;
  detail: string;
}

export interface ComfortScore {
  score: number;
  label: string;
  tone: ComfortTone;
}

export interface AirQualityInput {
  pm25: number | null;
  eco2: number | null;
  tvoc: number | null;
}

export interface MicroclimateInput {
  thermal: ThermalMetrics | null;
  airQuality: AirQualityInput;
  pressureDelta: number | null;
}

interface Subindex {
  score: number;
  weight: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundTo(value: number, precision: number): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function toFahrenheit(celsius: number): number {
  return celsius * CELSIUS_TO_FAHRENHEIT + FAHRENHEIT_OFFSET;
}

function toCelsius(fahrenheit: number): number {
  return (fahrenheit - FAHRENHEIT_OFFSET) / CELSIUS_TO_FAHRENHEIT;
}

function sanitizeHumidity(relativeHumidity: number): number {
  if (!Number.isFinite(relativeHumidity)) {
    return Number.NaN;
  }
  if (relativeHumidity < HUMIDITY_MIN || relativeHumidity > HUMIDITY_MAX) {
    return Number.NaN;
  }
  return relativeHumidity;
}

function dewPointCore(temperatureC: number, relativeHumidity: number): number | null {
  if (relativeHumidity <= 0 || !Number.isFinite(temperatureC)) {
    return null;
  }
  const rhFraction = relativeHumidity * 0.01;
  const gamma = Math.log(rhFraction) + (MAGNUS_A * temperatureC) / (MAGNUS_B + temperatureC);
  return (MAGNUS_B * gamma) / (MAGNUS_A - gamma);
}

export function saturationVaporPressureHpa(temperatureC: number): number {
  return MAGNUS_BASE_PRESSURE_HPA * Math.exp((MAGNUS_A * temperatureC) / (MAGNUS_B + temperatureC));
}

export function actualVaporPressureHpa(temperatureC: number, relativeHumidity: number): number | null {
  if (!Number.isFinite(temperatureC)) {
    return null;
  }
  const rh = sanitizeHumidity(relativeHumidity);
  if (!Number.isFinite(rh)) {
    return null;
  }
  const saturation = saturationVaporPressureHpa(temperatureC);
  return saturation * (rh * 0.01);
}

export function dewPointAlduchovEskridge(temperatureC: number, relativeHumidity: number): number | null {
  if (!Number.isFinite(temperatureC)) {
    return null;
  }
  const rh = sanitizeHumidity(relativeHumidity);
  if (!Number.isFinite(rh)) {
    return null;
  }
  return dewPointCore(temperatureC, rh);
}

export function humidexFromTempRh(temperatureC: number, relativeHumidity: number): number | null {
  if (!Number.isFinite(temperatureC) || temperatureC < 20.0) {
    return null;
  }
  const vaporPressure = actualVaporPressureHpa(temperatureC, relativeHumidity);
  if (vaporPressure == null) {
    return null;
  }
  return temperatureC + HUMIDEX_COEFF * (vaporPressure - 10);
}

export function heatIndexNwsRothfusz(temperatureC: number, relativeHumidity: number): number | null {
  if (!Number.isFinite(temperatureC)) {
    return null;
  }
  const rh = sanitizeHumidity(relativeHumidity);
  if (!Number.isFinite(rh) || temperatureC < HEAT_INDEX_MIN_TEMP_C || rh < HEAT_INDEX_MIN_RH) {
    return null;
  }
  const temperatureF = toFahrenheit(temperatureC);
  const temperatureFSquared = temperatureF * temperatureF;
  const rhSquared = rh * rh;
  let heatIndexF = -42.379
    + 2.04901523 * temperatureF
    + 10.14333127 * rh
    - 0.22475541 * temperatureF * rh
    - 0.00683783 * temperatureFSquared
    - 0.05481717 * rhSquared
    + 0.00122874 * temperatureFSquared * rh
    + 0.00085282 * temperatureF * rhSquared
    - 0.00000199 * temperatureFSquared * rhSquared;
  if (rh > 85 && temperatureF >= 80 && temperatureF <= 87) {
    const adjustment = ((rh - 85) * 0.1) * ((87 - temperatureF) * 0.2);
    heatIndexF += adjustment;
  }
  return toCelsius(heatIndexF);
}

export function absoluteHumidityFromTempRh(temperatureC: number, relativeHumidity: number): number | null {
  if (!Number.isFinite(temperatureC)) {
    return null;
  }
  const vaporPressure = actualVaporPressureHpa(temperatureC, relativeHumidity);
  if (vaporPressure == null) {
    return null;
  }
  const Tk = 273.15 + temperatureC;
  if (Tk <= 0) {
    return null;
  }
  return (216.7 * vaporPressure) / Tk;
}

export function computeThermalMetrics(input: ThermalInput): ThermalMetrics | null {
  if (!Number.isFinite(input.temperatureC)) {
    return null;
  }
  const rh = sanitizeHumidity(input.relativeHumidity);
  if (!Number.isFinite(rh)) {
    return null;
  }
  const saturation = saturationVaporPressureHpa(input.temperatureC);
  const actual = saturation * (rh * 0.01);
  const dewPoint = dewPointCore(input.temperatureC, rh);
  const humidex = input.temperatureC < 20.0 ? null : input.temperatureC + HUMIDEX_COEFF * (actual - 10);
  const Tk = 273.15 + input.temperatureC;
  const absoluteHumidity = Tk <= 0 ? null : (216.7 * actual) / Tk;
  return {
    temperatureC: input.temperatureC,
    relativeHumidity: rh,
    saturationVaporPressureHpa: saturation,
    actualVaporPressureHpa: actual,
    dewPointC: dewPoint,
    humidex,
    heatIndexC: heatIndexNwsRothfusz(input.temperatureC, rh),
    absoluteHumidityGm3: absoluteHumidity,
  };
}

export function describeDewPoint(value: number | null): ComfortDescriptor {
  if (value == null) {
    return {
      tone: 'muted',
      label: 'Brak danych',
      detail: 'Wymagane RH > 0%.',
    };
  }
  if (value < 0) {
    return { tone: 'info', label: 'Suche', detail: 'Powietrze jest bardzo suche.' };
  }
  if (value < 10) {
    return { tone: 'info', label: 'Chlodne', detail: 'Suche i lekkie odczucie.' };
  }
  if (value <= 16) {
    return { tone: 'good', label: 'Komfort', detail: 'Zakres zwykle odczuwany jako komfortowy.' };
  }
  if (value <= 18) {
    return { tone: 'warn', label: 'Lepko', detail: 'Odczuwalny wzrost wilgoci.' };
  }
  if (value <= 21) {
    return { tone: 'warn', label: 'Duszno', detail: 'Wysoka wilgotnosc odczuwalna.' };
  }
  return { tone: 'danger', label: 'Bardzo duszno', detail: 'Zwiekszone ryzyko dyskomfortu cieplnego.' };
}

export function describeHumidex(value: number | null): ComfortDescriptor {
  if (value == null) {
    return {
      tone: 'muted',
      label: 'Brak danych',
      detail: 'Humidex wymaga T i RH.',
    };
  }
  if (value < 20) {
    return { tone: 'info', label: 'Chlodno', detail: 'Niski poziom dyskomfortu.' };
  }
  if (value < 30) {
    return { tone: 'good', label: 'Komfort', detail: 'Warunki odczuwalne jako wygodne.' };
  }
  if (value < 40) {
    return { tone: 'warn', label: 'Niekomfortowo', detail: 'Odczuwalne cieplo i wilgoc.' };
  }
  if (value < 46) {
    return { tone: 'danger', label: 'Duzy dyskomfort', detail: 'Ogranicz intensywny wysilek.' };
  }
  return { tone: 'danger', label: 'Niebezpiecznie', detail: 'Ryzyko przeciazenia cieplnego.' };
}

export function describeHeatIndex(value: number | null): ComfortDescriptor {
  if (value == null) {
    return {
      tone: 'muted',
      label: 'N/A',
      detail: 'Wzorzec NWS aktywny dopiero dla T >= 27 C i RH >= 40%.',
    };
  }
  if (value < 27) {
    return { tone: 'good', label: 'Niski', detail: 'Niskie obciazenie cieplne.' };
  }
  if (value < 32) {
    return { tone: 'warn', label: 'Caution', detail: 'Mozliwy dyskomfort przy dluzszym wysilku.' };
  }
  if (value < 41) {
    return { tone: 'warn', label: 'Extreme Caution', detail: 'Wysokie obciazenie cieplne.' };
  }
  if (value < 54) {
    return { tone: 'danger', label: 'Danger', detail: 'Ryzyko skurczy i wyczerpania cieplnego.' };
  }
  return { tone: 'danger', label: 'Extreme Danger', detail: 'Wysokie ryzyko udaru cieplnego.' };
}

export function describeAbsoluteHumidity(value: number | null): ComfortDescriptor {
  if (value == null) {
    return {
      tone: 'muted',
      label: 'Brak danych',
      detail: 'AH wymaga T i RH.',
    };
  }
  if (value < 5) {
    return { tone: 'warn', label: 'Za sucho', detail: 'Ponizej zakresu 5-15 g/m3.' };
  }
  if (value <= 15) {
    return { tone: 'good', label: 'Docelowo', detail: 'W zalecanym zakresie dla pomieszczen.' };
  }
  if (value <= 20) {
    return { tone: 'warn', label: 'Wilgotno', detail: 'Powyzej komfortu w pomieszczeniu.' };
  }
  return { tone: 'danger', label: 'Bardzo wilgotno', detail: 'Zwiekszone ryzyko kondensacji i dyskomfortu.' };
}

function subindexFromBreakpoints(value: number, breakpoints: Array<{ max: number; score: number }>): number {
  let prev = breakpoints[0];
  for (const point of breakpoints.slice(1)) {
    if (value <= point.max) {
      const t = (value - prev.max) / (point.max - prev.max);
      return roundTo(prev.score + t * (point.score - prev.score), 2);
    }
    prev = point;
  }
  return breakpoints[breakpoints.length - 1].score;
}

function computePm25Subindex(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const bps = [
    { max: 15, score: 100 },
    { max: 35, score: 75 },
    { max: 55, score: 50 },
    { max: 150, score: 25 },
    { max: 250, score: 0 },
    { max: Infinity, score: 0 },
  ];
  return subindexFromBreakpoints(value, bps);
}

function computeEco2Subindex(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const bps = [
    { max: 600, score: 100 },
    { max: 800, score: 85 },
    { max: 1000, score: 60 },
    { max: 1500, score: 30 },
    { max: Infinity, score: 0 },
  ];
  return subindexFromBreakpoints(value, bps);
}

function computeTvocSubindex(value: number | null): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) {
    return null;
  }
  const bps = [
    { max: 200, score: 100 },
    { max: 500, score: 75 },
    { max: 1000, score: 40 },
    { max: Infinity, score: 0 },
  ];
  return subindexFromBreakpoints(value, bps);
}

function computePressureSubindex(deltaHpa: number | null): number | null {
  if (deltaHpa == null || !Number.isFinite(deltaHpa)) {
    return null;
  }
  const abs = Math.abs(deltaHpa);
  if (abs <= 0.5) return 100;
  if (abs <= 1) return 85;
  if (abs <= 2) return 60;
  if (abs <= 4) return 30;
  return 0;
}

function rangeScore(value: number, hardMin: number, idealMin: number, idealMax: number, hardMax: number): number {
  if (value >= idealMin && value <= idealMax) {
    return 1;
  }
  if (value < idealMin) {
    return clamp((value - hardMin) / (idealMin - hardMin), 0, 1);
  }
  return clamp((hardMax - value) / (hardMax - idealMax), 0, 1);
}

const P_NORM_P = 2;

export function computeComfortScore(input: MicroclimateInput): ComfortScore {
  const subs: Subindex[] = [];

  if (input.thermal) {
    const { dewPointC, humidex, absoluteHumidityGm3, heatIndexC } = input.thermal;
    if (dewPointC != null) {
      subs.push({ score: roundTo(rangeScore(dewPointC, -15, 10, 16, 26) * 100, 2), weight: 0.10 });
    }
    if (humidex != null) {
      subs.push({ score: roundTo(rangeScore(humidex, 10, 20, 29, 48) * 100, 2), weight: 0.08 });
    }
    if (absoluteHumidityGm3 != null) {
      subs.push({ score: roundTo(rangeScore(absoluteHumidityGm3, 0, 5, 15, 22) * 100, 2), weight: 0.12 });
    }
    if (heatIndexC != null) {
      subs.push({ score: roundTo(rangeScore(heatIndexC, 20, 23, 31, 54) * 100, 2), weight: 0.10 });
    }
  }

  const pm25 = computePm25Subindex(input.airQuality.pm25);
  const eco2 = computeEco2Subindex(input.airQuality.eco2);
  const tvoc = computeTvocSubindex(input.airQuality.tvoc);
  const pressure = computePressureSubindex(input.pressureDelta);

  if (pm25 != null) subs.push({ score: pm25, weight: 0.20 });
  if (eco2 != null) subs.push({ score: eco2, weight: 0.15 });
  if (tvoc != null) subs.push({ score: tvoc, weight: 0.15 });
  if (pressure != null) subs.push({ score: pressure, weight: 0.10 });

  const totalWeight = subs.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) {
    return { score: 0, tone: 'muted', label: 'Brak punktow referencyjnych' };
  }

  const weightedLossSum = subs.reduce((sum, s) => sum + s.weight * Math.pow(100 - s.score, P_NORM_P), 0);
  const totalLoss = Math.pow(weightedLossSum / totalWeight, 1 / P_NORM_P);
  const score = Math.round(clamp(100 - totalLoss, 0, 100));

  if (score >= 80) {
    return { score, tone: 'good', label: 'Stabilny mikroklimat' };
  }
  if (score >= 60) {
    return { score, tone: 'info', label: 'Akceptowalne warunki' };
  }
  if (score >= 40) {
    return { score, tone: 'warn', label: 'Potrzebna korekta' };
  }
  return { score, tone: 'danger', label: 'Wysokie obciazenie' };
}
