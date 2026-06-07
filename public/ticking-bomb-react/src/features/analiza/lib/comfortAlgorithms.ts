// Alduchov & Eskridge (1996) coefficient set to keep all Magnus-related formulas consistent
const MAGNUS_A = 17.625;
const MAGNUS_B = 243.04;
const MAGNUS_BASE_PRESSURE_HPA = 6.112; // hPa

const HUMIDITY_MIN = 0;
const HUMIDITY_MAX = 100;
const HUMIDEX_COEFF = 5 / 9; // 0.5555... z MSC Canada (dokładniejsza niż 0.5555)

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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

  // Nie klamrujemy cicho ujemnych lub "powyżej" zadanych wartości; informacja o błędnych odczytach musi przejść dalej.
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

  // korekcja przy wysokiej wilgotności, zgodnie z NWS
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

function rangeScore(value: number, hardMin: number, idealMin: number, idealMax: number, hardMax: number): number {
  if (value >= idealMin && value <= idealMax) {
    return 1;
  }

  if (value < idealMin) {
    return clamp((value - hardMin) / (idealMin - hardMin), 0, 1);
  }

  return clamp((hardMax - value) / (hardMax - idealMax), 0, 1);
}

export function computeComfortScore(metrics: ThermalMetrics): ComfortScore {
  const buckets: Array<{ value: number; weight: number; score: number }> = [];

  if (metrics.dewPointC != null) {
    buckets.push({
      value: metrics.dewPointC,
      weight: 0.28,
      score: rangeScore(metrics.dewPointC, -15, 10, 16, 26),
    });
  }

  if (metrics.humidex != null) {
    buckets.push({
      value: metrics.humidex,
      weight: 0.24,
      score: rangeScore(metrics.humidex, 10, 20, 29, 48),
    });
  }

  if (metrics.absoluteHumidityGm3 != null) {
    buckets.push({
      value: metrics.absoluteHumidityGm3,
      weight: 0.3,
      score: rangeScore(metrics.absoluteHumidityGm3, 0, 5, 15, 22),
    });
  }

  if (metrics.heatIndexC != null) {
    buckets.push({
      value: metrics.heatIndexC,
      weight: 0.18,
      score: rangeScore(metrics.heatIndexC, 20, 23, 31, 54),
    });
  }

  const totalWeight = buckets.reduce((sum, bucket) => sum + bucket.weight, 0);
  if (totalWeight === 0) {
    return { score: 0, tone: 'muted', label: 'Brak punktow referencyjnych' };
  }

  const weightedScore = buckets.reduce((sum, bucket) => sum + bucket.score * bucket.weight, 0);
  const score = Math.round((weightedScore / totalWeight) * 100);

  if (score >= 80) {
    return { score, tone: 'good', label: 'Stabilny mikroklimat' };
  }
  if (score >= 60) {
    return { score, tone: 'info', label: 'Akceptowalne warunki' };
  }
  if (score >= 40) {
    return { score, tone: 'warn', label: 'Potrzebna korekta' };
  }

  return { score, tone: 'danger', label: 'Wysokie obciazenie cieplne' };
}
