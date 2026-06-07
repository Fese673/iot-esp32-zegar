# ZEGAR-ESP32 · Dokumentacja

> Modułowy projekt embedded — sensory, wyświetlacze i komunikację można odłączać i podłączać bez przebudowy reszty systemu. Główny HMI: **Guition ESP32-S3 JC8048W550** (5" IPS 800×480, touch, WiFi, BLE 5.0).
> Projekt to ESP32, który ogarnia kilka rzeczy naraz: odtwarzacz Bluetooth, węzeł WiFi/MQTT, stacja jakości powietrza, panel diagnostyczny i klasyczny zegar — w jednym urządzeniu, na jednym chipie.
> Każda funkcja może być włączona lub wyłączona niezależnie. Sensory są hot-plug — system startuje i działa nawet bez podłączonych czujników.

---

## Spis treści

1. [Jak to uruchomić](#1-jak-to-uruchomić)
   - [Wymagania wstępne](#wymagania-wstępne)
   - [Build i flash](#build-i-flash)
   - [Monitorowanie systemu](#monitorowanie-systemu)
2. [Co to robi i czym to robi](#2-co-to-robi-i-czym-to-robi)
   - [Przegląd technologii](#przegląd-technologii)
   - [Sensory — tabela parametrów](#sensory--tabela-parametrów)
   - [Kluczowe biblioteki](#kluczowe-biblioteki)
3. [Hardware & Connectivity](#3-hardware--connectivity)
   - [Mapowanie pinów GPIO](#mapowanie-pinów-gpio)
   - [Konfiguracja radia WiFi / Bluetooth](#konfiguracja-radia-wifi--bluetooth)
   - [Flagi kompilacji](#flagi-kompilacji)
4. [Co siedzi pod maską (i dlaczego to tak skomplikowane)](#4-co-siedzi-pod-maską-i-dlaczego-to-tak-skomplikowane)
   - [Izolacja rdzeni: Core 0 vs Core 1](#izolacja-rdzeni-core-0-vs-core-1)
   - [Sekwencja startu: od resetu do steady-state](#sekwencja-startu-od-resetu-do-steady-state)
   - [Hierarchia tasków i priorytety](#hierarchia-tasków-i-priorytety)
   - [Pętla główna AppLoop](#pętla-główna-apploop)
   - [Snapshoty zamiast globalnych zmiennych](#snapshoty-zamiast-globalnych-zmiennych)
5. [Rzeczy, które wymagały chwili zastanowienia](#5-rzeczy-które-wymagały-chwili-zastanowienia)
   - [Audio Pipeline — ringbuffer i prefetching](#audio-pipeline--ringbuffer-i-prefetching)
   - [DMA — jak audio trafia do DAC-a bez angażowania CPU](#dma--jak-audio-trafia-do-dac-a-bez-angażowania-cpu)
   - [I2C Worker Task — bo szyna I2C nie lubi tłumu](#i2c-worker-task--bo-szyna-i2c-nie-lubi-tłumu)
   - [Synchronizacja — muteksy, semafory, atomiki](#synchronizacja--muteksy-semafory-atomiki)
   - [Diagnostyka pamięci — RamTelemetry](#diagnostyka-pamięci--ramtelemetry)
   - [Mapa ryzyk i co z nimi zrobiono](#mapa-ryzyk-i-co-z-nimi-zrobiono)
6. [Interfejs i sterowanie UI](#6-interfejs-i-sterowanie-ui)
   - [Kanały wyświetlania](#kanały-wyświetlania)
   - [Architektura UI — przepływ stanów](#architektura-ui--przepływ-stanów)
   - [Tryby pracy](#tryby-pracy)
7. [Sieć i telemetria MQTT](#7-sieć-i-telemetria-mqtt)
   - [Przepływ danych: od pomiaru do brokera](#przepływ-danych-od-pomiaru-do-brokera)
   - [Przełączanie trybów BT ↔ WiFi](#przełączanie-trybów-bt--wifi)
8. [Struktura repozytorium](#8-struktura-repozytorium)
9. [Co można dołożyć i co warto poprawić](#9-co-można-dołożyć-i-co-warto-poprawić)

---

## 1. Jak to uruchomić

Zanim zajrzymy w głąb — trzy komendy, które uruchamiają firmware od zera.

### Wymagania wstępne

- **PlatformIO CLI** lub PlatformIO IDE (VSCode Extension)
- **ESP32 dev board** z odpowiednim układem pinów (patrz sekcja 3)
- Zewnętrzny DAC/wzmacniacz I2S lub moduł MAX98357A (dla funkcji audio)
- Czujniki BME280/BMP280, ENS160+AHT21, PMS5003 — opcjonalne, system startuje bez nich
- Konto MQTT (np. Mosquitto lokalnie lub HiveMQ w chmurze) — też opcjonalne

### Build i flash

```bash
# 1. Sklonuj repozytorium i przejdź do katalogu projektu
git clone <repo-url> && cd ZEGAR-ESP32

# 2. Zbuduj firmware (środowisko: esp32dev, schemat partycji: huge_app.csv)
pio run

# 3. Wgraj firmware na płytkę
pio run --target upload

# 4. (Opcjonalnie) Wyczyść cache przed pełnym buildem
pio run --target clean && pio run
```

> **Dlaczego `huge_app.csv`?**  
> Audio + JSON + sensory + telemetria + system diagnostyczny wypełniają flash powyżej domyślnego limitu. `huge_app.csv` to świadomy kompromis, nie lenistwo — zmień go dopiero gdy *wiesz*, że flash na to pozwala i wiesz co wycinasz.

### Monitorowanie systemu

```bash
# Serial monitor z prędkością 921600 baud (zgodnie z AppBoot::initCoreHardware)
pio device monitor --baud 921600

# Alternatywnie przez screen
screen /dev/ttyUSB0 921600
```

Co zobaczysz na konsoli po uruchomieniu:

```
[I][Boot] Serial + RAM diagnostics OK
[I][Boot] I2C @ 400kHz initialized
[I][Boot] LCD + encoder OK
[I][Boot] PMS5003 initialized
[I][Boot] ENS160+AHT21 initialized
[I][Boot] BMP280 initialized
[I][Boot] RadioModeSwitch: reading RTC → mode = WIFI
[I][WiFi] Connected. IP: 192.168.x.x
[I][MQTT] Connected to broker
Heap heartbeat #1 checkpoint=HEARTBEAT free=234k largest=128k dma_b=52480 frag=12‰
```

Jeśli widzisz `Heap heartbeat` co 5 sekund — system działa. Jeśli `frag` rośnie powyżej ~150‰ — czas przyjrzeć się fragmentacji (patrz sekcja 5.5).

---

## 2. Co to robi i czym to robi

### Przegląd technologii

ZEGAR-ESP32 to projekt multi-mode: w zależności od trybu pracy staje się innym urządzeniem. Technologie, które to umożliwiają:

| Technologia | Rola w systemie | Uwagi |
|---|---|---|
| **ESP32 (Dual-Core Xtensa LX6)** | Główny MCU, 240 MHz | Core 0 = audio realtime, Core 1 = I/O |
| **FreeRTOS (SMP)** | System operacyjny czasu rzeczywistego | Zarządzanie taskami, kolejkami, semaforami |
| **Arduino Framework** | Warstwa HAL i ekosystem bibliotek | Integracja z PlatformIO |
| **Bluetooth Classic (A2DP Sink)** | Odbiornik audio stereo | Nie można łączyć z WiFi jednocześnie — ograniczenie krzemu, nie projektu |
| **I2S + DMA** | Wyjście audio do DAC/wzmacniacza | 44.1 kHz, 16-bit stereo |
| **WiFi (WPA2)** | Łączność sieciowa | Inicjalizacja na Core 1 |
| **MQTT over TLS** | Telemetria środowiskowa | PubSubClient, backoff strategy |
| **SNTP** | Synchronizacja czasu | Uruchamiany po podłączeniu WiFi |
| **I2C (400 kHz)** | Bus sensorów i wyświetlacza LCD | Serializowany przez dedykowany task, bo inaczej chaos |
| **UART** | PMS5003 + link do STM32 | GPIO 34/13 (sensor), 16/17 (STM32) |
| **NVS (Non-Volatile Storage)** | Persystencja konfiguracji | Namespace `"zegar"` |
| **RTC DS3231** | Sprzętowy zegar czasu rzeczywistego | Backup czasu po restarcie |
| **ArduinoJson** | Budowanie payloadów telemetrycznych | Kompaktowy, zero-alloc API |

### Sensory — tabela parametrów

System obsługuje cztery źródła danych środowiskowych. Wszystkie I2C-owe są obsługiwane przez wspólny bus 400 kHz z dedykowanym worker taskiem. PMS5003 ma własny UART i automat stanów, bo pomiar pyłu trwa na tyle długo, że blokowanie pętli nie wchodzi w grę.

| Czujnik | Mierzone wielkości | Interfejs | GPIO | Technika odczytu | Uwagi |
|---|---|---|---|---|---|
| **PMS5003** | Pyły: PM1.0, PM2.5, PM10 (µg/m³) | UART | RX: 34, TX: 13 | Nieblokujący automat stanów | Długi pomiar nie blokuje pętli |
| **ENS160** | Jakość powietrza: eCO₂ (ppm), TVOC (ppb), AQI | I2C | SDA: 21, SCL: 22 | Polling z kompensacją T/RH | Wymaga aktualnej T i RH z AHT21 |
| **AHT21** | Temperatura (°C), wilgotność względna (%) | I2C | SDA: 21, SCL: 22 | Polling | Zazwyczaj pakowany razem z ENS160 |
| **BMP280** | Ciśnienie atmosferyczne (hPa), temperatura (°C) | I2C | SDA: 21, SCL: 22 | Lightweight polling | Alternatywa: BME280 z wilgotnością |
| **RamTelemetry** | free_heap, largest_free_block, DMA, frag, watermarki tasków | — | — | Snapshot co 5000 ms | Wbudowana diagnostyka wewnętrzna systemu |

> **Uwaga na ENS160:** czujnik wymaga podania aktualnej temperatury i wilgotności jako parametrów kompensacyjnych przed odczytem AQI. System robi to automatycznie, czytając AHT21 tuż przed ENS160. Pominięcie kompensacji daje wyniki o niskiej dokładności — to nie błąd ENS160, to element architektury tego czujnika.

### Kluczowe biblioteki

| Biblioteka | Wersja / źródło | Rola |
|---|---|---|
| `arduino-audio-tools` | Nowszy backend | I2S pipeline dla audio BT |
| `BluetoothA2DPSinkQueued` | Fork z ringbufferem | A2DP Sink z kolejką FIFO |
| `hd44780` | Arduino Library | Sterownik LCD HD44780 przez I2C |
| `PMserial` | PlatformIO registry | Obsługa PMS5003 (UART) |
| `ScioSense_ENS16x` | Vendor | Czujnik jakości powietrza ENS160 |
| `PubSubClient` | knolleary | MQTT klient |
| `ArduinoJson` | bblanchon | Payload MQTT + config JSON |
| `ESP-IDF` (wbudowany) | Espressif SDK | FreeRTOS, WiFi, BT, DMA, I2S |

---

## 3. Hardware & Connectivity

### Mapowanie pinów GPIO

Pełna mapa pinów zdefiniowana w `Board_Pins.h` — żaden pin nie jest zahardkodowany w kodzie źródłowym.

| GPIO | Stała | Aliasy | Funkcja | Kierunek |
|---:|---|---|---|---|
| **2** | `kBuzzer` | `BUZZER_PIN` | Buzzer aktywny | Output |
| **4** | `kTouchTestPad` | — | Test dotykowy (tymczasowy) | Input |
| **5** | `kSevenSegLatch` | `LATCH_PIN` | 74HC595 latch | Output |
| **13** | `kPms5003Tx` | — | PMS5003 TX (Serial1) | Output |
| **14** | `kBtI2sData` | — | BT I2S DOUT → DAC | Output |
| **16** | `kStm32UartRx` | — | STM32 BPM/SpO2 RX (SoftwareSerial) | Input |
| **17** | `kStm32UartTx` | — | STM32 BPM/SpO2 TX (SoftwareSerial) | Output |
| **18** | `kSevenSegClock` | `CLOCK_PIN` | 74HC595 clock / SPI CLK | Output |
| **19** | `kGuitionUartTx` | — | Guition UART TX (Serial2) | Output |
| **21** | `kI2cSda` | — | I2C SDA (shared bus) | Bidirectional |
| **22** | `kI2cScl` | — | I2C SCL (shared bus) | Output |
| **23** | `kSevenSegData` | `DATA_PIN` | 74HC595 data / SPI MOSI | Output |
| **25** | `kEncoderClk` | — | Enkoder CLK | Input (pull-up) |
| **26** | `kEncoderDt` | — | Enkoder DT | Input (pull-up) |
| **27** | `kEncoderSw` | — | Enkoder przycisk | Input (pull-up) |
| **32** | `kBtI2sWs` | — | BT I2S WS/LRCK → DAC | Output |
| **33** | `kBtI2sBclk` | — | BT I2S BCLK → DAC | Output |
| **34** | `kPms5003Rx` | — | PMS5003 RX (Serial1) | Input |
| **35** | `kGuitionUartRx` | — | Guition UART RX (Serial2) | Input |

**Dodatkowe piny (domyślne ESP32, nie zdefiniowane explicit):**

| GPIO | Funkcja | Uwagi |
|---:|---|---|
| **1** | UART0 TX | Serial debug, 921600 baud |
| **3** | UART0 RX | Serial debug |

**Schemat blokowy wyjścia I2S:**

```
ESP32 GPIO 33 (BCLK) ──────►  DAC / wzmacniacz
ESP32 GPIO 32 (WS)   ──────►  (np. MAX98357A)
ESP32 GPIO 14 (DATA) ──────►  Analog L/R output
```

### Główny HMI — Guition JC8048W550

![Guition JC8048W550 - 5" IPS Touch Display](/images/sensors/jc8048w550.png)

Panel dotykowy ESP32-S3 z 5" IPS LCD. Pełni rolę głównego interfejsu człowieka z maszyną (HMI) w projekcie. Modularna architektura pozwala na odłączenie go i zastąpienie innym wyświetlaczem bez zmian w logice systemu.

| Parametr | Wartość |
|---|---|
| **Procesor** | ESP32-S3-WROOM-1-N16R8 (dual-core LX7 @ 240 MHz) |
| **Flash** | 16 MB |
| **PSRAM** | 8 MB (Octal SPI, 80 MHz) |
| **Wyświetlacz** | 5" IPS LCD, 800×480 px, RGB565 (16-bit) |
| **Kontroler displaya** | ST7262, RGB Parallel 16-bit, pclk 16 MHz |
| **Touch** | Kapacytywny (Goodix GT911), I2C, multi-touch |
| **WiFi** | 2.4 GHz 802.11 b/g/n |
| **Bluetooth** | BLE 5.0 |
| **Zasilanie** | 5V via USB-C |
| **Slot kart** | MicroSD (FAT32, do 32 GB) |

> **Modularność:** JC8048W550 jest fizycznie odłączalny od głównej płytki. System może działać również z oryginalnym LCD HD44780 lub 7-segment — display HMI jest opcjonalnym rozszerzeniem, nie wymogiem.

### Konfiguracja radia WiFi / Bluetooth

ESP32 współdzieli sprzęt RF między WiFi a Bluetooth Classic. To ograniczenie krzemu, nie projektu. System zarządza tym jawnie i nie próbuje udawać, że jest inaczej.

| Tryb | Stos | Inicjalizacja | Wyłączenie |
|---|---|---|---|
| **WiFi** | WPA2 STA, lwIP, TLS | Task `wifiInit` (Core 1, Priority 5), self-delete po `WiFi.begin()` | `ModeManager` + `RadioModeSwitch` |
| **Bluetooth** | Classic A2DP Sink | On-demand, `audioBT_init()` → `BtI2STask` (Core 0, Priority 22) | `ModeManager` wyłącza stary stos przed startem nowego |

> **Dlaczego nie oba jednocześnie?** ESP32 obsługuje jednocześnie BT Classic i WiFi, ale wymaga to zbyt dużej ilości RAM — projekt nie ma wystarczającej puli pamięci, by uruchomić oba stosy. Projekt zarządza tym jawnie przez `RadioModeSwitch` z pamięcią RTC — po restarcie system wie, do którego trybu wrócić.

### Flagi kompilacji

Flagi definiowane w `platformio.ini` (sekcja `build_flags`):

| Flaga | Domyślna wartość | Efekt |
|---|---|---|
| `PlatformIO env` | `esp32dev` | Główne środowisko builda |
| `Framework` | `Arduino` | Integracja z ekosystemem Arduino |
| `Partition scheme` | `huge_app.csv` | Niestandardowy schemat flash dla dużego firmware |
| `ENABLE_RUNTIME_TELEMETRY` | `1` | Liczniki błędów I2C, audio i enkodera (`std::atomic`) |
| `TEST_RAM` | `1` | Snapshoty RAM + kontrola fragmentacji heapu |
| `RAM_TELEMETRY_PRINT_INTERVAL_MS` | `5000UL` | Heartbeat diagnostyczny co 5 sekund |
| `TEST_RAM_HEAP_INFO` | `0` | Wyłączone ciężkie dumpy heapu (domyślnie) |
| `UART_LCD_MIRROR` | `1` | Mirror LCD → Serial (tryb dev) |
| `BOOT_LCD_CLEAR_TELEMETRY` | `1` | Telemetria czyszczenia LCD podczas bootu |
| `CONFIG_BT_ENABLED` | `1` | BT musi być włączony w buildzie |
| `METEO_ENABLED` | defined | Synchronizacja pogody Open-Meteo |
| `CORE_DEBUG_LEVEL` | `2` | Poziom logowania IDF (0=brak, 3=verbose) |
| `ENABLE_WIFI_DIAGNOSTICS` | `1` | Diagnostyka WiFi |
| `ESP_TO_GUTION_LOG_ENABLED` | `1` | Logi UART do Guition |
| `RUNTIME_TELEMETRY_PRINT_INTERVAL_MS` | `5000UL` | Interwał druku telemetrii runtime |
| Extra script | `generate_alarm_melodies.py` | Katalog melodii generowany podczas kompilacji |

---

## 4. Co siedzi pod maską (i dlaczego to tak skomplikowane)

### Izolacja rdzeni: Core 0 vs Core 1

To najważniejsza decyzja architektoniczna w całym projekcie. ESP32 ma dwa rdzenie Xtensa LX6 @ 240 MHz i projekt świadomie je rozdziela — nie dlatego, że można, ale dlatego, że bez tego audio po prostu nie działa poprawnie.

**Dlaczego izolacja jest konieczna?**  
I2S DMA wymaga ciągłego zasilania danymi. Jeśli CPU jest zajęty czymkolwiek innym — aktualizacją LCD, czekaniem na I2C, parsowaniem JSON — przez za długo, bufor DMA się opróżnia i słyszysz glitch. Na procesorze jednordzeniowym nie możesz tego uniknąć bez bardzo agresywnego timingu. Na dwóch rdzeniach: dajesz audio własny rdzeń i sprawa przestaje być problemem.

```
CORE 0 (PRO_CPU)                     CORE 1 (APP_CPU)
---------------------------           ---------------------------
BtI2STask (Priority 24)              encoderTask (Priority 20)
BtAppT (Priority 19)                 bootIntro (Priority 15)
wifiMonitor (Priority 2)             i2cWorker (Priority 12)
meteoFetch (Priority 1)              wifiInit (Priority 5)
WiFi/BT stack ISRs                   Arduino loop() (Priority 1)
mqttConn (Priority 1)

-> realtime audio path               -> I/O, siec, wejscie uzytk.
-> zero blocking I/O                 -> obsluga sensorow
```

**Kluczowe konsekwencje tej decyzji:**
- Enkoder, LCD, sensory I2C i WiFi init sa na Core 1 — nie maja szansy wyrwac czasu sciezce audio
- I2S DMA jest na Core 0 razem z glowna petla aplikacyjna, ale `BtI2STask` ma priorytet 24 wobec petli glownej na priorytecie 1 — audio zawsze wygrywa
- Ciezka inicjalizacja WiFi driver nie blokuje UI podczas startu — dzieje sie asynchronicznie na Core 1

### Sekwencja startu: od resetu do steady-state

Sekwencja jest deterministyczna i wieloetapowa. Każdy etap ma udokumentowane zależności i inicjalizuje dokładnie to, czego potrzebuje następny.

```
[Hardware Reset]
      │
      ▼
[Stage 0] Bootloader ESP32 → FreeRTOS scheduler startuje
          Core 0: setup() → loop()
          Core 1: idle
      │
      ▼
[Stage 1] initCoreHardware()              ← AppBoot.cpp:171-189
          • Serial.begin(921600)
          • RtcSyncService::applyTimezone()
          • Baseline heap capture (ESP.getFreeHeap)
          • ModeManager::begin()
          • RamTelemetry::begin()
          • initSevenSeg() — GPIO 23/18/5
      │
      ▼
[Stage 2] EsptoGuition::begin()           ← AppBoot.cpp:392
          • Serial2 — UART 115200 baud
          • RX=35, TX=19 (Guition HMI)
          • COBS framing + CRC-16
      │
      ▼
[Stage 3] initPersistenceAndConfig()      ← AppBoot.cpp:191-211
          • NVS: s_prefs.begin("zegar")
          • Wczytaj WiFi / MQTT credentials
          • AlarmRuntime::reset()
          • RadioModeSwitch::begin() — odczyt RTC
          • restoreRtcHandoffTime() — czas z DS3231
          • PMS5003 enabled/disable z NVS
          • EsptoGuition::musicSettingsInit()
      │
      ▼
[Stage 4] initUiAndInput()                ← AppBoot.cpp:213-275
          • LCD mirror (UART_LCD_MIRROR)
          • LcdFrameBuffer20x4::begin()
          • I2cShared::initMaster()
            ├── Wire.begin(SDA=21, SCL=22, 400kHz)
            ├── gI2cRequestQueue (8 slotów)
            └── SPAWN i2cWorker [Core 1, Priority 12, Stack 3072 B]
          • LCD probe 0x27 + lcd.init()
          • LCDIcons palette cache
          • RtcSyncService::tryRestoreSystemTimeFromDs3231()
          • LCD backlight + clear
          • BUZZER_PIN OUTPUT (GPIO 2)
          • BootIntroService::begin()
            └── (start wywoływany warunkowo poniżej)
          • encoder_begin()
            ├── GPIO 25/26/27 z pull-upami
            ├── s_eventQueue (64 zdarzenia)
            └── SPAWN encoderTask [Core 1, Priority 20, Stack 2048 B]
          • TouchBuzzerTest::begin(GPIO 4, GPIO 2)
          • StatsManager::begin()
      │
      ▼
      │  ┌─ BootIntroService::start() ──┐
      │  │  SPAWN bootIntro [Core 1,    │  (tylko jeśli showEpicIntro
      │  │  Priority 15, Stack 4096 B]  │   i brak radio handoff)
      │  └──────────────────────────────┘
      │
      ▼
[Stage 5] initSensors()                   ← AppBoot.cpp:277-300
          • STM32data_begin(Rx=16, Tx=17) — SoftwareSerial
          • PMS5003Sensor::begin() — Serial1 (Rx=34, Tx=13)
          • ENS160AHT21Sensor::begin() — I2C (probe 0x53/0x52)
          • BMP280Sensor::begin() — I2C raw register driver
          • HomeRuntime::begin() — rejestracja callbacków UI
          [Wszystkie operacje I2C idą przez i2cWorker]
      │
      ▼
[Stage 6] initComms()                     ← AppBoot.cpp:302-373
          • UI_Callbacks — full callback registration
          • ui_begin() — inicjalizacja UI state machine
          • LCD backlight + timing report
          • HomeRuntime overlay interval
          • AlarmMelodyPrefs::loadIndex()
          • WiFiSync::setOnDone() — callback NTP sync
          • WiFiSync::begin(ssid, pass, ntp)
            ├── SPAWN wifiInit [Core 1, Priority 5, Stack 8192 B]
            └── SPAWN wifiMonitor [Core 0, Priority 2, Stack 2048 B]
          • MQTTSync::configure(config)
          • NetworkOrchestrator::begin() — uzbrojenie usług
          • AlarmRuntime::loadAllAlarms()
      │
      ▼
[Stage 7] finalizeStartup()               ← AppBoot.cpp:375-385
          • LoopBaselineTelemetry::resetWindow()
          • Detect radio mode (BT lub WiFi) z RTC
          • ModeManager::logDiag("after-setup-radio-ready")
      │
      ▼
[Stage 8] AppLoop::initEventHandlers()    ← AppLoop.cpp:343-367
          EventBus — subskrypcje + timery:
          ┌─────────────────────┬──────────┬─────────────────────────────┐
          │ Zdarzenie           │ Interwał │ Handler                     │
          ├─────────────────────┼──────────┼─────────────────────────────┤
          │ EV_UI_OVERLAY       │ 10 ms    │ Rotacja overlay, redraw     │
          │ EV_SENSOR_READ      │ 200 ms   │ Poll sensors, NetworkOrch.  │
          │ EV_CLOCK_TICK       │ 1000 ms  │ Zegar, alarm, meteo sync    │
          │ EV_UI_REFRESH       │ 1000 ms  │ Screen-specific redraws     │
          │ EV_DIAGNOSTICS      │ 2000 ms  │ Heap/status log, telemetry  │
          │ EV_MQTT_PUBLISH     │ 5000 ms  │ Publikacja sensor data      │
          │ EV_BT_CONN_CHECK    │ 60000 ms │ BT connection status log    │
          └─────────────────────┴──────────┴─────────────────────────────┘
      │
      ▼
[Stage 9] meteoSync::begin()              ← AppBoot.cpp:399
          • Inicjalizacja Open-Meteo weather sync
          └── SPAWN meteoFetch [Core 0, Priority 1, Stack 8192 B]
              (tylko jeśli METEO_ENABLED)
      │
      ▼
[loop()] AppLoop::runLoop()               ← steady-state operation
```

Lazy initialization WiFi i Bluetooth jest tu świadoma: taski tworzone są on-demand, nie podczas bootu. Efekt — szybszy start, mniejszy footprint pamięciowy w spoczynku, brak fragmentacji heapu przy starcie.

### Hierarchia tasków i priorytety

Na ESP32 `configMAX_PRIORITIES = 25`. Pełna hierarchia priorytetów w systemie:

| Priorytet | Wartość | Task / Komponent | Rdzeń | Stack | Tworzony kiedy |
|---|---|---|---|---|---|
| System max | 24 | FreeRTOS system tasks (zarezerwowane) | — | — | Boot |
| **Realtime audio** | **24** | **BtI2STask** | **Core 0** | **3072 B** | **On-demand (BT start)** |
| **BT events** | **19** | **BtAppT** | **Core 0** | **3072 B** | **On-demand (BT start)** |
| WiFi/BT ESP-IDF | ~23 | Wewnętrzne taski ESP-IDF | — | — | Boot |
| TCP/IP (lwIP) | ~18 | lwIP stack task | — | — | WiFi init |
| **I2C worker** | **12** | **i2cWorker** | **Core 1** | **3072 B** | **Stage 3 (setup)** |
| WiFi init | 5 | wifiInit (temporary) | Core 1 | 4096 B | On-demand (self-delete) |
| **Encoder input** | **20** | **encoderTask** | **Core 1** | **2048 B** | **Stage 3 (setup)** |
| **WifiMonitor** | **2** | **WifiMonitorTask** | **Core 0** | — | **On-demand (WiFi start)** |
| **MeteoSync** | **1** | **MeteoSyncTask** | **Core 0** | — | **On-demand (WiFi start)** |
| Main loop | 1 | Arduino loop() | Core 0 | — | Boot |
| Idle | 0 | FreeRTOS idle task | — | — | Boot |



### Pętla główna AppLoop

Każdy cykl pętli głównej (`loop()`) wykonuje operacje w stałej, przewidywalnej kolejności:

```
1. encoder_update()        → odczyt z s_eventQueue (produkowanej przez encoderTask)
2. UI animation / refresh  → inkrementalne rysowanie LCD przez I2C worker
3. Sensor updates          → polling PMS5003 (UART), ENS160+AHT21, BMP280 (przez I2C worker)
4. RamTelemetry::update()  → snapshot co RAM_TELEMETRY_PRINT_INTERVAL_MS
5. NetworkOrchestrator     → może spawować wifiInit lub BtAppT
6. MQTTSync::loop()        → PubSubClient loop + publish (bez osobnego taska)
7. Misc tasks              → budziki, melodie, diagnostyka
```

Ten porządek gwarantuje, że żaden moduł nie "przejmuje" CPU na dłużej niż jeden cykl. MQTT działa w pętli głównej (bez własnego taska) — oszczędza ~4 KB pamięci stacku i eliminuje jeden task ze schedulera. Kompromis: jeśli broker jest wolny lub sieć się waha, pętla główna czeka — ale z TLS backoff strategią jest to krótkotrwałe i akceptowalne.

### Snapshoty zamiast globalnych zmiennych

Dane sensorowe nie wyciekają przez `extern`. Każdy moduł eksponuje stabilne API snapshot:

```
Sensor          →   Snapshot / getData()   →   UI_Draw (LCD render)
                                           →   TelemetryComposer → MQTTSync → broker
```

UI i MQTT czytają te same dane w tej samej formie — żaden widok nie pokaże innej wersji PM2.5 niż payload MQTT opublikowany w tej samej sekundzie. Eliminuje całą klasę błędów "dane na ekranie różnią się od danych w bazie", które w embedded potrafią być bolesne do wyśledzenia.

---

## 5. Rzeczy, które wymagały chwili zastanowienia

### Audio Pipeline — ringbuffer i prefetching

Dźwięk przychodzi przez Bluetooth w nieregularnych paczkach (zależy od profilu SBC i aktualnego nastroju modułu RF). I2S DMA wymaga ciągłego, regularnego strumienia próbek. Między tymi dwoma rzeczywistościami stoi ringbuffer.

**Architektura ścieżki audio:**

```
Telefon (A2DP źródło)
        │
        ▼ [SBC decode w Bluetooth Controller, Core 0]
BT Stack Callback (Core 1)
        │ write_audio(pcm_data, size)
        ▼
xRingbufferSend(s_ringbuf_i2s, data, size, 0)   ← non-blocking
        │
        ▼
Ringbuffer 12 KB (FreeRTOS, DMA-capable memory)
        │
        │ [gdy >= 9830 bytes = 80% pełny]
        ▼
xSemaphoreGive(s_i2s_write_semaphore)            ← sygnał dla BtI2STask
        │
        ▼
BtI2STask wakes up [Core 0, Priority 22]
        │ xRingbufferReceiveUpTo(..., 1920 bytes)
        │ i2s_write_data(data, item_size)
        ▼
ESP-IDF I2S Driver → DMA Controller → I2S0 Peripheral
        │
        ▼
GPIO 14 (Serial Data) → Zewnętrzny DAC (MAX98357A lub inny)
        │
        ▼
Analog audio output (L + R)
```

**Trzy tryby pracy ringbuffera:**

```
PREFETCHING ──[≥80% full]──► PROCESSING ──[overflow]──► DROPPING
      ▲                                                      │
      └─────────────[data < 80%]──────────────────────────────┘
```

| Tryb | Warunek | Akcja |
|---|---|---|
| `PREFETCHING` | Start lub underrun | Czekaj na semafory `s_i2s_write_semaphore` (maks. 3s) |
| `PROCESSING` | ≥ 80% bufora pełne | Normalne odtwarzanie |
| `DROPPING` | Bufor pełny | Odrzuć nadchodzące dane (BT wysyła za szybko) |

**Kalkulacja latencji prefetch:**
```
Prefetch size  = 12288 × 0.80 = 9830 bajtów
Latencja startu = 9830 / (44100 Hz × 2 kanały × 2 bajty) ≈ 56 ms
```

56 ms opóźnienia przy starcie muzyki jest niezauważalne dla ucha — ale chroni przed natychmiastowym underrunem. Świadomy kompromis.

**Konfiguracja DMA — dwa backendy:**

| Parametr | AudioTools (nowy) | ESP-IDF Legacy |
|---|---|---|
| Buforów DMA | 8 | 12 |
| Rozmiar bufora | 256 frames | 128 samples |
| Całkowity DMA | **8 KB** | **6 KB** |
| Sample rate | 44100 Hz | 44100 Hz |
| Bit depth | 16-bit | 16-bit |
| Channels | Stereo | Stereo |
| APLL | Tak | Tak |
| Auto-clear na underrun | Tak | Tak (tx_desc_auto_clear) |

> APLL (Audio PLL) to dedykowany PLL ESP32 zaprojektowany pod audio — minimalizuje jitter zegarowy, który przy 44.1 kHz byłby słyszalny. `use_apll = true` dla audio wyłącza się tylko jeśli wiesz co robisz i jesteś gotowy na konsekwencje.

**Kod BtI2STask — pełna logika:**

```cpp
void i2s_task_handler(void *arg) {
  is_starting.store(true);

  while (true) {
    // Reset ringbuffera jeśli wymagany (zmiana źródła audio)
    if (needs_ringbuffer_reset.load()) {
      drain_ringbuffer();
      needs_ringbuffer_reset.store(false);
    }

    // Zawieszenie gdy audio nieaktywne
    if (!bt_audio_active.load()) {
      ulTaskNotifyTake(pdTRUE, portMAX_DELAY);  // blokuje, nie spali CPU
      continue;
    }

    // Prefetch na starcie
    if (is_starting.load()) {
      if (pdTRUE != xSemaphoreTake(s_i2s_write_semaphore, pdMS_TO_TICKS(3000))) {
        TELEMETRY_INC(audio_underruns);  // timeout — bufor się nie napełnił
        continue;
      }
      is_starting.store(false);
    }

    // Odczyt z ringbuffera
    data = xRingbufferReceiveUpTo(s_ringbuf_i2s, &item_size, pdMS_TO_TICKS(10), 1920);

    if (item_size == 0) {
      TELEMETRY_INC(audio_underruns);
      ringbuffer_mode.store(RINGBUFFER_MODE_PREFETCHING);  // powrót do czekania
      continue;
    }

    // Zapis do I2S DMA
    if (is_i2s_active.load()) {
      i2s_write_data(data, item_size);
    }

    vRingbufferReturnItem(s_ringbuf_i2s, data);  // zwolnij slot
  }
}
```

Kiedy `audio_underruns` w telemetrii rośnie — to sygnał, że coś zajmuje Core 0 za długo lub połączenie BT jest niestabilne. Pierwszym krokiem diagnostycznym jest zwiększenie progu prefetch lub rozmiaru ringbuffera.

### DMA — jak audio trafia do DAC-a bez angażowania CPU

DMA (Direct Memory Access) pozwala I2S na przesyłanie próbek bez udziału CPU. ESP-IDF zarządza tym transparentnie — z perspektywy kodu użytkownika wystarczy wywołać `i2s_write_data()`.

**Przepływ DMA:**

```
BtI2STask wywołuje i2s_write_data(data, size)
        │
        ▼
ESP-IDF I2S Driver kopiuje dane do DMA descriptor
        │
        ▼
DMA Controller przesyła próbki do I2S0 Peripheral (bez CPU)
        │
        ▼
I2S0 serializuje próbki na linię BCLK/WS/DATA
        │
        ▼
GPIO 14 → DAC odbiera bitowy strumień I2S
```

DMA generuje interrupt po skonsumowaniu bufora — ESP-IDF ISR refilluje descriptor. Kod użytkownika tego nie widzi. `intr_alloc_flags = ESP_INTR_FLAG_LEVEL1` to celowo niski priorytet przerwania — wyższy mógłby zakłócać BT stack.

Rozwiązanie, które o dziwo zapobiega cięciu dźwięku gdy WiFi akurat postanowi coś wysłać.

**Monitoring DMA w telemetrii:**
```
dma_b=52480        → wolna pamięć DMA (bajtów)
base_dma_b=-8192   → 8 KB zajęte przez I2S DMA bufory (zgodnie z obliczeniami)
```

### I2C Worker Task — bo szyna I2C nie lubi tłumu

I2C to bus, który nie toleruje jednoczesnego dostępu z kilku źródeł. System ma LCD, kilka sensorów, RTC i EEPROM na tym samym busie. Bez serializacji: kolizje, NACK-i, deadlocki i błędy, które wyglądają na losowe, a wcale nie są. Zamiast rzucić globalnego mutex-a na cały bus — powstał dedykowany worker z kolejką requestów. Czyste, testowalne, rozszerzalne.

**Rozwiązanie: dedykowany task jako bramkarz**

```
Main loop (Core 0) → acquireRequest() → xQueueSend(gI2cRequestQueue) → wait on done semaphore
Sensor code       →                  ↗
LCD driver        →                  ↗

                                              ↓

                             i2cWorker (Core 1, Priority 21)
                             xQueueReceive(gI2cRequestQueue, portMAX_DELAY)
                                     │
                                  switch(op):
                                  • Probe
                                  • Write
                                  • WriteRead (z retry, maks. 3 próby)
                                     │
                             req->completed.store(true, memory_order_release)
                             xSemaphoreGive(req->done)  → odblokuj żądającego
```

**Kod workera (kluczowe fragmenty):**

```cpp
void i2cWorkerTask(void *) {
  for (;;) {
    I2cRequest *request = nullptr;
    // Blokuj na pustej kolejce (nie spala CPU)
    if (xQueueReceive(gI2cRequestQueue, &request, portMAX_DELAY) != pdTRUE) continue;

    switch (request->op) {
      case Probe:     request->result = executeProbe(...); break;
      case Write:     request->result = executeWrite(...); break;
      case WriteRead: request->result = executeWriteRead(...); break;
    }

    request->completed.store(true);
    xSemaphoreGive(request->done);  // Obudź żądającego
    releaseRequest(request);
  }
}
```

**Pula requestów (static allocation):**  
System używa statycznej puli 8 slotów (`gI2cRequestPool`). Alokacja przez critical section (~5 µs), nie przez heap — brak fragmentacji, deterministyczny czas alokacji.

```cpp
taskENTER_CRITICAL(&gI2cRequestPoolMux);
// znajdź wolny slot
taskEXIT_CRITICAL(&gI2cRequestPoolMux);
```

Critical section wyłącza przerwania — dlatego musi być *bardzo* krótka. 5 µs jest bezpieczne; powyżej ~10 µs ryzykujesz miss deadline-u I2S DMA.

**Retry logic:**  
Każde zapytanie I2C może mieć do 3 prób. Jeśli sensor nie odpowiada (timeout, NACK) — worker retryuje bez angażowania logiki wyższej warstwy. Błędy są zliczane przez `TELEMETRY_INC(i2c_errors)`.

### Synchronizacja — muteksy, semafory, atomiki

System używa pełnego zestawu mechanizmów synchronizacji FreeRTOS. Oto ich mapowanie:

| Prymityw | Instancja | Producent | Konsument | Cel |
|---|---|---|---|---|
| **FreeRTOS Queue** | `s_eventQueue` (64 sloty) | encoderTask | loop() | Zdarzenia enkodera |
| **FreeRTOS Queue** | `gI2cRequestQueue` (8 slotów) | dowolny task | i2cWorker | Żądania I2C |
| **FreeRTOS Queue** | `app_task_queue` (20 slotów) | BT callbacks | BtAppT | Zdarzenia BT stack |
| **FreeRTOS Ringbuffer** | `s_ringbuf_i2s` (12 KB) | BT audio callback | BtI2STask | Próbki audio |
| **Recursive Mutex** | `gI2cMutex` | i2cWorker | i2cWorker | Serializacja transakcji I2C |
| **Binary Semaphore** | `req->done` (per request) | i2cWorker | żądający task | Sygnalizacja zakończenia I2C |
| **Binary Semaphore** | `s_i2s_write_semaphore` | BT audio callback | BtI2STask | Sygnał prefetch 80% |
| **Task Notification** | `s_bt_i2s_task_handle` | BT activation code | BtI2STask | Start/stop audio |
| **Static Mutex** | `s_mutex` (logging) | każdy task | każdy task | Nieskrzyżowane logi UART |
| **`std::atomic<bool>`** | `s_connected`, `bt_audio_active` | WiFi/BT callbacks | loop() | Flagi stanu bez mutex |
| **`portMUX_TYPE`** | `gI2cRequestPoolMux` | critical section | critical section | Ochrona puli requestów |

**Recursive mutex — dlaczego, nie zwykły?**

Jeśli sensor A woła `I2cShared::writeRead()`, a wewnętrznie wywołuje to `lock()` dwukrotnie (nested call) — zwykły mutex deadlockuje sam siebie. Recursive mutex pozwala temu samemu taskowi zablokować go wielokrotnie, śledząc głębokość rekursji przez `gI2cOwnerDepth`.

**Memory ordering w atomikach:**

```cpp
// Worker (Core 1) — RELEASE: zapisz dane, potem ustaw flagę
request->completed.store(true, std::memory_order_release);

// Requester (Core 0) — ACQUIRE: najpierw odczytaj flagę, potem dane
if (request->completed.load(std::memory_order_acquire)) { ... }
```

Bez pary `release`/`acquire`, kompilator lub CPU może zmienić kolejność instrukcji. Core 0 mógłby odczytać dane *przed* ich zapisem przez Core 1 — klasyczny bug wielordzeniowy, który pojawia się losowo i jest nieprzyjemny w diagnozowaniu.

### Diagnostyka pamięci — RamTelemetry

`free_heap` to kłamstwo. To, że masz 200 KB wolnej pamięci, nie znaczy, że możesz zaalokować 200 KB. Heap może być sfragmentowany do tego stopnia, że największy dostępny blok to 20 KB — i właśnie tam wysypuje się `malloc()`.

**Co RamTelemetry faktycznie mierzy (snapshot co 5000 ms):**

```cpp
// RamTelemetry.cpp:124
values.freeHeap           = esp_get_free_heap_size();
values.largestFreeBlock   = heap_caps_get_largest_free_block(MALLOC_CAP_DEFAULT);
values.dmaFree            = heap_caps_get_free_size(MALLOC_CAP_DMA);
values.fragmentationPermille = 1000 - (largestFreeBlock * 1000 / freeHeap);
// watermarki tasków: uxTaskGetStackHighWaterMark()
```

**Interpretacja `fragmentationPermille`:**

| Wartość | Interpretacja | Akcja |
|---|---|---|
| 0–50‰ | Heap prawie liniowy | Brak działania |
| 50–150‰ | Normalna fragmentacja | Monitoring |
| 150–300‰ | Umiarkowana | Sprawdź alokacje dynamiczne |
| > 300‰ | Wysoka | Ryzyko `malloc()` failure; audyt kodu |

**Przykładowy heartbeat:**
```
Heap heartbeat #42 checkpoint=HEARTBEAT free=198k largest=112k dma_b=52480 \
prev_dma_b=+0 base_dma_b=-8192 frag=54‰ [i2cWorker hwm=1024 BtI2STask hwm=512]
```

- `base_dma_b=-8192` — 8 KB zajęte przez I2S DMA bufory od startu
- `hwm` (High Water Mark) — minimalna pozostała przestrzeń stacku; jeśli zbliża się do 0 → przepełnienie stacku

**Strategia statycznej alokacji:**  
Większość buforów jest alokowana raz podczas bootu:
- Pula I2C: 8 statycznych slotów
- Kolejka enkodera: 64 zdarzenia (createOnce w `encoder_begin()`)
- Ringbuffer audio: 12 KB (createOnce w `bt_i2s_task_start_up()`)
- Task wifiInit: self-delete po zakończeniu → zwrot pamięci stacku

Efekt: determinizm użycia pamięci. Heap nie rośnie i nie maleje dynamicznie w steady-state. Fragmentacja pozostaje niska.

### Mapa ryzyk i co z nimi zrobiono

System jest przemyślany, ale żaden embedded system nie jest wolny od obszarów ryzyka. Poniżej mapa zagrożeń z oceną statusu — włącznie z tymi, których jeszcze nie zaadresowano.

| Ryzyko | Lokalizacja | Status | Mitygacja |
|---|---|---|---|
| **Race condition** na ringbuffer audio | `s_ringbuf_i2s` (Core 0 i 1) | ✅ Bezpieczne | FreeRTOS API używa memory barriers |
| **Race condition** na puli I2C | `gI2cRequestPool` | ✅ Bezpieczne | Critical section (`portMUX_TYPE`) |
| **Deadlock** — I2C mutex rekurencja | `gI2cMutex` | ✅ Bezpieczne | Recursive mutex z licznikiem głębokości |
| **Deadlock** — przepełniona kolejka | `gI2cRequestQueue` (8 slotów) | ✅ Bezpieczne | Producenci używają timeout, nie `portMAX_DELAY` |
| **Priority inversion** | encoderTask (Prio 2) vs i2cWorker (Prio 21) | ✅ Mitigated | FreeRTOS priority inheritance na recursive mutex |
| **Cache coherency** — ringbuffer | Obie core | ✅ Bezpieczne | FreeRTOS API zawiera memory barriers (`DMB`) |
| **Cache coherency** — I2C request metadata | Obie core | ✅ Bezpieczne | `memory_order_release` / `memory_order_acquire` |
| **Audio underrun** | BtI2STask | ⚠️ Monitorowane | Ringbuffer 12 KB + prefetch 80% + `audio_underruns` counter |
| **Fragmentacja heap** | Cały system | ✅ Minimalne | Statyczna alokacja + telemetria fragmentacji |
| **Interrupt latency** — critical section | `gI2cRequestPoolMux` | ✅ Bezpieczne | <10 µs; I2S ma 8 buforów DMA |
| **WiFi/BT koegzystencja** | NetworkOrchestrator | ⚠️ Exclusive mode | Tylko jeden stos RF aktywny; zarządzanie przez ModeManager |
| **Stack overflow** | Wszystkie taski | ⚠️ Niezaimplementowane | Rekomendacja: `configCHECK_FOR_STACK_OVERFLOW` |

**Liczniki telemetryczne** (implementacja zero-overhead):

```cpp
#define TELEMETRY_INC(counter) \
  do { \
    extern std::atomic<uint32_t> g_telemetry_##counter; \
    g_telemetry_##counter.fetch_add(1, std::memory_order_relaxed); \
  } while (0)
```

Atomowy increment bez mutex — ~1 cykl CPU. Liczniki reportowane periodycznie, bez wpływu na timing realtime.

| Licznik | Co oznacza wzrost |
|---|---|
| `audio_underruns` | Ringbuffer opróżnił się podczas playback — sprawdź obciążenie Core 0 lub jakość BT |
| `audio_overflows` | Ringbuffer pełny, dane odrzucane — BT wysyła szybciej niż DMA konsumuje |
| `audio_drops` | Pakiety BT porzucone (warstwa wyżej) |
| `i2c_timeouts` | Sensor nie odpowiedział w limicie czasu — sprawdź okablowanie lub zasilanie |
| `i2c_errors` | NACK lub błąd busa — sprawdź adres I2C lub stan busa |

---

## 6. Interfejs i sterowanie UI

### Kanały wyświetlania

System ma **trzy fizycznie niezależne kanały wizualne** i jeden kanał debug:

| Kanał | Technologia | GPIO / Interfejs | Rola | Odświeżanie |
|-------|-------------|------------------|------|-------------|
| LCD HD44780 20×4 | hd44780_I2Cexp (PCF8574) | I2C: SDA=21, SCL=22, 400 kHz, addr 0x27 | Główny interfejs: menu, statystyki, audio, gry, weather | Inkrementalne (shadow buffer) |
| 7-segment (74HC595) | Shift register × 3 (SPI) | DATA=23, CLK=18, LATCH=5 | Zegar — zawsze widoczny czas, BPM/SpO2, stany | Bezpośredni zapis SPI |
| Guition HMI (JC8048W550c) | UART + COBS framing | Serial2: RX=35, TX=19, 115200 baud | Panel dotykowy — muzyka BT, pogoda, ustawienia, powiadomienia | Event-driven (frame per change) |
| UART mirror | Serial @ 921600 | USB/UART0 (GPIO 1/3) | Debug — mirror LCD do terminala | `UART_LCD_MIRROR=1` |

### Dlaczego trzy kanały?

LCD wymaga I2C — każde odświeżenie to transakcja przez i2cWorker. Przy intensywnym użyciu (animacje, scroll) mogłoby to nasycać bus. 7-segment przez shift register (SPI) jest natychmiastowy (GPIO, bez busa) i pokazuje czas zawsze, niezależnie od stanu LCD, trybu pracy czy aktywności BT. Guition HMI to osobny UART — nie obciąża I2C ani SPI, obsługuje dotyk i zaawansowaną grafikę.

### LCD 20×4 — inkrementalne odświeżanie

System nie czyści i nie rysuje całego ekranu od nowa. `LcdFrameBuffer20x4` śledzi co się zmieniło i aktualizuje tylko te fragmenty.

```
+---------------------------------------------------+
|  lcdFrame (RAM)    <- UI_Draw pisze tutaj          |
|  shadow (RAM)      <- ostatni commit do LCD        |
|                                                     |
|  commit() porownuje frame <-> shadow               |
|  -> wysyla tylko zmienione zakresy przez I2C        |
|  -> synchronizuje shadow = frame                   |
+---------------------------------------------------+
```

Efekt: dramatycznie niższy koszt I2C per cykl. Pełne czyszczenie LCD to ~dziesiątki transakcji I2C; aktualizacja 2-3 znaków to 2-3 transakcje.

**Tryby commit:**
- **Inkrementalny** (domyślny) — porównuje `frame[]` ze `shadow[]`, wysyła tylko różnice
- **Full redraw** (`forceFullRedrawOnce()`) — wymusza zapis całego ekranu (boot/splash)
- **Lock timeout** — `I2cShared::lock(50ms)` — jeśli bus zajęty, commit pominięty (brak blockowania)

**Telemetria** (gdy `CORE_DEBUG_LEVEL > 0`):
- `lastCommitUs` — czas ostatniego commita w mikrosekundach
- `maxCommitUs` — maksymalny czas commita
- `avgCommitUs` — średnia z wszystkich commitów
- `commitCount` — liczba commitów

### LCDIcons — niestandardowe znaki CGRAM

LCD obsługuje 8 slotów CGRAM na niestandardowe ikony (5×8 pikseli):

| Slot | Ikona | Użycie |
|------|-------|--------|
| 0 | Ntp/Gauge | Sync NTP, wskaźnik |
| 1 | Heart | BPM/SpO2 |
| 2 | Bell | Alarm |
| 3 | Cross | Wyłączono/błąd |
| 4 | Check | OK/włączono |
| 5 | Smile | Pozytywny status |
| 6 | Sad | Negatywny status |
| 7 | Wifi/Note | WiFi, muzyka |

Palety ikon są ładowane dynamicznie przez `LCDIcons::loadPalette()` w zależności od aktualnego ekranu (Home, Weather, Air, Settings).

### 7-segment — architektura

Trzy rejestry przesuwne 74HC595 połączone szeregowo, sterowane przez SPI:

```
ESP32 SPI (CLK=18, MOSI=23) -> [595 #1] -> [595 #2] -> [595 #3]
                                     |           |           |
                                   Godziny    Minuty    Sekundy/BPM
                                                        (z LATCH=5)
```

- `initSevenSeg()` — inicjalizuje GPIO + SPI, zeruje wyświetlacz
- `updateSevenSeg()` — formatuje czas HH:MM:SS lub BPM/SpO2 i wysyła przez SPI
- `updateSevenSegStoper()` — formatuje MM:SS:cc (stoper)
- Zawsze aktywny — niezależny od LCD, BT czy WiFi

### Guition HMI — panel dotykowy

Zewnętrzny display JC8048W550c z własnym MCU, komunikacja przez UART z framingiem COBS + CRC-16:

**Protokół (ramki):**
```
+--------+--------+------------------+---------+
| 0xAA   | Type   | Payload (N B)    | CRC-16  |
+--------+--------+------------------+---------+
```

**Typy ramek (ESP32 -> Guition):**

| Type | Hex | Zawartość |
|------|-----|-----------|
| IndoorWeather | 0x01 | Temp, humidity, CO2, AQI |
| Pms | 0x02 | PM2.5, PM10 |
| Time | 0x03 | HH:MM:SS, data, dzien tyg. |
| Settings | 0x04 | Stan ustawien |
| SystemResources | 0x06 | RAM/Flash usage, heap |
| WifiStatus | 0x07 | SSID, IP, RSSI, MQTT status |
| OutdoorWeather | 0x08 | Pogoda Open-Meteo |
| Ppg | 0x09 | BPM/SpO2 z STM32 |
| MusicMetadata | 0x30 | Tytul, artysta, album BT |
| MusicStatus | 0x31 | Play/pause, position |
| RadioMode | 0x38 | BT/WiFi/Auto |

**Typy ramek (Guition -> ESP32):**

| Type | Hex | Zawartość |
|------|-----|-----------|
| Request | 0x10 | Zadanie danych (polling) |
| Config | 0x11 | Zmiana ustawien z panelu |
| MusicCommand | 0x32 | Play/pause/next/prev |
| MusicVolume | 0x33 | Regulacja glosnosci |
| MusicEQ | 0x34 | Zmiana EQ |

**Inicjalizacja:**
- `EsptoGuition::begin(Serial2, 115200, RX=35, TX=19)` — Stage 2 boot
- Handshake: `kTypeHello` / `kTypeHelloAck` — weryfikacja polaczenia
- `PeerSyncState` — maszyna stanow synchronizacji obu urzadzen

### Macro API — jednolity dostep do LCD

```c
LCD_CLEAR()       // wyczysc frame (+ jesli mirror wlaczony)
LCD_CLEAR_ROW(r)  // wyczysc wiersz r
LCD_SET(c, r)     // ustaw kursor (col, row)
LCD_PRINT(v)      // wypisz wartosc
LCD_WRITE(b)      // wypisz bajt
LCD_DUMP()        // commit frame -> LCD (+ mirror dump jesli wlaczony)
```

Macro automatycznie obsluguja mirror UART — nie trzeba pisac warunkow `#if` w kodzie UI.

### Przeplyw danych LCD

```
UI_Controller (Core 1)
    |
    +-- write() -> lcdFrame (RAM buffer)
    |                  |
    |                  v
    |           commit() -- porownanie ze shadow
    |                  |
    |                  +-- I2cShared::lock(50ms)
    |                  +-- lcd.setCursor() + lcd.write() -- tylko zmienione
    |                  +-- I2cShared::unlock()
    |                  +-- shadow = frame
    |
    +-- LCD_DUMP() wywolywany z EV_UI_OVERLAY (10ms)
                     lub EV_UI_REFRESH (1000ms)
```

### Architektura UI — przepływ stanów

```
Enkoder obrotowy (GPIO 25/26/27)
         │ encoderTask: poll co 1ms, Gray-code state machine
         │ → zdarzenie do s_eventQueue (64 sloty)
         │
         ▼
loop() odczytuje s_eventQueue
         │
         ▼
   UI_Controller  ←→  mapuje zdarzenia na przejścia stanów
         │
         ▼
   AppState / UIState  ←  jedyne źródło prawdy dla UI
   • bieżący widok (zegar / menu / audio / diagnostics / ...)
   • indeks menu
   • dane do wyświetlenia
         │
         ▼
   UI_Draw  →  renderuje widoki do LCD przez i2cWorker (inkrementalnie)
               renderuje czas do 7-segment przez GPIO (bezpośrednio)
```

**Kluczowa zasada:** enkoder nie rysuje. Enkoder emituje zdarzenie. UI_Controller zmienia stan. UI_Draw rysuje stan. Klasyczny MVC — i w embedded działa tak samo dobrze jak wszędzie indziej.

**Enkoder — Gray-code state machine:**

```cpp
void encoderTask(void* param) {
  for (;;) {
    const EncoderEvent evt = encoderSampleOnce();  // Gray-code dekoder
    if (evt != ENC_NONE && s_eventQueue != nullptr) {
      xQueueSendToBack(s_eventQueue, &evt, 0);  // non-blocking
    }
    vTaskDelay(pdMS_TO_TICKS(1));  // poll co 1ms
  }
}
```

1ms polling = 1000 Hz częstotliwość próbkowania enkodera. Typowy enkoder mechaniczny nie generuje więcej niż ~20-30 impulsów na obrót, więc 1ms jest wystarczające bez ryzyka przepełnienia kolejki.

### Tryby pracy

| Tryb | Opis | Kanał sterowania |
|---|---|---|
| **Zegar główny** | Czas + overlay rotujący dane środowiskowe (T, RH, PM2.5, CO₂) | Automatyczny |
| **Menu ustawień** | Nawigacja przez enkoder (obrót = scroll, klik = select) | Enkoder |
| **Audio Bluetooth** | Track info, poziom głośności, status połączenia | Enkoder + BT remote |
| **Statystyki** | RAM, sensory, telemetria I2C/audio, watermarki tasków | Enkoder |
| **Budziki** | Zarządzanie alarmami, melodiami, harmonogramem | Enkoder |
| **Gra** | Tryb gry (niespodziewany feature 🎮) | Enkoder |
| **Panel diagnostyczny** | Pełna diagnostyka systemu na LCD | Enkoder |

---

## 7. Sieć i telemetria MQTT

### Przepływ danych: od pomiaru do brokera

```
PMS5003 (UART automat stanów)  ─────────────────────────┐
ENS160+AHT21 (I2C, z kompensacją)  ─────────────────────┤
BMP280 (I2C, polling)  ─────────────────────────────────┤
RamTelemetry (snapshot co 5s)  ─────────────────────────┤
                                                         ▼
                                              TelemetryComposer
                                              • scala wszystkie źródła
                                              • buduje JSON przez ArduinoJson
                                                         │
                              ┌──────────────────────────┴──────────────────────────┐
                              ▼                                                      ▼
                     UI renderer (LCD)                                     MQTTSync::publish()
                     (bieżący widok)                                       PubSubClient → WiFiClient
                                                                           → lwIP → WiFi MAC
                                                                           → TLS → broker MQTT
```

UI i MQTT nigdy nie konkurują o surowy stan czujnika — oba czytają gotowy snapshot z `TelemetryComposer`. Jeden snapshot, dwa odbiorcy, zero race conditions.

**Payload MQTT** (format ArduinoJson, kompaktowy):

```json
{
  "pm25": 12.4,
  "pm10": 18.2,
  "eco2": 842,
  "tvoc": 156,
  "temp": 22.3,
  "humidity": 54.1,
  "pressure": 1013.2,
  "free_heap": 198432,
  "frag_permille": 54,
  "audio_underruns": 0,
  "i2c_errors": 0
}
```

**MQTT bez osobnego taska:**  
`PubSubClient::loop()` i `publish()` wywołane są bezpośrednio z pętli głównej. Oszczędza ~4 KB pamięci stacku i eliminuje jeden task ze schedulera. Kompromis: jeśli broker jest wolny lub sieć się waha, pętla główna czeka — ale z TLS backoff strategią jest to krótkotrwałe i akceptowalne.

### Przełączanie trybów BT ↔ WiFi

```
Użytkownik wybiera tryb (menu enkoder)
                │
                ▼
   NetworkOrchestrator::requestModeChange(NEW_MODE)
                │
                ▼
   ModeManager::switchTo(NEW_MODE)
                │
                ├── wyłącz stary stos (WiFi.disconnect() lub bt_stop())
                │   [czekaj na pełne wyłączenie — ważne dla RF hardware]
                │
                ├── zapisz nowy tryb w RTC przez RadioModeSwitch
                │   (przeżywa restart, nie wymaga SNTP po powrocie)
                │
                └── uruchom nowy stos (wifiInit task lub audioBT_init())
```

**Dlaczego zapis w RTC, nie NVS?**  
NVS (flash) ma ograniczoną liczbę cykli zapisu i jest wolniejszy. RTC (RAM zasilana przez baterię) jest natychmiastowa i nie zużywa flash. Po twardym restarcie z flagą trybu w RTC, system może pominąć animację intro i przywrócić czas z DS3231 bez czekania na SNTP — szybszy cold start.

---

## 8. Struktura repozytorium

Projekt zorganizowany jest po domenach, nie po typach plików. Każdy katalog to osobna odpowiedzialność:

```
ZEGAR-ESP32/
├── include/                    ← Publiczne nagłówki (mirror struktury src/)
│   ├── core/                   ← Boot, telemetria, runtime
│   ├── comms/                  ← WiFi, MQTT, sieć
│   ├── bluetooth/              ← A2DP, I2S
│   ├── sensors/                ← Interfejsy sensorów
│   ├── ui/                     ← Stany UI, routing
│   ├── display/                ← LCD, 7-seg
│   ├── input/                  ← Enkoder
│   └── drivers/                ← I2C, niskopoziomowe
│
├── src/
│   ├── core/
│   │   ├── app/AppBoot.cpp     ← Sekwencja startowa (6 etapów)
│   │   ├── app/AppLoop.cpp     ← Pętla główna
│   │   └── telemetry/          ← RamTelemetry, LoopBaseline
│   ├── comms/
│   │   ├── WiFiSync.cpp        ← WiFi task, event handler
│   │   ├── MQTTSync.cpp        ← PubSubClient wrapper
│   │   └── NetworkOrchestrator.cpp
│   ├── bluetooth/
│   │   ├── AudioBT.cpp         ← I2S config, DMA setup
│   │   ├── BluetoothA2DPSinkQueued.cpp ← BtI2STask, ringbuffer
│   │   └── BluetoothA2DPCommon.cpp     ← BtAppT, callbacks
│   ├── sensors/                ← PMS5003, ENS160+AHT21, BMP280
│   ├── ui/                     ← UI_Controller, AppState, HomeRuntime
│   ├── display/                ← LCD render, 7-seg driver
│   ├── input/
│   │   └── Encoder.cpp         ← encoderTask, Gray-code state machine
│   └── drivers/
│       └── I2C_bus_shared.cpp  ← i2cWorker, pula requestów, mutex
│
├── platformio.ini              ← Build config, flagi kompilacji
├── huge_app.csv                ← Niestandardowy schemat partycji
└── generate_alarm_melodies.py  ← Pre-build script: katalog melodii
```

Nagłówki w `include/` odzwierciedlają ten sam układ co `src/` — granice modułów są widoczne od pierwszego `ls`. Nowy developer może nawigować strukturę bez czytania kodu.

---

## 9. Co można dołożyć i co warto poprawić

### Co można dołożyć bez wywracania systemu

Nowe funkcje mają naturalne miejsca i nie wymagają przebudowy istniejącej architektury:

| Feature | Gdzie dodać | Wymagany wysiłek |
|---|---|---|
| **Nowy czujnik** | `src/sensors/` + widok w `src/ui/` | Niski — wzorzec istnieje |
| **OTA firmware update** | `src/comms/` — naturalne uzupełnienie stosu WiFi | Średni |
| **BLE zamiast/obok BT Classic** | `src/bluetooth/` — wymaga przepisania A2DP Sink | Wysoki |
| **Home Assistant MQTT autodiscovery** | `MQTTSync.cpp` — dodaj discovery topic | Niski |
| **Webowy panel konfiguracji** | HTTP server na ESP32 w `src/comms/` | Średni |
| **Rozszerzony katalog melodii** | `generate_alarm_melodies.py` + NVS | Niski |
| **Inny DAC/wzmacniacz** | `AudioBT.cpp` — I2S pins + config | Niski |
| **Inne wyświetlacze** | `src/display/` + `src/drivers/` | Średni |
| **Warianty produktowe** | Profile PlatformIO (audio-first, weather-first, IoT-first) | Niski |

### Gdzie są naturalne refaktoryzacje

Projekt jest uczciwy wobec swoich kompromisów. Rzeczy do poprawienia przy następnej iteracji — bez owijania w bawełnę:

- **Ujednolicenie stanu UI** — część stanu przepływa przez `extern`-y; docelowo wszystko przez `AppState` / `UIState` API
- **Separacja warstwy prezentacji od logiki domenowej** — miejscami są zbyt blisko siebie
- **Watchdog timer dla krytycznych tasków** — `BtI2STask`, WiFi i Bluetooth nie mają watchdoga; rekomendowane przez FreeRTOS best practices
- **Stack overflow detection** — `configCHECK_FOR_STACK_OVERFLOW` w FreeRTOS jest niezaimplementowane; ułatwiłoby debugging zanim przepełnienie stacku objawi się jako losowy crash
- **Porzucenie legacy vendor snapshotów** — starsze źródła w `src/bluetooth/` mogą być wyczyszczone gdy `arduino-audio-tools` okaże się stabilny
- **Zwiększenie priorytetu encoderTask** — przy scenariuszach priority inversion z i2cWorker (patrz sekcja 5.3)

---

## 10. Dalszy rozwój dokumentacji

> **Uwaga:** Niniejsza dokumentacja powstała w trakcie realizacji projektu i nie obejmuje wszystkich aspektów systemu. Jest to wersja robocza, która będzie rozbudowywana w miarę rozwoju kodu źródłowego.

### Co jeszcze wymaga udokumentowania

- **Pełna dokumentacja API** — interfejsy publiczne modułów (sensors, comms, ui, display)
- **Schemat elektryczny** — pinout, zasilanie, połączenia między modułami
- **Instalacja i konfiguracja MQTT** — krok po kroku dla Mosquitto / HiveMQ
- **Debugowanie i diagnostyka** — przewodnik po logach, telemetrii, narzędziach
- **Testy jednostkowe** — strategia testowania, uruchamianie, pokrycie
- **Aktualizacja OTA** — wdrożenie i konfiguracja zdalnej aktualizacji firmware
- **Dokumentacja protokołu Guition** — pełna specyfikacja ramek, przykłady implementacji
- **Migracja na BLE** — plan przesiadki z BT Classic na BLE 5.0
- **Integracja z Home Assistant** — konfiguracja MQTT autodiscovery

### Status dokumentacji

| Sekcja | Status | Uwagi |
|--------|--------|-------|
| Jak to uruchomić | Gotowe | Podstawowa instrukcja build/flash |
| Przegląd technologii | Gotowe | Tabela komponentów |
| Hardware & Connectivity | Częściowo | Brak schematu elektrycznego |
| Architektura wewnętrzna | Gotowe | Sekwencja startu, taski, synchronizacja |
| Audio Pipeline | Gotowe | Ringbuffer, DMA, BtI2STask |
| Interfejs i sterowanie UI | Częściowo | Brak pełnej dokumentacji API |
| Sieć i telemetria MQTT | Gotowe | Konfiguracja, payload, przełączanie |
| Struktura repozytorium | Gotowe | Opis katalogów |
| Co można dołożyć | Gotowe | Lista pomysłów + refaktoryzacje |
| Dalszy rozwój dokumentacji | W trakcie | Ta sekcja |
