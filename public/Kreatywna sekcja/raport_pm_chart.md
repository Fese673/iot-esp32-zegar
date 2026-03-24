# Raport: PM Frakcje, dashboard i to, czego temu widokowi brakuje

## Zakres
Przejrzałem kluczowe pliki widoczne w projekcie:

- [Kreatywna sekcja/pm_chart1.html](Kreatywna%20sekcja/pm_chart1.html)
- [index.html](index.html)
- [app.js](app.js)
- [styles.css](styles.css)
- [iot-dashboard-ntp/public/index.html](iot-dashboard-ntp/public/index.html)
- [iot-dashboard-ntp/public/app.js](iot-dashboard-ntp/public/app.js)
- [iot-dashboard-ntp/public/styles.css](iot-dashboard-ntp/public/styles.css)
- [iot-dashboard-ntp/server/src/index.ts](iot-dashboard-ntp/server/src/index.ts)
- [iot-dashboard-ntp/server/src/routes/ntp.ts](iot-dashboard-ntp/server/src/routes/ntp.ts)
- [iot-dashboard-ntp/server/src/services/ntpService.ts](iot-dashboard-ntp/server/src/services/ntpService.ts)
- [iot-dashboard-ntp/firmware/esp32/main.ino](iot-dashboard-ntp/firmware/esp32/main.ino)
- [iot-dashboard-ntp/firmware/esp32/ntp_module.cpp](iot-dashboard-ntp/firmware/esp32/ntp_module.cpp)

## Wniosek w jednym zdaniu
Ten wykres jest wizualnie mocny, ale semantycznie jeszcze nie ma wystarczającej informacji, żeby działał jak narzędzie do analizy. Na ten moment bardziej pokazuje niż wyjaśnia.

## Co jest dobre

### 1. Bardzo dopracowana warstwa wizualna
`pm_chart1.html` ma własną estetykę, spójne karty, dobry kontrast, czytelne stany i dopracowane mikroanimacje. To nie wygląda jak surowy prototyp, tylko jak gotowy komponent preview.

### 2. Jest próba nadania wykresowi życia
Wykres nie jest martwym obrazkiem. Ma:

- animowaną symulację,
- tooltip,
- dynamiczne stany kolorystyczne,
- panel statystyk,
- metadane typu highest reading, average fill, dominant zone.

To dobry kierunek, bo sama tabela liczb nie buduje hierarchii informacji.

### 3. Główna strona już ma kierunek produktowy
`iot-dashboard-ntp/public/index.html` nie jest zwykłym ekranem z odczytami. Tam już widać myślenie o:

- historii danych,
- wyborze dnia,
- PMS5003 jako osobnej sekcji,
- stanie połączenia,
- osobnych trybach dla różnych sensorów.

To znaczy, że produkt nie jest przypadkowy. Problemem nie jest brak pomysłu, tylko brak domknięcia informacji.

## Co umyka temu wykresowi

### 1. Brakuje kontekstu czasowego, ale nie w sensie klasycznego kalendarza
Masz rację: dla pyłów oś czasu w formie wyboru dat często jest sztuczna. To nie musi być wykres dzień po dniu.

Lepiej działają takie konteksty:

- teraz,
- ostatnie 15 minut,
- ostatnia godzina,
- typowy dzień,
- epizod wzrostu,
- okres stabilizacji.

Czyli nie jaki dzień, tylko jaki stan i jak się zmieniał.

### 2. Brakuje odpowiedzi na pytanie czy to jest problem
Wykres pokazuje poziomy, ale nie mówi, czy użytkownik ma się martwić.

Do tego potrzebne są:

- progi jakości,
- opis stref,
- krótkie podsumowanie tekstowe,
- porównanie do baseline,
- informacja o przekroczeniu lub jego braku.

Bez tego użytkownik widzi ładne słupki, ale musi sam interpretować, czy wynik jest istotny.

### 3. Brakuje relacji między frakcjami
Obecny układ pokazuje frakcje osobno, ale nie wyciąga wniosku z ich układu.

Przy PM bardziej użyteczne byłyby odpowiedzi typu:

- która frakcja dominuje,
- czy drobne cząstki rosną szybciej niż grubsze,
- czy trend jest lokalny czy szeroki,
- czy wzrost jest jednofrakcyjny czy systemowy.

### 4. Brakuje sensownego storytellingu danych
Wykres nie opowiada historii:

- skąd był start,
- gdzie był pik,
- co się zmieniło,
- jak długo trwał stan,
- czy to był pojedynczy skok czy dłuższy epizod.

Przy pyłach bardzo dobrze działa opis w stylu:

- dominująca PM 2.5, wzrost od 12 minut, stabilizacja po krótkim piku,
- PM 10 bez zmian, problem skupia się w drobnej frakcji,
- stan alarmowy trwał krótko i opada.

### 5. Brakuje stanu co dalej
Użytkownik powinien dostać informację operacyjną.

Na przykład:

- obserwuj dalej,
- wzrost krótkotrwały,
- utrzymuje się przekroczenie,
- wraca do normy.

