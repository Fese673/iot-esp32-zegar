export interface SensorCatalogItem {
  id: string;
  name: string;
  role: string;
  imagePath: string;
  docsUrl: string;
  shortDescription: string;
  highlights: string[];
}

export const sensorsCatalog: SensorCatalogItem[] = [
  {
    id: 'pms5003',
    name: 'PMS5003',
    role: 'Sensor pylu PM1 / PM2.5 / PM10',
    imagePath: '/images/sensors/pms5003.png',
    docsUrl: 'https://www.aqmd.gov/docs/default-source/aq-spec/resources-page/plantower-pms5003-manual_v2-3.pdf',
    shortDescription: 'Laserowy sensor czastek stalych z interfejsem UART, stosowany do monitoringu jakosci powietrza.',
    highlights: ['PM1.0 / PM2.5 / PM10', 'UART', 'pomiar ciagly'],
  },
  {
    id: 'ens160',
    name: 'ENS160',
    role: 'Jakosc powietrza: eCO2, TVOC, AQI',
    imagePath: '/images/sensors/ens160.png',
    docsUrl: 'https://www.sciosense.com/wp-content/uploads/2023/12/ENS160-Datasheet.pdf',
    shortDescription: 'Cyfrowy sensor gazow VOC z indeksem jakosci powietrza, wymagajacy kompensacji temperatura i wilgotnoscia.',
    highlights: ['eCO2', 'TVOC', 'AQI', 'I2C'],
  },
  {
    id: 'aht21',
    name: 'AHT21',
    role: 'Temperatura i wilgotnosc',
    imagePath: '/images/sensors/aht21.png',
    docsUrl: 'https://www.aosong.com/userfiles/files/media/Data%20Sheet%20AHT21.pdf',
    shortDescription: 'Kompaktowy sensor T/RH wykorzystywany do kompensacji danych z ENS160 i monitoringu mikroklimatu.',
    highlights: ['T + RH', 'I2C', 'kompensacja ENS160'],
  },
  {
    id: 'bmp280',
    name: 'BMP280',
    role: 'Cisnienie atmosferyczne',
    imagePath: '/images/sensors/bmp280.png',
    docsUrl: 'https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp280-ds001.pdf',
    shortDescription: 'Barometryczny sensor cisnienia z szybkim odczytem, wspierajacy trend pogody i telemetrie.',
    highlights: ['hPa', 'I2C', 'niski pobor mocy'],
  },
  {
    id: 'ds3231',
    name: 'DS3231',
    role: 'RTC i podtrzymanie czasu',
    imagePath: '/images/sensors/ds3231.png',
    docsUrl: 'https://www.analog.com/media/en/technical-documentation/data-sheets/DS3231.pdf',
    shortDescription: 'Precyzyjny zegar czasu rzeczywistego, zapewniajacy ciaglosc czasu po restarcie i bez sieci.',
    highlights: ['RTC', 'I2C', 'backup czasu'],
  },
  {
    id: 'jc8048w550',
    name: 'Guition JC8048W550',
    role: 'Glowny HMI — 5" IPS touch display',
    imagePath: '/images/sensors/jc8048w550.png',
    docsUrl: 'https://github.com/Shadowtrance/jc8048w550c/blob/main/2-Specification/JC8048W550%20Specifications-EN%20.pdf',
    shortDescription: 'Modulowy panel dotykowy ESP32-S3 z 5" IPS 800x480, WiFi, BLE 5.0 i 8 MB PSRAM.',
    highlights: ['ESP32-S3 dual-core 240MHz', '800x480 IPS RGB', 'Capacitive touch (GT911)', '16 MB Flash + 8 MB PSRAM', 'WiFi + BLE 5.0'],
  },
  {
    id: 'pcm5102',
    name: 'PCM5102A',
    role: 'DAC audio — 32-bit I2S',
    imagePath: '/images/sensors/pcm5102.png',
    docsUrl: 'https://www.ti.com/lit/ds/symlink/pcm5102.pdf',
    shortDescription: '32-bit stereo DAC I2S z niskim poziomem szumu i zakresem napiecia 3.3-5V, wykorzystywany do odtwarzania audio z Bluetooth na ESP32.',
    highlights: ['32-bit / 384kHz', 'I2S', 'niski THD+N', '3.3-5V'],
  },
  {
    id: 'lcd2004',
    name: 'LCD 2004 (HD44780)',
    role: 'Wyswietlacz znakowy 20x4',
    imagePath: '/images/sensors/lcd2004.png',
    docsUrl: 'https://cdn-shop.adafruit.com/datasheets/TC2004A-01.pdf',
    shortDescription: 'Alfanumeryczny wyswietlacz LCD 20 znakow x 4 wiersze z kontrolerem HD44780, podlaczony przez I2C (PCF8574) do ESP32.',
    highlights: ['20x4 znaki', 'HD44780', 'I2C (PCF8574)', 'podswietlenie'],
  },
];
