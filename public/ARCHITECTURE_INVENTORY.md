# Architecture Inventory

Dokument inwentaryzuje aktualną implementację referencyjną przed refaktoryzacją do React + Vite + TypeScript. Opis dotyczy obecnego zachowania, a nie planowanej architektury docelowej.

## 1. Moduły funkcjonalne

### App shell
- Odpowiada za strukturę strony, kolejność sekcji, przyciski sterujące i wpięcie wszystkich modułów.
- Aktualnie mieszka głównie w [index.html](index.html) oraz w [app.js](app.js).
- Powiązania: [styles.css](styles.css), [ui-utils.js](ui-utils.js), [time-utils.js](time-utils.js), [pms-module.js](pms-module.js), [pm-embed.js](pm-embed.js).

### Firebase config
- Dostarcza konfigurację RTDB/Firebase do całej aplikacji.
- Aktualnie mieszka w [firebase-config.js](firebase-config.js).
- Powiązania: [app.js](app.js), [pms-module.js](pms-module.js), [Kreatywna sekcja/pm_chart-live.js](Kreatywna%20sekcja/pm_chart-live.js).

### Live metrics
- Odczytuje `devices/{deviceId}/latest`, renderuje temperaturę, wilgotność i ciśnienie.
- Aktualnie mieszka w [app.js](app.js) w funkcji `subscribeLatest()` oraz w logice aktualizacji kart.
- Powiązania: [time-utils.js](time-utils.js) dla `humanTime()`, [ui-utils.js](ui-utils.js) dla `resetCards()`, status połączenia i wykres historii.

### Connection health
- Monitoruje świeżość danych live i ustawia stan `online` / `reconnecting` / `offline`.
- Aktualnie mieszka w [app.js](app.js) w `setStatus()`, `setStatusFromAge()` i `monitorHealth()`.
- Powiązania: karta połączenia w [index.html](index.html), `lastSeen`, karty live.

### Time sync
- Synchronizuje zegar aplikacji z urządzeniem przez HTTP endpoint `/api/time`, prowadzi fallback do czasu lokalnego.
- Aktualnie mieszka w [app.js](app.js) w `syncTimeFromDevice()`, `fallbackToLocal()`, `clockLoop()`.
- Powiązania: [time-utils.js](time-utils.js), pola `uptimeValue`, `projectStartTime`, `ntpClockValue`, `ntpClockMeta`.

### History chart
- Ładuje dane dobowe, obsługuje fallback `historyByDay -> history`, renderuje wykres temperatury, wilgotności i ciśnienia, wspiera pan/zoom oraz gesty.
- Aktualnie mieszka w [app.js](app.js) w `loadDay()`, `normalizeHistoryObject()`, `createChart()`, `handleChartWheel()`, `setupPointerGestures()`.
- Powiązania: Chart.js CDN, plugin zoom CDN, `styles.css`, kalendarz, overlaye wykresu.

### Calendar (główny)
- Pozwala wybrać dzień, zmienia miesiąc i odświeża dane historii.
- Aktualnie mieszka w [app.js](app.js) w `renderCalendar()` oraz powiązanych handlerach przycisków.
- Powiązania: wykres historii, `selectedDate`, `viewDate`, `loadDay()`.

### PMS module (live + history + wykres + kalendarz)
- Obsługuje dane pyłów PM, niezależny wykres, własny kalendarz, live cards oraz fallback A/F.
- Aktualnie mieszka w [pms-module.js](pms-module.js).
- Powiązania: [index.html](index.html) dla sekcji PMS, [Kreatywna sekcja/pm_chart-live.js](Kreatywna%20sekcja/pm_chart-live.js) dla embeda, [pm-embed.js](pm-embed.js) dla autosizingu iframe.

### Alerts
- Pokazuje alerty w stosie powiadomień i automatycznie je usuwa po czasie.
- Aktualnie mieszka w [ui-utils.js](ui-utils.js) w `pushAlert()`.
- Powiązania: [app.js](app.js), błędy Firebase, brak danych historycznych, fallback czasu.

### Toast
- Pokazuje globalny toast statusowy.
- Aktualnie mieszka w [ui-utils.js](ui-utils.js) w `toast()`.
- Powiązania: element `#toast` w [index.html](index.html).

### Motion toggle
- Włącza i wyłącza animacje oraz steruje klasą `motion-off` na `document.documentElement`.
- Aktualnie mieszka w [app.js](app.js) w `applyMotionSetting()` oraz częściowo w [ui-utils.js](ui-utils.js).
- Powiązania: przycisk `#toggleMotion` w [index.html](index.html), globalne animacje w [styles.css](styles.css).

