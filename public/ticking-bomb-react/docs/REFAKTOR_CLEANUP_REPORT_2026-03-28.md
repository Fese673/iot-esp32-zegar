# Raport Refaktoru i Cleanupu

Data audytu: 2026-03-28
Zakres: cały projekt aplikacji webowej w folderze ticking-bomb-react
Tryb: audyt read-only + weryfikacja narzędziowa (lint/build/test)
Aktualizacja wdrożeniowa: 2026-03-28 (implementacja findingów S1 + S2 + S3 + rewalidacja)

## 1. Cel raportu

Celem tego raportu jest wskazanie najważniejszych obszarów refaktoru i cleanupu, które:
- poprawią czytelność i utrzymanie kodu,
- ograniczą ryzyko regresji,
- poprawią wydajność,
- nie naruszą działającej funkcjonalności (plan zmian etapowych, bezpiecznych).

## 2. Metodologia

Audyt został wykonany na podstawie:
- przeglądu kodu źródłowego (src, docs, konfiguracje),
- analizy architektury modułów dashboard i PMS,
- uruchomienia quality gate (stan bazowy):
  - npm run lint (wynik: nie przechodzi),
  - npm run test -- --run (wynik: przechodzi),
  - npm run build (wynik: przechodzi, ostrzeżenie o wielkości bundla).

Po wdrożeniu krytycznych findingów S1 wykonano ponowną walidację:
- npm run lint (wynik: przechodzi),
- npm run test -- --run (wynik: przechodzi),
- npm run build (wynik: przechodzi, utrzymane ostrzeżenie o chunku >500 kB).

Po wdrożeniu wysokich findingów S2 wykonano ponowną walidację:
- npm run lint (wynik: przechodzi),
- npm run test -- --run (wynik: przechodzi),
- npm run build (wynik: przechodzi, utrzymane ostrzeżenie o chunku >500 kB).

Po wdrożeniu średnich findingów S3 wykonano ponowną walidację:
- npm run lint (wynik: przechodzi),
- npm run test -- --run (wynik: przechodzi),
- npm run build (wynik: przechodzi; wdrożony code-splitting usunął ostrzeżenie o chunku >500 kB).

## 3. Szybkie metryki projektu

- Liczba plików TS/TSX w src: 51
- Liczba testów (.test.ts/.test.tsx): 13
- Liczba plików CSS w src: 1
- Główny arkusz stylów: src/styles.css ma 854 linii
- Pokrycie testami: rozszerzone o smoke testy dashboard (topbar/live/history/connection)

## 4. Status quality gate

### 4.1 Lint

Stan bazowy audytu: 17 problemów (11 błędów, 6 ostrzeżeń)

Stan po wdrożeniu S1: przechodzi (0 błędów, 0 ostrzeżeń)

Stan po wdrożeniu S2: przechodzi (0 błędów, 0 ostrzeżeń)

Stan po wdrożeniu S3: przechodzi (0 błędów, 0 ostrzeżeń)

Główne klasy problemów:
- react-hooks/set-state-in-effect
- react-hooks/exhaustive-deps
- react-hooks/immutability
- react-refresh/only-export-components

Najważniejsze lokalizacje:
- src/features/dashboard/hooks/useConnectionHealth.ts:24
- src/features/dashboard/hooks/useHistoryData.ts:66
- src/features/dashboard/hooks/useLiveMetrics.ts:18
- src/features/pms/hooks/usePmsData.ts:26
- src/features/pms/hooks/usePmsHistory.ts:54
- src/features/pms/hooks/usePmsLive.ts:33
- src/features/dashboard/components/HistoryChart.tsx:489
- src/App.tsx:71
- src/features/pms/components/PmsChartController.tsx:55

### 4.2 Testy

Stan bazowy audytu: przechodzą (9/9 plików, 23/23 testów)

Stan po wdrożeniu S1: przechodzą (9/9 plików, 23/23 testów)

