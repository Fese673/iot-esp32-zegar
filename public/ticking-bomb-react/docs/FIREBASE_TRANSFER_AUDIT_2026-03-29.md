# Audyt transferu Firebase i odświeżenia strony

## Wniosek w skrócie

W obecnym buildzie aplikacja nadal deployuje do Firebase Hosting zawartość `dist` z Vite, ale dwa wcześniej wskazane źródła nadmiarowego transferu zostały poprawione:

1. historyczne dane nie są już pobierane równolegle z primary i fallbackiem;
2. `latest` jest obsługiwane przez jeden wspólny provider, zamiast trzech osobnych listenerów.

Z pomiarów builda statyczny cold start nadal jest umiarkowany, a koszt miesięczny będzie teraz dużo bardziej zależał od rzeczywistych danych z Realtime Database niż od zbędnego dublowania odczytów.

## Co trafia na Firebase Hosting przy deployu

W [firebase.json](../firebase.json) hosting wskazuje na `dist`, więc na serwer trafia cały wynik builda, a nie źródła projektu.

W praktyce deploy zawiera:

- główny shell aplikacji i chunk runtime
- chunk Firebase i chunk wykresów
- lazy-loaded analizę danych
- plik konfiguracyjny Firebase z public
- assety publiczne, w tym `bomba.gif`, `elektryk.gif` i `favicon.svg`
- fonty KaTeX do wzorów w kafelkach analizy

## Pomiar statycznego transferu

Poniżej wynik z analizy plików z `dist` po ostatnim buildzie.

| Scenariusz | Raw | Szacowany wire |
|---|---:|---:|
| Cold start dashboardu | ~791 KB | ~327 KB |
| Cold otwarcie analizy jako dodatkowy chunk | +~1.40 MB | +~1.17 MB |
| Cold otwarcie analizy łącznie | ~2.19 MB | ~1.49 MB |

Uwagi:

- `wire` to przybliżenie po gzip dla HTML/JS/CSS/SVG/JSON, a dla obrazków i fontów przyjęto rozmiar raw.
- `index.html` dokłada jeszcze zewnętrzne Google Fonts z `fonts.googleapis.com` i `fonts.gstatic.com`, ale to **nie** wchodzi do transferu Firebase Hosting.
- Po warm cache większość fingerprintowanych assetów zwykle nie powinna pobierać się ponownie w całości.

## Co jest pobierane po odświeżeniu dashboardu

Na start dashboardu aplikacja uruchamia:

- [useLiveMetrics](../src/features/dashboard/hooks/useLiveMetrics.ts#L1) przez [App.tsx](../src/App.tsx#L12) i [App.tsx](../src/App.tsx#L202)
- [useHistoryData](../src/features/dashboard/hooks/useHistoryData.ts#L130)
- [usePmsData](../src/features/pms/hooks/usePmsData.ts#L1)
- [useEns160Data](../src/features/ens160/hooks/useEns160Data.ts#L1)

Dodatkowo dashboard renderuje obrazki z public:

- [bomba.gif](../src/features/dashboard/components/TopBar.tsx#L30)
- [elektryk.gif](../src/features/dashboard/components/MetaGrid.tsx#L16)

## Co zostało naprawione

### Jeden wspólny listener `latest`

Live data są teraz obsługiwane przez [DeviceTelemetryProvider](../src/shared/context/DeviceTelemetryContext.tsx#L16), który subskrybuje `devices/{deviceId}/latest` tylko raz i rozdziela wynik do konsumentów przez kontekst.

- provider jest wpięty w [App.tsx](../src/App.tsx#L12)
- sam listener jest w [DeviceTelemetryContext.tsx](../src/shared/context/DeviceTelemetryContext.tsx#L39)
- hook [useLiveMetrics](../src/features/dashboard/hooks/useLiveMetrics.ts#L1) już nie tworzy własnej subskrypcji, tylko czyta dane z kontekstu i normalizuje je przez [normalizeLiveRecord](../src/features/dashboard/api/firebaseAdapter.ts#L11)
- hooki [usePmsLive](../src/features/pms/hooks/usePmsLive.ts#L1) i [useEns160Live](../src/features/ens160/hooks/useEns160Live.ts#L1) też konsumują ten sam strumień zamiast zakładać własne połączenia

### Sekwencyjny fallback historii

Pobieranie historii zostało zmienione na prawdziwy fallback: najpierw leci `historyByDay/{date}`, a dopiero jeśli wynik jest pusty, uruchamia się odczyt z `history`.

- [useHistoryData](../src/features/dashboard/hooks/useHistoryData.ts#L172)
- [usePmsHistory](../src/features/pms/hooks/usePmsHistory.ts#L160)
- [useEns160History](../src/features/ens160/hooks/useEns160History.ts#L160)

To usuwa wcześniejsze równoległe pobieranie primary + fallback i znacząco obniża niepotrzebny transfer z bazy.

## Najważniejszy efekt po poprawce

1. Jedno połączenie live na `latest` zamiast trzech.
2. Zero równoległego pobierania historii `historyByDay` i `history`.
3. Fallback `limitToLast(20_000)` uruchamia się tylko wtedy, gdy primary nic nie zwróci.

## Krótki osąd kosztu

- Sam statyczny refresh dashboardu pozostaje umiarkowany i mieści się w setkach KB.
- Najcięższy element pozostaje na stronie analizy przez KaTeX i fonty, ale to jest koszt hostingu statycznego, a nie bazy.
- Największy wcześniej wykryty błąd transferowy został usunięty, więc obecne zużycie powinno być wyraźnie niższe przy zwykłym odświeżeniu i przy dłuższym korzystaniu z dashboardu.
