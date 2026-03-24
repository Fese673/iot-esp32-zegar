# Raport z przeglądu refaktoru

Zakres przeglądu:
- główny frontend w [app.js](app.js)
- konfiguracja Firebase w [firebase-config.js](firebase-config.js)
- główny widok w [index.html](index.html)
- style w [styles.css](styles.css)
- warianty projektu w [iot-dashboard-ntp](iot-dashboard-ntp) i [iot-dashboard-ntp-1](iot-dashboard-ntp-1)
- firmware ESP32 w [iot-dashboard-ntp/firmware/esp32/main.ino](iot-dashboard-ntp/firmware/esp32/main.ino) i [iot-dashboard-ntp/firmware/esp32/ntp_module.cpp](iot-dashboard-ntp/firmware/esp32/ntp_module.cpp)
- backend NTP w [iot-dashboard-ntp/server/src/index.ts](iot-dashboard-ntp/server/src/index.ts), [iot-dashboard-ntp/server/src/routes/ntp.ts](iot-dashboard-ntp/server/src/routes/ntp.ts), [iot-dashboard-ntp/server/src/services/ntpService.ts](iot-dashboard-ntp/server/src/services/ntpService.ts), [iot-dashboard-ntp/server/src/types/index.ts](iot-dashboard-ntp/server/src/types/index.ts)
- test i narzędzia pomocnicze w [test/uptime-gif.test.js](test/uptime-gif.test.js) i [scripts/diagnose.js](scripts/diagnose.js)
- plik awaryjny 404 w [404.html](404.html)

## Wnioski skrócone

Największy dług techniczny nie jest w jednej funkcji, tylko w architekturze repozytorium:
- są dwa równoległe, praktycznie identyczne warianty projektu: [iot-dashboard-ntp](iot-dashboard-ntp) i [iot-dashboard-ntp-1](iot-dashboard-ntp-1)
- frontend, symulacje, elementy legacy i logika dashboardu są zmieszane w jednym dużym widoku
- konfiguracja Firebase jest wpisana bezpośrednio w kod frontendu
- backend NTP i firmware mają rozjazd między tym, co deklarują README, a tym, co faktycznie robi kod
- są stare lub eksperymentalne katalogi, które zwiększają szum i utrudniają nawigację

## Priorytety refaktoru