Stan po wdrożeniu S2: przechodzą (9/9 plików, 23/23 testów)

Stan po wdrożeniu S3: przechodzą (13/13 plików, 29/29 testów)

Uwaga: po S3 dodano smoke testy dashboard, ale najgłębsze pokrycie nadal dominuje w module PMS.

### 4.3 Build

Stan bazowy audytu: przechodzi.

Stan po wdrożeniu S1: przechodzi.

Stan po wdrożeniu S2: przechodzi.

Stan po wdrożeniu S3: przechodzi.

Dodatkowa obserwacja: po wdrożeniu lazy loading + manualChunks nie występuje już ostrzeżenie o chunku >500 kB.

## 5. Skala priorytetów (Stopień)

- S1 Krytyczny: wysokie ryzyko błędów runtime/regresji lub ciągłego spadku wydajności
- S2 Wysoki: istotny dług techniczny utrudniający rozwój i zwiększający koszt zmian
- S3 Średni: cleanup i porządki ważne dla czytelności i stabilności procesu
- S4 Niski: drobne niespójności i poprawki kosmetyczne

---

## 6. Najważniejsze findings (co, gdzie, stopień, ryzyko, rekomendacja)

## F-01
Stopień: S1 Krytyczny
Obszar: Architektura danych live PMS

Co:
Podwójna subskrypcja PMS live i ryzyko rozjazdu stanu.

Gdzie:
- src/features/pms/components/PmsHistorySection.tsx:28
- src/features/pms/hooks/usePmsData.ts:17

Ryzyko:
- redundantne nasłuchiwanie tego samego źródła,
- dodatkowe re-rendery,
- potencjalna niespójność między kafelkami live a wykresem.

Rekomendacja:
- Zostawić jedno źródło live w module PMS (single source of truth),
- przekazywać dane przez jeden hook (np. usePmsData rozszerzony o liveSnapshot).

Szacowany effort: M

---

## F-02
Stopień: S1 Krytyczny
Obszar: Logika aktualizacji punktów wykresu PMS

Co:
Deduplikacja live points po samym x (timestamp), co blokuje aktualizacje przy stabilnym timestampie.

Gdzie:
- src/features/pms/hooks/usePmsData.ts:45

Ryzyko:
- wykres PMS może wyglądać jak „zamrożony”,
- aktualizacje z tym samym ts i nowymi wartościami nie są nanoszone.

Rekomendacja:
- stosować upsert po kluczu złożonym series + x,
- użyć istniejącej semantyki appendUniquePmsChartPoint z podmianą wartości dla tego samego punktu.

Szacowany effort: S/M

---

## F-03
Stopień: S1 Krytyczny
Obszar: Wydajność globalna renderów

Co:
Częste globalne dispatch (co 1s) i brak stabilizacji wartości context, co może powodować kosztowne re-rendery całego drzewa.

Gdzie:
- src/features/dashboard/hooks/useConnectionHealth.ts:32
- src/App.tsx:192

Ryzyko:
- niepotrzebne re-rendery komponentów ciężkich (wykresy),
- degradacja UX na słabszych urządzeniach.

Rekomendacja:
- dispatch statusu tylko przy realnej zmianie,
- memoizacja value kontekstu (useMemo),
- rozdzielenie kontekstów na mniejsze (np. AlertsContext, ConnectionContext).

Szacowany effort: M

---

## F-04
Stopień: S1 Krytyczny
Obszar: Jakość bazowa (lint nieprzechodzący)

Co:
Projekt nie przechodzi lint quality gate.

Gdzie:
- src/features/dashboard/hooks/useConnectionHealth.ts:24
- src/features/dashboard/hooks/useHistoryData.ts:66
- src/features/dashboard/hooks/useLiveMetrics.ts:18
- src/features/pms/hooks/usePmsData.ts:26
- src/features/pms/hooks/usePmsHistory.ts:54
- src/features/pms/hooks/usePmsLive.ts:33
- src/features/dashboard/components/HistoryChart.tsx:489
- src/App.tsx:71
- src/features/pms/components/PmsChartController.tsx:55

