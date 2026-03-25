# Raport z refaktoru

## PM Frakcje w trybie live

- Panel PM Frakcje został przełączony z symulacji na realne dane z Firebase RTDB.
- Osadzony widok [Kreatywna sekcja/pm_chart1.html](Kreatywna%20sekcja/pm_chart1.html) ładuje teraz [Kreatywna sekcja/pm_chart-live.js](Kreatywna%20sekcja/pm_chart-live.js).
- Wykres nadal działa jako układ warstwowy stacked bars, ale liczby pochodzą z `devices/device1/latest.particles.*`.
- Opisy w [index.html](index.html) zostały zaktualizowane, żeby nie sugerowały już trybu demo.
- Historia `devices/device1/history` służy jako kontekst dla peaków i trendu, a fallback `A`/`F` pozostał tylko awaryjnie.

Ten dokument opisuje, co zostało już zrobione, dlaczego to zrobiono i co dalej wymaga pracy. Nie jest to już lista luźnych uwag, tylko aktualny status przebudowy repozytorium.

## Co zostało zrobione

| Zmiana | Co dokładnie zrobiono | Dlaczego |
| --- | --- | --- |
| Firebase config | Przeniesiono konfigurację do [firebase-config.js](firebase-config.js) i dołączono ją przed [app.js](app.js) | Żeby główny kod aplikacji nie trzymał danych środowiskowych i żeby łatwiej było zmieniać konfigurację bez ruszania logiki UI |
| Wspólne helpery UI | Wydzielono [ui-utils.js](ui-utils.js) | Żeby odseparować animacje, toast, alerty i podstawowe helpery DOM od reszty logiki aplikacji |
| Czas i formatowanie | Wydzielono [time-utils.js](time-utils.js) | Żeby funkcje formatujące czas nie siedziały w monolitycznym [app.js](app.js) |
| Osadzanie PM | Wydzielono automatyczne dopasowanie wysokości iframe do [pm-embed.js](pm-embed.js) | Żeby odsunąć od głównego widoku techniczny skrypt pomocniczy związany z osadzonym panelem PM |
| PMS5003 | Przeniesiono całą sekcję PMS do [pms-module.js](pms-module.js) | Żeby rozdzielić główny dashboard od osobnego modułu PM i zmniejszyć złożoność [app.js](app.js) |
| Duplikat projektu | Usunięto zduplikowane drzewo projektu | Żeby zostało jedno źródło prawdy i nie było ryzyka rozjazdu między kopiami |
| Raport | Przepisano raport do formy statusowej | Żeby od razu było widać, co jest wykonane, a co jeszcze wymaga pracy |

## Dlaczego te zmiany były ważne

### 1. Firebase config poza logiką aplikacji

To była najtańsza zmiana o dużym efekcie. Konfiguracja środowiskowa przestała mieszać się z logiką UI, więc:
- łatwiej utrzymać różne środowiska,
- łatwiej zrozumieć, co jest kodem, a co ustawieniem wdrożeniowym,
- mniejsze ryzyko przypadkowego rozjechania konfiguracji przy edycji [app.js](app.js).

### 2. Helpery UI i czasu osobno

Te funkcje są wspólne i nie powinny być rozlane po głównym pliku. Ich wydzielenie:
- skraca główny plik,
- poprawia czytelność,
- ułatwia dalsze rozbijanie frontendu.

### 3. PMS5003 jako osobny moduł

Sekcja PMS była funkcjonalnie niezależna, więc miała sens jako osobny plik. Dzięki temu:
- główny dashboard jest mniej obciążony,
- logika PM nie miesza się z logiką temperatury, wilgotności i historii,
- łatwiej później to wyłączyć, przenieść lub testować osobno.

### 4. Usunięcie duplikatu projektu

To usuwa największy koszt utrzymania organizacyjnego. Mając jedną wersję projektu:
- nie ma wątpliwości, który kod jest aktywny,
- nie ma ryzyka, że poprawka trafi tylko do jednej kopii,
- dokumentacja i rozwój są prostsze.

## Co nadal wymaga pracy

| Obszar | Co jeszcze zostało | Dlaczego to dalej ważne |
| --- | --- | --- |
| Główny frontend | [app.js](app.js) nadal trzyma główny stan aplikacji, wykres historii, kalendarz i logikę odczytu danych | To nadal największy plik i główne miejsce ryzyka regresji |
| Struktura widoku | [index.html](index.html) dalej łączy dashboard z sekcjami eksperymentalnymi | Mimo uporządkowania helperów, sam widok nadal jest szeroki i trochę ciężki |
| Backend NTP | [iot-dashboard-ntp/server/src/index.ts](iot-dashboard-ntp/server/src/index.ts) i powiązane pliki nadal są prostym szkieletem | Brakuje wyraźnej separacji konfiguracji, walidacji i obsługi błędów |
| Firmware | [iot-dashboard-ntp/firmware/esp32/main.ino](iot-dashboard-ntp/firmware/esp32/main.ino) i [iot-dashboard-ntp/firmware/esp32/ntp_module.cpp](iot-dashboard-ntp/firmware/esp32/ntp_module.cpp) nadal pokazują dwa style podejścia | To zwiększa ryzyko rozjazdu zachowania na urządzeniu |
| Legacy | [stara sekcja](stara%20sekcja) i [Kreatywna sekcja](Kreatywna%20sekcja) nadal są artefaktami pobocznymi | Mieszają produkt, eksperyment i archiwum |
| Testy | [test/uptime-gif.test.js](test/uptime-gif.test.js) i [scripts/diagnose.js](scripts/diagnose.js) są zbyt wąskie | Potrzebne są testy dla głównych przepływów, nie tylko dla pojedynczego elementu |

## Najbliższy sensowny plan

1. Dzielić dalej [app.js](app.js) na mniejsze moduły odpowiedzialności.
2. Wyciągnąć logikę głównego wykresu historii do osobnego pliku.
3. Oddzielić sekcje eksperymentalne od głównego dashboardu.
4. Uporządkować backend NTP i firmware jako osobne, czyste warstwy.
5. Rozszerzyć testy o scenariusze kluczowe dla działania dashboardu.

## Podsumowanie

Najważniejsze zostało już zrobione tam, gdzie dawało największy zwrot:
- konfiguracja przestała siedzieć w głównym kodzie,
- wspólne helpery zostały rozdzielone,
- PMS5003 dostał osobny moduł,
- duplikat projektu został usunięty.

Został jeszcze główny monolit w [app.js](app.js) oraz porządkowanie backendu, firmware i testów. To są kolejne naturalne kroki, ale już nie blokują one zrozumienia obecnego stanu projektu.
