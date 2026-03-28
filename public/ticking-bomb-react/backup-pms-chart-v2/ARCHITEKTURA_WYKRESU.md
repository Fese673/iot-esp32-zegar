# PMS History Chart (Chart 2) - Architektura i Współpraca

Ten dokument opisuje jak poszczególne moduły współpracują ze sobą, aby zapewnić płynne odświeżanie i "live-tracking" dla wykresu PM 1.0, 2.5 i 10.

## 1. Warstwa Danych (API & Hooks)
- **`src/features/pms/api/pmsAdapter.ts`**: Pobiera dane historyczne z Firebase (`pms/history`). Formatuje surowe rekordy na punkty zrozumiałe dla Chart.js, dbając o mapowanie pól `pm10`, `pm25`, `pm100` (dla PM 10).
- **`src/features/pms/hooks/usePmsLive.ts`**: Subskrybuje najnowszy rekord (`pms/latest`) w Firebase. Kluczowym elementem jest funkcja `normalizePmsLiveTimestamp`, która konwertuje sekundy (z ESP32) na milisekundy (używane przez wykres).
- **`src/features/dashboard/hooks/usePmsData.ts`**: Główny hook zarządzający stanem historii. Agreguje punkty z Firebase i punkty przychodzące "na żywo".

## 2. Warstwa Logiki Wykresu (Controller & Helpers)
- **`src/features/pms/components/PmsChartController.tsx`**: Serce logiki biznesowej wykresu.
    - Zarządza oknem widoku (`window` - `min`/`max` skali X).
    - Implementuje **Auto-following**: Jeśli prawy brzeg wykresu jest blisko "teraz", automatycznie przesuwa okno przy każdym nowym punkcie.
    - Reaguje na zmianę daty w kalendarzu (clean slate dla "dzisiaj" vs "historyczne").
- **`src/features/pms/lib/pmsChartHelpers.ts`**: 
    - `appendUniquePmsChartPoint`: Zapewnia, że nowe dane "live" nie dublują się z istniejącymi (identyczne timestampy są nadpisywane).
    - `buildFollowWindow`: Oblicza nowe granice widoku dla trybu "live".

## 3. Warstwa Prezentacji (UI)
- **`src/features/pms/components/PmsChart.tsx`**: "Głupi" komponent renderujący. Inicjalizuje instancję Chart.js, ustawia kolory, legendę i osie. Reaguje na zmiany `window` i `data` poprzez efekt `update('none')` dla wydajności.
- **`src/features/pms/components/PmsHistorySection.tsx`**: Kontener spinający wszystko. Renderuje kafelki "live" na górze i wykres pod spodem. Używa propsa `key={selectedDate}` na kontrolerze, aby wymusić reset stanu przy przełączaniu dni.

## 4. Wspólne Biblioteki (Shared)
- **`src/shared/lib/chartHelpers.ts`**: Uniwersalne narzędzia do stylowania Chart.js (gridy, kolory).
- **`src/shared/lib/timeHelpers.ts`**: Narzędzia do konwersji epok i formatowania czasu.

---
*Backup stworzony po wdrożeniu Etapu 10 (Full Parity with Baseline).*
