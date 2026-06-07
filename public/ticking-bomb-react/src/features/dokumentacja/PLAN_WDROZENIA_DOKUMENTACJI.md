# Plan wdrozenia podstrony "Dokumentacja" (wersja projektowa)

## 1) Cel i wynik koncowy

Celem jest dodanie nowej podstrony Dokumentacja, ktora:

- jest otwierana przyciskiem "Dokumentacja" z glownych widokow aplikacji,
- zachowuje obecny styl wizualny strony (kolory, klimat, typografia, rytm kart),
- zawiera cala tresc z pliku `ZEGAR-ESP32_Master_Documentation_v2.md`,
- nie jest jednym blokiem tekstu, tylko zbiorem niezaleznych sekcji/komponentow,
- ma ladny, czytelny i klikalny spis tresci,
- ma minimalistyczne animacje zgodne z `motion-off` i `prefers-reduced-motion`,
- ma czytelne tabele (pinout, sensory) z podswietlaniem wierszy i filtrowaniem,
- ma specjalna sekcje startowa na zdjecia sensorow + linki do dokumentacji producentow,
- jest latwa do edycji przez developera bez przepisywania calego kodu.

## 2) Stan obecny (audyt architektury i stylu)

### Routing i nawigacja

- Aplikacja juz ma wzorzec podstrony po hash (`#analiza-danych`) i lazy loading.
- Widok glowny oraz analiza sa przelaczane w `App.tsx` przez `activePage`.
- W `TopBar.tsx` istnieje prawa kolumna z akcjami (idealne miejsce na przycisk Dokumentacja).

### Styl i tokeny

- Globalna paleta i klimat sa zdefiniowane w `src/styles.css` przez zmienne CSS (`--bg-0`, `--panel`, `--stroke`, `--accent`, `--muted`, `--text`, `--radius`, `--shadow`, `--mono`, `--sans`).
- Istnieje gotowy system paneli i kart (`.panel`, `.stat-card`, `.chip`, `.ghost-btn`, `.primary-btn`).
- Istnieje wzorzec oddzielnego pliku stylow feature (`analysis.css`) z animacjami i fallbackiem dla reduced motion.

### Ograniczenia techniczne

- Obecny stack: React 19 + TypeScript + Vite.
- Brak gotowego parsera markdown w dependencies.
- Folder `src/features/dokumentacja` istnieje i jest pusty (idealny punkt startowy).

## 3) Docelowa architektura informacji (IA)

Podstrona Dokumentacja bedzie podzielona na warstwy:

1. Hero + szybki wstep
2. Sensor Hub (zdjecia + opisy + linki producentow)
3. Spis tresci (sticky, klikalny, z aktywnym highlightem)
4. Sekcje merytoryczne (renderowane jako niezalezne bloki)
5. Tabele techniczne (interaktywne)
6. Bloki kodu/schematow (ladne podswietlenie)
7. Podsumowanie + linki nawigacyjne

Kazda sekcja ma byc niezalezna, tak aby mozna bylo:

- usunac sekcje bez ruszania reszty,
- dodac nowa sekcje przez wpis w konfiguracji,
- zmienic kolejnosc sekcji bez przepisywania calego widoku.

## 4) Proponowana struktura plikow

```text
src/features/dokumentacja/
  components/
    DocumentationPage.tsx
    DocumentationTopNav.tsx
    DocumentationHero.tsx
    DocumentationSensorHub.tsx
    DocumentationToc.tsx
    DocumentationSectionCard.tsx
    DocumentationTable.tsx
    DocumentationCodeBlock.tsx
  data/
    sensorsCatalog.ts
    docsSections.config.ts
  lib/
    markdownLoader.ts
    markdownSectionParser.ts
    tableFilter.ts
  content/
    master-documentation.md
  styles/
    dokumentacja.css
  __tests__/
    markdownSectionParser.test.ts
    tableFilter.test.ts
```

Uwaga: `master-documentation.md` to kopia/kanoniczne zrodlo tresci z `ZEGAR-ESP32_Master_Documentation_v2.md` dla frontendu.

## 5) Narzedzia i biblioteki (rekomendacja)

### Rekomendowany zestaw

