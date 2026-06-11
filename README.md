# ZEGAR-ESP32 — Dashboard

Dashboard do monitorowania danych z ESP32 w czasie rzeczywistym.
Czujniki powietrza, pogoda, telemetria — wszystko na jednym ekranie.

## Architektura

```
+-----------+      MQTT       +--------+      HTTP       +---------+      HTTP       +-----------+
|  ESP32    | ------------->  | HiveMQ | ------------->  | Serwer  | ------------->  | Firebase  |
|  (czujniki|      TLS        | (broker|    MQTT sub     | (domowy)|    REST API     | (baza)    |
|   + RTC)  |                 |  cloud) |                |         |                 |           |
+-----------+                 +--------+                 +---------+                 +-----+-----+
                                                                                           |
                                                                                           v
                                                                                     +-----------+
                                                                                     | Dashboard |
                                                                                     | (React)   |
                                                                                     +-----------+
```

1. **ESP32** wysyła dane z czujników (PM2.5, PM10, eCO2, TVOC, T, RH, P) przez MQTT (TLS)
2. **HiveMQ** — broker MQTT w chmurze, przekazuje dane do serwera
3. **Domowy serwer** — nasłuchuje MQTT, pakuje dane i wysyła do Firebase REST API
4. **Firebase** — Realtime Database + Hosting
5. **Dashboard** — React czyta dane z Firebase i wyświetla na wykresach

## Dane z czujników

| Czujnik | Parametry | Interfejs |
|---------|-----------|-----------|
| PMS5003 | PM1.0, PM2.5, PM10 (ug/m3) | UART |
| ENS160 | eCO2 (ppm), TVOC (ppb), AQI | I2C |
| AHT21 | Temperatura (C), wilgotnosc (%) | I2C |
| BMP280 | Cisnienie (hPa), temperatura (C) | I2C |
| DS3231 | Zegar czasu rzeczywistego | I2C |
| STM32 | BPM, SpO2 | SoftwareSerial |

## Uruchomienie lokalne

```bash
cd public/ticking-bomb-react
npm install
npm run dev
```

Otwórz http://127.0.0.1:5173

## Deploy na Firebase

```bash
firebase deploy
```

## Testy

```bash
cd public/ticking-bomb-react
npm test
```

## Stack technologiczny

- **Frontend:** React 19 + TypeScript + Vite
- **Baza danych:** Firebase Realtime Database
- **Hosting:** Firebase Hosting
- **Wykresy:** Chart.js
- **Dokumentacja:** react-markdown + KaTeX
- **Broker MQTT:** HiveMQ (cloud)