Ryzyko:
- rosnąca liczba regresji,
- utrata kontroli nad stylem i wzorcami hooków,
- trudniejsze code review.

Rekomendacja:
- Faza 1 refaktoru = doprowadzenie lint do zera błędów,
- utrzymać regułę „no new lint debt”.

Szacowany effort: M/L

---

## 6A. Aktualizacja wdrożenia findingów S1

Status: wykonane i zweryfikowane narzędziowo.

### F-01 (single source PMS live)

Wdrożenie:
- usunięto duplikację subskrypcji live w sekcji PMS,
- `PmsHistorySection` konsumuje live snapshot zwracany przez `usePmsData`,
- źródło live jest utrzymywane przez jeden hook `usePmsLive`.

Kluczowe pliki:
- src/features/pms/components/PmsHistorySection.tsx
- src/features/pms/hooks/usePmsData.ts
- src/features/pms/hooks/usePmsLive.ts

### F-02 (upsert points po series + x)

Wdrożenie:
- akumulacja live points jest wykonywana przez `appendUniquePmsChartPoint` (klucz `series + x`),
- merge historii i sesji live używa upsertu zamiast deduplikacji po samym `x`.

Kluczowe pliki:
- src/features/pms/hooks/usePmsLive.ts
- src/features/pms/hooks/usePmsData.ts

### F-03 (redukcja globalnych re-renderów)

Wdrożenie:
- wydzielono kontekst aplikacji do osobnego modułu (`AppContext`),
- ustabilizowano wartość providera przez `useMemo`,
- ograniczono dispatch statusu połączenia do realnej zmiany statusu.

Kluczowe pliki:
- src/shared/context/AppContext.ts
- src/App.tsx
- src/features/dashboard/hooks/useConnectionHealth.ts

### F-04 (lint gate)

Wdrożenie:
- usunięto błędy hooków (`set-state-in-effect`, `exhaustive-deps`, `refs`),
- poprawiono naruszenie immutability w wykresie dashboard,
- wyniesiono helpery z `PmsChartController` do modułu util (zgodność z fast refresh),
- zaktualizowano testy pod nową strukturę kontekstu i API hooka.

Kluczowe pliki:
- src/features/dashboard/components/HistoryChart.tsx
- src/features/pms/components/PmsChart.tsx
- src/features/pms/components/PmsChartController.tsx
- src/features/pms/lib/pmsFollowWindow.ts
- src/features/pms/components/__tests__/PmsHistorySection.test.tsx
- src/features/pms/hooks/__tests__/usePmsHistory.test.tsx

Walidacja po wdrożeniu S1:
- npm run lint: PASS
- npm run test -- --run: PASS (9/9, 23/23)
- npm run build: PASS (z utrzymanym ostrzeżeniem o dużym chunku)

---

## F-05
Stopień: S2 Wysoki
Obszar: Funkcjonalność UI (martwe przyciski)

Co:
Przyciski wyglądają na aktywne, ale nie mają handlerów.

Gdzie:
- src/features/dashboard/components/TopBar.tsx:58 (btnRefresh)
- src/features/dashboard/components/HistoryPanel.tsx:66 (btnToday)
- src/features/dashboard/components/HistoryPanel.tsx:67 (btnClear)

Ryzyko:
- mylący UX,
- zgłoszenia „nie działa kliknięcie”,
- utrata zaufania do panelu.

Rekomendacja:
- podpiąć realne akcje albo usunąć przyciski do czasu implementacji,
- dodać testy interakcji dla tych elementów.

Szacowany effort: S

---

## F-06
Stopień: S2 Wysoki
Obszar: CSS cleanup / dług stylów