- `react-markdown` (render markdown do React)
- `remark-gfm` (tabele, listy, markdown GFM)
- `rehype-highlight` lub `shiki` (podswietlanie kodu)
- `rehype-slug` + `rehype-autolink-headings` (ID naglowkow i anchory)

### Dlaczego to podejscie

- Developer edytuje glownie markdown i lekka konfiguracje, a nie JSX calej strony.
- Mamy pelna kontrole nad mapowaniem elementow markdown na nasze komponenty (kartowe).
- Kod i tabele beda czytelne, estetyczne i zgodne z obecna paleta.
- Jednak wygląd i otymalizacja nadal muszą być na wysokim poziomie.

## 6) Etapy realizacji (realistyczne i kreatywne)

## Etap 0 - Fundament i kontrakt UX (0.5 dnia)

Zakres:

- Potwierdzic hash route: `#dokumentacja`.
- Potwierdzic miejsce przycisku (TopBar prawa kolumna).
- Potwierdzic zasady visual parity: te same tokeny kolorow i paneli.

Wyjscie:

- Mini spec funkcjonalna (checklista + makieta low-fi).

## Etap 1 - Routing i wejscie na podstrone (0.5 dnia)

Zakres:

- Dodac obsluge trzeciego widoku w `App.tsx` (`dashboard | analysis | documentation`).
- Dodac lazy import nowej strony dokumentacji.
- Dodac `onOpenDocumentation` do `TopBar.tsx` i przycisk "Dokumentacja".

Wyjscie:

- Dzialajace przejscie dashboard -> dokumentacja -> dashboard.

## Etap 2 - Szkielet strony i modularna kompozycja (1 dzien)

Zakres:

- Zbudowac `DocumentationPage.tsx` jako kontener sekcji.
- Dodac komponenty: Hero, SensorHub, ToC, SectionCard.
- Wydzielic `dokumentacja.css` i podeprzec go tokenami z `styles.css`.

Wyjscie:

- Strona ma finalna strukture blokowa, ale jeszcze bez pelnej tresci.

## Etap 3 - Pipeline markdown i migracja tresci (1 dzien)

Zakres:

- Dodac `master-documentation.md` do folderu feature.
- Zaimplementowac parser sekcji po naglowkach H2/H3.
- Wstrzyknac cala tresc z pliku zrodlowego do sekcji renderowanych kartowo.

Wyjscie:

- 100% tresci dokumentacji widoczne na stronie, ale w czytelnych moduach.

## Etap 4 - Spis tresci i nawigacja sekcyjna (0.5-1 dnia)

Zakres:

- Auto-generacja ToC na podstawie naglowkow.
- Sticky ToC na desktopie + wersja collapsible na mobile.
- Scrollspy: aktywna sekcja podswietla sie podczas przewijania.

Wyjscie:

- Uzytkownik szybko skacze po duzym dokumencie bez zgubienia kontekstu.

## Etap 5 - Tabele interaktywne i czytelnosc danych (0.5-1 dnia)

Zakres:

- Dla tabel pinow/sensorow zastosowac `DocumentationTable`.
- Dodac minimum:
  - hover highlight wiersza,
  - sticky header,
  - filtr tekstowy (np. po GPIO, nazwie, interfejsie).
- Zapewnic horizontal scroll na mobile bez lamania layoutu.

Wyjscie:

- Tabele sa praktyczne, nie tylko dekoracyjne.

## Etap 6 - Sekcja Sensor Hub na gorze strony (0.5 dnia)

Zakres:

- Stworzyc ladna sekcje "Poznaj sensory" przed glowna trescia.
- Karty sensorow: zdjecie, 2-3 zdania opisu, kluczowe parametry, link do oficjalnego datasheetu.
- Dane kart trzymac w `sensorsCatalog.ts`.

Wyjscie:

- Miejsce gotowe na Twoje zdjecia i zewnetrzne linki.

## Etap 7 - Animacje subtelne i wydajne (0.5 dnia)

Zakres:

- Wejscie sekcji: delikatny fade + translateY.
- Stagger tylko dla pierwszego widoku i tylko dla desktop.
- Pelna zgodnosc z:
  - `motion-off` (globalny przelacznik),
  - `prefers-reduced-motion`.

