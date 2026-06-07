# AUDYT TECHNICZNY PROJEKTU

Data: 2026-03-31
Repo: ticking-bomb-react

## Zakres i metoda

Audyt obejmowal:
- konfiguracje i tooling (`package.json`, `eslint.config.js`, `tsconfig*.json`, `vite.config.ts`),
- kluczowe moduły runtime (`src/App.tsx`, `src/shared/context/*`, `src/features/**`),
- warstwe styli i animacji (`src/styles.css`, `src/features/analiza/analysis.css`, `src/features/pms/particles/components/PmsParticlesChart.css`),
- testy i ostrzezenia wykonawcze,
- zaleznosci bezpieczenstwa (`npm audit`).

Wykonane komendy kontrolne:
- `npm run lint`
- `npm run test -- --run`
- `npm run build`
- `npm audit --omit=dev --json`

## Executive Summary

Stan projektu jest funkcjonalny (testy i build przechodza), ale quality gate lintera jest obecnie zablokowany przez 5 bledow React Hooks/React Refresh. To jest glowny blocker do utrzymania i CI.

Najwazniejsze wnioski:
- Krytyczne: 5 potwierdzonych bledow lint (ponizej, z lokalizacjami).
- Bezpieczenstwo: 1 podatnosc `moderate` w `katex`.
- Wydajnosc: kilka miejsc z nadmiarowymi sortowaniami i zbyt duzymi komponentami (`AnalysisPage.tsx`, `HistoryChart.tsx`).
- Cleanup: wykryte martwe/duplikowane elementy (placeholder komponent, duplikat hooka, nieuzywane assety, powielone bloki CSS).
- WAAPI: czesc animacji juz jest na WAAPI (modul analizy), ale nadal sa obszary, gdzie migracja poprawi plynność.

## Wyniki komend (fakty)

### 1) Lint

`npm run lint` zwrocil 5 bledow:

1. `react-hooks/preserve-manual-memoization`
   - `src/features/analiza/components/AnalysisPage.tsx:162`
2. `react-hooks/purity` (impure `Date.now()` podczas renderu)
   - `src/features/analiza/components/AnalysisPage.tsx:321`
3. `react-hooks/set-state-in-effect`
   - `src/features/ens160/hooks/useEns160Live.ts:28`
4. `react-hooks/set-state-in-effect`
   - `src/features/pms/hooks/usePmsLive.ts:47`
5. `react-refresh/only-export-components`
   - `src/shared/context/DeviceTelemetryContext.tsx:85`

### 2) Testy

`npm run test -- --run`:
- 19 plikow testowych passed,
- 44 testy passed,
- ostrzezenia deprecacji `ReactDOMTestUtils.act` w testach:
  - `src/features/analiza/components/__tests__/AnalysisPage.test.tsx:3`
  - `src/features/ens160/components/__tests__/Ens160Section.test.tsx:3`

### 3) Build

`npm run build` przechodzi poprawnie.

### 4) Security

`npm audit --omit=dev --json`:
- 1 podatnosc `moderate` w `katex` (wiele advisory GHSA),
- zalecana aktualizacja biblioteki do wersji z poprawkami.

## Krytyczne bledy (do naprawy najpierw)

### CRIT-1: Blokada quality gate przez 5 bledow lint

Pliki:
- `src/features/analiza/components/AnalysisPage.tsx:162`
- `src/features/analiza/components/AnalysisPage.tsx:321`
- `src/features/ens160/hooks/useEns160Live.ts:28`
- `src/features/pms/hooks/usePmsLive.ts:47`
- `src/shared/context/DeviceTelemetryContext.tsx:85`

Dlaczego krytyczne:
- przy standardowym CI z lint gatingiem deployment jest ryzykowny lub blokowany,
- bledy sa systemowe (React Hooks + refresh), nie kosmetyczne.

### CRIT-2: Podatnosc w KaTeX

Plik zaleznosci:
- `package.json` (`katex: ^0.16.9`)

Ryzyko:
- obecna wersja wpada w advisory `moderate` (walidacja/escaping/maxExpand przypadki).

Uwagi:
- formuly obecnie sa glownie statyczne, ale i tak warto podniesc wersje, bo to komponent renderujacy HTML (`dangerouslySetInnerHTML`) w `AnalysisPage`.

## High Priority: refaktor i stabilnosc

### HIGH-1: `AnalysisPage.tsx` jest zbyt duzy i wieloodpowiedzialny

Plik:
- `src/features/analiza/components/AnalysisPage.tsx` (~37 KB)

Objawy:
- obliczenia metryk,
- logika danych,
- animacje WAAPI,
- render wielu sekcji.

Rekomendacja:
- podzielic na mniejsze bloki (`useAnalysisMetrics`, `useAnalysisMotion`, `AnalysisHero`, `AnalysisCards`, `AnalysisCockpit`).

### HIGH-2: Nadmiarowe sortowania i przeksztalcenia danych chartowych

Pliki:
- `src/features/dashboard/components/HistoryChart.tsx`
- `src/shared/lib/chartHelpers.ts`

Objaw:
- punkty sa sortowane wielokrotnie (w tym przy grupowaniu), co przy stalej aktualizacji moze kosztowac CPU.

Rekomendacja:
- utrzymywac dane juz posortowane,
- grupowac bez dodatkowego `sortChartPoints` przy kazdym update,
- zredukowac alokacje tablic w goracych sciezkach.

### HIGH-3: Powielony kod hookow historii

Pliki:
- `src/features/dashboard/hooks/useHistoryData.ts`
- `src/features/pms/hooks/usePmsHistory.ts`
- `src/features/ens160/hooks/useEns160History.ts`

