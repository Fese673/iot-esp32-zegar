# Plan refaktoryzacji projektu do React + Vite + TypeScript


---

## Cel dokumentu

Ten dokument opisuje plan refaktoryzacji istniejącego projektu dashboardu IoT do architektury React + Vite + TypeScript.

Dokument jest przygotowany dla agenta AI wykonującego refaktoryzację. Jego głównym celem jest:
- utrzymanie pełnej zgodności funkcjonalnej z obecną wersją,
- ograniczenie zbędnych zmian wizualnych i architektonicznych,
- pilnowanie kolejności prac,
- unikanie przypadkowego przepisywania logiki bez zrozumienia zależności,
- rozdzielenie refaktoryzacji od przebudowy produktu.

To nie jest plan tworzenia nowej wersji strony od zera.
To jest plan kontrolowanej refaktoryzacji istniejącej aplikacji.

---

## Uwagi krytyczne do planu

Poniższe korekty zostały wprowadzone, żeby plan nie zawierał sprzeczności albo założeń, które mogą go wywrócić w trakcie realizacji:

- Poprawiono odwołanie do nieistniejącego etapu 22. Plan kończy się na etapie 21, więc testy regresyjne muszą wskazywać etap 19 jako miejsce checklisty scenariuszy.
- Typ `ConnectionStatus` został doprecyzowany tak, żeby odzwierciedlał faktyczny stan aplikacji. W obecnym kodzie występuje stan pośredni typu reconnecting, więc `unknown` było zbyt słabe i wymuszałoby sztuczne mapowanie.
- `ClockState.startMs` i `ClockState.rtt` muszą dopuszczać brak wartości. Przy fallbacku do czasu lokalnego albo przed pierwszą synchronizacją nie ma sensu udawać, że dane istnieją.
- `ChartPoint` został jawnie zdefiniowany z polem serii. Bez tego hook historii zwracałby jedną listę punktów bez informacji, czy punkt należy do temperatury, wilgotności czy ciśnienia.
- Inicjalizacja Firebase powinna być współdzielona lub zabezpieczona przez `getApps` / `getApp`, a nie powielona w obu adapterach. W przeciwnym razie łatwo o podwójną inicjalizację w dev i przy odświeżeniach.
- Obsługa zoom/pinch dla wykresów nie powinna zależeć od przypadkowego skryptu CDN. Jeśli używany jest plugin zoom, ma być jawnie dodany jako zależność projektu albo zastąpiony logiką przeniesioną z baseline.

---

## Zasady nadrzędne dla agenta AI

Agent musi traktować obecny projekt jako działający system referencyjny.
Każda zmiana ma służyć poprawie struktury kodu i utrzymania, a nie zmianie zachowania aplikacji.

### Agent nie może

- Zmieniać UI tylko dlatego, że „da się lepiej".
- Zmieniać layoutu tylko dlatego, że React daje inną strukturę komponentów.
- Zmieniać kolejności sekcji, nazw widocznych etykiet, tekstów, stanów i zachowań bez wyraźnej potrzeby.
- Podmieniać Firebase, bazy danych, hostingu lub modelu deployu w ramach tej refaktoryzacji.
- Przepisywać wszystkiego do jednego dużego komponentu React.
- Zaczynać od najbardziej złożonego modułu.
- Usuwać istniejących zachowań tylko dlatego, że są trudne do zamodelowania.
- „Ulepszać" architektury kosztem regresji funkcjonalnych.
- Zmieniać stylowania, jeśli nie jest to konieczne do zachowania obecnego wyglądu.
- Samodzielnie wybierać rozwiązania architektoniczne tam, gdzie plan już je definiuje.
- Zgadywać kształtu danych — musi korzystać ze zdefiniowanych typów TypeScript.
- Scalać wielu ryzykownych zmian w jednym kroku.

### Agent musi

- Zachować aktualny wygląd strony możliwie 1:1.
- Zachować aktualne zachowania użytkowe możliwie 1:1.
- Przenosić logikę etapami.
- Wydzielać warstwy odpowiedzialności.
- Utrzymywać czytelny podział między danymi, stanem i renderowaniem.
- Zostawić Firebase Hosting i Firebase RTDB bez zmian funkcjonalnych.
- Zachować Chart.js jako bibliotekę wykresów.
- Traktować obecną implementację jako źródło prawdy przy porównywaniu zachowań.
- Przed rozpoczęciem każdego etapu sprawdzić warunek gotowości.
- Po zakończeniu każdego etapu oznaczyć go jako zakończony i opisać wynik.

---

## Rozstrzygnięcia techniczne obowiązujące agenta

Poniższe decyzje są ostateczne. Agent nie może ich zmieniać ani "ulepszać".

### Stack

| Obszar | Decyzja |
|---|---|
| Framework | React 18 + Vite |
| Język | TypeScript (strict mode) |
| Hosting | Firebase Hosting – bez zmian |
| Baza danych | Firebase RTDB – bez zmian |
| Wykresy | Chart.js – bez zmian biblioteki |
| Styling | Jeden globalny plik `styles.css` importowany wyłącznie w `main.tsx` |
| State management | React Context + `useReducer` dla stanu globalnego; lokalny `useState` dla stanu komponentu |
| Testy | Manualne scenariusze regresyjne z checklistą (opisane w Etapie 19) |

### Struktura katalogów – obowiązująca i nienaruszalna

Agent ma stworzyć dokładnie tę strukturę i nie odchodzić od niej:

```
src/
  features/
    dashboard/
      api/           ← Firebase adapter dla głównego dashboardu
      hooks/         ← useLiveMetrics, useHistory, useClock, itd.
      components/    ← TopBar, MetaGrid, LiveGrid, HistoryPanel, itd.
      lib/           ← helpery domenowe dashboardu
    pms/
      api/           ← Firebase adapter dla PMS
      hooks/         ← usePmsLive, usePmsHistory, itd.
      components/    ← PmsSection, PmsChart, itd.
      lib/           ← pickPmsRaw i inne helpery PMS
  shared/
    lib/             ← formatowanie czasu, daty, kolorów, CSS vars
    hooks/           ← współdzielone hooki (np. useCalendar)
    types/           ← wszystkie typy domenowe TypeScript
    components/      ← Alert, Toast i inne współdzielone komponenty UI
  App.tsx
  main.tsx           ← JEDYNY plik importujący styles.css
```

