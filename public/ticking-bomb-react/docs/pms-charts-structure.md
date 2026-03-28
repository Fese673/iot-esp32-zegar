# Raport: struktura wykresów PMS5003

Ten dokument opisuje aktualną strukturę dwóch widoków wykresów związanych z PMS5003 w aplikacji:

- wykres historii (line chart) — komponent: PmsChart
- panel live / frakcje (kolumnowy, CSS) — komponent: PmsLivePanel

**Pliki kluczowe**

- **PmsChart (historia):** [src/features/pms/components/PmsChart.tsx](src/features/pms/components/PmsChart.tsx)
- **PmsLivePanel (live/frakcje):** [src/features/pms/components/PmsLivePanel.tsx](src/features/pms/components/PmsLivePanel.tsx)
- **Funkcje pomocnicze (chart):** [src/features/pms/lib/pmsChartHelpers.ts](src/features/pms/lib/pmsChartHelpers.ts)
- **Pick raw (A/F):** [src/features/pms/lib/pmsHelpers.ts](src/features/pms/lib/pmsHelpers.ts)
- **Adapter Firebase:** [src/features/pms/api/pmsAdapter.ts](src/features/pms/api/pmsAdapter.ts)
- **Hook live:** [src/features/pms/hooks/usePmsLive.ts](src/features/pms/hooks/usePmsLive.ts)
- **Typy danych:** [src/shared/types/index.ts](src/shared/types/index.ts)

**1) Przegląd funkcjonalny**

1. PmsChart pokazuje historię pomiarów jako wykres liniowy z trzema seriami: PM1, PM2.5, PM10.
2. PmsLivePanel to wizualny, kolumnowy panel „frakcji” (nie używa Chart.js) — pokazuje względne udziały PM1/PM2.5/PM10 dla bieżącej próbki.
3. Źródłem danych jest Firebase: adapter `subscribePmsLive`, `loadPmsHistoryByDay` i fallback w `pmsAdapter.ts`.

**2) Struktura danych i mapowanie**

- Typy: `PmsRaw` = { pm1, pm25, pm10 } i `PmsRecord` = { A?: PmsRaw, F?: PmsRaw, ts } ([src/shared/types/index.ts](src/shared/types/index.ts)).
- `pmsHelpers.pickPmsRaw(record)` wybiera `A` lub `F` (pierwsze dostępne) — [pmsHelpers.ts](src/features/pms/lib/pmsHelpers.ts).
- Dla wykresu historycznego każdy `PmsRecord` jest konwertowany na trzy punkty serii przez `recordToPmsChartPoints` → typ `PmsChartPoint` = { series: 'pm1'|'pm25'|'pm10', x:number, y:number } ([pmsChartHelpers.ts](src/features/pms/lib/pmsChartHelpers.ts)).

**3) `PmsChart.tsx` — szczegóły techniczne**

- Biblioteka: Chart.js (zarejestrowane `registerables`). Nowy wykres tworzony w `createChart()`.
- Zestawy danych: trzy datasety w tej kolejności: PM1 (index 0), PM2.5 (index 1), PM10 (index 2). PM10 ma `borderDash: [4,4]`.
- Każdy punkt to obiekt `{ x: number, y: number }` (x = epoch ms). Oznacza to, że oś X jest typem `linear` i przyjmuje wartości czasowe jako liczby.
- Formaty i etykiety:
  - Tooltipy formatuje `formatTooltipLabel(datasetIndex, value)` (rozróżnienie po indexie).
  - Oś Y: etykiety z jednostką `µg/m³`.
  - Oś X: `formatAxisTime` konwertuje epoch → lokalny format czasu.
- Styl/kolory: `readChartPalette()` czyta zmienne CSS (np. `--pm1`, `--pm25`, `--pm10`, `--panel-2` i inne).
- Interakcje:
  - Obsługa wskazówek dotykowych/pointerów: pan (jednym palcem), pinch-to-zoom (dwa palce).
  - Wheel: przewijanie z `ctrl/meta` → zoom, poziome przewijanie → pan.
  - Programowa kontrola okna czasowego: `updateChartWindow`, `panChart`, `zoomChart`.