Objaw:
- prawie identyczny mechanizm cache + timeout + fallback.

Rekomendacja:
- wydzielic wspolny hook infrastrukturalny typu `useDayHistoryCacheLoader(...)`.

## Cleanup: konkretna lista do posprzatania

### 1) Martwy placeholder komponent

Plik:
- `src/features/pms/components/Ens160Section.tsx`

Status:
- nie jest uzywany przez runtime (aktywny ENS160 jest w `src/features/ens160/components/Ens160Section.tsx`).

Akcja:
- usunac plik lub jasno oznaczyc jako legacy i wyprowadzic poza runtime.

### 2) Duplikat hooka particles

Pliki:
- `src/features/pms/particles/hooks/useParticlesFrame.ts`
- `src/features/pms/particles/hooks/useParticlesSimulation.ts`

Status:
- `useParticlesSimulation.ts` jest praktycznie duplikatem i nie ma uzyc.

Akcja:
- usunac nieuzywany hook, zostawic jeden kanoniczny.

### 3) Nieuzywane assety w `src/assets`

Pliki:
- `src/assets/hero.png`
- `src/assets/react.svg`
- `src/assets/vite.svg`

Status:
- brak referencji w `src/**` i `index.html`.

Akcja:
- usunac lub udokumentowac cel ich trzymania.

### 4) Powielone bloki CSS

Plik:
- `src/styles.css`

Problem:
- sekcje `.pms-section`, `.pms-inner-panel` i powiazane reguly pojawiaja sie wielokrotnie (duplikacja definicji).

Akcja:
- scalić reguly i zredukowac konfliktowe nadpisania.

### 5) Testy z deprecated `act`

Pliki:
- `src/features/analiza/components/__tests__/AnalysisPage.test.tsx`
- `src/features/ens160/components/__tests__/Ens160Section.test.tsx`

Akcja:
- migracja do `act` z `react` zamiast `react-dom/test-utils`.

## Co przerobic na WAAPI, aby bylo plynniej

## Stan obecny

Juz jest WAAPI:
- `src/features/analiza/components/AnalysisPage.tsx` (animacje kart i flyout).

Nadal CSS-only (kandydaci do WAAPI):
- tytul literowy TopBar (`titleFade` + inline delay),
- wejscie panelu particles (`particles3-rise-in`),
- animacje drawer/backdrop w particles,
- kilka przejsc hover/opacity na duzych blokach.

## Priorytet migracji

### WAAPI-1 (najwyzszy): Tytul TopBar z CSS stagger do WAAPI timeline

Pliki:
- `src/features/dashboard/components/TopBar.tsx`
- `src/styles.css` (sekcja `.title-letter`, `@keyframes titleFade`)

Dlaczego:
- teraz opoznienia sa sterowane inline style per litera,
- WAAPI da lepsza kontrole start/stop/restart i anulowanie przy remountach.

Efekt:
- bardziej przewidywalny lifecycle animacji i mniej repaintow przy zmianach stanu topbara.

### WAAPI-2 (wysoki): particles bar fill z `height` na transform-based WAAPI

Pliki:
- `src/features/pms/particles/components/PmsParticlesChart.css`
- `src/features/pms/particles/components/PmsParticlesChart.tsx`

Dlaczego:
- aktualnie animowane jest `height` + `will-change: height`, co wymusza layout,
- dla plynnosci lepsze jest `transform: scaleY()` na wewnetrznym elemencie (compositor).

Efekt:
- mniej layout thrashingu przy czestych update danych.

### WAAPI-3 (sredni): drawer/backdrop particles

Pliki:
- `src/features/pms/particles/components/PmsParticlesChart.css`

Dlaczego:
- przejscia `transform + opacity` mozna przestawic na WAAPI dla lepszego sterowania stanami i cancel logic.

Efekt:
- bardziej stabilne animacje przy szybkim otwieraniu/zamykaniu.

### WAAPI-4 (techniczny dlug): uporzadkowac obecne WAAPI w AnalysisPage

Plik:
- `src/features/analiza/components/AnalysisPage.tsx`

Dlaczego:
- duze animacje odpalane w `useLayoutEffect` z pomiarami geometrii.

Akcja:
- ograniczyc pomiary,
- tam gdzie mozliwe przeniesc na `useEffect` + `requestAnimationFrame`,
- wydzielic do dedykowanego hooka motion, by unikac regresji.

## Plan refaktoryzacji (kolejnosc)

### Etap 1 (1-2 dni)
- naprawa 5 bledow lint,
- aktualizacja `katex`,
- poprawka deprecacji testowych `act`.

### Etap 2 (2-4 dni)
- cleanup martwych plikow (`pms/components/Ens160Section.tsx`, `useParticlesSimulation.ts`, assety `src/assets/*`),
- deduplikacja `styles.css`.

### Etap 3 (4-7 dni)
- dekompozycja `AnalysisPage.tsx`,
- wspolny mechanizm ladowania historii,
- optymalizacja sortowan chartow.

### Etap 4 (po stabilizacji)
- migracja WAAPI-1 i WAAPI-2,
- pomiar FPS/CPU w DevTools Performance.

## Mierniki sukcesu po wdrozeniu

- `npm run lint` = 0 errors,
- `npm test -- --run` bez warningow deprecacji act,
- `npm audit --omit=dev` bez podatnosci `moderate+` (dla runtime),
- odczuwalnie gladsze animacje przy update LIVE,
- mniejsza zlozonosc kodu i prostszy maintenance.

## Notatka o stanie repo podczas audytu

Repo jest w stanie roboczym z lokalnymi zmianami (dirty worktree). Audyt dotyczy aktualnego stanu plikow i nie cofa zadnych modyfikacji.