### CSS – twarda zasada

- `styles.css` jest importowany **wyłącznie** w `main.tsx`.
- Żaden komponent React nie importuje CSS bezpośrednio.
- Klasy CSS istniejące w obecnym projekcie są **zamrożone**. Agent nie może ich zmieniać ani usuwać. Jedynym wyjątkiem jest sytuacja, gdy zmienia się element HTML (np. `div` staje się `section`) – wtedy klasa może zostać przeniesiona na nowy element.
- Nowe klasy można dodawać tylko jeśli nowa funkcja absolutnie tego wymaga.

### Chart.js + React StrictMode – obowiązkowa obsługa

React 18 w trybie deweloperskim uruchamia efekty dwukrotnie (StrictMode). Chart.js tworzy instancje imperatywnie na canvasie. Bez zabezpieczenia powstanie podwójnie zainicjowany wykres i błędy w konsoli.

**Agent musi stosować następujący wzorzec dla każdego wykresu:**

```typescript
const chartRef = useRef<Chart | null>(null);
const canvasRef = useRef<HTMLCanvasElement | null>(null);

useEffect(() => {
  if (!canvasRef.current) return;
  if (chartRef.current) {
    chartRef.current.destroy();
  }
  chartRef.current = new Chart(canvasRef.current, config);
  return () => {
    chartRef.current?.destroy();
    chartRef.current = null;
  };
}, [dependencies]);
```

Agent nie może wyłączać StrictMode jako rozwiązania problemu z wykresami.

### Vite config – obowiązujący szablon