- Okna i padding:
  - Stałe: `MIN_WINDOW_MS = 60_000`, `REALTIME_WINDOW_MS = 10*60_000`, `RIGHT_PADDING_RATIO = 0.08`, `INITIAL_ZOOM_MS = MIN_WINDOW_MS`.
  - PmsChart utrzymuje `chartWindowRef` oraz `boundsRef` (dzienny zakres) — logika ustawia widoczne min/max dla skali X.
- Dane: `getSeriesData(sortPmsChartPoints(points))` grupuje punkty i przypisuje do datasetów.

Głębsze odwołania: [PmsChart.tsx](src/features/pms/components/PmsChart.tsx)

**4) `PmsLivePanel.tsx` — szczegóły techniczne**

- Nie używa Chart.js — to HTML/CSS + React.
- `buildRows(liveData)` tworzy trzy wiersze (`pm1`, `pm25`, `pm10`) i oblicza `fill` jako procent względem największej wartości (peak).
- Progowe zachowania (severity):
  - `fill >= 78` → `alert`
  - `fill >= 52` → `warn`
  - inaczej → `good`
- Widok zawiera: nagłówek (hero), statystyki, kolumny z wypełnieniem, oraz panel szczegółów (drawer).
- Źródło danych dla panelu: hook `usePmsLive()` → `subscribePmsLive()` ([usePmsLive.ts](src/features/pms/hooks/usePmsLive.ts), [pmsAdapter.ts](src/features/pms/api/pmsAdapter.ts)).

**5) Adapter i pobieranie danych**

- `subscribePmsLive(deviceId, callback)` subskrybuje `devices/{id}/latest` i normuje rekord (`normalizePmsRecord`).
- `loadPmsHistoryByDay(deviceId, date)` czyta `historyByDay/{date}`; fallback `loadPmsHistoryFallback` odczytuje ostatnie rekordy i filtruje zakres.
- Normalizacja:
  - `normalizePmsRaw` konwertuje wartości na number i odrzuca niepoprawne.
  - `normalizePmsRecord` bierze `A` i `F` jako możliwe pola z danymi i ustawia `ts` (z pola `ts` lub z klucza).

Zobacz: [pmsAdapter.ts](src/features/pms/api/pmsAdapter.ts)

**6) Funkcje pomocnicze (pmsChartHelpers.ts)**

- `rawToPmsChartPoints` i `recordToPmsChartPoints` — tworzą trzy punkty na timestamp.
- `sortPmsChartPoints`, `groupPmsChartPointsBySeries`, `appendUniquePmsChartPoint` — porządkują i grupują dane przed podaniem ich do wykresu.

**7) Uwagi i potencjalne problemy**

- Oś X używa liczb (epoch ms). Jeśli źródło czasu dostarczy sekund zamiast ms — wykres będzie błędny.
- `pickPmsRaw` wybiera `A` lub `F` — sprawdź, która z nich jest używana przez urządzenie (A/F = różne tryby pomiaru).
- PmsChart domyślnie ustawia `pointRadius: 0` — punkty są niewidoczne (tylko linie). To ważne przy debugowaniu braku widocznych punktów.
- W przypadku problemów z live: sprawdź reguły dostępu Firebase (see errors handling in `usePmsLive`).

**8) Gdzie zmieniać rzeczy**

- Kolory: zmienne CSS (`--pm1`, `--pm25`, `--pm10`, `--panel-2`) użyte przez `readChartPalette()` w `PmsChart.tsx`.
- Progi i etykiety live: `severityFor` / `severityLabel` w `PmsLivePanel.tsx`.
- Opcje wykresu (tension, borderWidth, tooltip callbacks): edytuj `createDataset()` i `createChart()` w `PmsChart.tsx`.

---

Plik utworzony w: `docs/pms-charts-structure.md` — jeśli chcesz, mogę dopisać diagram, przykładowe fragmenty JSON z Firebase albo krótką instrukcję debugowania krok-po-kroku.