| Priorytet | Co refaktorować | Dlaczego | Gdzie |
| --- | --- | --- | --- |
| P0 | Usunąć duplikację wariantów projektu i wybrać jedną wersję źródłową | Dwa niemal identyczne drzewa powodują rozjazdy zmian, niejasny punkt prawdy i podwójny koszt utrzymania | [iot-dashboard-ntp](iot-dashboard-ntp), [iot-dashboard-ntp-1](iot-dashboard-ntp-1) |
| P0 | Wydzielić konfigurację i sekrety z frontendu | Publiczny kod nie powinien zawierać stałych danych konfiguracyjnych Firebase; konfiguracja została wydzielona, ale nadal warto utrzymać ją osobno od logiki UI | [firebase-config.js](firebase-config.js), [app.js](app.js) |
| P1 | Rozbić duży frontend na moduły odpowiedzialności | Obecny [app.js](app.js) miesza: inicjalizację Firebase, stan UI, wykresy, kalendarz, czas, alerty i animacje. To utrudnia testy i zmiany lokalne | [app.js](app.js) |
| P1 | Uporządkować strukturę HTML i wyciągnąć sekcje eksperymentalne | W [index.html](index.html) siedzą jednocześnie główny dashboard, symulacja PM i sekcja PMS5003; to jest funkcjonalnie szerokie, ale organizacyjnie ciężkie | [index.html](index.html#L47), [index.html](index.html#L176) |
| P1 | Naprawić backend NTP i warstwę uruchomieniową | Kod serwera jest prosty, ale oparty na minimalnym szkielecie bez wyraźnej separacji konfiguracji, walidacji i obsługi błędów | [iot-dashboard-ntp/server/src/index.ts](iot-dashboard-ntp/server/src/index.ts), [iot-dashboard-ntp/server/src/routes/ntp.ts](iot-dashboard-ntp/server/src/routes/ntp.ts), [iot-dashboard-ntp/server/src/services/ntpService.ts](iot-dashboard-ntp/server/src/services/ntpService.ts) |
| P2 | Ujednolicić firmware ESP32 | [main.ino](iot-dashboard-ntp/firmware/esp32/main.ino) i [ntp_module.cpp](iot-dashboard-ntp/firmware/esp32/ntp_module.cpp) pokazują dwa różne podejścia do czasu i Wi-Fi; to zwiększa ryzyko rozjazdu zachowania | [iot-dashboard-ntp/firmware/esp32/main.ino](iot-dashboard-ntp/firmware/esp32/main.ino), [iot-dashboard-ntp/firmware/esp32/ntp_module.cpp](iot-dashboard-ntp/firmware/esp32/ntp_module.cpp) |
| P2 | Ograniczyć legacy i artefakty poboczne | Katalogi typu [stara sekcja](stara%20sekcja) i [Kreatywna sekcja](Kreatywna%20sekcja) utrudniają orientację i mieszają produkt z eksperymentem | [stara sekcja](stara%20sekcja), [Kreatywna sekcja](Kreatywna%20sekcja) |
| P3 | Wzmocnić testy i diagnostykę | Jest tylko jeden test integracyjny, a diagnostyka ma charakter podstawowy. To za mało dla repo z frontem, firmware i backendem | [test/uptime-gif.test.js](test/uptime-gif.test.js), [scripts/diagnose.js](scripts/diagnose.js) |
| P3 | Uporządkować dokumentację | Dwa README opisują ten sam projekt w praktycznie tej samej formie. Dokumentacja nie mówi jasno, która wersja jest aktywna | [iot-dashboard-ntp/README.md](iot-dashboard-ntp/README.md), [iot-dashboard-ntp-1/README.md](iot-dashboard-ntp-1/README.md) |

## Co dokładnie refaktorować i dlaczego

### 1. Jedno źródło prawdy dla projektu

Problem:
- [iot-dashboard-ntp](iot-dashboard-ntp) i [iot-dashboard-ntp-1](iot-dashboard-ntp-1) są praktycznie takimi samymi kopiami
- oba zawierają ten sam układ: frontend, firmware, backend i README

Dlaczego to jest problem:
- każda poprawka może zostać wdrożona tylko w jednym wariancie
- trudno stwierdzić, która gałąź katalogów jest referencyjna
- przegląd kodu staje się wolniejszy, bo trzeba sprawdzać dwa drzewa

Rekomendacja:
- wybrać jeden katalog jako wersję aktywną
- drugi przenieść do archiwum albo usunąć po potwierdzeniu, że nic z niego nie jest używane
- w dokumentacji wskazać jeden oficjalny punkt wejścia

### 2. Konfiguracja Firebase poza kodem

Problem:
- konfiguracja Firebase została wydzielona do [firebase-config.js](firebase-config.js), więc główny kod nie musi już trzymać stałych danych inicjalizacyjnych

Dlaczego to jest problem:
- nadal warto trzymać ją poza główną logiką aplikacji i ładować z warstwy wdrożeniowej lub środowiskowej
- ułatwia to zmianę środowiska bez dotykania logiki UI
- rozdziela kod aplikacji od danych wdrożeniowych

Rekomendacja:
- utrzymać konfigurację jako osobny, łatwy do podmiany plik runtime
- front powinien dostać tylko to, co jest potrzebne do działania w danym środowisku

### 3. Rozbicie monolitycznego frontendu

Problem:
- [app.js](app.js) obsługuje jednocześnie Firebase, status połączenia, wykresy, kalendarz, czas, alerty, animacje i logikę zależną od urządzenia

Dlaczego to jest problem:
- jedna zmiana może niechcący zepsuć kilka niezależnych funkcji
- trudniej pisać testy jednostkowe i integracyjne
- kod będzie coraz trudniejszy do czytania przy dalszym rozwoju

Rekomendacja:
- podzielić frontend na moduły: konfiguracja, stan urządzenia, wykresy, kalendarz, czas, UI powiadomień, animacje
- wyciągnąć wspólne helpery do osobnych plików
- dążyć do prostego punktu wejścia i małych, samodzielnych modułów

### 4. Uporządkowanie HTML i sekcji eksperymentalnych

Problem:
- [index.html](index.html#L47) i [index.html](index.html#L176) mieszają kluczowy dashboard z dodatkowymi modułami wizualnymi i symulacjami

Dlaczego to jest problem:
- rozmiar i złożoność widoku rośnie szybciej niż wartość biznesowa
- trudno odróżnić funkcje produkcyjne od demonstracyjnych
- układ staje się mniej przewidywalny dla utrzymania i stylowania

Rekomendacja:
- wydzielić sekcje eksperymentalne do osobnych komponentów, widoków lub podstron
- utrzymać główny dashboard jako lekki i jednoznaczny ekran
- jeśli symulacje są potrzebne, ładować je tylko wtedy, gdy użytkownik je otworzy

### 5. Backend NTP do dopracowania pod produkcję

Problem:
- [iot-dashboard-ntp/server/src/index.ts](iot-dashboard-ntp/server/src/index.ts) uruchamia serwer bez warstwy konfiguracji aplikacji
- [iot-dashboard-ntp/server/src/routes/ntp.ts](iot-dashboard-ntp/server/src/routes/ntp.ts) i [iot-dashboard-ntp/server/src/services/ntpService.ts](iot-dashboard-ntp/server/src/services/ntpService.ts) są blisko logiki transportowej, ale bez wyraźnych granic odpowiedzialności
- [iot-dashboard-ntp/server/src/types/index.ts](iot-dashboard-ntp/server/src/types/index.ts) definiuje typy, ale nie widać ich realnego spięcia z przepływem danych

Dlaczego to jest problem:
- trudno testować i rozwijać serwer bez naruszania routing i transportu
- brak mocnej separacji utrudnia późniejsze rozszerzenia, np. autoryzację, logowanie, healthchecki
- implementacja NTP powinna mieć lepszą obsługę błędów i cyklu życia socketa

Rekomendacja:
- wydzielić konfigurację serwera, route handlers i serwisy
- dodać obsługę błędów i walidację odpowiedzi
- rozważyć osobny moduł transportu UDP z czystym kontraktem wejścia i wyjścia

### 6. Firmware ESP32 do uproszczenia i ujednolicenia

Problem:
- [main.ino](iot-dashboard-ntp/firmware/esp32/main.ino) to prosty sketch pollingowy
- [ntp_module.cpp](iot-dashboard-ntp/firmware/esp32/ntp_module.cpp) definiuje osobną klasę czasu, ale nie widać spójnej integracji z głównym szkicem

Dlaczego to jest problem:
- są dwa wzorce implementacji czasu, więc łatwo o rozjazd
- kod odpowiedzialny za Wi-Fi i czas powinien być jednoznaczny i testowalny na poziomie modułu
- sprzętowe części projektu źle znoszą niejasne granice odpowiedzialności

Rekomendacja:
- wybrać jeden model czasu i jeden punkt sterowania
- wydzielić konfigurację Wi-Fi, NTP i logowanie do odrębnych plików lub klas
- usunąć martwe albo nieużywane warianty implementacji

### 7. Legacy i artefakty poboczne

Problem:
- [stara sekcja](stara%20sekcja) oraz [Kreatywna sekcja](Kreatywna%20sekcja) są katalogami, które wyglądają na eksperymentalne lub historyczne
- [404.html](404.html) jest standardowym plikiem Firebase, ale wizualnie nie pasuje do reszty projektu i nie jest zintegrowany z główną architekturą UI

Dlaczego to jest problem:
- repozytorium robi się trudne do skanowania
- nowa osoba nie wie, co jest produkcyjne, a co jest testem lub szkicem
- zwiększa się koszt utrzymania, bo trzeba pamiętać o śmieciach informacyjnych

Rekomendacja:
- oznaczyć artefakty jako archiwalne albo wynieść poza główny workspace
- zostawić tylko to, co ma realne znaczenie dla wdrożenia i debugowania

### 8. Testy i diagnostyka są zbyt wąskie

Problem:
- [test/uptime-gif.test.js](test/uptime-gif.test.js) sprawdza tylko jeden detal UI
- [scripts/diagnose.js](scripts/diagnose.js) ma charakter zdrowotny, ale nie zastępuje testów zachowania

Dlaczego to jest problem:
- brak pokrycia dla przepływów krytycznych, takich jak wczytanie danych, przełączanie dni czy stany offline/online
- łatwo wprowadzić regresję bez wykrycia jej przez CI

Rekomendacja:
- dodać testy dla głównych stanów dashboardu
- objąć testami integrację z danymi historii i stanami połączenia
- dodać prosty zestaw testów dla backendu i firmware kontraktów, jeśli to możliwe

## Kolejność prac

1. Ustalić jeden aktywny wariant projektu i zamrozić drugi.
2. Wyciągnąć konfiguracje z frontendu i uporządkować sekrety.
3. Podzielić [app.js](app.js) na mniejsze moduły.
4. Oddzielić sekcje eksperymentalne od głównego dashboardu.
5. Dopracować backend NTP i obsługę błędów.
6. Ujednolicić firmware ESP32.
7. Oczyścić legacy katalogi i poprawić dokumentację.
8. Rozszerzyć testy o zachowania krytyczne.

## Ryzyko, jeśli tego nie ruszyć

- dalsze kopiowanie kodu między dwoma wariantami projektu
- kolejne trudne do śledzenia regresje w dashboardzie
- wzrost czasu wdrażania zmian
- większe ryzyko błędów wynikających z niejednoznacznej struktury repozytorium

## Najbardziej opłacalne pierwsze kroki

1. Wybrać jedną wersję projektu jako oficjalną.
2. Utrzymać konfigurację Firebase poza główną logiką [app.js](app.js).
3. Rozbić frontend na mniejsze pliki odpowiedzialności.
4. Przenieść legacy i eksperymenty poza główny tor rozwoju.
