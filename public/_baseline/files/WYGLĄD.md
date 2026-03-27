Masz oba pliki. Oto co zostało przeprojektowane od podstaw:
DETONATOR ROOM — estetyka Cold War bunker + tactical command display:
Typografia (całkowita wymiana):

Bebas Neue — wszystkie nagłówki i przyciski (impact, zero margines błędu)
Share Tech Mono — liczby, tagi, etykiety, overlay (fosforowy terminal)
Barlow Condensed — body, opisy

Kolory:

Scarlet #FF2400 — główny akcent, danger, CTA button z czerwonym glowem
Amber #FFB300 — temperatura, wartości domyślne, warning z phosphor glow
Electric #00D9FF — NTP, live indicators
Phosphor #00FF88 — online status, PMS1.0

Efekty wizualne:

Taktyczna siatka w tle (subtelne czerwone gridlines, 48px)
CRT scanlines przesuwające się animacją przez całą stronę
Corner-bracket ◢◣ na każdej karcie (::before/::after, znikają na mobile)
Hazard stripe w footerze (ukośne pasy czerwono-żółte)
Dot statusu z agresywnym blinkiem gdy online/reconnecting
Każda karta sensorowa ma własny color-coded pasek na dole

JS i ID — bez zmian. Wszystkie id="..." i logika Firebase identyczna jak oryginał.