**9) Diagnoza problemu i rekomendacja: czy rozdzielić wykresy?**

- Problemy z aktualną implementacją:
  - `PmsChart` łączy odpowiedzialność za renderowanie, zarządzanie oknem czasowym i obsługę interakcji pointer/wheel. To utrudnia testowanie i ponowne użycie.
  - Część logiki stanu (np. inicjalizacja okna, pan/zoom) jest trwale spięta z cyklem życia komponentu i DOM (event listeners), co utrudnia przenoszenie do innych widoków.
  - `PmsLivePanel` i `PmsChart` korzystają z tej samej źródłowej struktury danych, ale nie dzielą wspólnego API do zarządzania widokiem czasu — możliwe duplikacje i niespójności.
  - Trudności w debugowaniu: brak wyraźnego API do ustawiania window/zoom, testy integracyjne muszą inicjalizować Chart.js oraz symulować pointer events.

- Czy rozdzielić wykresy? Rekomendacja:
  - Tak — warto rozdzielić odpowiedzialności. Główne zalety:
    - Lepsza testowalność (unit tests dla hooków, snapshoty dla rendererów).
    - Większa czytelność i prostota `PmsChart` (render-only).
    - Możliwość ponownego użycia `PmsChart` w innych kontekstach (iframe, inny kontener).
    - Mniejsze ryzyko regresji przy zmianach UI/interactionów.

- Najprostszy plan rozdzielenia (krok po kroku, minimalny ryzyk):
  1. Wyodrębnić czyste helpery i zachować ich testy (`pmsChartHelpers.ts`) — mały, bezpieczny commit.
  2. Utworzyć hook `useChartWindow(bounds)` zarządzający window/pan/zoom i expose: `{ window, setWindow, pan, zoom }`.
  3. Utworzyć hook `useChartInteractions(canvasRef, controller)` z pointer/wheel handlers, wywołujący metody z hooka window.
  4. Zmodyfikować `PmsChart` tak, by przyjmował `seriesData` i `window` jako props i nie tworzył listenerów domowych.
  5. Dodać `ChartController` (komponent kontener) który łączy hooki, subskrybuje dane history, i przekazuje do `PmsChart`.
  6. Stopniowo zastępować stare użycia `PmsChart` kontenerem — commit po commicie.

- Przykładowe (docelowe) API `PmsChart`:
  - `interface PmsChartProps { seriesData: SeriesData; window?: {start:number,end:number}; palette?: ChartPalette; onReady?: ()=>void }`

- Najważniejsze ryzyka i ich mitigacje:
  - Regresje UI: wdrażaj stopniowo i zachowaj kompatybilne propsy przez warstwę adaptera.
  - Testy wymagające Chart.js: testuj hooki i helpery bez Chart.js; integrację z Chart.js zostawić w oddzielnych integracyjnych testach/preview.

---

Aktualizacja gotowa — jeśli chcesz, wprowadzę teraz `useChartWindow` jako pierwszy patch (z testami dla helperów). Możemy też najpierw dodać diagram sekwencji.

**10) Plan etapowy (proponowany, etapowy)**

- **Cel:** Rozdzielić odpowiedzialności renderowania, zarządzania oknem czasowym i obsługi interakcji, zachowując kompatybilność i minimalne ryzyko regresji.

- **Faza 1 — Rekonesans i zabezpieczenia (1-2 dni)**
  - Przejrzeć i ustabilizować helpery: `pmsChartHelpers.ts`, `pmsHelpers.ts` (unit tests).
  - Dodać krótkie testy jednostkowe dla `rawToPmsChartPoints` i `pickPmsRaw`.
  - Cel: pewne i niezmienne API helperów przed refaktorem.
  - Status: ✅ wykonane (`npm test` przechodzi, testy helperów dodane).

- **Faza 2 — Wyodrębnienie logiki okna (2-4 dni)**
  - Wprowadzić `useChartWindow(bounds)` (pure hook): expose `{ window, setWindow, pan, zoom, reset }`.
  - Pokryć hook testami (jednostkowe) dla pan/zoom/ograniczeń (`MIN_WINDOW_MS`, `REALTIME_WINDOW_MS`).
  - Cel: logika okna niezależna od DOM i Chart.js.
  - Status: ✅ wykonane (`useChartWindow.ts` + testy `useChartWindow.test.ts`).