Co:
W styles.css pozostały liczne selektory po usuniętej/nieużywanej strukturze.

Gdzie:
- src/styles.css:463 (pms-master-head)
- src/styles.css:467 (pms-stack)
- src/styles.css:611 (pm-preview)
- src/styles.css:624 (pm-embed-shell)
- src/styles.css:832 (panel-title-wrap)
- src/styles.css:921 (pms-section .panel-title-wrap)

Ryzyko:
- większa złożoność i trudniejsze modyfikacje layoutu,
- wysokie ryzyko efektów ubocznych przy zmianach CSS.

Rekomendacja:
- etapowy pruning nieużywanych selektorów,
- podział styles.css na moduły tematyczne (dashboard, pms, shared).

Szacowany effort: M

---

## F-07
Stopień: S2 Wysoki
Obszar: Spójność dokumentacji technicznej

Co:
Dokumenty opisują usunięte pliki i zawierają nieaktualne statusy „zrobione”.

Gdzie:
- docs/PMS_HISTORY_CHART_PLAN.md:15 (PmsLivePanel), 16 (pmsLiveHelpers), 192 (Etap 10 done)
- docs/pms-charts-structure.md:11 (odwołanie do PmsLivePanel), 136+ (statusy ✅)

Ryzyko:
- błędne decyzje implementacyjne,
- strata czasu przez pracę na nieaktualnych założeniach.

Rekomendacja:
- zsynchronizować docs z aktualnym stanem kodu,
- dodać sekcję „Stan na dzień” i ownera dokumentu.

Szacowany effort: S/M

---

## F-08
Stopień: S2 Wysoki
Obszar: Rozproszenie konfiguracji runtime

Co:
Wiele miejsc odczytuje deviceId/Firebase z window i localStorage, brak jednego modułu konfiguracyjnego.

Gdzie:
- src/shared/lib/firebaseClient.ts:29-30
- src/features/dashboard/hooks/useLiveMetrics.ts:7
- src/features/dashboard/hooks/useHistoryData.ts:10
- src/features/pms/hooks/usePmsHistory.ts:10
- src/features/pms/hooks/usePmsLive.ts:42

Ryzyko:
- niespójność zachowania między modułami,
- trudniejsze testy i debugging konfiguracji.

Rekomendacja:
- wydzielić centralny config resolver (deviceId + firebase runtime),
- używać go wszędzie zamiast powielonego fallback chain.

Szacowany effort: M

---

## 6B. Aktualizacja wdrożenia findingów S2

Status: wykonane i zweryfikowane narzędziowo.

### F-05 (martwe przyciski)

Wdrożenie:
- podpięto akcję `btnRefresh` do odświeżenia dashboardu,
- podpięto akcje `btnToday` i `btnClear` do wyboru dzisiejszej daty,
- dodano `type="button"` dla spójnego zachowania przycisków.

Kluczowe pliki:
- src/features/dashboard/components/TopBar.tsx
- src/features/dashboard/components/HistoryPanel.tsx
- src/App.tsx

### F-06 (CSS cleanup)

Wdrożenie:
- usunięto martwe selektory po usuniętym układzie PMS preview/live,
- wyczyszczono powiązane fragmenty media queries odwołujące się do nieużywanych klas,
- pozostawiono aktywne selektory layoutu i komponentów runtime.

Kluczowe pliki:
- src/styles.css

### F-07 (spójność dokumentacji)

Wdrożenie:
- zsynchronizowano dokumentację PMS z aktualną architekturą kodu,
- usunięto odwołania do nieistniejących `PmsLivePanel` i `pmsLiveHelpers`,
- dodano adnotacje o aktualnym stanie dokumentów (`stan na dzień`).

Kluczowe pliki:
- docs/pms-charts-structure.md
- docs/PMS_HISTORY_CHART_PLAN.md

### F-08 (centralizacja runtime config)

