# Raport: nakładanie się warstw i problemy z wykresem PM

## Zakres

Przejrzałem główny dashboard i osobny widok PM w:

- [index.html](index.html)
- [styles.css](styles.css)
- [app.js](app.js)
- [pms-module.js](pms-module.js)
- [Kreatywna sekcja/pm_chart1.html](Kreatywna%20sekcja/pm_chart1.html)

## Co wyglądało na zbugowane

### 1. Sterowanie wykresem było rozstrzelone wizualnie

W [styles.css](styles.css) przyciski `.chart-controls` miały ustawiony środek `left: 47%` i ogromny `gap: 500px`. To powodowało, że kontrolki nie siedziały przy krawędziach wykresu, tylko wyglądały jak przypadkowo rozsypane po jego środku.

### 2. Scroll/zoom był obsługiwany podwójnie

W [app.js](app.js) i [pms-module.js](pms-module.js) ten sam handler `wheel` był podpięty jednocześnie do kontenera wykresu i do canvasu. Ponieważ zdarzenie bąbelkuje, pojedynczy scroll potrafił uruchamiać zoom/pan dwa razy.

### 3. PMS kontrolki były sztucznie przesuwane przez JS

W [pms-module.js](pms-module.js) był dodatkowy blok, który na starcie przestawiał pozycję `.chart-controls` na podstawie obliczonego procentu. To było kruche i mogło dawać różne rezultaty przy zmianie szerokości panelu.

### 4. Część stylów była przypięta do złego selektora

Reguły dla sekcji PMS w [styles.css](styles.css) były zapisane dla `.panel[aria-label="pms5003"]`, ale faktyczny element ma klasę `.pms-section`. Efekt: część stylów wyglądała jakby nie działała, choć w praktyce selektor po prostu nie trafiał.

### 5. Widok PM miał uszkodzony koniec HTML

W [Kreatywna sekcja/pm_chart1.html](Kreatywna%20sekcja/pm_chart1.html) końcówka sekcji z notką była źle zagnieżdżona. Powstawał otwarty akapit w akapicie, a dalsza część dokumentu była dopięta bez czytelnej struktury zamykającej. Taki układ potrafi przesunąć albo spłaszczyć część kafelków w zależności od przeglądarki.

## Co zrobiłem

- Ustawiłem kontrolki wykresu na dwa stałe bieguny zamiast sztucznego rozstrzelenia.
- Usunąłem podwójne nasłuchiwanie `wheel` na canvasie i zostawiłem jeden punkt obsługi na kontenerze.
- Wyłączyłem JS-owy hack, który przesuwał PMS kontrolki po załadowaniu.
- Poprawiłem selektory CSS dla sekcji PMS, żeby stylowanie trafiało w realny element.
- Naprawiłem końcówkę [Kreatywna sekcja/pm_chart1.html](Kreatywna%20sekcja/pm_chart1.html), żeby układ nie zależał od awaryjnego domykania przez przeglądarkę.
- Zmieniłem układ pętlowy (nesting) w głównym `index.html`: wyciągnąłem `.pms-section` na zewnątrz kontenera `.pm-preview`. Zapobiegnie to nienaturalnemu zlewaniu się obramowań i dziwnym promieniom zaokrągleń (border-radius zawijał ramkę powyżej sekcji w tym samym kontenerze).
- Usunąłem zdublowaną klasę `live-grid pms5003-grid` na same `pms5003-grid` w `index.html`. Sprawiało to konflikt siatek (4 kolumny vs 3 kolumny), co wymuszało nieprzewidywalne skalowanie wykresów na węższych ekranach.
- Zabezpieczyłem tytuły `S E N S O R` oraz głownego nagłówka (litery flex) za pomocą `flex-wrap: wrap` – brak tej reguły i ułożenie `display: flex` dla liter powodowały wyciek nagłówka przy bardzo małych rozdzielczościach poniżej `300px` (np. nakładanie się na ikony na urządzeniach typu zegarki / małe paski).
- Dodałem brakujący element `<p id="projectStartTime">` w karcie Uptime. Brak tego paragrafu powodował asymetrię wysokości względem siostrzanej karty zegara NTP, przez co blok `.meta-grid` potrafił krzywić wizualny balans układu.

## Efekt

- Sterowanie wykresem nie powinno już sprawiać wrażenia „nakładającego się”.
- Scroll i pinch nie powinny już robić podwójnego skoku.
- Sekcja PM ma wysoce przewidywalny i odizolowany układ – dwa niezależne bloki (Iframe Firebase oraz widok PMS5003) zamiast zlanego panelu.
- Kafle PM 5003 przeliczają się stabilnie, układając się w 3 → 2 → 1 kolumny, nie poddając się już losowym łamaniom z tytułu miksu klas.
- Etykiety i logotyp w górnych panelach mają teraz zabezpieczenie dla wąskich viewportów.

## Co dalej warto obserwować

- Czy wąski ekran mobilny nadal mieści przyciski wykresu bez ścisku.
- Czy iframe z widokiem PM dalej poprawnie dopasowuje wysokość po zmianie danych.
- Czy widok PM nie potrzebuje jeszcze osobnego wzmocnienia kontrastu dla legendy i osi.
- Czy samodzielny widok [Kreatywna sekcja/pm_chart1.html](Kreatywna%20sekcja/pm_chart1.html) nie wymaga dalszego odchudzenia, bo zawiera zarówno layout, jak i warstwę demonstracyjną.