- **Faza 3 — Interakcje (2-3 dni)**
  - Utworzyć `useChartInteractions(canvasRef, controller)` obsługujące pointer/wheel/pinch i wywołujące metody z `useChartWindow`.
  - Zaimplementować testy integracyjne (symulacja zdarzeń) tam, gdzie to sensowne.
  - Cel: przenieść listener-y z komponentu do hooka testowalnego.
  - Status: ✅ wykonane (`useChartInteractions.ts` + testy `useChartInteractions.test.ts`).

- **Faza 4 — Rozdzielenie prezentacji i kontrolera (2-3 dni)**
  - Zmodyfikować `PmsChart` do: render-only, props: `seriesData`, `window`, `palette`, `onReady`.
  - Stworzyć `ChartController` (kontener) łączący `useChartWindow`, `useChartInteractions`, subskrypcje danych i przekazujący props do `PmsChart`.
  - Cel: zachować dotychczasową funkcjonalność, ułatwić testowanie i reuse.
  - Status: ✅ wykonane (`PmsChart` render-only + `PmsChartController` + podmiana w `PmsSection`).

- **Faza 5 — Stopniowe przełączanie i testy e2e (1-2 tygodnie)**
  - Wprowadzać po jednym miejscu użycia (`ChartController` zastępuje stary `PmsChart`) i testować ręcznie/regresyjnie.
  - Uruchomić end-to-end smoke tests (preview strony, sprawdzić pan/zoom, live feed).
  - Cel: zminimalizować ryzyko regresji przy wdrożeniach.
  - Status: ✅ wykonane (rollout na `PmsSection` + smoke test DevTools/Playwright, pan controls działają).

- **Faza 6 — Uporządkowanie i dokumentacja (1-2 dni)**
  - Zaktualizować dokumentację (ten plik), dodać przykłady API `PmsChart` i `ChartController`.
  - Zamknąć zadania refaktoru, przegląd PR i merge.
  - Status: ✅ wykonane (zaktualizowany raport + status faz i kryteria zamknięcia).

- **Kryteria zakończenia:**
  - Helpery i hooki mają testy jednostkowe.
  - `PmsChart` jest render-only i działa z przekazywanym `window`.
  - Interakcje działają przez `useChartInteractions` bez bezpośrednich listenerów w `PmsChart`.
  - Brak regresji UI w podstawowych scenariuszach (manual smoke tests).

- **Bramki jakości (go/no-go) po każdej fazie:**
  - `Go`: zielone testy fazy + brak nowych błędów runtime w DevTools.
  - `No-go`: choć 1 regresja funkcjonalna (pan/zoom/live), test failing lub niejasny ownership zmiany.
  - Każda faza kończy się osobnym PR-em z krótkim rollback planem.

- **Podział odpowiedzialności (ograniczenie ryzyka):**
  - Faza 1-2: tylko helpery/hooki (bez zmian UX).
  - Faza 3: tylko warstwa interakcji (bez zmian adaptera danych).
  - Faza 4: tylko separacja render/controller (bez zmian kontraktów API backendu).
  - Faza 5-6: rollout i dokumentacja, bez mieszania z nowymi feature'ami.

- **Warunek zatrzymania prac (safety stop):**
  - Jeśli lint/build/testy zaczną zgłaszać nowe błędy poza obszarem fazy, zatrzymać merge i wrócić do ostatniego zielonego PR.

- **Wynik końcowy wdrożenia (fazy 1-6):**
  - `npm test -- --run`: ✅ 14/14 testów.
  - `npm run build`: ✅ przechodzi.
  - Smoke runtime (DevTools/Playwright): ✅ brak nowych błędów runtime, kontrolki pan działają.
  - Architektura: `PmsChart` = render-only, logika okna i interakcji w dedykowanych hookach, kontroler wydzielony.
