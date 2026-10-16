# ZEGAR-ESP32 — Dashboard

Dashboard do monitorowania danych z ESP32 w czasie rzeczywistym.
Jakość powietrza, mikroklimat w pomieszczeniu, pogoda i telemetria — wszystko na jednym ekranie.

**Strona internetowa projektu:** https://iot-esp32-zegar.web.app

## Funkcje

- **Dashboard LIVE** — bieżące odczyty ze wszystkich czujników, odświeżane na żywo z Firebase.
- **Wykresy historyczne** — przebieg temperatury, wilgotności, ciśnienia i pyłów dla wybranego dnia, z lokalnym cache w przeglądarce.
- **Analiza mikroklimatu** — syntetyczna ocena 0–100 liczona z 8 sygnałów: punkt rosy, humidex, Heat Index, wilgotność absolutna, PM2.5, eCO2, TVOC i 3-godzinny trend ciśnienia. Do tego mapa komfortu T × RH i rekomendacje (np. kiedy przewietrzyć).
- **Sekcje PMS i ENS160** — szczegółowe dane o pyłach (PM1.0 / PM2.5 / PM10) oraz gazach (eCO2, TVOC, AQI) z korektą odczytów przy wysokiej wilgotności.
- **Dokumentacja w aplikacji** — karty każdego modułu ze zdjęciem, opisem i linkiem do datasheetu producenta.

## Architektura

```
+-----------+      MQTT       +--------+      HTTP       +---------+      HTTP       +-----------+
|  ESP32    | ------------->  | HiveMQ | ------------->  | Serwer  | ------------->  | Firebase  |
|  (czujniki)|      TLS        | (broker|    MQTT sub     | (domowy)|    REST API     | (baza)    |
|           |                 |  cloud) |                |         |                 |           |
+-----------+                 +--------+                 +---------+                 +-----+-----+
                                                                                            |
                                                                                            v
                                                                                      +-----------+
                                                                                      | Dashboard |
                                                                                      | (React)   |
                                                                                      +-----------+
```

1. **ESP32** wysyła dane z czujników przez MQTT (TLS).
2. **HiveMQ** — broker MQTT w chmurze, przekazuje dane do serwera.
3. **Domowy serwer** — nasłuchuje MQTT, pakuje dane i wysyła je do Firebase przez REST API.
4. **Firebase** — Realtime Database + Hosting.
5. **Dashboard** — aplikacja React, czyta dane z Firebase i rysuje wykresy.

## Czujniki

| Czujnik | Co mierzy |
|---------|-----------|
| PMS5003 | Pył zawieszony PM1.0 / PM2.5 / PM10 (µg/m³) |
| ENS160 | eCO2 (ppm), TVOC (ppb), indeks AQI |
| AHT21 | Temperatura (°C), wilgotność względna (%) |
| BMP280 | Ciśnienie atmosferyczne (hPa) |
| Guition JC8048W550 | Główny panel HMI — dotykowy wyświetlacz 5" 800×480 (ESP32-S3) |
| PCM5102A | Przetwornik audio DAC 32-bit (I2S) |
| LCD 2004 | Znakowy wyświetlacz 20×4 |
| HLK-LD2410C | Radar obecności 24 GHz — wykrywa ruch i statyczną obecność człowieka |

Linki do datasheetów każdego modułu są w zakładce dokumentacji w aplikacji.

## Uruchomienie lokalne

```bash
cd public/ticking-bomb-react
npm install
npm run dev
```

Otwórz http://127.0.0.1:5173

## Testy

```bash
cd public/ticking-bomb-react
npx vitest run
```

## Deploy

Deploy wykonuje się z głównego katalogu repozytorium. Zbudowanie aplikacji dzieje się automatycznie przed wysyłką (predeploy w `firebase.json`):

```bash
firebase deploy
```

## Struktura repozytorium

```
├── public/ticking-bomb-react/   # aplikacja React (Vite + TypeScript)
│   └── src/features/            # moduły: dashboard, analiza, pms, ens160, dokumentacja
├── referencje/                  # zdjęcia i materiały referencyjne (nie trafiają na hosting)
├── firebase.json                # konfiguracja hostingu i deployu
└── database.rules.json          # reguły Firebase Realtime Database
```

## Stack technologiczny

- **Frontend:** React 19 + TypeScript + Vite
- **Baza danych:** Firebase Realtime Database
- **Hosting:** Firebase Hosting
- **Wykresy:** Chart.js
- **Dokumentacja:** react-markdown + KaTeX
- **Broker MQTT:** HiveMQ (cloud)