Bez tego wykres nie wspiera decyzji.

## Co pokazuje przegląd strony i backendu

### 1. Frontend i backend nie są jeszcze połączone z PM jako realnym źródłem danych
`iot-dashboard-ntp/server/src/routes/ntp.ts` udostępnia tylko `/api/ntp/time`.

`iot-dashboard-ntp/server/src/services/ntpService.ts` obsługuje czas NTP przez UDP, ale nie ma tam żadnej logiki dla cząstek PM, historii stężeń ani endpointów dla PMS5003.

To oznacza, że wykres PM nie ma jeszcze naturalnego źródła danych. Na dziś jest projektem wizualnym, nie kompletnym panelem telemetrycznym.

### 2. Firmware też nie dostarcza danych PM
`iot-dashboard-ntp/firmware/esp32/main.ino` robi tylko:

- połączenie z Wi-Fi,
- synchronizację NTP,
- wypisanie czasu na Serial.

Nie ma tam czujnika PM, nie ma serializacji pomiarów PM, nie ma kanału wysyłki do backendu.

Czyli: nawet jeśli UI wygląda jak gotowy dashboard PM, warstwa danych jeszcze nie istnieje.

### 3. W projekcie są dwa różne kierunki UI
Masz dwie wizje:

- `pm_chart1.html` jako samodzielny, dopracowany mockup PM,
- `iot-dashboard-ntp/public/index.html` jako rozbudowany dashboard z historią, kalendarzem i sekcją PMS5003.

To nie jest błąd samo w sobie, ale obecnie te dwa światy nie są jeszcze zszyte w jeden spójny model produktu.

## Co jest niespójne albo niedokończone

### 1. Główny rootowy index.html wygląda na starszy, prostszy wariant
W `index.html` i `app.js` w katalogu głównym widać prosty szkic, ale niepełny:

- `app.js` szuka elementu `time-display`, którego w HTML nie ma,
- `styles.css` jest pusty,
- `index.html` wygląda jak bardzo wczesna wersja dashboardu.

To sugeruje, że ten wariant jest bardziej archiwalny niż produkcyjny.

### 2. W `pm_chart1.html` dane są symulowane
To nie wada estetyczna, tylko ważna informacja projektowa.

Na dziś wykres:

- nie czyta API,
- nie pobiera historii,
- nie ma prawdziwego stanu źródłowego,
- nie odróżnia danych rzeczywistych od symulacji poza opisem.

### 3. W `iot-dashboard-ntp/public/app.js` jest mocny nacisk na kalendarz
To dobre dla historii temperatury lub wilgotności, ale dla PM może być zbyt mechaniczne.

Przy pyłach użytkownik często potrzebuje bardziej analitycznego trybu:

- epizody,
- trend,
- alert,
- porównanie frakcji,
- świeżość odczytu.

## Co bym zrobił zamiast klasycznego wyboru dat

### Opcja A: tryb obserwacji
Zamiast kalendarza:

- teraz,
- 15 minut,
- 1 godzina,
- 24 godziny,
- epizody.

To jest najbliższe realnemu użyciu takiego sensora.

### Opcja B: wykres + panel narracyjny
Obok wykresu dać mały blok:

- dominująca frakcja,
- największy skok,
- czas trwania epizodu,
- status jakości,
- krótki opis po ludzku.

### Opcja C: wykres zdarzeń zamiast osi czasu
Jeśli chcesz coś ciekawszego niż zwykły timeline, pokaż tylko punkty ważne:

- spike,
- plateau,
- powrót do normy,
- przekroczenie progu,
- brak zmian.

To lepiej pasuje do pyłów niż tradycyjna historia z kalendarzem.

## Najkrótsza diagnoza produktu

Ten widok jest na etapie:

1. bardzo dobrego stylu,
2. częściowej logiki dashboardu,
3. jeszcze niepełnej analityki.

Najbardziej brakuje mu nie efektów, tylko znaczenia.

## Priorytety usprawnień

### Pilne
- Podłączyć realne źródło danych PM.
- Dodać progowe stany jakości.
- Pokazać krótkie podsumowanie tekstowe nad lub pod wykresem.

### Ważne
- Zamienić myślenie data wyboru dnia na okno obserwacji albo epizod.
- Dodać baseline i porównanie do poprzedniego okresu.
- Uporządkować rozdział między wersją archiwalną a aktualnym dashboardem.

### Dodatkowe
- Dodać legendę interpretacyjną, nie tylko kolorową.
- Zostawić wykres bardziej skupiony na trendzie niż na dekoracji.
- Ujednolicić nazwy i role sekcji PM w całym projekcie.

## Konkluzja
Jeśli pytasz, czego najbardziej brakuje temu wykresowi, to odpowiedź brzmi: interpretacji i źródła prawdziwych danych.

Jeśli chcesz, żeby ten widok był naprawdę mocny, to lepszy od wyboru dat będzie układ:

- status,
- trend,
- epizody,
- porównanie frakcji,
- krótki tekstowy werdykt.

To da więcej wartości niż dokładanie kolejnej osi czasu.