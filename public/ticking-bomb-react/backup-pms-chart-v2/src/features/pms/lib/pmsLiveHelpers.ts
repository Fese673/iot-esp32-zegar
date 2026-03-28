import type { LoadState, PmsRaw } from '../../../shared/types';

export type PmsParticleKey = '0p3' | '0p5' | '1p0' | '2p5' | '5p0' | '10p0';

export interface PmsParticleRow {
  key: PmsParticleKey;
  fraction: string;
  title: string;
  colorClass: 'good' | 'warn' | 'alert';
  value: number;
  peak: number;
  fill: number;
  severity: 'good' | 'warn' | 'alert';
}

interface ParticleGuide {
  title: string;
  what: string;
  source: string;
  why: string;
  examples: string;
  story: string;
}

const PARTICLE_ROWS = [
  { key: '0p3', fraction: '0.3 μm', title: 'Ultradrobne cząstki', colorClass: 'alert' as const },
  { key: '0p5', fraction: '0.5 μm', title: 'Drobny aerozol', colorClass: 'warn' as const },
  { key: '1p0', fraction: '1.0 μm', title: 'Bin licznika 1.0 μm', colorClass: 'warn' as const },
  { key: '2p5', fraction: '2.5 μm', title: 'PM2.5 orientacyjnie', colorClass: 'good' as const },
  { key: '5p0', fraction: '5.0 μm', title: 'Kurz i bioaerozol', colorClass: 'good' as const },
  { key: '10p0', fraction: '10 μm', title: 'PM10 orientacyjnie', colorClass: 'good' as const },
] as const satisfies Array<{ key: PmsParticleKey; fraction: string; title: string; colorClass: PmsParticleRow['colorClass'] }>;

const PARTICLE_GUIDES: Record<string, ParticleGuide> = {
  '0.3 μm': {
    title: 'Ultradrobne cząsteczki',
    what: 'Ultradrobna frakcja pyłu i aerozoli, najłatwiej przenikająca głęboko do układu oddechowego.',
    source: 'Spaliny, dym, intensywne spalanie oraz bardzo drobne aerozole technologiczne.',
    why: 'To frakcja szczególnie istotna zdrowotnie, bo najłatwiej wchodzi do dolnych dróg oddechowych.',
    examples: 'spaliny diesla, dym papierosowy, smog fotochemiczny, aerozole z kuchni',
    story: 'Najbardziej czuły bin. Gdy rośnie szybciej niż pozostałe, zwykle wskazuje na dym, spaliny albo ultradrobny aerozol.',
  },
  '0.5 μm': {
    title: 'Drobne aerozole',
    what: 'Drobne aerozole i cząstki pośrednie, długo utrzymujące się w powietrzu.',
    source: 'Kondensacja pary, spalanie oraz domowe aerozole w sprayu.',
    why: 'Dobrze pokazuje, czy w pomieszczeniu pojawił się aerozol, odświeżacz lub bardzo drobna sadza.',
    examples: 'odświeżacz, spray, e-papieros, mgła olejowa',
    story: 'To bin często związany z aktywnością w pomieszczeniu. Daje czytelny sygnał o aerozolach i sadzy.',
  },
  '1.0 μm': {
    title: 'Bin licznika 1.0 μm',
    what: 'Frakcja pośrednia licznika cząstek, ważna do oceny składu aerozolu.',
    source: 'Procesy spalania, kondensacja gazów i emisje przemysłowe.',
    why: 'Pokazuje intensywność źródeł spalania i ładunku zanieczyszczeń.',
    examples: 'smog fotochemiczny, opary chemiczne, sadza',
    story: 'Wzrost tego binu zwykle oznacza intensywne spalanie albo aerozol o wysokim ładunku zanieczyszczeń.',
  },
  '2.5 μm': {
    title: 'PM2.5 orientacyjnie',
    what: 'Główny składnik smogu traktowany tu jako wskazówka interpretacyjna.',
    source: 'Niska emisja, piece, kotłownie, starsze silniki Diesla.',
    why: 'To kluczowy wskaźnik pogorszenia jakości powietrza.',
    examples: 'zimowy smog, dym z komina, pył przemysłowy',
    story: 'Jeśli ten bin rośnie, zwykle sygnalizuje realne pogorszenie jakości powietrza w otoczeniu.',
  },
  '5.0 μm': {
    title: 'Kurz i bioaerozol',
    what: 'Frakcja mechaniczna i bioaerozolowa, szybko osiadająca jako kurz.',
    source: 'Ruch w pomieszczeniu, rośliny, zwierzęta domowe i pylenie osadów.',
    why: 'Wskazuje na kurz, alergeny i wzburzone osady.',
    examples: 'roztocza, pyłki, naskórek, kurz z dywanu',
    story: 'Rosnąca wartość często idzie w parze z alergiami albo poruszeniem osadu w pomieszczeniu.',
  },
  '10 μm': {
    title: 'PM10 orientacyjnie',
    what: 'Najgrubsza frakcja, widoczna już jako pył i osad.',
    source: 'Ruch drogowy, budowy, ścieranie mechaniczne, wiatr.',
    why: 'Wiele mówi o kurzu i wzburzonym osadzie, mniej o ultradrobnych emisjach.',
    examples: 'pył drogowy, budowa, piasek, popiół',
    story: 'Ten bin pokazuje głównie kurz mechaniczny. Gdy dominuje, źródło zwykle jest lokalne i widoczne.',
  },
};