Wdrożenie:
- dodano wspólny resolver runtime (`deviceId`, `firebase config`) w jednym module,
- przepięto hooki dashboard/PMS i klienta Firebase na wspólny resolver,
- usunięto duplikowany fallback chain `window/localStorage` z wielu modułów.

Kluczowe pliki:
- src/shared/lib/runtimeConfig.ts
- src/shared/lib/firebaseClient.ts
- src/features/dashboard/hooks/useLiveMetrics.ts
- src/features/dashboard/hooks/useHistoryData.ts
- src/features/pms/hooks/usePmsHistory.ts
- src/features/pms/hooks/usePmsLive.ts

Walidacja po wdrożeniu S2:
- npm run lint: PASS
- npm run test -- --run: PASS (9/9, 23/23)
- npm run build: PASS (z utrzymanym ostrzeżeniem o dużym chunku)

---

## F-09
Stopień: S3 Średni
Obszar: Martwe pliki CSS z template Vite

Co:
W repo pozostają App.css i index.css z template, nieużywane przez runtime.

Gdzie:
- src/App.css
- src/index.css
- aktywny import stylów: src/main.tsx:3 (import './styles.css')

Ryzyko:
- szum w repo i dezorientacja przy onboardingu.

Rekomendacja:
- usunąć martwe pliki lub przenieść do archiwum.

Szacowany effort: S

---

## F-10
Stopień: S3 Średni
Obszar: Luki testowe

Co:
Testy są skoncentrowane na PMS, brak analogicznego pokrycia dashboard (live/history/connection/topbar).

Gdzie:
- brak testów w src/features/dashboard/**/__tests__
- istniejące testy: głównie src/features/pms/**/__tests__

Ryzyko:
- regresje w głównej ścieżce dashboard mogą przejść niezauważone.

Rekomendacja:
- dodać smoke testy dashboard: render, przyciski, status połączenia, fallback danych.

Szacowany effort: M

---

## F-11
Stopień: S3 Średni
Obszar: Bundle performance

Co:
Build sygnalizuje duży chunk JS (>500 kB).

Gdzie:
- wynik npm run build

Ryzyko:
- wolniejszy start aplikacji przy słabszym łączu/urządzeniu.

Rekomendacja:
- code-splitting sekcji ciężkich (np. chart modules),
- lazy loading komponentów wykresowych.

Szacowany effort: M

---

## 6C. Aktualizacja wdrożenia findingów S3

Status: wykonane i zweryfikowane narzędziowo.

### F-09 (martwe pliki CSS template)

Wdrożenie:
- usunięto nieużywane pliki `src/App.css` i `src/index.css`,
- pozostawiono jeden aktywny arkusz globalny (`src/styles.css`) importowany w `main.tsx`.

Kluczowe pliki:
- src/main.tsx
- src/styles.css

### F-10 (luki testowe dashboard)

Wdrożenie:
- dodano smoke testy dashboard dla kluczowych obszarów: topbar, live grid, history panel i connection health,
- testy pokrywają render fallbacków, statusy i krytyczne interakcje przycisków.

Kluczowe pliki:
- src/features/dashboard/components/__tests__/TopBar.test.tsx
- src/features/dashboard/components/__tests__/LiveGrid.test.tsx
- src/features/dashboard/components/__tests__/HistoryPanel.test.tsx
- src/features/dashboard/hooks/__tests__/useConnectionHealth.test.tsx

### F-11 (bundle performance)

Wdrożenie:
- wdrożono lazy loading ciężkich sekcji wykresowych (`HistoryPanel`, `PmsSection`) przez `React.lazy` + `Suspense`,
- dodano manualne rozdzielenie chunków vendor dla Firebase i Chart.js.

Kluczowe pliki:
- src/App.tsx
- vite.config.ts

Walidacja po wdrożeniu S3:
- npm run lint: PASS
- npm run test -- --run: PASS (13/13, 29/29)
- npm run build: PASS

