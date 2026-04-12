# Firebase i PocketBase — skonsolidowany plan integracji

> Cel: opisać aktualną integrację z Firebase RTDB i podać spójny, krok‑po‑kroku plan poprawnego dodania PocketBase (publiczny URL: https://weron.tail37abe5.ts.net) jako alternatywnego źródła danych.

## 0. Krótkie założenia
- Aplikacja: `public/ticking-bomb-react` (React + TypeScript + Vite).
- Obecne źródło danych: Firebase Realtime Database (RTDB).
- Cel: dodać PocketBase bez łamania istniejącej logiki — adapterowym podejściem.

## 1. Obecna integracja Firebase (skrót)

- Klient: `src/shared/lib/firebaseClient.ts` (init + `getFirebaseDb()`).
- Runtime config: `src/shared/lib/runtimeConfig.ts` (`window.__FIREBASE_CONFIG__`, `localStorage.firebaseDatabaseURL`).
- Adaptery danych: `src/features/*/api/firebaseAdapter.ts` (dashboard, ens160, pms) — live: `onValue(ref(.../latest))`, historia: `get(ref(.../historyByDay/...))` lub `query(history, limitToLast(20000))`.
- Globalny kontekst live: `src/shared/context/DeviceTelemetryContext.tsx` — subskrypcja `devices/${deviceId}/latest`.

Zachowujemy ten kontrakt typów (`LiveRecord`, `HistoryRecord`) jako standard wejścia/wyjścia dla adapterów.

## 2. Dlaczego PocketBase i jak ma współpracować

- PocketBase daje REST + JS SDK + realtime (WebSocket) oraz kolekcje rekordów — dobry do self‑host lub publicznego endpointu (`https://weron.tail37abe5.ts.net`).
- Strategia: stworzyć `pocketbaseAdapter` per funkcjonalności (dashboard/ens160/pms) i fabrykę adapterów, tak aby reszta appki korzystała z jednolitego API.

## 3. Rekomendowana, spójna architektura adapterów

1) Typy + wybór źródła

- Nowy plik: `src/features/shared/api/dataSource.ts` — definicja `DataSourceName = 'firebase' | 'pocketbase'` oraz `getCurrentDataSource()`.
- Rekomendacja wyboru: preferuj `import.meta.env.VITE_DATA_SOURCE` z możliwością nadpisania `window.__DATA_SOURCE__` w debug/testach.

2) Fabryka adapterów

- `src/features/shared/api/index.ts` — eksportuje `dashboardAdapter`, `ens160Adapter`, `pmsAdapter` zależnie od `getCurrentDataSource()`.

3) Zasada użycia

- Hooki i konteksty (np. `useHistoryData`, `DeviceTelemetryContext`) powinny wywoływać adapter z `shared/api` zamiast bezpośrednio `firebaseAdapter`.

## 4. PocketBase — spójne wytyczne i przykłady

Poniżej opisuję jednolite, praktyczne podejście — tyle szczegółu ile potrzeba, aby uniknąć nieścisłości.

4.1. Klient PB

Utwórz `src/shared/lib/pocketbaseClient.ts` i skonfiguruj URL tak, aby preferował runtime env/var z Twoim publicznym adresem:

```ts
import PocketBase from 'pocketbase';

let pb: PocketBase | null = null;

export function getPocketBaseClient(): PocketBase {
  if (!pb) {
    const url =
      (typeof window !== 'undefined' && (window as any).__POCKETBASE_URL__) ||
      (import.meta.env.VITE_POCKETBASE_URL as string) ||
      'https://weron.tail37abe5.ts.net';
    pb = new PocketBase(url);
  }
  return pb;
}
```

Uwaga: `VITE_POCKETBASE_URL` ustaw w `.env` dla produkcji/deployu, `window.__POCKETBASE_URL__` możesz używać lokalnie do szybkich testów.

4.2. Model kolekcji (spójne zalecenie)

- `live` (preferowane): rekord per urządzenie, id = deviceId (albo unikalne id + pole `deviceId`). Pola: `ts`, `t`, `h`, `p`, (opcjonalnie `rawLatest`). Dzięki temu łatwo subskrybować pojedynczy rekord.
- `history`: lista rekordów z polami `deviceId`, `ts` (epoch ms), `t`, `h`, `p`, `A`, `F`, `tvoc`, `eco2`. Indeksuj `deviceId, ts` dla szybkości zapytań.
- (opcjonalnie) `devices` — meta o urządzeniu (nazwa, lokalizacja) bez trzymania dużej pola `latest` jeśli używasz `live`.

4.3. Realtime / subskrypcje — spójne podejście

- Preferowane: użyj kolekcji `live` i subskrybuj jej rekord o identyfikatorze deviceId. To najprostsze mapowanie do obecnego `ref(.../latest)` z Firebase.
- Przykład (pseudokod):

