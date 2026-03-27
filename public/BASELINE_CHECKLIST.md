# Baseline Checklist

## Live metrics
- [x] Temperatura – wyświetla aktualną wartość
- [x] Wilgotność – wyświetla aktualną wartość
- [x] Ciśnienie – wyświetla aktualną wartość
- [x] Wartości aktualizują się po nadejściu nowych danych

## Połączenie
- [x] Status połączenia wyświetla się poprawnie
- [x] lastSeen aktualizuje się poprawnie
- [x] Brak danych live wyświetla stan offline/brak połączenia

## Czas
- [x] Zegar systemowy wyświetla się i tyka
- [x] Czas pochodzi z urządzenia gdy jest dostępny
- [x] Fallback do czasu lokalnego gdy urządzenie niedostępne
- [x] Źródło czasu jest opisane w UI

## Historia
- [x] Wykres dobowy renderuje się poprawnie
- [x] Ładowanie danych historycznych działa
- [x] Stan loading wyświetla się podczas ładowania
- [x] Stan empty wyświetla się gdy brak danych
- [x] Stan error wyświetla się przy błędzie Firebase
- [x] Fallback z historyByDay do history działa

## Kalendarz
- [x] Można wybrać inny dzień
- [x] Dzisiaj jest zaznaczony
- [x] Wybrany dzień jest zaznaczony
- [x] Zmiana dnia ładuje inne dane historyczne

## Live + history
- [x] Dla dzisiejszego dnia nowe punkty live dopinają się do wykresu
- [x] Dla innego dnia nowe punkty live nie dopinają się do wykresu

## PMS
- [ ] PM1 live wyświetla się
- [ ] PM2.5 live wyświetla się
- [ ] PM10 live wyświetla się
- [ ] Historia PM renderuje się
- [ ] Dane z pola A są używane jeśli dostępne
- [ ] Fallback do pola F działa
- [ ] Kalendarz PMS działa niezależnie od kalendarza głównego

## Alerty i toast
- [x] Alert success wyświetla się
- [x] Alert warn wyświetla się
- [x] Alert error wyświetla się
- [x] Toast wyświetla się i znika

## UI
- [ ] Motion toggle włącza i wyłącza animacje
- [ ] Klasa motion-off jest dodawana/usuwana z documentElement
- [ ] Wygląd strony jest zgodny z baseline wizualnie
- [ ] Hierarchia sekcji jest zachowana

## Edge cases
- [ ] permission denied w Firebase – obsłużone
- [ ] Brak odpowiedzi urządzenia dla synchronizacji czasu – obsłużone
- [ ] PMS bez pola A, tylko F – obsłużone
- [ ] Mobile gestures na wykresie działają
- [ ] Wheel zoom na wykresie działa
