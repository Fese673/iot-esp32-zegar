# Koszt danych wejścia na stronę

Pomiar wykonany 2026-04-12 na produkcyjnym buildzie uruchomionym przez `npm run build` i `vite preview`.

Metoda:
- zsumowano rozmiary wszystkich zarejestrowanych zasobów strony z `performance.getEntriesByType('resource')` oraz wpisu `navigation`
- dla fontów Google przyjęto rozmiar odpowiedzi z nagłówka `Content-Length`
- liczby poniżej opisują payload zasobów, czyli faktycznie pobrane treści; realny transfer sieciowy będzie minimalnie większy przez nagłówki HTTP
- w tym przebiegu narzędzia sieciowe nie pokazały osobnego klasycznego requestu do Firebase, więc nie doliczono ukrytego strumienia, którego nie dało się zweryfikować

## Wyniki

| Scenariusz | Payload | W przeliczeniu |
| --- | ---: | ---: |
| Cold start dashboardu | 776,094 B | 0.776 MB |
| Cold start bezpośrednio na `/#analiza-danych` | 1,142,090 B | 1.142 MB |
| Dodatkowy koszt samego modułu analizy po wejściu na dashboard | 382,499 B | 0.382 MB |

## Największe składniki

### Dashboard
- `index-DOyI9vvI.js` - 278,808 B
- `charts--8enhH-2.js` - 202,221 B
- `firebase-VeUu2VyD.js` - 154,248 B
- fonty Google razem - 84,904 B
- `index-D0OF3JlQ.css` - 27,506 B

### Analiza
- `AnalysisPage-CrCdpATb.js` - 293,003 B
- `index-DOyI9vvI.js` - 278,808 B
- `charts--8enhH-2.js` - 202,221 B
- `firebase-VeUu2VyD.js` - 154,248 B
- fonty Google razem - 84,904 B
- fonty KaTeX razem - 48,180 B
- `AnalysisPage-D7hmcLqI.css` - 41,316 B

## Wniosek

Jeśli użytkownik wchodzi od razu na dashboard, koszt pierwszego wejścia jest około 0.776 MB. Jeśli wchodzi bezpośrednio na analizę, koszt rośnie do około 1.142 MB, głównie przez lazy-loaded `AnalysisPage` oraz fonty KaTeX.

Największy pojedynczy koszt na obu ścieżkach to główny bundle JS, a drugi w kolejności to Chart.js / wykresy i Firebase SDK. Dla analizy dodatkowo dochodzą fonty matematyczne.