```ts
// subscribeLive(adapter)
const pb = getPocketBaseClient();
const unsubscribe = pb.collection('live').subscribe(deviceId, (event) => {
  // event.record zawiera aktualny stan 'latest' — normalizuj i wywołaj callback
});
```

- Uwaga: struktura eventów PB różni się od RTDB — adapter musi normalizować `event.record` do `LiveRecord`.

4.4. Historia — zapytania i paginacja

- Dla `loadHistoryByDay(deviceId, date)` użyj filtrów po `deviceId` i `ts` (przedział od..do). Jeśli spodziewasz się <20k punktów dziennie, `getFullList(limit)` jest wygodne; dla większych zbiorów stosuj paginację (`getList`) i sortowanie po `ts`.

Przykład filtra (pseudokod):

```ts
const range = dateRangeForDay(date); // from/to epoch ms
const records = await getPocketBaseClient()
  .collection('history')
  .getFullList(20000, {
    filter: `deviceId = "${deviceId}" && ts >= ${range.from} && ts <= ${range.to}`,
    sort: 'ts'
  });
```

4.5. Normalizacja i kontrakt adaptera

- Każdy `pocketbaseAdapter` powinien zwracać te same typy, co `firebaseAdapter`:
  - `LiveRecord` => `{ t, h, p, ts }`
  - `HistoryRecord` => `{ t, h, p, ts }`
- Adapter robi mapowanie pól, konwersję typów, sortowanie i filtrowanie zakresowe.

4.6. Autentykacja, CORS, limity

- PB może wymagać API key lub sesji — adaptery muszą obsłużyć tokeny (np. `pb.authStore`), oraz zgłosić błędy do UI tak jak Firebase adapter.
- Sprawdź CORS na `https://weron.tail37abe5.ts.net` i certyfikat TLS.
- PB realtime (WebSocket) ma praktyczne ograniczenia; pamiętaj o throttlingu subskrypcji i ośrodkach (np. grupować subskrypcje w providerach, nie otwierać osobnego kanału dla każdego pojedynczego komponentu).

## 5. Runtime: przełączanie źródła danych

- `.env` (przykład):

```
VITE_DATA_SOURCE=pocketbase
VITE_POCKETBASE_URL=https://weron.tail37abe5.ts.net
```

- Runtime override (debug): w konsoli przeglądarki `window.__DATA_SOURCE__ = 'pocketbase'` i `window.__POCKETBASE_URL__ = 'https://weron.tail37abe5.ts.net'`.

## 6. Minimalny, bezpieczny plan wdrożenia (mały refactor)

1. Dodać `pocketbaseClient.ts` (zgodnie z 4.1).
2. Dodać `src/features/dashboard/api/pocketbaseAdapter.ts` z funkcjami:
   - `subscribeLive(deviceId, callback, onError)` — subskrybuje rekord w `live` i normalizuje.
   - `loadHistoryByDay(deviceId, date)` — fetch + normalizacja.
   - `loadHistoryFallback(deviceId, date)` — paginacja/limit + filtr.
3. Dodać `src/features/shared/api/dataSource.ts` + `src/features/shared/api/index.ts` (fabryka adapterów).
4. W `DeviceTelemetryContext.tsx` i `useHistoryData` zamienić bezpośrednie wywołania na `*Adapter`.
5. Testy: ręczna walidacja UI z `VITE_DATA_SOURCE=pocketbase`, sprawdzenie live + historia.

## 7. Testy i walidacja

- Uruchom dev z PB:

```bash
VITE_DATA_SOURCE=pocketbase VITE_POCKETBASE_URL=https://weron.tail37abe5.ts.net npm run dev
```

- Scenariusz testowy:
  1. Wstaw testowy rekord do kolekcji `live` (deviceId).
  2. Wstaw kilka rekordów do `history` dla tej samej `deviceId` i daty.
  3. Otwórz UI; ustaw `window.__DATA_SOURCE__ = 'pocketbase'` jeśli trzeba.
  4. Sprawdź, czy `Live` komponenty i wykresy ładują się i aktualizują.

## 8. Uwagi i pułapki (konkretne)

- Subscription shape: PB events zawierają `action` i `record` — adapter musi ignorować nieistotne akcje i normalizować rekord.
- Jeśli używasz `latest` jako zagnieżdżonego obiektu w `devices`, rozważ opóźnienia i większe payloady; prostsze jest osobna kolekcja `live` z prostym schematem.
- Dla dużych zbiorów historycznych stosuj paginację i serwerowe indeksy po `deviceId, ts`.

## 9. Podsumowanie

- Poprawiłem i ujednoliciłem cały opis PocketBase: klient, model danych, realtime, historia, env i kroki wdrożenia.
- Kolejny krok, jeśli chcesz: wygeneruję szkielet `pocketbaseAdapter` + `dataSource` (kod) i otworzę PR w repozytorium.

---

> Plik zaktualizowany — sprawdź: public/ticking-bomb-react/docs/FIREBASE_TO_POCKETBASE_INTEGRATION_PLAN.md