### UI helpers
- Zapewniają animację tytułu, toast, alerty i reset kart.
- Aktualnie mieszka w [ui-utils.js](ui-utils.js).
- Powiązania: [app.js](app.js), [index.html](index.html), klasy UI w [styles.css](styles.css).

### Time helpers
- Dostarczają formatowanie czasu, daty i duration.
- Aktualnie mieszka w [time-utils.js](time-utils.js).
- Powiązania: [app.js](app.js) przy zegarze i `lastSeen`.

### Chart helpers
- Obecnie helpery wykresów są rozproszone w [app.js](app.js) i [pms-module.js](pms-module.js): clamp window, padding, kolorystyka, dataset builders, transformacje punktów.
- Nie istnieje osobny plik helperów wykresu w baseline.
- Powiązania: Chart.js, gesty, overlaye, CSS vars.

### Gesture handling
- Obsługuje wheel pan/zoom, pinch zoom i pointer pan dla obu wykresów.
- Aktualnie mieszka w [app.js](app.js) i [pms-module.js](pms-module.js).
- Powiązania: Chart.js canvas, `touchAction = none`, przyciski pan, plugin zoom fallback.

## 2. Ścieżki Firebase RTDB

### `devices/{deviceId}/latest`
- Typ: subscription (`on("value")`).
- Korzystają: [app.js](app.js) w `subscribeLatest()`, [pms-module.js](pms-module.js) w `pmsSubscribeLive()`.
- Zawiera live pomiary głównego dashboardu oraz PMS.

### `devices/{deviceId}/historyByDay/{date}`
- Typ: one-time read (`get()`).
- Korzystają: [app.js](app.js) w `loadDay(dateStr)` oraz [pms-module.js](pms-module.js) w `pmsLoadDay(dateStr)`.
- Jest pierwszym źródłem danych do wykresów dobowych.

### `devices/{deviceId}/history`
- Typ: one-time read (`get()`, z `limitToLast(20000)`).
- Korzystają: [app.js](app.js) i [pms-module.js](pms-module.js) jako fallback, gdy `historyByDay` nie zwraca danych.
- Po pobraniu dane są filtrowane lokalnie do wybranego dnia.

## 3. Kształt danych

### LiveRecord
- `t` – temperatura (`number`)
- `h` – wilgotność (`number`)
- `p` – ciśnienie (`number`)
- `ts` – timestamp w sekundach Unix (`number`)

### HistoryRecord
- W praktyce ma ten sam kształt co live record dla głównego dashboardu.
- `t` – temperatura (`number`)
- `h` – wilgotność (`number`)
- `p` – ciśnienie (`number`)
- `ts` – timestamp w sekundach Unix (`number`)

### PmsRecord
- `A` – preferowane źródło danych PMS (`PmsRaw`, opcjonalne)
- `F` – fallback źródła danych PMS (`PmsRaw`, opcjonalne)
- `ts` – timestamp w sekundach Unix (`number`)

### PmsRaw
- `pm1` – PM1.0 (`number`)
- `pm25` – PM2.5 (`number`)
- `pm10` – PM10 (`number`)

### Dodatkowe kształty lokalne
- `ChartPoint` w baseline jest reprezentowany jako obiekt `{ x, y }` w danych Chart.js, a rozróżnienie serii odbywa się przez indeks datasetu.
- `ClockState` jest trzymany lokalnie w `timeState` i zawiera `baseMs`, `startMs`, `lastSync`, `source`, `rtt`.
- `CalendarState` jest reprezentowany przez `viewDate` i `selectedDate` w obu kalendarzach.

## 4. Znane edge-case'y

- Brak live danych ustawia stan `reconnecting` albo `offline` i czyści karty z wartości starych.
- Gdy nie ma danych historycznych dla dnia, aplikacja próbuje fallback `history`, a potem pokazuje overlay błędu i alert.
- `permission denied` albo `insufficient permissions` w RTDB jest mapowane na alert błędu dla historii.
- Zegar przełącza się na czas lokalny, gdy endpoint `/api/time` nie odpowiada albo zwróci błąd.
- `lastSeen` bazuje na `ts` z live record i jest formatowany przez `humanTime()`.
- Nowe punkty live dopinają się tylko dla dnia bieżącego i tylko jeśli są unikalne po `x`.
- Dla innych dni live punkty nie dopinają się do wykresu historii.
- PMS używa `A` jako pierwszego wyboru i `F` jako fallbacku.
- Wykresy mają własne clampowanie okna i syntetyczne przesuwanie na starcie.
- Gesty na canvasie używają bezpośrednich listenerów pointer/wheel, a nie reaktywnych eventów React.
- `pm-embed.js` dostosowuje wysokość iframe do zawartości i nasłuchuje resize.
- `motion-off` na `document.documentElement` jest jedyną klasą globalną dla przełączenia animacji.
