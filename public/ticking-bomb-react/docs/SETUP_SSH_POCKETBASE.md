# Setup report: SSH + PocketBase (plan + wykonane kroki)

## Kontekst
- Host: `192.168.1.16`
- Użytkownik: `weron`
- Hasło: `weron`
- Cel: przygotować środowisko i bazę PocketBase dla projektu IoT.

> Uwaga: z tego środowiska VS Code wykonano połączenie SSH i kroki instalacyjne na hoście.

## Sekcja A: Próby połączenia SSH
1. Standardowo:
   - `ssh weron@192.168.1.16`
2. Wariant z Command = echo:
   - `ssh weron@192.168.1.16 "echo connected"` --> otrzymano `connected`.
3. Wariant z podłączonymi poleceniami zdalnymi:
   - `ssh weron@192.168.1.16 "uname -a; whoami; pwd; ls -la"` --> sukces, użytkownik `weron`, katalog `/home/weron`.

---

## Sekcja B: Aktualizacja i narzędzia (wykonane)
1. `sudo apt update && sudo apt upgrade -y` (przez SSH, aktualizacja pakietów trwała, wymagane sudo + hasło).
2. `sudo apt install -y curl unzip` (zainstalowano wymagane narzędzia do pobierania i rozpakowywania).

---

## Sekcja C: Instalacja PocketBase (wykonane)
1. Stworzenie katalogów i nadanie praw:
   - `sudo mkdir -p /opt/pocketbase/data /var/log/pocketbase`
2. Pobranie właściwej wersji ARM64:
   - `curl -sL -o pocketbase.zip https://github.com/pocketbase/pocketbase/releases/download/v0.36.8/pocketbase_0.36.8_linux_arm64.zip`
3. Rozpakowanie i instalacja:
   - `unzip -o pocketbase.zip`
   - `sudo mv -f pocketbase /usr/local/bin/pocketbase`
   - `sudo chown -R weron:weron /opt/pocketbase /var/log/pocketbase`
4. Walidacja:
   - `/usr/local/bin/pocketbase --version` -> `pocketbase version 0.36.8`

---

## Sekcja D: Konfiguracja systemd serwisu (wykonane)
1. Utworzenie pliku systemd: `/etc/systemd/system/pocketbase.service`:
```ini
[Unit]
Description=PocketBase
After=network.target

[Service]
User=weron
WorkingDirectory=/opt/pocketbase
ExecStart=/usr/local/bin/pocketbase serve --http=0.0.0.0:8090 --dir=/opt/pocketbase/data
Restart=on-failure

[Install]
WantedBy=multi-user.target
```
2. Włączenie i uruchomienie:
   - `sudo systemctl daemon-reload`
   - `sudo systemctl enable --now pocketbase`
3. Status: `active (running)`.

---

## Sekcja E: Weryfikacja endpointa
- `curl -sI localhost:8090` zwróciło `HTTP/1.1 404 Not Found` (prawidłowe, root HTTP nie istnieje, serwis działa).
- Logi: `Server started at http://0.0.0.0:8090` oraz dashboard `http://0.0.0.0:8090/_/`.

---

## Sekcja F: Dalsze kroki
1. Utworzyć superusera PocketBase:
   - `sudo /usr/local/bin/pocketbase superuser upsert email@example.com strongpassword`
2. Otworzyć `http://<rpihost>:8090/_/` w przeglądarce lub tunelu.
3. Zmienić frontendowy adapter:
   - w `src/shared/lib/firebaseClient.ts` (przejście na PocketBase API)
4. Przetestować lokalne push/pull danych do kolekcji dodatniej.

---

## Co zostało zrobione lokalnie w repozytorium
- Aktualizacja dokumentacji: `docs/SETUP_SSH_POCKETBASE.md` z krokiem po kroku wykonanymi akcjami oraz stanem po instalacji.
- Brak zmian w kodzie aplikacji (bez ryzyka zatarta integracja).

---

## Sekcja G: Stan końcowy po migracji na Podman + Quadlet
- SSH: `weron@192.168.1.16` działa poprawnie.
- System hosta: Debian/Raspberry Pi, architektura aarch64.
- Użytkownik runtime: `weron`.
- Podman działa w trybie rootless dla `weron`.
- Lokalny obraz kontenera PocketBase: `localhost/pocketbase:0.36.8`.
- Runtime PocketBase: kontener Podman, nie natywny binarny proces `/usr/local/bin/pocketbase`.
- Quadlet config: `~/.config/containers/systemd/pocketbase.container`.
- Usługa: `systemctl --user status pocketbase.service` → `Active: active (running)`.
- Kontener w `podman ps`: `pocketbase` w stanie Up.
- Port hosta ograniczony do `127.0.0.1:8090` (nie publiczne 0.0.0.0).
- Dashboard PocketBase: `http://127.0.0.1:8090/_/` (HTTP 200).
- REST API: `http://127.0.0.1:8090/api/`.
- Trwałość danych: `/opt/pocketbase/data`, w katalogu znajdują się `data.db`, `auxiliary.db`.

## Sekcja H: Potwierdzenie funkcjonalne
- Dashboard admina odpowiada HTTP 200 pod `/ _ /`.
- Superuser został utworzony.
- Restart usługi: `systemctl --user restart pocketbase.service` działa.
- `loginctl show-user weron | grep Linger` → `Linger=yes`.
- Persistencja danych działa (nieusuwane po restarcie usługi).

## Dodatkowe uwagi do planu produkcyjnego
- Brak reverse proxy (Caddy/Nginx) i TLS/HTTPS w obecnej konfiguracji — priorytet do wdrożenia.
- Brak formalnej procedury backup/restore oraz aktualizacji obrazu.

dla pocketbase superuser używać ostrożnie tylko gdy jesteś pewno że dobrze myslisz 
hasło weron2121 
email weron@example.com

połacz sie tak np PS C:\Users\PC> ssh weron@192.168.1.16
weron@192.168.1.16's password:
Linux WERON 6.12.75+rpt-rpi-v8 #1 SMP PREEMPT Debian 1:6.12.75-1+rpt1 (2026-03-11) aarch64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
Last login: Tue Mar 31 18:59:54 2026 from 192.168.1.26
weron@WERON:~ $ ls
weron@WERON:~ $