Wynik build po S3:
- brak ostrzeżenia o chunku >500 kB; bundle rozdzielony na mniejsze chunki (`firebase`, `charts`, lazy sekcje dashboard/PMS).

---

## F-12
Stopień: S4 Niski
Obszar: Spójność treści i semantyki UI

Co:
Pozostałości tekstów roboczych i niespójności semantyczne.

Gdzie:
- src/features/pms/components/PmsHistorySection.tsx:46 (tekst „NIE usuwać tej sekcji”)

Ryzyko:
- nieprofesjonalny przekaz w UI produkcyjnym.

Rekomendacja:
- usunąć teksty operatorskie z warstwy UI.

Szacowany effort: S

---

## 7. Plan wdrożenia (bez naruszania działania)

## Etap A (najpierw bezpieczeństwo)

1. Naprawić lint do 0 błędów (bez dużej przebudowy architektury).
2. Dodać testy smoke dla dashboard.
3. Podpiąć lub usunąć martwe przyciski (btnRefresh/btnToday/btnClear).

Wyjście etapu:
- npm run lint: zielony
- npm run test -- --run: zielony
- build: zielony

## Etap B (stabilizacja danych i renderów)

1. Ujednolicić źródło live PMS (usunąć duplikat usePmsLive).
2. Poprawić upsert live points (series + x).
3. Ograniczyć globalne dispatch tylko do zmian statusu.
4. Zmemoizować value kontekstu i rozważyć podział kontekstów.

Wyjście etapu:
- mniej renderów, brak „zamrożeń” live chart.

## Etap C (cleanup repo i CSS)

