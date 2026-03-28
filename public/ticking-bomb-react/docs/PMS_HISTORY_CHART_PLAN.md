# PMS History Chart Plan

## Cel

Naprawić i ustabilizować sekcję `<section class="pms-inner-panel" aria-label="Historia i trend dla PMS5003">` przez porównanie Reactowej implementacji z baseline z katalogu `_baseline`.

Priorytetem jest zgodność zachowania, lifecycle Chart.js, kontraktu danych i izolacja sekcji od reszty dashboardu.

## Źródła prawdy

- Baseline history chart: `_baseline/pms-module.js`
- Current React history section: `src/features/pms/components/PmsHistorySection.tsx`
- Current chart controller: `src/features/pms/components/PmsChartController.tsx`
- Current chart renderer: `src/features/pms/components/PmsChart.tsx`
- Current PMS data combiner: `src/features/pms/hooks/usePmsData.ts`
- Shared PM helpers: `src/features/pms/lib/pmsHelpers.ts`

## Stan docelowy

- Wykres historii PMS działa w osobnym module, bez współdzielenia stanu z dashboardem.
- Chart.js jest tworzony raz, aktualizowany przy zmianie danych i niszczony w cleanup.
- Wykres zachowuje baseline: etykiety, kolory, tooltipy, osie, kolejność serii i zakres Y.
- Kafelki live PM są zasilane niezależnie od historii (oddzielne źródła danych i efekty).
- Layout po usunięciu `<aside class="pm-live-info">` nie zostawia pustych przestrzeni.

## Porównanie baseline vs React

### Baseline

- `buildPmsChart()` tworzy wykres liniowy z trzema datasetami PM 1.0 / PM 2.5 / PM 10.
- Dataset ma `fill: true`, `tension: 0.35`, `borderDash` dla PM10 i y-axis zaczynającą się od zera.
- `pmsLoadDay()` czyści wykres przed nowym ładowaniem, potem ustawia dane i wywołuje `update("none")`.
- Wykres jest częścią jednego panelu, ale jego stan jest imperatywnie zarządzany i nie opiera się na callbacku rodzica.

### React

- Historia jest już wydzielona do `PmsHistorySection` i `PmsChartController`.
- `PmsChart` tworzy instancję Chart.js przez `useEffect` i aktualizuje datasets w drugim `useEffect`.
- Dane live są dołączane tylko dla dzisiejszej daty i przez oddzielne helpery.
- Layout jest już rozdzielony na panel live i panel historii z separatorem.

## Etapowy plan naprawy

### Etap 0. Zamrożenie stanu odniesienia

Cel: mieć punkt porównania, zanim ruszy się zachowanie.

Zadania:
1. Potwierdzić baseline render history chart w `_baseline/pms-module.js`.
2. Spisać różnice w datasetach, tooltipach, skalach, y-axis i cleanupie.
3. Ustalić checklistę regresji dla sekcji PMS.

Warunek zakończenia:
- Lista różnic jest kompletna i przypisana do konkretnych plików.

### Etap 1. Odseparowanie sekcji PMS

Cel: żadnych wspólnych efektów ani stanów między panelem live i historią.

Zadania:
1. Utrzymać rozdział odpowiedzialności między live PM a historią (`usePmsLive` / `usePmsHistory` + `usePmsData`).
2. Nie przekazywać stanu wykresu ani refów między nimi.
3. Zachować wizualny separator między blokami.

Warunek zakończenia:
- Obie sekcje renderują się niezależnie i nie wpływają na siebie rerenderami.

### Etap 2. Parity danych dla panelu live

Cel: panel live ma pokazywać poprawne wartości PM, a nie mylone pola z rekordu.

Zadania:
1. Utrzymać model trzech kafelków PM (`PM1`, `PM2.5`, `PM10`) zgodnie z aktualnym UI.
2. Sprawdzić, czy wartości pochodzą z właściwego źródła `particles / P / A / F`.
3. Utrzymać zgodność mapowania `extractPmRawLike()` z baseline adapterem i etykietami UI.

