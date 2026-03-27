(function initPmChartLive() {
  const barsRow = document.getElementById("barsRow");
  if (!barsRow) return;

  const xAxis = document.getElementById("xAxis");
  const tt = document.getElementById("tt");
  const detailsBtn = document.getElementById("detailsBtn");
  const detailsBackdrop = document.getElementById("detailsBackdrop");
  const detailsDrawer = document.getElementById("detailsDrawer");
  const drawerClose = document.getElementById("drawerClose");
  const drawerTitle = document.getElementById("drawerTitle");
  const drawerWhat = document.getElementById("drawerWhat");
  const drawerSource = document.getElementById("drawerSource");
  const drawerWhy = document.getElementById("drawerWhy");
  const drawerExamples = document.getElementById("drawerExamples");
  const drawerFoot = document.getElementById("drawerFoot");
  const particleStoryText = document.getElementById("particleStoryText");
  const particleStoryTags = document.getElementById("particleStoryTags");
  const heroMaxValue = document.getElementById("heroMaxValue");
  const heroMaxMeta = document.getElementById("heroMaxMeta");
  const heroAvgValue = document.getElementById("heroAvgValue");
  const heroDominantValue = document.getElementById("heroDominantValue");
  const heroTrendValue = document.getElementById("heroTrendValue");
  const simStatus = document.getElementById("simStatus");
  const activityLabel = document.getElementById("activityLabel");
  const activityBars = Array.from(document.querySelectorAll("#activityBars span"));

  const FRACTIONS = [
    {
      key: "0p3",
      fraction: "0.3 μm",
      title: "Ultradrobne cząsteczki",
      colorClass: "alert"
    },
    {
      key: "0p5",
      fraction: "0.5 μm",
      title: "Drobne aerozole",
      colorClass: "warn"
    },
    {
      key: "1p0",
      fraction: "1.0 μm",
      title: "Pył średni (PM1.0)",
      colorClass: "warn"
    },
    {
      key: "2p5",
      fraction: "2.5 μm",
      title: "Pył zawieszony (PM2.5)",
      colorClass: "good"
    },
    {
      key: "5p0",
      fraction: "5.0 μm",
      title: "Pył gruby / Bioaerozole",
      colorClass: "good"
    },
    {
      key: "10p0",
      fraction: "10 μm",
      title: "Pył gruby (PM10)",
      colorClass: "good"
    }
  ];

  const GUIDE = {
    "0.3 μm": {
      title: "Ultradrobne cząsteczki",
      what: "Ultradrobna frakcja pyłu i aerozoli, najłatwiej przenikająca głęboko do układu oddechowego.",
      source: "Spaliny, dym, intensywne spalanie oraz bardzo drobne aerozole technologiczne.",
      why: "To frakcja szczególnie istotna zdrowotnie, bo najłatwiej wchodzi do dolnych dróg oddechowych.",
      examples: "spaliny diesla, dym papierosowy, smog fotochemiczny, aerozole z kuchni",
      story: "Najbardziej czuła frakcja. Gdy rośnie szybciej niż pozostałe, zwykle wskazuje na dym, spaliny albo ultradrobny aerozol."
    },
    "0.5 μm": {
      title: "Drobne aerozole",
      what: "Drobne aerozole i cząstki pośrednie, długo utrzymujące się w powietrzu.",
      source: "Kondensacja pary, spalanie oraz domowe aerozole w sprayu.",
      why: "Dobrze pokazuje, czy w pomieszczeniu pojawił się aerozol, odświeżacz lub bardzo drobna sadza.",
      examples: "odświeżacz, spray, e-papieros, mgła olejowa",
      story: "To frakcja często związana z aktywnością w pomieszczeniu. Daje czytelny sygnał o aerozolach i sadzy."
    },
    "1.0 μm": {
      title: "Pył średni (PM1.0)",
      what: "Frakcja pośrednia, ważna do oceny składu chemicznego smogu.",
      source: "Procesy spalania, kondensacja gazów i emisje przemysłowe.",
      why: "Pokazuje intensywność źródeł spalania i ładunku zanieczyszczeń.",
      examples: "smog fotochemiczny, opary chemiczne, sadza",
      story: "Wzrost tej frakcji zwykle oznacza intensywne spalanie albo aerozol o wysokim ładunku zanieczyszczeń."
    },
    "2.5 μm": {
      title: "Pył zawieszony (PM2.5)",
      what: "Główny składnik smogu, ważny standard jakości powietrza.",
      source: "Niska emisja, piece, kotłownie, starsze silniki Diesla.",
      why: "To kluczowy wskaźnik pogorszenia jakości powietrza.",
      examples: "zimowy smog, dym z komina, pył przemysłowy",
      story: "Jeśli ta kolumna rośnie, zwykle sygnalizuje realne pogorszenie jakości powietrza w otoczeniu."
    },
    "5.0 μm": {
      title: "Pył gruby / Bioaerozole",
      what: "Frakcja mechaniczna i bioaerozolowa, szybko osiadająca jako kurz.",
      source: "Ruch w pomieszczeniu, rośliny, zwierzęta domowe i pylenie osadów.",
      why: "Wskazuje na kurz, alergeny i wzburzone osady.",
      examples: "roztocza, pyłki, naskórek, kurz z dywanu",
      story: "Rosnąca wartość często idzie w parze z alergiami albo poruszeniem osadu w pomieszczeniu."
    },
    "10 μm": {
      title: "Pył gruby (PM10)",
      what: "Najgrubsza frakcja, widoczna już jako pył i osad.",
      source: "Ruch drogowy, budowy, ścieranie mechaniczne, wiatr.",
      why: "Wiele mówi o kurzu i wzburzonym osadzie, mniej o ultradrobnych emisjach.",
      examples: "pył drogowy, budowa, piasek, popiół",
      story: "Ta frakcja pokazuje głównie kurz mechaniczny. Gdy dominuje, źródło zwykle jest lokalne i widoczne."
    }
  };

  const firebaseConfig = window.__FIREBASE_CONFIG__ || {};
  const hasFirebase = Boolean(window.firebase && firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.databaseURL);
  const DEVICE_ID = window.__DEVICE_ID__ || localStorage.getItem("firebaseDeviceId") || "device1";
  const LIVE_PATH = `devices/${DEVICE_ID}/latest`;
  const HISTORY_PATH = `devices/${DEVICE_ID}/history`;

  const state = {
    rows: FRACTIONS.map((item) => ({
      ...item,
      value: null,
      fill: 0,
      peak: 0,
      severity: "good"
    })),
    columnRefs: [],
    latestRecord: null,
    previousRecord: null,
    selectedIndex: 0,
    historyPeak: new Map(FRACTIONS.map((item) => [item.key, 0])),
    historySource: "bez historii",
    lastError: ""
  };

  function textOrDash(value) {
    return value == null ? "—" : String(value);
  }

  function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatCount(value) {
    if (!Number.isFinite(value)) return "—";
    const abs = Math.abs(value);
    if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
    if (abs >= 1e3) return `${(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
    return `${Math.round(value)}`;
  }

  function severityFor(fillPct) {
    if (fillPct >= 78) return "alert";
    if (fillPct >= 52) return "warn";
    return "good";
  }

  function severityLabel(fillPct) {
    if (fillPct >= 78) return "alarm";
    if (fillPct >= 52) return "uwaga";
    return "norma";
  }

  function guideFor(fraction) {
    return GUIDE[fraction] || {
      what: "Brak opisu dla tej frakcji.",
      source: "Dane do uzupełnienia.",
      why: "Warto dopisać własne źródło i interpretację.",
      examples: "kurz, aerozol, pył zawieszony",
      story: "Ta frakcja może zostać opisana po podpięciu własnej klasyfikacji."
    };
  }

  function particleSource(record) {
    if (!record) return null;
    return record.particles || record.P || record.A || record.F || record;
  }

  function normalizeRecord(record) {
    const src = particleSource(record);
    return FRACTIONS.reduce((acc, item) => {
      acc[item.key] = toNumber(src && src[item.key]);
      return acc;
    }, {});
  }

  function timestampMs(record, fallbackKey) {
    const candidates = [record && record.ts, record && record.device_ts, record && record.timestamp, fallbackKey];
    for (const candidate of candidates) {
      const numeric = toNumber(candidate);
      if (numeric == null) continue;
      const maybeMs = numeric > 1e12 ? numeric : numeric * 1000;
      if (Number.isFinite(maybeMs)) return maybeMs;
    }
    return null;
  }

  function sortHistoryRecords(raw) {
    const records = [];
    for (const [key, value] of Object.entries(raw || {})) {
      if (!value) continue;
      const ts = timestampMs(value, key);
      if (ts == null) continue;
      records.push({ key, value, ts });
    }
    records.sort((a, b) => a.ts - b.ts);
    return records;
  }

  function updateHistoryPeak(records) {
    state.historyPeak = new Map(FRACTIONS.map((item) => [item.key, 0]));
    for (const entry of records) {
      const values = normalizeRecord(entry.value);
      for (const item of FRACTIONS) {
        const current = values[item.key];
        if (current == null) continue;
        const nextPeak = Math.max(state.historyPeak.get(item.key) || 0, current);
        state.historyPeak.set(item.key, nextPeak);
      }
    }
    state.historySource = records.length ? `${records.length} rekordów historii` : "bez historii";
  }

  function buildColumns() {
    barsRow.innerHTML = "";
    if (xAxis) xAxis.innerHTML = "";
    state.columnRefs = [];

    FRACTIONS.forEach((item, index) => {
      const column = document.createElement("div");
      column.className = "bar-col";
      column.dataset.index = String(index);
      column.dataset.fraction = item.fraction;

      const topLine = document.createElement("div");
      topLine.className = `bar-topline ${item.colorClass}`;
      topLine.textContent = "—";
      column.appendChild(topLine);

      const outer = document.createElement("div");
      outer.className = "bar-outer";

      const vessel = document.createElement("div");
      vessel.className = "bar-vessel";
      vessel.style.height = "0%";

      const fill = document.createElement("div");
      fill.className = "bar-fill";

      const base = document.createElement("div");
      base.className = "seg seg-base";

      const mid = document.createElement("div");
      mid.className = "seg seg-mid";
      const pct = document.createElement("span");
      pct.className = "lbl-pct";
      pct.textContent = "—";
      mid.appendChild(pct);

      const top = document.createElement("div");
      top.className = `seg seg-top ${item.colorClass}`;
      const value = document.createElement("span");
      value.className = `lbl-val ${item.colorClass}`;
      value.textContent = "—";
      top.appendChild(value);

      fill.append(base, mid, top);
      vessel.appendChild(fill);
      outer.appendChild(vessel);
      column.appendChild(outer);

      const axis = document.createElement("div");
      axis.className = "x-col";
      const xMax = document.createElement("span");
      xMax.className = "x-max";
      xMax.textContent = "—";
      const xFrac = document.createElement("span");
      xFrac.className = "x-frac";
      xFrac.textContent = item.fraction;
      axis.append(xMax, xFrac);
      xAxis.appendChild(axis);

      column.addEventListener("mousemove", (event) => {
        if (!tt) return;
        const row = state.rows[index];
        tt.style.display = "block";
        tt.style.left = `${event.clientX + 16}px`;
        tt.style.top = `${event.clientY - 10}px`;
        const guide = guideFor(row.fraction);
        tt.innerHTML = `
          <b>${row.fraction}</b>
          Stan: <span class="${row.severity}">${severityLabel(row.fill).toUpperCase()}</span><br>
          Odczyt: ${formatCount(row.value)}<br>
          Peak: ${formatCount(row.peak)}<br>
          Wypełnienie: ${Math.round(row.fill)}%<br>
          ${guide.story}
        `;
      });

      column.addEventListener("mouseleave", () => {
        if (tt) tt.style.display = "none";
      });

      column.addEventListener("click", () => openDetails(index));

      barsRow.appendChild(column);
      state.columnRefs.push({ column, vessel, fill, value, pct, top, topLine, xMax, xFrac });
    });
  }

  function renderStory(dominantRow, trendText) {
    if (!particleStoryText || !particleStoryTags) return;
    const guide = guideFor(dominantRow.fraction);
    const severity = dominantRow.severity;
    particleStoryText.innerHTML = `Dominują teraz <strong>${dominantRow.fraction}</strong>. ${guide.story} W praktyce oznacza to, że wykres opowiada nie tylko o poziomie, ale o tym, czy chodzi o <strong>dym, kurz, bioaerozol</strong> czy zwykłe wzburzenie osadu.`;
    particleStoryTags.innerHTML = `
      <span class="story-tag ${severity}"><span class="dot"></span>${dominantRow.fraction}</span>
      <span class="story-tag ${severity}"><span class="dot"></span>${guide.title}</span>
      <span class="story-tag"><span class="dot"></span>${trendText}</span>
    `;
  }

  function renderMetrics(dominantRow, averageFill, trendText) {
    if (heroMaxValue) heroMaxValue.textContent = formatCount(dominantRow.value);
    if (heroMaxMeta) heroMaxMeta.textContent = `${dominantRow.fraction} · ${formatCount(dominantRow.peak || dominantRow.value)} peak`;
    if (heroAvgValue) heroAvgValue.textContent = `${Math.round(averageFill)}%`;
    if (heroDominantValue) heroDominantValue.textContent = dominantRow.fraction;
    if (heroTrendValue) heroTrendValue.textContent = trendText;
  }

  function renderStatus(message, kind = "info") {
    state.lastError = kind === "error" ? message : "";
    if (!simStatus) return;
    simStatus.textContent = message;
  }

  function renderActivity(level) {
    if (!activityLabel) return;
    const label = level > 0.74 ? "wysoka" : level > 0.46 ? "średnia" : "niska";
    activityLabel.textContent = label;
    activityBars.forEach((bar, index) => {
      const wave = 0.22 + Math.abs(Math.sin((performance.now() / 1000) * 1.2 + index * 0.48)) * level;
      bar.style.setProperty("--h", wave.toFixed(2));
      bar.style.opacity = String(0.4 + wave * 0.55);
    });
  }

  function applyRecord(record, sourceLabel) {
    if (!record) {
      renderStatus("Brak danych w Firebase", "error");
      return;
    }

    const values = normalizeRecord(record);
    const numericValues = FRACTIONS.map((item) => Math.max(0, values[item.key] ?? 0));
    const samplePeak = Math.max(...numericValues, 1);
    const sampleSum = numericValues.reduce((sum, value) => sum + value, 0);
    const previous = state.latestRecord ? normalizeRecord(state.latestRecord) : null;

    state.previousRecord = state.latestRecord;
    state.latestRecord = record;
    state.rows = FRACTIONS.map((item, index) => {
      const value = numericValues[index];
      const peak = Math.max(state.historyPeak.get(item.key) || 0, value);
      const fill = samplePeak > 0 ? Math.min(100, (value / samplePeak) * 100) : 0;
      return {
        ...item,
        value,
        peak,
        fill,
        severity: severityFor(fill)
      };
    });

    let dominantIndex = 0;
    for (let i = 1; i < state.rows.length; i += 1) {
      if ((state.rows[i].value || 0) > (state.rows[dominantIndex].value || 0)) dominantIndex = i;
    }
    const dominantRow = state.rows[dominantIndex];
    const averageFill = state.rows.reduce((sum, row) => sum + row.fill, 0) / state.rows.length;

    let trendText = "stabilnie";
    if (previous) {
      const previousDominant = FRACTIONS.reduce((best, item) => {
        const prevValue = previous[item.key] || 0;
        return prevValue > best.value ? { key: item.key, value: prevValue } : best;
      }, { key: dominantRow.key, value: previous[dominantRow.key] || 0 });
      const delta = dominantRow.value - previousDominant.value;
      const denom = Math.max(previousDominant.value, 1);
      const pct = Math.round((delta / denom) * 100);
      if (delta > 0) trendText = `↑ ${pct}%`;
      else if (delta < 0) trendText = `↓ ${Math.abs(pct)}%`;
      else trendText = "stabilnie";
    }

    state.columnRefs.forEach((ref, index) => {
      const row = state.rows[index];
      const guide = guideFor(row.fraction);
      const severity = row.severity;
      ref.vessel.style.height = `${Math.max(row.fill, 4)}%`;
      ref.vessel.style.borderColor = severity === "alert"
        ? "rgba(248,113,113,0.22)"
        : severity === "warn"
          ? "rgba(252,211,77,0.18)"
          : "rgba(52,211,153,0.18)";
      ref.vessel.style.boxShadow = severity === "alert"
        ? "0 0 0 1px rgba(248,113,113,0.08) inset, 0 0 20px rgba(248,113,113,0.10)"
        : severity === "warn"
          ? "0 0 0 1px rgba(252,211,77,0.08) inset, 0 0 20px rgba(252,211,77,0.09)"
          : "0 0 0 1px rgba(52,211,153,0.08) inset, 0 0 20px rgba(52,211,153,0.08)";
      ref.fill.style.opacity = `${0.94 + Math.min(0.06, row.fill * 0.001)}`;
      ref.value.textContent = formatCount(row.value);
      ref.value.className = `lbl-val ${severity}`;
      ref.pct.textContent = `${Math.round(row.fill)}%`;
      ref.pct.className = `lbl-pct${row.fill > 55 ? " flash" : ""}`;
      ref.top.className = `seg seg-top ${severity}${row.fill > 72 ? " flash" : ""}`;
      ref.topLine.textContent = severityLabel(row.fill);
      ref.topLine.className = `bar-topline ${severity}`;
      ref.xMax.textContent = `peak ${formatCount(row.peak)}`;
      ref.xFrac.textContent = row.fraction;
      ref.column.classList.toggle("column-selected", index === state.selectedIndex);

      const title = `${row.fraction} · ${guide.title}`;
      ref.column.dataset.title = title;
    });

    if (detailsDrawer && detailsDrawer.classList.contains("open")) {
      openDetails(state.selectedIndex);
    }

    renderMetrics(dominantRow, averageFill, trendText);
    renderStory(dominantRow, trendText);
    renderActivity(Math.min(1, 0.28 + (sampleSum / Math.max(samplePeak * FRACTIONS.length, 1))));

    const ts = timestampMs(record, Date.now());
    const tsLabel = ts ? new Date(ts).toLocaleString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "bez daty";
    renderStatus(`Live z ${sourceLabel} · ${tsLabel} · ${state.historySource}`);
  }

  function openDetails(index) {
    const row = state.rows[index] || state.rows[0];
    const guide = guideFor(row.fraction);
    state.selectedIndex = index;

    state.columnRefs.forEach((ref, refIndex) => {
      ref.column.classList.toggle("column-selected", refIndex === index);
    });

    if (drawerTitle) drawerTitle.textContent = `${row.fraction} · ${guide.title}`;
    if (drawerWhat) drawerWhat.textContent = guide.what;
    if (drawerSource) drawerSource.textContent = guide.source;
    if (drawerWhy) drawerWhy.textContent = guide.why;
    if (drawerExamples) drawerExamples.textContent = guide.examples;
    if (drawerFoot) {
      drawerFoot.textContent = `Stan: ${severityLabel(row.fill).toUpperCase()} · ${Math.round(row.fill)}% wypełnienia · ${formatCount(row.value)} odczytu. ${guide.story}`;
    }

    if (detailsBackdrop) detailsBackdrop.classList.add("open");
    if (detailsDrawer) {
      detailsDrawer.classList.add("open");
      detailsDrawer.setAttribute("aria-hidden", "false");
    }
  }

  function closeDetails() {
    if (detailsBackdrop) detailsBackdrop.classList.remove("open");
    if (detailsDrawer) {
      detailsDrawer.classList.remove("open");
      detailsDrawer.setAttribute("aria-hidden", "true");
    }
    state.columnRefs.forEach((ref) => ref.column.classList.remove("column-selected"));
  }

  function installInteractions() {
    if (detailsBtn) detailsBtn.addEventListener("click", () => openDetails(state.selectedIndex));
    if (drawerClose) drawerClose.addEventListener("click", closeDetails);
    if (detailsBackdrop) detailsBackdrop.addEventListener("click", closeDetails);
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDetails();
    });

    document.addEventListener("mousemove", (event) => {
      if (!tt || tt.style.display !== "block") return;
      const rect = tt.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width - 12;
      const maxTop = window.innerHeight - rect.height - 12;
      tt.style.left = `${Math.min(event.clientX + 16, maxLeft)}px`;
      tt.style.top = `${Math.min(event.clientY - 10, maxTop)}px`;
    });

    window.addEventListener("blur", () => {
      if (simStatus) simStatus.textContent = "Podgląd w tle";
    });
  }

  async function loadHistoryPeaks() {
    if (!hasFirebase) return;
    try {
      const snap = await firebase.database().ref(HISTORY_PATH).limitToLast(250).get();
      const records = sortHistoryRecords(snap.val());
      updateHistoryPeak(records);
    } catch (error) {
      state.historySource = "historia niedostępna";
      console.warn("[pm-chart] history load error:", error && error.message ? error.message : error);
    }
  }

  function subscribeLive() {
    if (!hasFirebase) {
      renderStatus("Brak konfiguracji Firebase", "error");
      return;
    }

    const ref = firebase.database().ref(LIVE_PATH);
    ref.on(
      "value",
      (snap) => {
        const record = snap.val();
        if (!record) {
          renderStatus("Brak danych w devices/device1/latest", "error");
          return;
        }
        applyRecord(record, LIVE_PATH);
      },
      (error) => {
        const message = error && error.message ? error.message : "Błąd odczytu Firebase";
        renderStatus(message, "error");
        console.warn("[pm-chart] live listener error:", message);
      }
    );
  }

  function bootstrap() {
    buildColumns();
    installInteractions();

    if (!hasFirebase) {
      renderStatus("Brak konfiguracji Firebase", "error");
      return;
    }

    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
    } catch (error) {
      console.warn("[pm-chart] firebase init error:", error && error.message ? error.message : error);
    }

    loadHistoryPeaks()
      .catch(() => null)
      .then(() => subscribeLive());
  }

  try {
    if (firebaseConfig && firebaseConfig.databaseURL && !window.firebase) {
      renderStatus("Brak bibliotek Firebase na stronie", "error");
      return;
    }
    bootstrap();
  } catch (error) {
    const message = error && error.message ? error.message : "Nie udało się uruchomić podglądu PM";
    renderStatus(message, "error");
    console.warn("[pm-chart] bootstrap error:", message);
  }
})();