function readValue(source: Record<string, unknown>, key: string): number {
  const value = Number(source[key]);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function severityFor(fill: number): PmsParticleRow['severity'] {
  if (fill >= 78) {
    return 'alert';
  }

  if (fill >= 52) {
    return 'warn';
  }

  return 'good';
}

export function severityLabel(fill: number): 'alarm' | 'uwaga' | 'norma' {
  if (fill >= 78) {
    return 'alarm';
  }

  if (fill >= 52) {
    return 'uwaga';
  }

  return 'norma';
}

export function formatParticleCount(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }

  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  }

  return `${Math.round(value)}`;
}

export function rowTitle(key: PmsParticleKey): string {
  return PARTICLE_ROWS.find((item) => item.key === key)?.title ?? 'Nieznana frakcja';
}

export function rowDescription(key: PmsParticleKey): string {
  const label = PARTICLE_ROWS.find((item) => item.key === key)?.fraction;
  return (label && PARTICLE_GUIDES[label]?.what) || 'Brak opisu dla tej frakcji.';
}

export function guideFor(fraction: string): ParticleGuide {
  return PARTICLE_GUIDES[fraction] || {
    title: 'Nieznana frakcja',
    what: 'Brak opisu dla tej frakcji.',
    source: 'Dane do uzupełnienia.',
    why: 'Warto dopisać własne źródło i interpretację.',
    examples: 'kurz, aerozol, pył zawieszony',
    story: 'Ta frakcja może zostać opisana po podpięciu własnej klasyfikacji.',
  };
}

export function extractParticleSource(record: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const candidate = (record.particles ?? record.P ?? record.A ?? record.F ?? record) as unknown;
  return candidate && typeof candidate === 'object' ? candidate as Record<string, unknown> : null;
}

export function extractPmRawLike(record: Record<string, unknown> | null): PmsRaw | null {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const candidates = [record.A, record.F, record.P, record];
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const source = candidate as Record<string, unknown>;
    const pm1 = Number(source.pm1);
    const pm25 = Number(source.pm25);
    const pm10 = Number(source.pm10);

    if ([pm1, pm25, pm10].every(Number.isFinite)) {
      return { pm1, pm25, pm10 };
    }
  }

  return null;
}

export function buildParticleRows(record: Record<string, unknown> | null): PmsParticleRow[] {
  const source = extractParticleSource(record);
  const values = PARTICLE_ROWS.map((row) => (source ? readValue(source, row.key) : 0));
  const peak = Math.max(...values, 1);

  return PARTICLE_ROWS.map((row, index) => {
    const value = values[index];
    const fill = peak > 0 ? Math.min(100, (value / peak) * 100) : 0;

    return {
      ...row,
      value,
      peak,
      fill,
      severity: severityFor(fill),
    };
  });
}

export function getParticleTrendLabel(currentRows: PmsParticleRow[], previousRows: PmsParticleRow[] | null): string {
  if (!previousRows || previousRows.length === 0) {
    return 'stabilnie';
  }

  const currentDominant = currentRows.reduce((best, row) => (row.value > best.value ? row : best), currentRows[0]);
  const previousDominant = previousRows.reduce((best, row) => (row.value > best.value ? row : best), previousRows[0]);
  const delta = currentDominant.value - previousDominant.value;

  if (delta === 0) {
    return 'stabilnie';
  }

  const denom = Math.max(previousDominant.value, 1);
  const pct = Math.round((Math.abs(delta) / denom) * 100);
  return delta > 0 ? `↑ ${pct}%` : `↓ ${pct}%`;
}

export function getParticleStatusLabel(status: LoadState): string {
  if (status === 'loaded') {
    return 'dane live z Firebase';
  }

  if (status === 'empty') {
    return 'brak danych';
  }

  if (status === 'error') {
    return 'błąd odczytu';
  }

  return 'ładowanie';
}