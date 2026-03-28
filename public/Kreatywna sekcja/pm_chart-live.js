(function initParticleCompositionView() {
  "use strict";

  const dom = {
    barsRow: document.getElementById("barsRow"),
    xAxis: document.getElementById("xAxis"),
    tooltip: document.getElementById("tt"),
    detailsBtn: document.getElementById("detailsBtn"),
    detailsBackdrop: document.getElementById("detailsBackdrop"),
    detailsDrawer: document.getElementById("detailsDrawer"),
    drawerClose: document.getElementById("drawerClose"),
    drawerTitle: document.getElementById("drawerTitle"),
    drawerWhat: document.getElementById("drawerWhat"),
    drawerSource: document.getElementById("drawerSource"),
    drawerWhy: document.getElementById("drawerWhy"),
    drawerExamples: document.getElementById("drawerExamples"),
    drawerFoot: document.getElementById("drawerFoot"),
    particleStoryText: document.getElementById("particleStoryText"),
    particleStoryTags: document.getElementById("particleStoryTags"),
    heroMaxValue: document.getElementById("heroMaxValue"),
    heroMaxMeta: document.getElementById("heroMaxMeta"),
    heroAvgValue: document.getElementById("heroAvgValue"),
    heroDominantValue: document.getElementById("heroDominantValue"),
    heroTrendValue: document.getElementById("heroTrendValue"),
    simStatus: document.getElementById("simStatus"),
    activityLabel: document.getElementById("activityLabel"),
    activityBars: Array.from(document.querySelectorAll("#activityBars span"))
  };

  if (!dom.barsRow || !dom.xAxis) {
    return;
  }

  const FRACTIONS = [
    {
      key: "0p3",
      label: "0.3 µm",
      title: "Ultradrobne czastki",
      interpretation: "wskazuje na spalanie lub dym",
      what: "Najmniejsza frakcja wykrywana przez PMS5003. Reaguje szybko na spaliny i dym.",
      sources: "Spaliny, dym, aerozole termiczne, intensywne procesy spalania.",
      health: "Moze docierac najglebiej do ukladu oddechowego i utrzymywac sie dlugo w powietrzu.",
      examples: "spaliny, dym papierosowy, aerozol z kuchni"
    },
    {
      key: "0p5",
      label: "0.5 µm",
      title: "Drobny aerozol",
      interpretation: "czesto oznacza aerozol lub drobna sadze",
      what: "Frakcja drobnego aerozolu, utrzymujaca sie dlugo w pomieszczeniu.",
      sources: "Rozpylacze, kondensacja pary, spalanie, e-papierosy.",
      health: "Zwiazek z podraznieniami drog oddechowych i dlugim czasem ekspozycji.",
      examples: "spray, mgla olejowa, odswiezacz"
    },
    {
      key: "1p0",
      label: "1.0 µm",
      title: "Pyl sredni",
      interpretation: "sugeruje aktywne zrodlo zanieczyszczen spaleniowych",
      what: "Frakcja przejsciowa miedzy ultradrobna i PM2.5, dobra do oceny trendu smogu.",
      sources: "Spalanie paliw, emisje przemyslowe, kondensacja gazow.",
      health: "Wazna przy ocenie przewleklej ekspozycji i obciazenia ukladu oddechowego.",
      examples: "smog fotochemiczny, sadza, opary"
    },
    {
      key: "2p5",
      label: "2.5 µm",
      title: "Pyl zawieszony PM2.5",
      interpretation: "moze sygnalizowac typowe pogorszenie jakosci powietrza",
      what: "Kluczowa frakcja smogowa i standardowy wskaznik jakosci powietrza.",
      sources: "Niska emisja, spalanie domowe, ruch drogowy, przemysl.",
      health: "Dlugotrwale podwyzszenie zwykle oznacza wieksze ryzyko zdrowotne.",
      examples: "smog zimowy, dym kominowy"
    },
    {
      key: "5p0",
      label: "5.0 µm",
      title: "Pyl grubszy / bioaerozol",
      interpretation: "czesto wskazuje na kurz i alergeny",
      what: "Frakcja czastek grubszych, szybko osiadajaca na powierzchniach.",
      sources: "Ruch w pomieszczeniu, wzburzony kurz, pylenie roslin, zwierzeta.",
      health: "Wazna dla alergikow i osob wrazliwych na pylki oraz roztocza.",
      examples: "kurz domowy, pylki, naskorek"
    },
    {
      key: "10p0",
      label: "10 µm",
      title: "Pyl gruby PM10",
      interpretation: "najczesciej oznacza pylenie mechaniczne i osad",
      what: "Najgrubsza frakcja z puli PMS5003, zwykle zwiazana z kurzem mechanicznym.",
      sources: "Ruch drogowy, budowy, wzbijanie osadu, wiatr.",
      health: "Podraza gorne drogi oddechowe i moze nasilac kaszel.",
      examples: "pyl drogowy, budowa, piasek"
    }
  ];

  const THRESHOLDS = {
    warnFrom: 50,
    alertFrom: 75
  };

  const MAX_HISTORY_FETCH = 360;
  const MAX_SLIDING_SAMPLES = 160;

  const firebaseConfig = window.__FIREBASE_CONFIG__ || {};
  const deviceId = window.__DEVICE_ID__ || localStorage.getItem("firebaseDeviceId") || "device1";
  const LIVE_PATH = `devices/${deviceId}/latest`;
  const HISTORY_PATH = `devices/${deviceId}/history`;

  const hasFirebaseRuntime = Boolean(
    window.firebase &&
    firebaseConfig &&
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    firebaseConfig.databaseURL
  );

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const DataProcessing = {
    toFiniteNumber(value) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    },

    sanitizeCount(value) {
      const numeric = this.toFiniteNumber(value);
      if (numeric == null) return null;
      return numeric < 0 ? 0 : numeric;
    },

    formatCount(value) {
      if (!Number.isFinite(value)) return "—";
      const abs = Math.abs(value);
      if (abs >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
      if (abs >= 1e3) return `${(value / 1e3).toFixed(abs >= 1e4 ? 0 : 1)}k`;
      return `${Math.round(value)}`;
    },

    formatPercent(value) {
      if (!Number.isFinite(value)) return "—";
      return `${Math.round(value)}%`;
    },

    extractParticlePayload(record) {
      if (!record || typeof record !== "object") return null;
      return record.particles || record.P || record.A || record.F || null;
    },

    normalizeParticles(record) {
      const payload = this.extractParticlePayload(record);
      return FRACTIONS.reduce((acc, item) => {
        acc[item.key] = this.sanitizeCount(payload && payload[item.key]);
        return acc;
      }, {});
    },

    resolveTimestampMs(record, fallbackMs) {
      const candidates = [
        record && record.ts,
        record && record.device_ts,
        record && record.timestamp,
        record && record.time,
        fallbackMs
      ];

      for (const candidate of candidates) {
        const numeric = this.toFiniteNumber(candidate);
        if (numeric == null) continue;
        const ms = numeric > 1e12 ? numeric : numeric * 1000;
        if (Number.isFinite(ms)) return ms;
      }

      return fallbackMs;
    },

    sortHistoryRecords(rawHistory) {
      const output = [];
      for (const [key, value] of Object.entries(rawHistory || {})) {
        if (!value) continue;
        const ts = this.resolveTimestampMs(value, this.toFiniteNumber(key) || Date.now());
        if (!Number.isFinite(ts)) continue;
        output.push({ key, value, ts });
      }
      output.sort((a, b) => a.ts - b.ts);
      return output;
    },

    severityForFill(fill) {
      if (fill >= THRESHOLDS.alertFrom) return "alert";
      if (fill >= THRESHOLDS.warnFrom) return "warn";
      return "good";
    },

    severityLabel(fill) {
      const severity = this.severityForFill(fill);
      if (severity === "alert") return "ALERT";
      if (severity === "warn") return "WARN";
      return "GOOD";
    },

    findDominant(rows) {
      if (!rows || !rows.length) return null;
      let best = rows[0];
      for (let index = 1; index < rows.length; index += 1) {
        if ((rows[index].valueSafe || 0) > (best.valueSafe || 0)) {
          best = rows[index];
        }
      }
      return best;
    },

    computeTrend(previousSample, rows, dominant, averageFill) {
      if (!previousSample || !previousSample.rows || !previousSample.rows.length || !dominant) {
        return {
          direction: "flat",
          label: "stabilnie",
          deltaPct: 0,
          avgDelta: 0,
          dominantShift: false,
          previousDominantKey: null
        };
      }

      const previousRows = previousSample.rows;
      const previousMatch = previousRows.find((row) => row.key === dominant.key);
      const previousDominantKey = previousSample.dominant ? previousSample.dominant.key : null;

      const previousValue = previousMatch ? previousMatch.valueSafe || 0 : 0;
      const currentValue = dominant.valueSafe || 0;
      const delta = currentValue - previousValue;
      const deltaPct = Math.round((delta / Math.max(previousValue, 1)) * 100);

      const previousAverage = Number.isFinite(previousSample.averageFill) ? previousSample.averageFill : 0;
      const avgDelta = averageFill - previousAverage;
      const dominantShift = Boolean(previousDominantKey && previousDominantKey !== dominant.key);

      if (Math.abs(deltaPct) < 4 && Math.abs(avgDelta) < 3) {
        return {
          direction: "flat",
          label: "stabilnie",
          deltaPct,
          avgDelta,
          dominantShift,
          previousDominantKey
        };
      }

      const magnitude = Math.max(Math.abs(deltaPct), Math.round(Math.abs(avgDelta)));
      if (delta > 0 || avgDelta > 0) {
        return {
          direction: "up",
          label: `wzrost ${magnitude}%`,
          deltaPct,
          avgDelta,
          dominantShift,
          previousDominantKey
        };
      }

      return {
        direction: "down",
        label: `spadek ${magnitude}%`,
        deltaPct,
        avgDelta,
        dominantShift,
        previousDominantKey
      };
    },

    buildSample(record, sourceLabel, previousSample, historyPeakMap) {
      const normalized = this.normalizeParticles(record);
      const hasAnyValue = FRACTIONS.some((item) => normalized[item.key] != null);

      const numericValues = FRACTIONS.map((item) => Math.max(0, normalized[item.key] || 0));
      const samplePeak = hasAnyValue ? Math.max(...numericValues, 0) : 0;
      const safePeak = samplePeak > 0 ? samplePeak : 1;

      const rows = FRACTIONS.map((item, index) => {
        const value = normalized[item.key];
        const valueSafe = numericValues[index];
        const fill = value == null || samplePeak <= 0
          ? 0
          : clamp((valueSafe / safePeak) * 100, 0, 100);

        const peakHistory = Math.max(historyPeakMap.get(item.key) || 0, valueSafe);

        return {
          ...item,
          value,
          valueSafe,
          fill,
          peakHistory,
          severity: this.severityForFill(fill)
        };
      });

      const dominant = this.findDominant(rows);
      const averageFill = rows.reduce((sum, row) => sum + row.fill, 0) / rows.length;
      const trend = this.computeTrend(previousSample, rows, dominant, averageFill);

      return {
        sourceLabel,
        timestampMs: this.resolveTimestampMs(record, Date.now()),
        hasAnyValue,
        samplePeak,
        rows,
        dominant,
        averageFill,
        trend,
        totalCount: rows.reduce((sum, row) => sum + row.valueSafe, 0),
        raw: record
      };
    }
  };

  const StateManager = {
    state: {
      selectedIndex: 0,
      rows: FRACTIONS.map((item) => ({
        ...item,
        value: null,
        valueSafe: 0,
        fill: 0,
        peakHistory: 0,
        severity: "good"
      })),
      previousSample: null,
      latestSample: null,
      historyPeak: new Map(FRACTIONS.map((item) => [item.key, 0])),
      historySource: "historia: brak",
      sampleWindow: [],
      framePending: false,
      queuedSample: null,
      liveRef: null
    },

    setSelectedIndex(index) {
      const maxIndex = FRACTIONS.length - 1;
      this.state.selectedIndex = clamp(index, 0, maxIndex);
    },

    getSelectedRow() {
      const row = this.state.rows[this.state.selectedIndex];
      return row || this.state.rows[0] || null;
    },

    updateHistoryFromRecords(records) {
      this.state.historyPeak = new Map(FRACTIONS.map((item) => [item.key, 0]));

      for (const entry of records) {
        const normalized = DataProcessing.normalizeParticles(entry.value);
        for (const item of FRACTIONS) {
          const numeric = normalized[item.key];
          if (numeric == null) continue;
          const currentPeak = this.state.historyPeak.get(item.key) || 0;
          this.state.historyPeak.set(item.key, Math.max(currentPeak, numeric));
        }
      }

      this.state.historySource = records.length
        ? `historia: ${records.length} rekordow`
        : "historia: brak";
    },

    commitSample(sample) {
      this.state.previousSample = this.state.latestSample;

      sample.rows.forEach((row) => {
        const currentPeak = this.state.historyPeak.get(row.key) || 0;
        if (row.valueSafe > currentPeak) {
          this.state.historyPeak.set(row.key, row.valueSafe);
        }
      });

      const rowsWithPeaks = sample.rows.map((row) => ({
        ...row,
        peakHistory: Math.max(this.state.historyPeak.get(row.key) || 0, row.valueSafe)
      }));

      const committed = {
        ...sample,
        rows: rowsWithPeaks,
        dominant: DataProcessing.findDominant(rowsWithPeaks),
        averageFill: rowsWithPeaks.reduce((sum, row) => sum + row.fill, 0) / rowsWithPeaks.length
      };

      this.state.latestSample = committed;
      this.state.rows = committed.rows;

      this.state.sampleWindow.push({
        timestampMs: committed.timestampMs,
        rows: committed.rows.map((row) => ({ key: row.key, valueSafe: row.valueSafe }))
      });

      if (this.state.sampleWindow.length > MAX_SLIDING_SAMPLES) {
        this.state.sampleWindow.shift();
      }

      return committed;
    }
  };

  const Interactions = {
    tooltipVisible: false,

    install() {
      if (dom.detailsBtn) {
        dom.detailsBtn.addEventListener("click", () => {
          this.openDetails(StateManager.state.selectedIndex);
        });
      }

      if (dom.drawerClose) {
        dom.drawerClose.addEventListener("click", () => this.closeDetails());
      }

      if (dom.detailsBackdrop) {
        dom.detailsBackdrop.addEventListener("click", () => this.closeDetails());
      }

      window.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          this.closeDetails();
          this.hideTooltip();
        }
      });

      document.addEventListener("mousemove", (event) => {
        if (!this.tooltipVisible || !dom.tooltip || dom.tooltip.style.display !== "block") return;
        this.positionTooltip(event.clientX, event.clientY);
      });
    },

    buildTooltipHtml(row) {
      const value = row.value == null ? "—" : DataProcessing.formatCount(row.value);
      const fill = row.value == null ? "—" : DataProcessing.formatPercent(row.fill);
      const peakHistory = row.peakHistory > 0 ? DataProcessing.formatCount(row.peakHistory) : "—";
      const severity = row.severity;
      const severityLabel = DataProcessing.severityLabel(row.fill);

      return `
        <b>${row.label}</b>
        Intensywnosc: <span class="${severity}">${severityLabel}</span><br>
        Wartosc: ${value}<br>
        Peak historyczny: ${peakHistory}<br>
        Fill: ${fill}<br>
        Interpretacja: ${row.interpretation}
      `;
    },

    showTooltip(index, clientX, clientY) {
      if (!dom.tooltip) return;
      const row = StateManager.state.rows[index];
      if (!row) return;

      dom.tooltip.innerHTML = this.buildTooltipHtml(row);
      dom.tooltip.style.display = "block";
      this.positionTooltip(clientX, clientY);
      this.tooltipVisible = true;
    },

    showTooltipFromFocus(index, columnElement) {
      const rect = columnElement.getBoundingClientRect();
      this.showTooltip(index, rect.left + rect.width / 2, rect.top + 14);
    },

    positionTooltip(clientX, clientY) {
      if (!dom.tooltip) return;
      const rect = dom.tooltip.getBoundingClientRect();
      const maxLeft = window.innerWidth - rect.width - 12;
      const maxTop = window.innerHeight - rect.height - 12;
      const nextLeft = Math.min(clientX + 16, Math.max(8, maxLeft));
      const nextTop = Math.min(clientY - 10, Math.max(8, maxTop));
      dom.tooltip.style.left = `${nextLeft}px`;
      dom.tooltip.style.top = `${nextTop}px`;
    },

    hideTooltip() {
      this.tooltipVisible = false;
      if (!dom.tooltip) return;
      dom.tooltip.style.display = "none";
    },

    openDetails(index) {
      StateManager.setSelectedIndex(index);
      Renderer.markSelectedColumn();

      const row = StateManager.getSelectedRow();
      if (!row) return;

      if (dom.drawerTitle) {
        dom.drawerTitle.textContent = `${row.label} - ${row.title}`;
      }
      if (dom.drawerWhat) {
        dom.drawerWhat.textContent = row.what;
      }
      if (dom.drawerSource) {
        dom.drawerSource.textContent = row.sources;
      }
      if (dom.drawerWhy) {
        dom.drawerWhy.textContent = row.health;
      }
      if (dom.drawerExamples) {
        dom.drawerExamples.textContent = row.examples;
      }
      if (dom.drawerFoot) {
        const valueText = row.value == null ? "—" : DataProcessing.formatCount(row.value);
        dom.drawerFoot.textContent = `Interpretacja: ${row.interpretation}. Stan: ${DataProcessing.severityLabel(row.fill)}. Odczyt: ${valueText}. Fill: ${Math.round(row.fill)}%.`;
      }

      if (dom.detailsBackdrop) {
        dom.detailsBackdrop.classList.add("open");
      }
      if (dom.detailsDrawer) {
        dom.detailsDrawer.classList.add("open");
        dom.detailsDrawer.setAttribute("aria-hidden", "false");
      }
    },

    closeDetails() {
      if (dom.detailsBackdrop) {
        dom.detailsBackdrop.classList.remove("open");
      }
      if (dom.detailsDrawer) {
        dom.detailsDrawer.classList.remove("open");
        dom.detailsDrawer.setAttribute("aria-hidden", "true");
      }
      Renderer.markSelectedColumn();
    }
  };

  const Renderer = {
    columnRefs: [],

    init() {
      this.buildColumns();
      this.renderFallbackState();
    },

    buildColumns() {
      dom.barsRow.innerHTML = "";
      dom.xAxis.innerHTML = "";
      this.columnRefs = [];

      FRACTIONS.forEach((item, index) => {
        const column = document.createElement("div");
        column.className = "bar-col";
        column.dataset.index = String(index);
        column.dataset.fraction = item.label;
        column.tabIndex = 0;
        column.setAttribute("role", "button");
        column.setAttribute("aria-label", `${item.label}, brak danych`);

        const topLine = document.createElement("div");
        topLine.className = "bar-topline good";
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
        top.className = "seg seg-top good";
        const value = document.createElement("span");
        value.className = "lbl-val good";
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
        xMax.textContent = "peak —";
        const xFrac = document.createElement("span");
        xFrac.className = "x-frac";
        xFrac.textContent = item.label;
        axis.append(xMax, xFrac);

        column.addEventListener("mousemove", (event) => {
          Interactions.showTooltip(index, event.clientX, event.clientY);
        });

        column.addEventListener("mouseleave", () => {
          Interactions.hideTooltip();
        });

        column.addEventListener("focus", () => {
          Interactions.showTooltipFromFocus(index, column);
        });

        column.addEventListener("blur", () => {
          Interactions.hideTooltip();
        });

        column.addEventListener("click", () => {
          Interactions.openDetails(index);
        });

        column.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            Interactions.openDetails(index);
          }
        });

        dom.barsRow.appendChild(column);
        dom.xAxis.appendChild(axis);

        this.columnRefs.push({
          column,
          vessel,
          fill,
          value,
          pct,
          top,
          topLine,
          xMax,
          xFrac
        });
      });
    },

    schedule(sample) {
      StateManager.state.queuedSample = sample;
      if (StateManager.state.framePending) return;

      StateManager.state.framePending = true;
      requestAnimationFrame(() => {
        StateManager.state.framePending = false;
        const queued = StateManager.state.queuedSample;
        StateManager.state.queuedSample = null;
        if (!queued) return;
        this.renderSample(queued);
      });
    },

    markSelectedColumn() {
      this.columnRefs.forEach((ref, index) => {
        ref.column.classList.toggle("column-selected", index === StateManager.state.selectedIndex);
      });
    },

    renderSample(sample) {
      const timestampLabel = Number.isFinite(sample.timestampMs)
        ? new Date(sample.timestampMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : "bez czasu";

      this.columnRefs.forEach((ref, index) => {
        const row = sample.rows[index];
        if (!row) return;

        const hasValue = row.value != null && sample.samplePeak > 0;
        const fillValue = hasValue ? row.fill : 0;
        const severity = row.severity;

        ref.vessel.style.height = `${fillValue.toFixed(2)}%`;
        ref.vessel.style.borderColor = hasValue
          ? (severity === "alert"
            ? "rgba(248,113,113,0.25)"
            : severity === "warn"
              ? "rgba(252,211,77,0.22)"
              : "rgba(52,211,153,0.22)")
          : "rgba(255,255,255,0.08)";

        ref.vessel.style.boxShadow = hasValue
          ? (severity === "alert"
            ? "0 0 0 1px rgba(248,113,113,0.10) inset, 0 0 20px rgba(248,113,113,0.12)"
            : severity === "warn"
              ? "0 0 0 1px rgba(252,211,77,0.10) inset, 0 0 20px rgba(252,211,77,0.11)"
              : "0 0 0 1px rgba(52,211,153,0.10) inset, 0 0 20px rgba(52,211,153,0.10)")
          : "inset 0 1px 0 rgba(255,255,255,0.05)";

        ref.fill.style.opacity = `${0.88 + Math.min(0.12, fillValue / 500)}`;
        ref.value.textContent = row.value == null ? "—" : DataProcessing.formatCount(row.value);
        ref.value.className = `lbl-val ${severity}`;
        ref.pct.textContent = row.value == null ? "—" : DataProcessing.formatPercent(row.fill);
        ref.pct.className = `lbl-pct${fillValue >= THRESHOLDS.alertFrom ? " flash" : ""}`;
        ref.top.className = `seg seg-top ${severity}${fillValue >= THRESHOLDS.alertFrom ? " flash" : ""}`;

        ref.topLine.textContent = row.value == null ? "—" : DataProcessing.severityLabel(row.fill);
        ref.topLine.className = `bar-topline ${severity}`;

        ref.xMax.textContent = row.peakHistory > 0 ? `peak ${DataProcessing.formatCount(row.peakHistory)}` : "peak —";
        ref.xFrac.textContent = row.label;

        ref.column.setAttribute(
          "aria-label",
          `${row.label}, odczyt ${row.value == null ? "brak" : DataProcessing.formatCount(row.value)}, fill ${Math.round(row.fill)} procent`
        );
      });

      this.markSelectedColumn();
      this.renderHero(sample);
      this.renderStory(sample);
      this.renderActivity(sample);
      this.renderStatus(`Live: ${sample.sourceLabel} - ${timestampLabel} - ${StateManager.state.historySource}`);

      if (dom.detailsDrawer && dom.detailsDrawer.classList.contains("open")) {
        Interactions.openDetails(StateManager.state.selectedIndex);
      }
    },

    renderHero(sample) {
      if (!sample.hasAnyValue || !sample.dominant || sample.samplePeak <= 0) {
        if (dom.heroMaxValue) dom.heroMaxValue.textContent = "—";
        if (dom.heroMaxMeta) dom.heroMaxMeta.textContent = "brak stabilnej probki";
        if (dom.heroAvgValue) dom.heroAvgValue.textContent = "—";
        if (dom.heroDominantValue) dom.heroDominantValue.textContent = "—";
        if (dom.heroTrendValue) dom.heroTrendValue.textContent = "stabilnie";
        return;
      }

      if (dom.heroMaxValue) dom.heroMaxValue.textContent = DataProcessing.formatCount(sample.samplePeak);
      if (dom.heroMaxMeta) {
        dom.heroMaxMeta.textContent = `${sample.dominant.label} - peak hist ${DataProcessing.formatCount(sample.dominant.peakHistory)}`;
      }
      if (dom.heroAvgValue) dom.heroAvgValue.textContent = `${Math.round(sample.averageFill)}%`;
      if (dom.heroDominantValue) dom.heroDominantValue.textContent = sample.dominant.label;
      if (dom.heroTrendValue) {
        const symbol = sample.trend.direction === "up" ? "UP" : sample.trend.direction === "down" ? "DOWN" : "FLAT";
        dom.heroTrendValue.textContent = `${symbol} ${sample.trend.label}`;
      }
    },

    renderStory(sample) {
      if (!dom.particleStoryText || !dom.particleStoryTags) return;

      if (!sample.hasAnyValue || !sample.dominant || sample.samplePeak <= 0) {
        dom.particleStoryText.innerHTML = "Brak wiarygodnej probki particle size distribution. System czeka na dane live i utrzymuje bezpieczny fallback dla pustych lub niestabilnych rekordow.";
        dom.particleStoryTags.innerHTML = [
          '<span class="story-tag"><span class="dot"></span>brak danych</span>',
          '<span class="story-tag"><span class="dot"></span>oczekiwanie</span>',
          '<span class="story-tag"><span class="dot"></span>fallback aktywny</span>'
        ].join("");
        return;
      }

      const dominant = sample.dominant;
      const trendPart = sample.trend.direction === "up"
        ? "Udzial tej frakcji rosnie wzgledem poprzedniej probki."
        : sample.trend.direction === "down"
          ? "Udzial tej frakcji slabnie wzgledem poprzedniej probki."
          : "Udzial tej frakcji jest stabilny.";

      const shiftPart = sample.trend.dominantShift && sample.trend.previousDominantKey
        ? `Zmiana lidera frakcji sugeruje przejscie charakteru zanieczyszczenia.`
        : "Lider frakcji pozostaje bez zmiany.";

      dom.particleStoryText.innerHTML = `Dominuje <strong>${dominant.label}</strong> - ${dominant.interpretation}. ${trendPart} ${shiftPart}`;
      dom.particleStoryTags.innerHTML = [
        `<span class="story-tag ${dominant.severity}"><span class="dot"></span>${dominant.label}</span>`,
        `<span class="story-tag ${dominant.severity}"><span class="dot"></span>${DataProcessing.severityLabel(dominant.fill)}</span>`,
        `<span class="story-tag"><span class="dot"></span>${sample.trend.label}</span>`
      ].join("");
    },

    renderActivity(sample) {
      if (!dom.activityLabel || !dom.activityBars.length) return;

      const baseLevel = sample.hasAnyValue ? sample.averageFill / 100 : 0.12;
      const trendBoost = sample.trend.direction === "up" ? 0.14 : sample.trend.direction === "down" ? -0.06 : 0;
      const activity = clamp(baseLevel + trendBoost, 0.1, 1);

      const label = activity > 0.72 ? "wysoka" : activity > 0.44 ? "srednia" : "niska";
      dom.activityLabel.textContent = label;

      const seed = (sample.timestampMs || Date.now()) / 1000;
      dom.activityBars.forEach((bar, index) => {
        const wave = 0.18 + Math.abs(Math.sin(seed * 1.1 + index * 0.55)) * (0.25 + activity * 0.62);
        bar.style.setProperty("--h", clamp(wave, 0.12, 1).toFixed(2));
        bar.style.opacity = String(0.35 + wave * 0.52);
      });
    },

    renderStatus(message) {
      if (!dom.simStatus) return;
      dom.simStatus.textContent = message;
    },

    renderFallbackState() {
      this.renderStatus("Laczenie z Firebase RTDB...");
      const fallbackSample = DataProcessing.buildSample(
        {},
        "particles.*",
        null,
        StateManager.state.historyPeak
      );
      const committed = StateManager.commitSample(fallbackSample);
      this.renderSample(committed);
    }
  };

  const RealtimeEngine = {
    async bootstrap() {
      Renderer.init();
      Interactions.install();

      if (!hasFirebaseRuntime) {
        Renderer.renderStatus("Brak konfiguracji Firebase lub brak bibliotek Firebase.");
        return;
      }

      try {
        if (!firebase.apps || !firebase.apps.length) {
          firebase.initializeApp(firebaseConfig);
        }
      } catch (error) {
        const message = error && error.message ? error.message : "Blad inicjalizacji Firebase";
        Renderer.renderStatus(message);
      }

      await this.loadHistory();
      this.subscribeLive();

      window.addEventListener("beforeunload", () => {
        if (StateManager.state.liveRef) {
          StateManager.state.liveRef.off();
        }
      });
    },

    async loadHistory() {
      try {
        const snapshot = await firebase
          .database()
          .ref(HISTORY_PATH)
          .limitToLast(MAX_HISTORY_FETCH)
          .get();

        const records = DataProcessing.sortHistoryRecords(snapshot.val());
        StateManager.updateHistoryFromRecords(records);

        if (!records.length) {
          Renderer.renderStatus(`Historia pusta, nasluch LIVE na ${LIVE_PATH}`);
          return;
        }

        const bootstrapRecord = records[records.length - 1].value;
        const sample = DataProcessing.buildSample(
          bootstrapRecord,
          "history bootstrap",
          StateManager.state.latestSample,
          StateManager.state.historyPeak
        );
        const committed = StateManager.commitSample(sample);
        Renderer.schedule(committed);
      } catch (error) {
        const message = error && error.message ? error.message : "Nie mozna pobrac historii";
        StateManager.state.historySource = "historia: niedostepna";
        Renderer.renderStatus(message);
      }
    },

    subscribeLive() {
      const ref = firebase.database().ref(LIVE_PATH);
      StateManager.state.liveRef = ref;

      ref.on(
        "value",
        (snapshot) => {
          const record = snapshot.val();

          const sample = DataProcessing.buildSample(
            record || {},
            LIVE_PATH,
            StateManager.state.latestSample,
            StateManager.state.historyPeak
          );

          const committed = StateManager.commitSample(sample);
          Renderer.schedule(committed);
        },
        (error) => {
          const message = error && error.message ? error.message : "Blad nasluchu LIVE";
          Renderer.renderStatus(message);
        }
      );
    }
  };

  RealtimeEngine.bootstrap().catch((error) => {
    const message = error && error.message ? error.message : "Nie udalo sie uruchomic widoku particles";
    Renderer.renderStatus(message);
  });
})();
