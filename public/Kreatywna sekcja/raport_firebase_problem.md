# Raport: dlaczego dashboard może nie czytać danych z Firebase

## Kontekst

Z dostarczonych logów wynika, że urządzenie i bridge faktycznie wysyłają dane do Firebase Realtime Database:

- aktualizowany jest węzeł `devices/device1/latest`
- dopisywana jest historia do `devices/device1/history`
- payload zawiera zarówno temperaturę / wilgotność / ciśnienie, jak i dane PM:
  - `F.pm1`, `F.pm25`, `F.pm10`
  - `A.pm1`, `A.pm25`, `A.pm10`
  - `particles.0p3`, `particles.0p5`, `particles.1p0`, `particles.2p5`, `particles.5p0`, `particles.10p0`

W logach widać też, że bridge poprawnie parsuje compact array format i zapisuje rekordy do RTDB.

## Co sprawdziłem w frontendzie

W `public/app.js` dashboard czyta dane z tych samych głównych ścieżek:

- live: `devices/device1/latest`
- historia: `devices/device1/history`
- dzień: `devices/device1/historyByDay/<YYYY-MM-DD>`

Czyli na poziomie samej ścieżki nie ma oczywistego rozjazdu między bridge a frontendem.

## Najważniejsza obserwacja

Frontend i bridge zgadzają się co do głównego miejsca zapisu, ale dashboard ma kilka zależności, które mogą powodować pozorny brak danych:

1. **Live i historia są obsługiwane osobno**
   - `latest` aktualizuje karty na żywo.
   - `historyByDay` jest używane do wykresu dobowego.
   - Gdy `historyByDay` nie istnieje, dashboard filtruje `history` po dacie.

2. **Historia używa pola `ts` jako czasu logicznego**
   - Frontend filtruje dane po `ts`.
   - Bridge nadpisuje `ts` czasem serwera i zachowuje `device_ts` osobno.
   - To jest poprawne, ale jeśli historia zawiera rekordy bez `ts`, wykres może ich nie pokazać.

3. **PM na żywo preferuje `A`, a potem `F`**
   - Dashboard dla PMS5003 bierze najpierw `v.A`, potem `v.F`.
   - To pasuje do bridge, bo bridge zapisuje oba zestawy.
   - Jeżeli jednak rekord ma tylko jeden z nich, UI nadal powinien działać, ale trzeba to potwierdzić na realnych danych.

## Wnioski techniczne

Na podstawie kodu najbardziej prawdopodobne problemy to:

- **reguły Firebase** nie pozwalają przeglądarce czytać danych
- dashboard jest otwierany z innego kontekstu niż zakłada konfiguracja RTDB
- `historyByDay` nie jest uzupełniane po stronie bridge, a frontend liczy na ten skrót
- `latest` jest zapisywany, ale w UI nie widać odczytu przez problem z subskrypcją / błędem konsoli / blokadą sieciową
- problem dotyczy tylko historii, a nie live, albo odwrotnie

## Miejsca w kodzie warte dalszej weryfikacji

- `public/app.js`:
  - `subscribeLatest()`
  - `loadDay(dateStr)`
  - `normalizeHistoryObject(obj)`
  - `pmsSubscribeLive()`
  - `pmsLoadDay(dateStr)`

- bridge:
  - zapis do `devices/device1/latest`
  - dopisywanie do `devices/device1/history`
  - brak wypełniania `historyByDay`

## Co jest już pewne

- Bridge nie wygląda na główne źródło problemu ze schematem danych.
- Frontend ma logikę, która powinna czytać dokładnie z tych samych głównych ścieżek.
- Największe ryzyko to niezgodność środowiska odczytu: reguły, uprawnienia, albo brakowanie danych w `historyByDay`.

## Co pokazuje konsola przeglądarki

Z Twoich logów wynika już coś dużo konkretniejszego:

1. **Osobny problem: CDN dla chartjs-plugin-zoom**
  - Zasób `https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@4.4.0/dist/chartjs-plugin-zoom.umd.min.js` jest blokowany przez `X-Content-Type-Options: nosniff`, bo serwer zwraca MIME `text/plain`.
  - To powoduje tylko fallback dla zoom/pinch.
  - To **nie tłumaczy** braku danych z Firebase.

2. **Główny problem: Firebase RTDB odrzuca odczyt**
  - W konsoli pojawia się `Permission denied` przy `pmsLoadDay(...)`.
  - Ten sam błąd występuje też przy `loadDay(...)`.
  - To oznacza, że przeglądarka nie może odczytać danych z RTDB, więc zarówno wykres historii, jak i live view są zablokowane.

## Co już wdrożyłem w repo

- usunąłem próbę Anonymous Auth z frontendu, bo generowała dodatkowy błąd bez naprawy odczytu
- dodałem `database.rules.json` z publicznym odczytem dla gałęzi `devices/$deviceId`
- podpiąłem te reguły w `firebase.json`

To jest właściwy tor naprawy dla statycznego frontendu, który ma czytać dane z RTDB zapisywanych przez bridge.

## Co już wiemy na pewno

- Bridge zapisuje dane poprawnie do Firebase.
- Frontend próbuje czytać te same ścieżki, ale dostaje odmowę dostępu.
- Problem nie wygląda na błędny format danych PM.
- Problem nie wygląda też na brak danych w samym bridge.
- Problem dotyczy odczytu z RTDB, a nie samego zapisu.

## Co to zmienia praktycznie

W obecnym układzie statyczny frontend nie ma własnego serwera auth. Jeżeli RTDB nie pozwala na odczyt bez logowania, przeglądarka dostanie `Permission denied` niezależnie od tego, że bridge zapisuje poprawnie.

Dlatego fix jest taki:

- reguły RTDB muszą pozwolić na odczyt tych gałęzi,
- frontend nie powinien próbować Anonymous Auth, jeśli projekt go nie ma włączonego,
- bridge może dalej pisać przez Admin SDK bez zmian.

## Co warto teraz potwierdzić

1. Czy w konsoli przeglądarki pojawia się `Permission denied`, `Missing or insufficient permissions` albo `Failed to read`.
2. Czy reguły RTDB pozwalają na read z poziomu przeglądarki.
3. Czy w RTDB istnieje realnie `devices/device1/latest` oraz `devices/device1/history` w tym samym projekcie, który ma skonfigurowany frontend.
4. Czy `historyByDay` jest tworzony gdziekolwiek po stronie bridge lub device.

## Najbardziej prawdopodobna przyczyna

Na tym etapie najbardziej prawdopodobne jest jedno z dwóch:

- **reguły Realtime Database zablokowały odczyt dla przeglądarki**
- **frontend wskazuje na inny projekt / inną bazę niż ta, do której zapisuje bridge**

Jeżeli bridge i frontend działają na tym samym projekcie, a log pokazuje `Permission denied`, to pierwsza opcja jest najbliżej prawdy.

## Pytania do Ciebie

- Czy problem dotyczy tylko karty LIVE, tylko wykresu historii, czy obu naraz?
- Czy w konsoli przeglądarki widzisz błąd uprawnień Firebase?
- Czy chcesz, żebym następnie zrobił już konkretną poprawkę kodu, np. dodał defensywny fallback i diagnostykę błędów odczytu?
