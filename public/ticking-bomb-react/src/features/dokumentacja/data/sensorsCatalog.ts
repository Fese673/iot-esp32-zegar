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
    imagePath: '/images/sensors/pms5003.jpg',
    docsUrl: 'https://cdn-shop.adafruit.com/product-files/3686/plantower_PMS5003_Manual_v2-3.pdf',
    shortDescription: 'Laserowy sensor czastek stalych z interfejsem UART, stosowany do monitoringu jakosci powietrza.',
    highlights: ['PM1.0 / PM2.5 / PM10', 'UART', 'pomiar ciagly'],
  },
  {
    id: 'ens160',
    name: 'ENS160',
    role: 'Jakosc powietrza: eCO2, TVOC, AQI',
    imagePath: '/images/sensors/ens160.jpg',
    docsUrl: 'https://www.sciosense.com/products/environmental-sensors/ens160/',
    shortDescription: 'Cyfrowy sensor gazow VOC z indeksem jakosci powietrza, wymagajacy kompensacji temperatura i wilgotnoscia.',
    highlights: ['eCO2', 'TVOC', 'AQI', 'I2C'],
  },
  {
    id: 'aht21',
    name: 'AHT21',
    role: 'Temperatura i wilgotnosc',
    imagePath: '/images/sensors/aht21.jpg',
    docsUrl: 'https://www.aosong.com/en/products-33.html',
    shortDescription: 'Kompaktowy sensor T/RH wykorzystywany do kompensacji danych z ENS160 i monitoringu mikroklimatu.',
    highlights: ['T + RH', 'I2C', 'kompensacja ENS160'],
  },
  {
    id: 'bmp280',
    name: 'BMP280',
    role: 'Cisnienie atmosferyczne',
    imagePath: '/images/sensors/bmp280.jpg',
    docsUrl: 'https://www.bosch-sensortec.com/products/environmental-sensors/pressure-sensors/bmp280/',
    shortDescription: 'Barometryczny sensor cisnienia z szybkim odczytem, wspierajacy trend pogody i telemetrie.',
    highlights: ['hPa', 'I2C', 'niski pobor mocy'],
  },
  {
    id: 'ds3231',
    name: 'DS3231',
    role: 'RTC i podtrzymanie czasu',
    imagePath: '/images/sensors/ds3231.jpg',
    docsUrl: 'https://www.analog.com/en/products/ds3231.html',
    shortDescription: 'Precyzyjny zegar czasu rzeczywistego, zapewniajacy ciaglosc czasu po restarcie i bez sieci.',
    highlights: ['RTC', 'I2C', 'backup czasu'],
  },
];
