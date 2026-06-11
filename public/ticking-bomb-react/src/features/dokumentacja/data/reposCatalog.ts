export interface RepoCatalogItem {
  id: string;
  name: string;
  url: string;
  description: string;
  tag: string;
  primary?: boolean;
}

export const reposCatalog: RepoCatalogItem[] = [
  {
    id: 'zegar-esp32',
    name: 'ZEGAR-ESP32',
    url: 'https://github.com/Fese673/ZEGAR-ESP32',
    description:
      'Firmware ESP32-WROOM-32D — zegar RTC, sensory (PMS5003, ENS160, BMP280), LCD, Bluetooth A2DP, WiFi/MQTT. Stworzony od podstaw.',
    tag: 'Główny firmware',
    primary: true,
  },
  {
    id: 'iot-esp32-zegar',
    name: 'iot-esp32-zegar',
    url: 'https://github.com/Fese673/iot-esp32-zegar',
    description:
      'Panel webowy IoT — wykresy, analiza danych, dokumentacja online. Dashboard React z interaktywnym UI.',
    tag: 'Dashboard (React)',
  },
  {
    id: 'esp32-s3-jc8048w550c-lvgl-ekran',
    name: 'ESP32-S3-JC8048W550c-LVGL-EKRAN',
    url: 'https://github.com/Fese673/ESP32-S3-JC8048W550c-LVGL-EKRAN',
    description:
      'Interfejs graficzny LVGL na ESP32-S3 z 5" IPS touch JC8048W550. Samodzielny projekt HMI, stworzony od podstaw.',
    tag: 'HMI — wyświetlacz',
  },
  {
    id: 'stm32-bpm',
    name: 'STM32-BPM',
    url: 'https://github.com/Fese673/STM32-BPM',
    description:
      'Mikrokontroler przemysłowy STM32C8T6 z pomiarem tętna (BPM). Osobny układ, zaprojektowany i zbudowany od zera.',
    tag: 'STM32',
  },
];