Warunek zakończenia:
- Panel live pokazuje poprawne wartości PM i zgodne znaczenie danych względem baseline.

### Etap 3. Parity Chart.js dla historii

Cel: historia ma renderować się i odświeżać tak jak baseline chart.

Zadania:
1. Zweryfikować init/destroy/update Chart.js w `PmsChart`.
2. Sprawdzić, czy dane wejściowe są przekazywane do datasets w momencie update, a nie tylko przy starcie.
3. Upewnić się, że cleanup zawsze niszczy poprzednią instancję.
4. Porównać tooltipy, legendę, skale i `fill/tension` z baseline.

Warunek zakończenia:
- Instancja wykresu aktualizuje się bez migotania, pustego canvasu ani duplikacji instancji.

### Etap 4. Diagnostyka danych historycznych

Cel: ustalić, czy problem jest w danych, mapowaniu czy lifecycle.

Zadania:
1. Sprawdzić, czy `usePmsHistory()` zwraca punkty z właściwej daty.
2. Zweryfikować, czy `extractPmRawLike()` i `rawToPmsChartPoints()` nie mieszają schematów.
3. Dodać testy na puste, częściowe i pełne rekordy.

Warunek zakończenia:
- Każdy przypadek ma jednoznaczny wynik: dane brakują, mapowanie jest złe albo lifecycle nie odświeża canvasu.

### Etap 5. Weryfikacja layoutu

Cel: usunąć puste przestrzenie po `aside` i utrzymać czytelny układ.

Zadania:
1. Potwierdzić, że sekcja `.pms5003-grid` nie rezerwuje miejsca po usuniętych blokach live-preview.
2. Upewnić się, że część wykresowa i kalendarz w `.panel-body.split` zajmują pełną szerokość dostępnego bloku.
3. Zachować wizualne obramowanie i separator między blokami.

Warunek zakończenia:
- Panel live i panel historii są wizualnie rozdzielone, ale bez martwych przestrzeni.

### Etap 6. Testy regresji

Cel: zamknąć ryzyko ponownego zepsucia wykresu.

Zadania:
1. Test lifecycle Chart.js dla historii.
2. Test mapowania live PM (`pm1/pm25/pm10`) dla panelu live.
3. Testy danych historycznych i fallbacków.
4. Manualna weryfikacja: dziś, inny dzień, brak danych, błąd Firebase.

Warunek zakończenia:
- `build` i testy przechodzą, a ekran zachowuje się jak baseline.

### Etap 7. Live tile parity

Cel: trzy kafelki w `pms5003-grid` mają pokazywać bieżące wartości PM z live rekordu, nawet jeśli ten sam rekord zawiera też blok `particles`.

Zadania:
1. Ustalić priorytet źródeł dla live PM: `A` / `F` / top-level pm fields, bez mylenia z `particles`.
2. Zweryfikować render `pm1Value`, `pm25Value` i `pm10Value` w sekcji live.
3. Dodać test regresyjny dla mieszanego rekordu live z `particles` i `A`.

Warunek zakończenia:
- Trzy kafelki live pokazują rzeczywiste dane PM, a nie `--`, gdy rekord live zawiera poprawne wartości PM.

### Etap 8. Live chart refresh parity

Cel: wykres historii PMS ma odświeżać bieżący punkt live nawet wtedy, gdy snapshot przychodzi z tym samym timestampem.

Zadania:
1. Porównać baseline `pmsAppendRealtime()` z Reactowym merge punktów w `PmsHistorySection`.
2. Upewnić się, że live punkt z tym samym `series + x` nadpisuje poprzedni zamiast być odrzucany.
3. Dodać test regresyjny dla aktualizacji punktu o tym samym timestampie.

Warunek zakończenia:
- Wykres historii odświeża się po nowych live danych także przy stabilnym `ts`, bez gubienia aktualizacji.

