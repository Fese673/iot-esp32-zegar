# Dlaczego projekt wydaje się duży i co to znaczy dla Firebase Spark

Data: 2026-03-28

## TL;DR

Aplikacja do hostingu NIE jest duża.
Duży jest lokalny katalog repo przez pliki trace w `docs`.

- `dist` (to, co hostujesz) = `783720` B (~0.75 MB)
- repo bez `node_modules` = `307001184` B (~292.8 MB)
- z tego same `docs` = ~`305486630` B (~291.3 MB)

## Skąd bierze się „duży projekt”

Największe pliki:
- `docs/perf_trace_after_particles.json` -> `252436987` B
- `docs/perf_trace_before_particles.json` -> `53026317` B

Razem to ~`305463304` B (praktycznie cały ciężar repo).

## Czy to blokuje Firebase Spark?

W obecnej konfiguracji hostingu w tym projekcie:
- `firebase.json:3` -> `public: "dist"`

To oznacza, że do hostingu idzie tylko `dist`, a nie `src`, `docs` i nie trace JSON.

Wniosek:
- jeśli deployujesz ten folder poprawnie, rozmiar artefaktów jest mały i nie powinien być problemem dla Spark
- problem „dużo miejsca” dotyczy głównie lokalnego dysku/repo

## Kiedy jednak może być problem przy deploy

Problem pojawi się, jeśli przez pomyłkę ustawisz hosting na zły katalog (np. root/public zamiast `dist`) i zaczniesz wysyłać cały projekt z `docs`.

## Co zrobić teraz (praktycznie)

1. Przenieść ciężkie trace JSON poza repo aplikacji (np. folder archiwalny poza projektem).
2. Zostawić w repo tylko raport `.md` i ewentualnie małe próbki trace.
3. Dodać regułę ignorowania ciężkich trace dla deploy (na wszelki wypadek).
4. Trzymać build/deploy zawsze z `dist`.

## Bezpieczne testy (żeby nie zaciąć komputera)

## Zasady

- uruchamiaj tylko jednorazowe komendy (bez watch mode)
- nie odpalaj ciężkich profilerów na całym projekcie, jeśli nie musisz
- nie otwieraj 250 MB JSON w edytorze przy zwykłym audycie

## Zestaw testów low-risk

1. Build produkcyjny:
   - `npm run build`
2. Rozmiar artefaktów hostingu:
   - sprawdzenie sumy plików w `dist`
3. Lint jednorazowo:
   - `npm run lint`
4. Testy jednorazowo:
   - `npm run test -- --run`

## Wyniki z tej sesji

- `npm run build` -> OK
- `npm run lint` -> OK
- `npm run test -- --run` -> OK (`14/14` plików testowych, `30/30` testów)
- `dist` -> `783720` B

## Checklista Spark + rozmiar

- [x] Potwierdzono, że deploy target to `dist`.
- [x] Zmierzono realny rozmiar `dist`.
- [x] Zidentyfikowano źródło dużego repo (`docs/perf_trace_*.json`).
- [ ] Przenieść/archiwizować duże trace poza repo aplikacji.
- [ ] Dodać politykę: nie trzymać surowych trace >50 MB w głównym repo.
- [ ] Opcjonalnie dodać osobny skrypt `npm run size:dist` i `npm run size:repo`.

## Rekomendacja końcowa

Dla Spark największy wpływ teraz ma poprawna ścieżka deploy i porządek w artefaktach diagnostycznych.
Sam frontend po buildzie jest mały; największy zysk operacyjny da usunięcie ciężkich trace z repo roboczego.