Agent ma stworzyć `vite.config.ts` z następującą konfiguracją:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',           // dostosować tylko jeśli Firebase Hosting używa subpath
  publicDir: 'public', // folder na statyczne assety (obrazy, GIF-y)
  build: {
    outDir: 'dist',    // Firebase Hosting czyta z dist/
  },
});
```

Firebase Hosting musi mieć w `firebase.json` wpis `"public": "dist"`. Jeśli tego nie ma, agent musi to dodać – to jedyna dopuszczalna zmiana w konfiguracji Firebase.

### State management – model obowiązujący

Stan aplikacji jest podzielony na dwa poziomy:

1. **Stan globalny** (połączenie Firebase, alerty, toast, motion toggle) – zarządzany przez `AppContext` z `useReducer`. Context Provider opakowuje całą aplikację w `App.tsx`.
2. **Stan lokalny feature'u** (wybrana data, stan wykresu, dane live, dane historii) – zarządzany przez dedykowane hooki w `features/*/hooks/`.

Agent nie może wprowadzać zewnętrznych bibliotek state management (Zustand, Redux, Jotai itp.) bez osobnej decyzji.

---

## Faza 0: Zasady bezpieczeństwa przed startem

Przed rozpoczęciem refaktoryzacji agent musi przyjąć następujące zasady operacyjne:

- Stara wersja projektu pozostaje nienaruszona w osobnym katalogu lub gałęzi git.
- Nowy projekt powstaje obok starego (osobny katalog lub gałąź `refactor/react`).
- Refaktoryzacja nie podmienia od razu produkcji.
- Każda większa część musi być porównywana z obecnym zachowaniem.
- Jeśli nowa implementacja odbiega od starej, priorytet ma zgodność starej implementacji.
- Nie wolno scalać wielu zmian naraz, jeśli utrudnia to wykrycie regresji.

---

## Etap 1: Zamrożenie obecnej wersji

### Cel

Utworzyć stabilny punkt odniesienia.

### Warunek wejścia

Brak. To jest pierwszy krok.

### Co agent ma zrobić

1. Skopiować obecną działającą wersję do katalogu `_baseline/` lub do gałęzi `main-baseline`.
2. Uruchomić lokalnie baseline i potwierdzić że wszystkie sekcje działają.
3. Stworzyć plik `BASELINE_CHECKLIST.md` z listą zachowań do weryfikacji po każdym etapie.

### Obowiązkowa zawartość BASELINE_CHECKLIST.md

Agent ma stworzyć plik z poniższą listą. Każde zachowanie jest osobną linią z checkboxem.

```markdown
# Baseline Checklist

## Live metrics
- [ ] Temperatura – wyświetla aktualną wartość
- [ ] Wilgotność – wyświetla aktualną wartość
- [ ] Ciśnienie – wyświetla aktualną wartość
- [ ] Wartości aktualizują się po nadejściu nowych danych

## Połączenie
- [ ] Status połączenia wyświetla się poprawnie
- [ ] lastSeen aktualizuje się poprawnie
- [ ] Brak danych live wyświetla stan offline/brak połączenia

## Czas
- [ ] Zegar systemowy wyświetla się i tyka
- [ ] Czas pochodzi z urządzenia gdy jest dostępny
- [ ] Fallback do czasu lokalnego gdy urządzenie niedostępne
- [ ] Źródło czasu jest opisane w UI

## Historia
- [ ] Wykres dobowy renderuje się poprawnie
- [ ] Ładowanie danych historycznych działa
- [ ] Stan loading wyświetla się podczas ładowania
- [ ] Stan empty wyświetla się gdy brak danych
- [ ] Stan error wyświetla się przy błędzie Firebase
- [ ] Fallback z historyByDay do history działa

## Kalendarz
- [ ] Można wybrać inny dzień
- [ ] Dzisiaj jest zaznaczony
- [ ] Wybrany dzień jest zaznaczony
- [ ] Zmiana dnia ładuje inne dane historyczne

## Live + history
- [ ] Dla dzisiejszego dnia nowe punkty live dopinają się do wykresu
- [ ] Dla innego dnia nowe punkty live nie dopinają się do wykresu

## PMS
- [ ] PM1 live wyświetla się
- [ ] PM2.5 live wyświetla się
- [ ] PM10 live wyświetla się
- [ ] Historia PM renderuje się
- [ ] Dane z pola A są używane jeśli dostępne
- [ ] Fallback do pola F działa
- [ ] Kalendarz PMS działa niezależnie od kalendarza głównego

## Alerty i toast
- [ ] Alert success wyświetla się
- [ ] Alert warn wyświetla się
- [ ] Alert error wyświetla się
- [ ] Toast wyświetla się i znika

## UI
- [ ] Motion toggle włącza i wyłącza animacje
- [ ] Klasa motion-off jest dodawana/usuwana z documentElement
- [ ] Wygląd strony jest zgodny z baseline wizualnie
- [ ] Hierarchia sekcji jest zachowana

## Edge cases
- [ ] permission denied w Firebase – obsłużone
- [ ] Brak odpowiedzi urządzenia dla synchronizacji czasu – obsłużone
- [ ] PMS bez pola A, tylko F – obsłużone
- [ ] Mobile gestures na wykresie działają
- [ ] Wheel zoom na wykresie działa
```

### Artefakt wyjściowy

Plik `BASELINE_CHECKLIST.md` wypełniony i zapisany.

### Warunek zakończenia etapu

`BASELINE_CHECKLIST.md` istnieje. Baseline działa lokalnie. Agent może przejść dalej.

Status: zakończony.

---

## Etap 2: Inwentaryzacja logiki

### Cel

Rozpoznać system według odpowiedzialności, a nie według plików. Stworzyć dokument który będzie mapą do kolejnych etapów.

### Warunek wejścia

Etap 1 zakończony. `BASELINE_CHECKLIST.md` istnieje.

### Co agent ma zrobić

Stworzyć plik `ARCHITECTURE_INVENTORY.md` z następującymi sekcjami:

#### Sekcja 1: Moduły funkcjonalne

Dla każdego modułu agent ma zapisać:
- nazwa modułu,
- za co odpowiada,
- w którym pliku/funkcji aktualnie mieszka,
- z czym jest powiązany (zależności).

Moduły do opisania:
- App shell
- Firebase config
- Live metrics
- Connection health
- Time sync
- History chart
- Calendar (główny)
- PMS module (live + history + wykres + kalendarz)
- Alerts
- Toast
- Motion toggle
- UI helpers
- Time helpers
- Chart helpers
- Gesture handling

#### Sekcja 2: Ścieżki Firebase RTDB

Agent ma wylistować wszystkie używane ścieżki:

```
devices/{deviceId}/latest
devices/{deviceId}/historyByDay/{date}
devices/{deviceId}/history          ← fallback
```

Dla każdej ścieżki: typ danych (one-time read / subscription), kto z niej korzysta.

#### Sekcja 3: Kształt danych

Agent ma opisać kształt każdego rekordu danych który przychodzi z Firebase. To będzie bezpośrednią podstawą dla typów TypeScript w Etapie 6.

Przykład formatu:

```
LiveRecord:
  t   – temperatura (number)
  h   – wilgotność (number)
  p   – ciśnienie (number)
  ts  – timestamp (number)

PmsRecord:
  A   – obiekt z pm1, pm25, pm10 (opcjonalny)
  F   – obiekt z pm1, pm25, pm10 (opcjonalny, fallback)
```

#### Sekcja 4: Znane edge-case'y

Agent ma wylistować wszystkie zachowania brzegowe zidentyfikowane w kodzie baseline.

### Artefakt wyjściowy

Plik `ARCHITECTURE_INVENTORY.md` wypełniony.

### Warunek zakończenia etapu

`ARCHITECTURE_INVENTORY.md` istnieje i zawiera wszystkie cztery sekcje. Bez tego pliku agent nie może przejść dalej.

Status: zakończony.

---

## Etap 3: Start nowego projektu

### Cel

Stworzyć nowy, czysty kontener aplikacji bez ruszania starej wersji.

### Warunek wejścia

Etap 2 zakończony. `ARCHITECTURE_INVENTORY.md` istnieje.

### TODO

- Utworzyć nowy projekt Vite w osobnym folderze `ticking-bomb-react`.
- Odtworzyć wymaganą strukturę katalogów `src/` zgodnie z planem.
- Przenieść globalny `styles.css` i statyczne assety do nowego projektu.
- Ustawić konfigurację Vite i Firebase Hosting bez zmiany modelu deployu.
- Podłączyć `styles.css` wyłącznie w `main.tsx`.
- Uruchomić projekt i sprawdzić, że startuje bez błędów w przeglądarce i buildzie.

### Kroki wykonania

1. Zainicjować scaffold nowego projektu poleceniem `npm create vite@latest ticking-bomb-react -- --template react-ts`.
2. Wejść do nowego projektu i utworzyć wymaganą strukturę katalogów:
  - `src/features/dashboard/api/`
  - `src/features/dashboard/hooks/`
  - `src/features/dashboard/components/`
  - `src/features/dashboard/lib/`
  - `src/features/pms/api/`
  - `src/features/pms/hooks/`
  - `src/features/pms/components/`
  - `src/features/pms/lib/`
  - `src/shared/lib/`
  - `src/shared/hooks/`
  - `src/shared/types/`
  - `src/shared/components/`
3. Skopiować do nowego projektu globalny `styles.css` z baseline oraz przenieść wszystkie statyczne assety do katalogu `public/`.
4. Skonfigurować `vite.config.ts` dokładnie według szablonu z planu, z `publicDir: 'public'` i `build.outDir: 'dist'`.
5. Upewnić się, że w konfiguracji Firebase Hosting używane jest `"public": "dist"` w `firebase.json` i że nie zmienia to żadnych innych ustawień deployu.
6. Dodać do `src/main.tsx` import `./styles.css` jako jedyny import CSS w całym projekcie.
7. Uruchomić `npm run dev` i potwierdzić, że projekt startuje na `localhost:5173` bez błędów w konsoli.
8. Uruchomić `npm run build` i potwierdzić, że build tworzy katalog `dist/` bez błędów.

### Agent nie ma jeszcze robić

- Migracji logiki Firebase.
- Migracji wykresów.
- Żadnej logiki aplikacji.
- Zmian deployu produkcyjnego.

### Artefakt wyjściowy

Działający projekt React + Vite + TypeScript który odpala się na `localhost:5173` i wyświetla pustą stronę bez błędów w konsoli.

### Warunek zakończenia etapu

`npm run dev` uruchamia się bez błędów. `npm run build` produkuje katalog `dist/`. Struktura katalogów zgodna z planem.

Status: zakończony i zweryfikowany.

---

## Etap 4: Przeniesienie layoutu bez logiki

### Cel

Odtworzyć obecny układ strony jako statyczne komponenty React.

### Warunek wejścia

Etap 3 zakończony.

### Co agent ma zrobić

Przenieść strukturę z `index.html` baseline do komponentów React. Komponenty są statyczne – żadnych hooków, żadnych danych, tylko HTML ze statycznymi wartościami zastępczymi.

Docelowe komponenty:

| Komponent | Ścieżka |
|---|---|
| `TopBar` | `features/dashboard/components/TopBar.tsx` |
| `MetaGrid` | `features/dashboard/components/MetaGrid.tsx` |
| `LiveGrid` | `features/dashboard/components/LiveGrid.tsx` |
| `HistoryPanel` | `features/dashboard/components/HistoryPanel.tsx` |
| `PmsSection` | `features/pms/components/PmsSection.tsx` |
| `AlertsSection` | `shared/components/AlertsSection.tsx` |
| `Footer` | `features/dashboard/components/Footer.tsx` |

### Twarde zasady CSS dla tego etapu

- Każdy element HTML ma te same klasy CSS co w baseline.
- Agent nie może zmieniać nazw klas.
- Agent nie może zmieniać kolejności sekcji.
- Agent nie może zmieniać widocznych tekstów etykiet.
- Jeśli element zmienia typ (np. `div` → `section`), klasa zostaje przeniesiona na nowy element.

### Artefakt wyjściowy

Strona w przeglądarce wygląda jak baseline (statycznie, bez danych).

### Warunek zakończenia etapu

Wizualne porównanie z baseline – układ, sekcje, klasy, teksty są zgodne. Agent odznacza w checkliście: wygląd strony zgodny.

Status: zakończony i zweryfikowany.

---

## Etap 5: Typy domenowe

### Cel

Ustabilizować model danych przed jakąkolwiek logiką. Typy mają wynikać z `ARCHITECTURE_INVENTORY.md`.

### Warunek wejścia

Etap 4 zakończony. `ARCHITECTURE_INVENTORY.md` zawiera sekcję kształtu danych.

### Co agent ma zrobić

Stworzyć plik `src/shared/types/index.ts` z poniższymi typami jako punktem startowym. Agent uzupełnia je o pola zidentyfikowane w inwentaryzacji.

```typescript
// Dane z Firebase

export interface LiveRecord {
  t: number;      // temperatura
  h: number;      // wilgotność
  p: number;      // ciśnienie
  ts: number;     // timestamp unix ms
}

export interface PmsRaw {
  pm1: number;
  pm25: number;
  pm10: number;
}

export interface PmsRecord {
  A?: PmsRaw;     // preferowane źródło
  F?: PmsRaw;     // fallback
  ts: number;
}

export interface HistoryRecord {
  t: number;
  h: number;
  p: number;
  ts: number;
}

// Stany aplikacji

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export interface ClockState {
  displayTime: string;
  source: 'device' | 'local';
  startMs: number | null;
  rtt: number | null;
}

export type ChartSeriesKey = 't' | 'h' | 'p';

export interface ChartPoint {
  series: ChartSeriesKey;
  x: number;
  y: number;
}

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error' | 'empty';

export interface CalendarState {
  selectedDate: string;   // YYYY-MM-DD
  viewDate: string;       // YYYY-MM-DD, miesiąc widoczny w kalendarzu
  today: string;          // YYYY-MM-DD
}

export interface AlertItem {
  id: string;
  level: 'success' | 'warn' | 'error';
  message: string;
  autoDismiss?: boolean;
}
```

### Twarda zasada

Każdy hook i komponent musi korzystać z tych typów. Żadnych `any`. Żadnych inline object types dla danych z Firebase.

### Artefakt wyjściowy

Plik `src/shared/types/index.ts`.

### Warunek zakończenia etapu

Plik istnieje. Typy kompilują się bez błędów TypeScript.

Status: zakończony i zweryfikowany.

---

## Etap 6: Adapter Firebase i shared utilities

### Cel 1 (adapter)

Zbudować jedną warstwę dostępu do danych, aby komponenty nie znały bezpośrednio RTDB.

### Cel 2 (utilities)

Oddzielić helpery od komponentów i logiki feature'owej.

### Warunek wejścia

Etap 5 zakończony. Typy domenowe istnieją.

### Co agent ma zrobić – adapter Firebase

Stworzyć `src/features/dashboard/api/firebaseAdapter.ts`:

```typescript
// Inicjalizacja Firebase – tylko raz w tym pliku
// Eksport instancji db
// Wszystkie ścieżki RTDB są prywatne dla tego pliku
// Publiczne API to tylko funkcje domenowe:

export function subscribeLiveMetrics(
  deviceId: string,
  callback: (data: LiveRecord) => void
): () => void   // ← zwraca funkcję cleanup

export function loadHistoryByDay(
  deviceId: string,
  date: string
): Promise<HistoryRecord[]>

export function loadHistoryFallback(
  deviceId: string,
  date: string
): Promise<HistoryRecord[]>
```

Stworzyć analogiczny `src/features/pms/api/pmsAdapter.ts` dla danych PMS.

### Twarda zasada dla adapterów

- Komponenty UI nie mogą nigdzie używać `db.ref(...)` bezpośrednio.
- Ścieżki Firebase (`devices/{deviceId}/latest` itd.) mogą istnieć **tylko** w plikach adapterów.
- Każda funkcja subskrypcji musi zwracać funkcję cleanup (`() => void`).

### Co agent ma zrobić – shared utilities

Stworzyć w `src/shared/lib/`:

| Plik | Zawartość |
|---|---|
| `firebaseClient.ts` | inicjalizacja Firebase i bezpieczny eksport `db` (`getApps` / `getApp`) |
| `timeHelpers.ts` | formatowanie czasu, daty, przeliczenia timestamp |
| `colorHelpers.ts` | helpery kolorów, CSS vars |
| `dateHelpers.ts` | obliczenia zakresu dat, `dateRangeForDay` itp. |
| `chartHelpers.ts` | wspólne helpery do serii wykresu, clampowania i transformacji punktów |

### Artefakt wyjściowy

Pliki adapterów i utility. Projekt kompiluje się bez błędów.

### Warunek zakończenia etapu

Adaptery i utility istnieją. Kompilacja czysta. Żaden komponent nie importuje Firebase SDK bezpośrednio.

Status: zakończony i zweryfikowany.

---

## Etap 7: AppContext i stan globalny

### Cel

Zbudować globalny kontener stanu przed podłączaniem danych do komponentów.

### Warunek wejścia

Etap 6 zakończony.

### Co agent ma zrobić

Stworzyć `src/App.tsx` z `AppContext`:

```typescript
interface AppState {
  connectionStatus: ConnectionStatus;
  motionEnabled: boolean;
  alerts: AlertItem[];
  toast: AlertItem | null;
}

type AppAction =
  | { type: 'SET_CONNECTION'; payload: ConnectionStatus }
  | { type: 'TOGGLE_MOTION' }
  | { type: 'ADD_ALERT'; payload: AlertItem }
  | { type: 'DISMISS_ALERT'; payload: string }
  | { type: 'SHOW_TOAST'; payload: AlertItem }
  | { type: 'HIDE_TOAST' };
```

Context Provider opakowuje całą aplikację. Wszystkie feature'owe hooki mają dostęp do dispatch przez `useAppContext()`.

### Motion toggle

Motion toggle jest częścią `AppContext`. Gdy `motionEnabled` zmienia się, efekt w App.tsx aktualizuje `document.documentElement.classList` (dodaje/usuwa `motion-off`). To jest jedyne miejsce w kodzie które dotyka `document.documentElement` dla tej funkcji.

### Artefakt wyjściowy

`AppContext` z `useReducer`. `useAppContext()` hook. Projekt kompiluje się bez błędów.

### Warunek zakończenia etapu

Context działa. Motion toggle zmienia klasę na `documentElement`. Kompilacja czysta.

Status: zakończony i zweryfikowany.

---

## Etap 8: Live cards i status połączenia

### Cel

Przenieść najprostszy widoczny fragment funkcjonalny. Pierwsze realne dane na ekranie.

### Warunek wejścia

Etap 7 zakończony.

### Co agent ma zrobić

1. Stworzyć `src/features/dashboard/hooks/useLiveMetrics.ts`:
   - Subskrybuje `subscribeLiveMetrics` z adaptera.
   - Zwraca `{ data: LiveRecord | null, status: LoadState }`.
   - Cleanup w `useEffect` return.

2. Stworzyć `src/features/dashboard/hooks/useConnectionHealth.ts`:
   - Monitoruje wiek ostatniego odczytu (`ts` z `LiveRecord`).
   - Jeśli ostatni odczyt starszy niż X sekund → status `disconnected`.
   - Aktualizuje `AppContext` przez dispatch `SET_CONNECTION`.
   - Zwraca `{ lastSeen: string }`.

3. Podłączyć hooki do komponentów `LiveGrid` i `TopBar`.

### Twarda zasada

Każdy `useEffect` który otwiera subskrypcję Firebase musi mieć funkcję cleanup:

```typescript
useEffect(() => {
  const unsubscribe = subscribeLiveMetrics(deviceId, callback);
  return () => unsubscribe();
}, [deviceId]);
```

### Artefakt wyjściowy

Karta temperatury, wilgotności i ciśnienia wyświetla live dane. Status połączenia działa. `lastSeen` aktualizuje się.

### Warunek zakończenia etapu

W `BASELINE_CHECKLIST.md` odznaczone:
- [ ] Temperatura/wilgotność/ciśnienie – live ✓
- [ ] Status połączenia ✓
- [ ] lastSeen ✓

Status: zakończony i zweryfikowany.

---

## Etap 9: Time subsystem

### Cel

Przenieść logikę czasu jako osobny, spójny moduł.

### Warunek wejścia

Etap 8 zakończony.

### Co agent ma zrobić

Stworzyć `src/features/dashboard/hooks/useClock.ts`:
- `syncTimeFromDevice` – bierze `ts` z `LiveRecord`, oblicza offset i `rtt`.
- Fallback do local time gdy urządzenie niedostępne.
- Tick co sekundę (`setInterval`).
- Cleanup `clearInterval` w return efektu.
- Zwraca `ClockState`.

### Twarda zasada

`useClock` nie może importować nic z Firebase. Dane wejściowe to `ts: number | undefined` z live record.

### Artefakt wyjściowy

Zegar tyka. Źródło czasu (device/local) widoczne w UI. Fallback działa.

### Warunek zakończenia etapu

W checkliście odznaczone:
- [ ] Zegar tyka ✓
- [ ] Źródło czasu ✓
- [ ] Fallback do local time ✓

Status: zakończony i zweryfikowany.

---

## Etap 10: Kalendarz głównego wykresu

### Cel

Wydzielić kalendarz jako czysty moduł UI bez zależności od danych.

### Warunek wejścia

Etap 9 zakończony.

### Co agent ma zrobić

Stworzyć `src/shared/hooks/useCalendar.ts`:
- Stan: `CalendarState`.
- Akcje: `selectDate(date: string)`, `nextMonth()`, `prevMonth()`.
- Zwraca stan + akcje.
- Nie zna Firebase. Nie zna Chart.js.

Stworzyć komponent kalendarza podłączony do tego hooka.

### Twarda zasada

Kalendarz emituje tylko zmianę daty. Nic więcej. Nie może triggerować ładowania danych bezpośrednio.

### Artefakt wyjściowy

Działający komponent kalendarza. Wybór dnia działa. Nawigacja po miesiącach działa.

### Warunek zakończenia etapu

W checkliście odznaczone:
- [ ] Kalendarz – wybór dnia ✓
- [ ] Dzisiaj zaznaczony ✓
- [ ] Wybrany dzień zaznaczony ✓

Status: zakończony i zweryfikowany.

---

## Etap 11: Ładowanie historii dobowej

### Cel

Przenieść loading historii do warstwy hooków danych.

### Warunek wejścia

Etap 10 zakończony.

### Co agent ma zrobić

Stworzyć `src/features/dashboard/hooks/useHistoryData.ts`:
- Przyjmuje `selectedDate: string`.
- Próbuje `loadHistoryByDay`, fallback do `loadHistoryFallback`.
- Filtruje dane do wybranego dnia.
- Zwraca `{ points: ChartPoint[], loadState: LoadState, dataDensity: number }`.
- `ChartPoint` zawiera `series` (`t`, `h` albo `p`), więc jeden hook może zwrócić wszystkie punkty bez mieszania serii.

### Twarda zasada

Hook zwraca gotowe punkty serii – nie surowe snapshoty. Konwersja z `HistoryRecord` na `ChartPoint` dzieje się wewnątrz hooka.

### Artefakt wyjściowy

Hook zwraca dane gotowe do podania do Chart.js. Stany loading/error/empty działają.

### Warunek zakończenia etapu

W checkliście odznaczone:
- [x] Ładowanie historii ✓
- [x] Fallback historyByDay → history ✓
- [x] Stany loading/error/empty ✓

Status: zakończony i zweryfikowany.

---

## Etap 12: Wykres główny

### Cel

Zachować Chart.js, ale zamknąć go w kontrolowanym komponencie React.

### Warunek wejścia

Etap 11 zakończony. Dane historii działają poprawnie (odznaczone w checkliście).

### Co agent ma zrobić

Stworzyć `src/features/dashboard/components/HistoryChart.tsx`:
- Używa `canvasRef` i `chartRef` zgodnie ze wzorcem ze sekcji „Chart.js + React StrictMode".
- Przyjmuje props: `points: ChartPoint[]`, `loadState: LoadState`.
- Logika wewnątrz: tworzenie datasets z filtrowaniem po `series`, konfiguracja wykresu, clampowanie okna.
- Pan/zoom, wheel, pointer gestures – przenoszone 1:1 z baseline.
- Lifecycle instancji wykresu zarządzany przez `useEffect`.

### Twarda zasada dotycząca gestów i canvasa

Nie próbować robić gestów deklaratywnie przez React events jeśli baseline używa bezpośrednich listenerów canvasa. Przenieść logikę gestów 1:1, zamknąć w efekcie z cleanup.

### Artefakt wyjściowy

Wykres renderuje dane historii. Pan/zoom działa. Wheel działa.

### Warunek zakończenia etapu

W checkliście odznaczone:
- [x] Wykres renderuje się ✓
- [x] Pan/zoom ✓
- [x] Wheel ✓

Status: zakończony i zweryfikowany.

---

## Etap 13: Integracja live + history

### Cel

Połączyć dwa źródła zachowania dopiero gdy osobno już działają poprawnie.

### Warunek wejścia

**Obowiązkowe przed startem tego etapu:**
- Etap 8 (live cards) – wszystkie pozycje odznaczone w checkliście.
- Etap 12 (wykres) – wszystkie pozycje odznaczone w checkliście.

Jeśli którekolwiek z powyższych nie jest spełnione, agent **nie może** zaczynać tego etapu.

### Co agent ma zrobić

Dodać do `useHistoryData` lub osobnego hooka logikę:
- Jeśli `selectedDate === today`: nowe live punkty są dopinane do serii wykresu.
- Jeśli `selectedDate !== today`: live punkty są ignorowane.
- Zachować reguły auto-follow / stable chart window zgodnie z baseline.

### Artefakt wyjściowy

Dopinanie live punktów do wykresu dla dzisiejszego dnia działa. Dla innych dni nie działa (zgodnie z baseline).

### Warunek zakończenia etapu

W checkliście odznaczone:
- [x] Live + history – dziś ✓
- [x] Live + history – inny dzień ✓

Status: zakończony i zweryfikowany.

---

## Etap 14: Alerty i toast

### Cel

Ujednolicić mechanizm powiadomień jako wspólny moduł.

### Warunek wejścia

Etap 13 zakończony.

### Co agent ma zrobić

Stworzyć `src/shared/components/AlertsSection.tsx` i `src/shared/components/Toast.tsx` podłączone do `AppContext`.

Poziomy: `success`, `warn`, `error`. Auto-dismiss opcjonalny.

### Twarda zasada

To jest jeden wspólny mechanizm. Żaden moduł nie może mieć własnej lokalnej implementacji alertów.

### Warunek zakończenia etapu

W checkliście odznaczone:
- [x] Alert success/warn/error ✓
- [x] Toast ✓

Status: zakończony i zweryfikowany.

---

## Etap 15: PMS – live cards

### Cel

Rozpocząć migrację PMS od najprostszego podzbioru.

### Warunek wejścia

Etap 14 zakończony. Główny dashboard stabilny – wszystkie pozycje checklisty dla dashboardu odznaczone.

### Dlaczego dopiero teraz

PMS ma własny live feed, własną historię, własny kalendarz, własny wykres, własne overlaye, własne gesty i dodatkową normalizację `A/F`. To osobny bounded context – nie można go migrować zanim główny dashboard nie jest stabilny.

### Co agent ma zrobić

1. Stworzyć `src/features/pms/lib/pmsHelpers.ts` z funkcją `pickPmsRaw`:
   ```typescript
   export function pickPmsRaw(record: PmsRecord): PmsRaw | null {
     return record.A ?? record.F ?? null;
   }
   ```
2. Stworzyć `src/features/pms/hooks/usePmsLive.ts` analogicznie do `useLiveMetrics`.
3. Podłączyć do komponentu PMS live cards.

### Uwagi do implementacji

`pickPmsRaw` jest helperem specyficznym dla PMS i powinien zostać w `src/features/pms/lib/pmsHelpers.ts`, a nie w `shared/lib/`, żeby nie mieszać domeny PMS z ogólnymi helperami.

### Warunek zakończenia etapu

W checkliście odznaczone:
- [x] PM1/PM2.5/PM10 live ✓
- [x] Fallback A → F ✓

---

## Etap 16: PMS – historia i wykres

### Cel

Odtworzyć dla PMS analogiczną strukturę jak dla głównego wykresu.

### Warunek wejścia

Etap 15 zakończony.

### Co agent ma zrobić

Analogicznie do głównego dashboardu:
- `src/features/pms/hooks/usePmsHistory.ts`
- `src/shared/hooks/useCalendar.ts` – ten sam hook co dla głównego kalendarza (nie duplikować)
- `src/features/pms/components/PmsChart.tsx` – wrapper Chart.js ze wzorcem StrictMode

### Zasada dotycząca abstrakcji

Jeśli `useCalendar` jest identyczny dla dashboardu i PMS – jeden hook w `shared/hooks/`. Nie duplikować kodu dla elegancji. Jednocześnie nie tworzyć nadmiernych abstrakcji tylko po to żeby uniknąć dwóch podobnych plików.

### Warunek zakończenia etapu

W checkliście odznaczone:
- [x] Historia PMS ✓
- [x] Wykres PMS ✓
- [x] Kalendarz PMS działa niezależnie ✓

---

## Etap 17: Checklista końcowa i domknięcie braków

### Cel

Przejść przez wszystkie jeszcze nieodznaczone pozycje checklisty i doprowadzić je do stanu pass bez zmiany uzgodnionej architektury.

### Warunek wejścia

Etap 16 zakończony. Dashboard i PMS są już wdrożone, a na liście zostały tylko pozycje wymagające dopięcia albo potwierdzenia.

### Co agent ma zrobić

Przejść przez każdy jeszcze nieodznaczony punkt `BASELINE_CHECKLIST.md` i dla każdego:
- zweryfikować, czy zachowanie już istnieje,
- jeśli nie istnieje, naprawić kod możliwie lokalnie i bez zmiany architektury,
- potwierdzić rezultat w browserze tam, gdzie to ma sens,
- odznaczyć pozycję dopiero po realnym potwierdzeniu.

Obejmuje to w szczególności:
- Motion toggle włącza i wyłącza animacje,
- Klasa motion-off jest dodawana/usuwana z documentElement,
- Wygląd strony jest zgodny z baseline wizualnie,
- Hierarchia sekcji jest zachowana,
- permission denied w Firebase – obsłużone,
- Brak odpowiedzi urządzenia dla synchronizacji czasu – obsłużone,
- PMS bez pola A, tylko F – obsłużone,
- Mobile gestures na wykresie działają,
- Wheel zoom na wykresie działa.

### Zasada dotycząca zakresu

Nie ruszać elementów już odznaczonych, nie przebudowywać UI bez potrzeby i nie przechodzić dalej, dopóki checklistę da się zamknąć uczciwie.

### Warunek zakończenia etapu

W `BASELINE_CHECKLIST.md` odznaczone wszystkie pozostające pozycje.

---

## Etap 18: iframe PM embed

### Cel

Zachować działający embed bez ryzyka.

### Zasada

`iframe` jest zachowany bez zmian na początku. Agent **nie usuwa** `iframe` tylko dlatego, że nie pasuje architektonicznie.

### Warunek integracji (exit criteria dla iframe)

Agent może rozważyć integrację `iframe` jako normalnego komponentu dopiero gdy spełnione są jednocześnie:
1. Wszystkie poprzednie etapy zakończone.
2. Cały `BASELINE_CHECKLIST.md` odznaczony.
3. Istnieje jawna decyzja (nie domysł agenta) o integracji.

Dopóki te warunki nie są spełnione, `iframe` pozostaje nienaruszony.

### Status realizacji

W tej wersji embed został zintegrowany jako komponent React w `src/features/pms/components/PmsLivePanel.tsx`, a `iframe` został zastąpiony bez zmiany reszty układu PMS.

---

## Etap 19: Cleanup subskrypcji i lifecycle

### Cel

Audyt całego projektu pod kątem wycieków.

### Warunek wejścia

Wszystkie poprzednie etapy zakończone.

### Co agent ma zrobić

Przejść przez każdy plik w projekcie i sprawdzić:

| Typ zasobu | Czy ma cleanup? |
|---|---|
| Firebase `ref.on(...)` | `ref.off(...)` w return efektu |
| `setInterval` | `clearInterval` w return efektu |
| Canvas event listeners | `removeEventListener` w return efektu |
| Chart.js instancja | `chart.destroy()` w return efektu |
| React `useEffect` | return function dla każdego efektu z subskrypcją |

Każde brakujące cleanup to błąd architektoniczny – nie detal do pominięcia.

### Artefakt wyjściowy

Lista wszystkich miejsc z subskrypcjami + potwierdzenie że każde ma cleanup.

### Status realizacji

Audyt zakończony. W Reactowym runtime wszystkie wskazane subskrypcje, timery, listenery i instancje Chart.js mają cleanup. W legacy static runtime dopięto brakujący cleanup dla synchronizacji czasu oraz PMS live feed i chart teardown.

---

## Etap 20: Testy regresyjne funkcjonalne

### Cel

Sprawdzić zgodność nowej implementacji ze starą przed deployem.

### Warunek wejścia

Etap 19 zakończony.

### Scenariusze obowiązkowe

Agent przechodzi przez każdy scenariusz i odznacza wynik (pass/fail). Przy fail – naprawia przed przejściem dalej.

```
SCENARIUSZ 1: Brak danych live
  - Odłącz urządzenie lub symuluj brak połączenia
  - Oczekiwane: status offline, karty w stanie error/empty, lastSeen zamrożony

SCENARIUSZ 2: Brak danych historycznych
  - Wybierz dzień bez danych w Firebase
  - Oczekiwane: stan empty na wykresie, brak błędów w konsoli

SCENARIUSZ 3: permission denied w Firebase
  - Symuluj błąd autoryzacji (zły klucz lub reguły RTDB)
  - Oczekiwane: błąd obsłużony, wyświetlony alert error, brak crashu

SCENARIUSZ 4: Fallback czasu lokalnego
  - Odłącz urządzenie
  - Oczekiwane: zegar nadal tyka, źródło = "local"

SCENARIUSZ 5: Wybór innego dnia
  - Wybierz dzień sprzed tygodnia
  - Oczekiwane: historia ładuje się, live punkty nie dopinają się

SCENARIUSZ 6: Dzisiejszy dzień + live
  - Wybierz dziś
  - Oczekiwane: historia załadowana, nowe live punkty dopinają się co odczyt

SCENARIUSZ 7: PMS – tylko pole F
  - Prześlij do Firebase rekord PMS bez pola A, tylko F
  - Oczekiwane: dane PM wyświetlają się poprawnie

SCENARIUSZ 8: Mobile gestures
  - Otwórz na urządzeniu mobilnym
  - Oczekiwane: gestures na wykresie działają jak w baseline

SCENARIUSZ 9: Wheel zoom
  - Użyj kółka myszy na wykresie
  - Oczekiwane: zoom działa jak w baseline

SCENARIUSZ 10: Opóźnienie synchronizacji czasu
  - Symuluj opóźnioną odpowiedź urządzenia (ts przychodzi kilka sekund po starcie)
  - Oczekiwane: fallback do local time, przełączenie na device time po otrzymaniu ts
```

### Warunek zakończenia etapu

Wszystkie 10 scenariuszy: pass.

---

## Etap 21: Deploy staging i porównanie wizualne

### Cel

Ostateczna weryfikacja przed podmienieniem produkcji.

### Co agent ma zrobić

1. Zdeployować nową wersję na osobny projekt Firebase (staging) lub preview channel.
2. Uruchomić obok siebie baseline i nową wersję.
3. Przejść przez kompletny `BASELINE_CHECKLIST.md` dla nowej wersji.
4. Zidentyfikować i naprawić wszystkie niezgodności.

### Warunek zakończenia etapu

100% checklisty odznaczone dla nowej wersji na staging.

---

## Etap 22: Refaktor stylistyczny – dopiero na końcu

### Cel

Nie mieszać zmian estetycznych z migracją logiki.

### Warunek wejścia

Etap 21 zakończony. Deploy staging potwierdził zgodność.

### Dopiero po stabilizacji można rozważyć

- Przejście na CSS Modules.
- Formalizację tokenów design systemu.
- Ujednolicenie komponentów UI.

### Twarda zasada

Stylowanie nie jest dziś głównym problemem projektu. Nie wolno robić refaktoru stylów wcześniej kosztem stabilności funkcjonalnej.

---

## Ostateczna kolejność etapów

| Nr | Etap | Artefakt wyjściowy |
|---|---|---|
| 0 | Zasady bezpieczeństwa | – |
| 1 | Zamrożenie wersji | `BASELINE_CHECKLIST.md` |
| 2 | Inwentaryzacja logiki | `ARCHITECTURE_INVENTORY.md` |
| 3 | Nowy projekt | Działający `npm run dev` |
| 4 | Layout bez logiki | Statyczna strona zgodna wizualnie |
| 5 | Typy domenowe | `src/shared/types/index.ts` |
| 6 | Adapter Firebase + utilities | Adaptery i lib |
| 7 | AppContext | Context + useReducer |
| 8 | Live cards + połączenie | Live dane na ekranie |
| 9 | Time subsystem | Zegar działa |
| 10 | Kalendarz | Wybór dnia działa |
| 11 | Historia dobowa | Hook z danymi |
| 12 | Wykres główny | Chart.js w komponencie |
| 13 | Integracja live + history | Dopinanie punktów |
| 14 | Alerty i toast | Wspólny mechanizm |
| 15 | PMS live | PM karty działają |
| 16 | PMS historia + wykres | PMS kompletny |
| 17 | iframe | Zachowany bez zmian |
| 18 | Cleanup lifecycle | Audyt wycieków |
| 19 | Testy regresyjne | 10/10 scenariuszy pass |
| 20 | Deploy staging | Checklist 100% |
| 21 | Refaktor stylów | Opcjonalnie |

---

## Czego agent absolutnie nie może zrobić

- Nie przepisywać `app.js` do jednego komponentu React.
- Nie ruszać jednocześnie deployu, bazy, stylów i frameworka.
- Nie zaczynać PMS przed stabilizacją głównego dashboardu.
- Nie usuwać trudnych zachowań tylko dlatego, że spowalniają migrację.
- Nie zmieniać layoutu bez potrzeby.
- Nie zmieniać klas CSS bez uzasadnienia.
- Nie importować CSS w komponentach (tylko w `main.tsx`).
- Nie inicjalizować Chart.js bez wzorca `ref` + `destroy()`.
- Nie wyłączać StrictMode jako rozwiązania problemów z wykresami.
- Nie stosować bibliotek state management innych niż React Context + useReducer.
- Nie zmieniać struktury katalogów bez jawnego uzasadnienia.
- Nie przechodzić do kolejnego etapu bez spełnienia warunku wejścia.
- Nie scalać wielu ryzykownych zmian w jednym kroku.
- Nie usuwać `iframe` bez spełnienia exit criteria.

---

## Oczekiwany efekt końcowy

Po zakończeniu refaktoryzacji projekt ma:

- wyglądać prawie tak samo jak obecna wersja,
- zachowywać się tak samo jak obecna wersja,
- być podzielony na czytelne moduły zgodne z ustaloną strukturą katalogów,
- mieć odseparowaną warstwę danych Firebase w adapterach,
- mieć kontrolowany lifecycle subskrypcji i wykresów z pełnym cleanup,
- mieć stabilny model danych oparty na TypeScript,
- mieć łatwiejszy rozwój kolejnych modułów,
- nie wymagać zmiany hostingu ani planu Firebase,
- być gotowy do dalszego utrzymania bez centralnego `app.js`.

---

## Zasada nadrzędna

**To ma być refaktoryzacja zachowawcza, a nie kreatywna przebudowa.**

Jeśli agent ma wybór między architekturą ładniejszą ale ryzykowną, a architekturą trochę mniej elegancką ale zgodną z działaniem obecnego systemu – wybiera wariant drugi.

Najpierw zgodność i kontrola. Potem porządek. Dopiero na końcu dalsze ulepszenia.