### Etap 9. Live timestamp parity

Cel: timestamp live PMS musi być w tej samej jednostce co history chart, czyli w epoch milliseconds, oraz panel musi remountować się jak dashboardowy history chart przy zmianie dnia.

Zadania:
1. Porównać `usePmsLive()` z `useLiveMetrics()` i `liveRecordToChartPoints()`.
2. Upewnić się, że live timestamp jest normalizowany do ms przed budowaniem punktów wykresu.
3. Zastosować stabilny `key` dla `PmsChartController` przy zmianie dnia, jak w `HistoryPanel`.
4. Dodać test regresyjny dla normalizacji timestampu.

Warunek zakończenia:
- Live punkty PMS trafiają na oś X w tej samej skali co baseline, a wykres odświeża się po zmianie dnia bez starego stanu.

### Etap 10. Live window follow parity

Cel: okno wykresu PMS ma podążać za bieżącym punktem live dla dzisiejszej daty, tak by wykres nie zatrzymywał się wizualnie po kilku sekundach/minutach.

Zadania:
1. Porównać inicjalne ustawienie okna i pan/zoom z baseline `pmsWindow`.
2. Dodać regułę auto-follow dla prawej krawędzi, gdy live punkt zbliża się do końca aktualnego okna.
3. Utrzymać bezpieczne zachowanie dla ręcznego pan/zoom poza obszarem live.
4. Dodać testy helperów odpowiedzialnych za decyzję auto-follow i clamp okna.

Warunek zakończenia:
- Dla wybranego dnia "dziś" wykres płynnie pokazuje kolejne live odczyty bez konieczności ręcznego odświeżania strony.

## Status wykonania

Stan na 2026-03-28: statusy poniżej odzwierciedlają zamknięte etapy refaktoru w aktualnej wersji kodu.

- Etap 0: zrobiony i zweryfikowany.
- Etap 1: zrobiony i zweryfikowany.
- Etap 2: zrobiony i zweryfikowany.
- Etap 3: zrobiony i zweryfikowany.
- Etap 4: zrobiony i zweryfikowany.
- Etap 5: zrobiony i zweryfikowany.
- Etap 6: zrobiony i zweryfikowany.
- Etap 7: zrobiony i zweryfikowany.
- Etap 8: zrobiony i zweryfikowany.
- Etap 9: zrobiony i zweryfikowany.
- Etap 10: zrobiony i zweryfikowany.

## Kryteria akceptacji

- `pms-inner-panel` jest całkowicie niezależną sekcją.
- Panel live nie używa usuniętych bloków preview (`pm-live-info` / `pm-live-layout`).
- Panel live pokazuje poprawne PM 1.0 / PM 2.5 / PM 10 i zgodne etykiety.
- Trzy kafelki w `pms5003-grid` pokazują live PM 1.0 / PM 2.5 / PM 10 z właściwego rekordu Firebase.
- Wykres historii odświeża live punkt nawet gdy snapshot używa tego samego timestampu.
- Live timestamp PMS jest normalizowany do epoch ms jak w panelu historii danych.
- Okno wykresu PMS podąża za live punktem dla dzisiejszej daty (auto-follow prawej krawędzi).
- Historia renderuje dane i zakresy jak w `_baseline/pms-module.js`.
- Chart.js ma jednoznaczny lifecycle: create → update → destroy.
- Build i testy przechodzą bez błędów.

## Uwagi dla agenta AI

- Zmiany wprowadzaj etapami i po każdym etapie sprawdzaj różnice względem baseline.
- Nie łącz napraw danych, layoutu i lifecycle w jednym niezweryfikowanym kroku.
- Jeśli coś wymaga głębszej przebudowy, zatrzymaj się na granicy etapu i opisz blokadę.
- Nie zmieniaj kontraktu danych, jeśli baseline już dostarcza potrzebny kształt.