1. Usunąć martwe selektory z styles.css.
2. Usunąć martwe App.css/index.css.
3. Zaktualizować dokumentację docs/* do stanu faktycznego.

Wyjście etapu:
- czytelny kod, krótsza ścieżka zmian UI.

## Etap D (optymalizacje)

1. Code-splitting ciężkich komponentów wykresowych.
2. Dodatkowe testy regresji pod dane live/history.

Wyjście etapu:
- lepszy TTI i mniejsze ryzyko regresji.

---

## 8. Szybkie wygrane (quick wins, 1-2 dni)

- QW-01: Usunąć martwe pliki src/App.css i src/index.css.
- QW-02: Usunąć tekst operatorski z PmsHistorySection.
- QW-03: Podpiąć onClick dla btnToday/btnClear/btnRefresh lub tymczasowo usunąć przyciski.
- QW-04: Zaktualizować docs do aktualnej architektury (usunąć odwołania do PmsLivePanel i pmsLiveHelpers).

---

## 9. Proponowana kolejność wdrożeń (priorytet biznesowy)

1. F-04 (lint errors)
2. F-01 + F-02 (PMS live i upsert)
3. F-03 (globalne re-rendery)
4. F-05 (martwe przyciski)
5. F-06 + F-09 (cleanup CSS i martwe pliki)
6. F-07 (docs)
7. F-10 + F-11 (test gaps i performance)

---

## 10. Ryzyka wdrożeniowe i jak je kontrolować

- Ryzyko: regresja wykresów po refaktorze hooków
  - Mitigacja: małe PR-y, testy po każdym kroku, porównanie snapshotów danych

- Ryzyko: naruszenie layoutu po cięciu CSS
  - Mitigacja: usuwanie selektorów tylko po potwierdzeniu braku użycia + smoke test na desktop/mobile

- Ryzyko: zmiany w kontekście spowodują uboczne re-rendery
  - Mitigacja: profilowanie renderów i etapowe rozbijanie contextu

---

## 11. Podsumowanie zarządcze

Najważniejsze rzeczy do refaktoru i cleanupu, które dają największy efekt przy najniższym ryzyku, to:
1. Ustabilizować quality gate (lint),
2. Naprawić logikę live PMS (single source + upsert),
3. Ograniczyć globalny koszt renderów,
4. Wyciąć martwy CSS i nieużywane pliki,
5. Urealnić dokumentację.

Po wykonaniu tych kroków kod będzie wyraźnie czystszy, łatwiejszy w utrzymaniu i odporniejszy na regresje, bez naruszenia działania strony.

---

## 12. Komunikaty z konsoli po ostatnim wdrożeniu

Poniższe wpisy zostały sprawdzone pod kątem źródła i krytyczności. Część z nich pochodzi z naszej aplikacji, część z zewnętrznych skryptów Firebase albo z DevTools przeglądarki.

### 12.1 `[vite] connecting...` i `[vite] connected.`

Znaczenie:
- normalne komunikaty Vite podczas łączenia klienta HMR z serwerem deweloperskim.

Krytyczność:
- S4 Niski.

Status:
- nie wymaga poprawki; to poprawny sygnał stanu dev servera.

### 12.2 `Ta strona jest w trybie zgodności wstecznej... "<!DOCTYPE html>"...`

Znaczenie:
- przeglądarka zgłasza dokument w trybie quirks/compatibility albo podobny dokument podrzędny w iframe bez standardowego doctype.
- w naszej aplikacji główny dokument ma poprawne `<!doctype html>` w [index.html](index.html), więc ten komunikat nie wskazuje na błąd głównego shellu.

Krytyczność:
- S3 Średni, ale tylko jako ostrzeżenie diagnostyczne.

Status:
- nie jest to błąd logiki aplikacji.
- źródłem jest zewnętrzny kontekst Firebase (`firebase_database.js`) lub osadzony iframe/zasób pomocniczy.

Rekomendacja:
- nie zmieniać doctype w naszej stronie, bo jest już poprawny.
- traktować jako szum środowiskowy, chyba że identyczny komunikat pojawi się w samym dokumencie aplikacji po otwarciu źródła głównego.

### 12.3 `Nadano przegrodzone ciasteczko lub dostęp do przechowywania danych...` / `navigator.sendBeacon...` z `.lp`

Znaczenie:
- to komunikaty z zasobów Firebase uruchamianych w kontekście trzeciej strony/iframe.
- dotyczą polityki storage/cookies i użycia synchronicznego XHR podczas unload/pagehide.

Krytyczność:
- S4 Niski.

Status:
- nie są to błędy aplikacji.
- nie wpływają bezpośrednio na działanie dashboardu, lecz mogą generować szum w konsoli.

Rekomendacja:
- nie próbować ich „naprawiać” w naszej aplikacji.
- jeśli zależy nam na czystszej konsoli, sprawdzić czy nie da się ograniczyć zewnętrznych iframe/legacy embedów Firebase, ale to ma niski priorytet.

### 12.4 `Błąd mapy źródła: JSON.parse...` dla `installHook.js.map` i `react_devtools_backend_compact.js.map`

Znaczenie:
- uszkodzone lub niekompletne sourcemapy po stronie rozszerzenia/DevTools albo devtools-injected script.

Krytyczność:
- S4 Niski.

Status:
- nie jest to problem bundlera aplikacji.
- błąd dotyczy narzędzi developerskich w przeglądarce, nie runtime UI.

Rekomendacja:
- ignorować w kontekście produkcyjnej aplikacji.
- do diagnostyki wydajności korzystać z profilu i logów aplikacyjnych, nie z tych sourcemap warningów.

### 12.5 Wniosek praktyczny

- Jedyny komunikat, który mógł sugerować realny problem z naszym kodem, był warning render-phase update z `PmsHistorySection`; on został już zlikwidowany w poprzednim etapie refaktoru.
- Obecne wpisy z konsoli to głównie Vite/Firebase/DevTools noise albo zewnętrzne ostrzeżenia o niskiej krytyczności.
- Nie wymaga to kolejnej zmiany funkcjonalnej w aplikacji, tylko właściwej interpretacji w raporcie.