Wyjscie:

- Strona ma "ducha", ale nie meczy i nie obciaza.

## Etap 8 - QA, dostepnosc i testy (0.5-1 dnia)

Zakres:

- Test parsera markdown (podzial na sekcje, ID, kolejnosc).
- Test filtrowania tabel.
- Test hash navigation i scroll behavior.
- Kontrola a11y: semantyka naglowkow, focus styles, kontrast, aria-label.

Wyjscie:

- Stabilna podstrona gotowa do rozwijania.

## 7) Szczegoly implementacyjne kluczowych wymagan

### A) "Nie jeden blok tekstu"

- Kazdy H2 tworzy osobna karte sekcji.
- Wnetrze sekcji moze miec H3, listy, cytaty, kod, tabele.
- `docsSections.config.ts` pozwala:
  - ukrywac sekcje,
  - zmieniac kolejnosc,
  - nadpisywac layout sekcji.

### B) "Calosc tresci ma sie znalezc"

- Tresc z dostarczonego markdown trafia 1:1 do `master-documentation.md`.
- Parser nie skraca tekstu; jedynie dzieli go na bloki i mapuje na komponenty.
- Dodajemy "integrity check" (np. liczba sekcji i naglowkow) po migracji.

### C) "Styl jak obecna strona"

- Uzywamy tych samych zmiennych CSS i tonu paneli.
- Nie zmieniamy globalnej palety, tylko rozszerzamy feature-level CSS.
- Zachowujemy klimat scanlines/bg-grid i panel cards.

### D) "Interaktywne tabele"

- Wersja MVP: filtr + hover + sticky head.
- Wersja V2: sortowanie kolumn i szybkie chipy filtrujace.

## 8) Kryteria akceptacji (Definition of Done)

Projekt uznajemy za zakonczony, gdy:

- Jest przycisk "Dokumentacja" i dziala na wszystkich viewportach.
- Podstrona dokumentacji laduje sie osobno i nie psuje dashboardu.
- Cala tresc z markdown jest widoczna na stronie.
- Spis tresci dziala i poprawnie przewija do sekcji.
- Tabele pinow/sensorow sa czytelne i filtrowalne.
- Kody/schematy maja czytelne podswietlenie.
- Animacje sa subtelne i poprawnie wyciszane przez `motion-off` i system reduced motion.
- Developer potrafi dodac nowa sekcje bez grzebania w rdzeniu strony.

## 9) Ryzyka i mitygacje

- Ryzyko: zbyt duzy bundle po dodaniu parserow markdown.
  - Mitygacja: lazy loading strony dokumentacji + ewentualny dynamic import highlightera.

- Ryzyko: niespojnosc stylu po dodaniu wielu komponentow.
  - Mitygacja: twarde oparcie o tokeny z `styles.css` i wspolne utility klasy.

- Ryzyko: slaba czytelnosc tabel na mobile.
  - Mitygacja: sticky header + kontrolowany overflow + testy na breakpointach.

- Ryzyko: trudna edycja tresci przez dev.
  - Mitygacja: markdown jako zrodlo prawdy + prosta konfiguracja sekcji.

## 10) Kolejnosc wdrozenia (praktyczna)

1. Routing + przycisk.
2. Szkielet komponentowy.
3. Import i rendering markdown.
4. ToC + scrollspy.
5. Interaktywne tabele.
6. Sensor Hub.
7. Animacje.
8. Testy i polishing.

To daje szybki efekt widoczny dla usera juz po 1-2 dniach, a potem bezpieczne dopinanie jakosci.

## 11) Co bedzie latwe do rozbudowy po MVP

- Dodanie wersji EN dokumentacji.
- Eksport do PDF (drukowalny layout).
- Tryb "quick start" dla poczatkujacych.
- Tryb "deep dive" dla dev/embedded.
- Dodatkowe interaktywne schematy (np. callouty pinow).

---

Ten plan jest gotowy do realizacji w obecnej architekturze projektu i utrzymuje tozsamosc wizualna aplikacji, jednoczesnie porzadkujac dokumentacje do formy wygodnej dla poczatkujacych i technicznie przyjaznej dla developera.
