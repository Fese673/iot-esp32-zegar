// PMS5003 Chart – independent chart with its own calendar, pan, zoom
(function initPmsChart() {
  const $pm1 = el("pm1Value");
  const $pm25 = el("pm25Value");
  const $pm10 = el("pm10Value");
  const $pmsModeInfo = el("pmsModeInfo");
  const $pmsChartNote = el("pmsChartNote");
  const $pmsChartLoading = el("pmsChartLoading");
  const $pmsChartError = el("pmsChartError");
  const $pmsDataDensity = el("pmsDataDensity");
  const $pmsCalGrid = el("pmsCalGrid");
  const $pmsCalTitle = el("pmsCalTitle");
  const $pmsCalPrev = el("pmsCalPrev");
  const $pmsCalNext = el("pmsCalNext");
  const $pmsBtnToday = el("pmsBtnToday");
  const $pmsBtnClear = el("pmsBtnClear");
  const pmsChartFrame = document.getElementById("pmsChartFrame");
  const pmsCanvas = document.getElementById("pmsChart");
  if (!pmsCanvas) return;
  const pmsCtx = pmsCanvas.getContext("2d");

  const pmsPalette = {
    pm1: "#34d399",
    pm25: "#fcd34d",
    pm10: "#f87171",
    text: chartPalette.text,
    muted: chartPalette.muted,
    stroke: chartPalette.stroke,
    panel: chartPalette.panel,
    grid: chartPalette.grid
  };

  function withAlpha(color, alpha) {
    if (!color) return `rgba(0,0,0,${alpha})`;
    const hex = color.trim();
    if (hex.startsWith("#")) {
      const normalized = hex.length === 4
        ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
        : hex;
      const r = parseInt(normalized.slice(1, 3), 16);
      const g = parseInt(normalized.slice(3, 5), 16);
      const b = parseInt(normalized.slice(5, 7), 16);
      return `rgba(${r},${g},${b},${alpha})`;
    }
    if (hex.startsWith("rgb")) return hex.replace(")", `, ${alpha})`).replace("rgb", "rgba");
    return color;
  }

  let pmsChart = null;
  let pmsDayStart = 0;
  let pmsDayEnd = 0;
  const pmsWindow = { start: 0, end: 0 };
  let pmsLoadToken = 0;
  let pmsViewDate = new Date();
  let pmsSelectedDate = new Date();
  let pmsLiveRef = null;
  let pmsLiveHandler = null;
  const PMS_INITIAL_WINDOW_MS = Math.max(REALTIME_WINDOW_MS, 10 * 60 * 1000);

  function pmsCleanup() {
    if (pmsLiveRef && pmsLiveHandler) {
      pmsLiveRef.off("value", pmsLiveHandler);
      pmsLiveRef = null;
      pmsLiveHandler = null;
    }

    if (pmsChart) {
      pmsChart.destroy();
      pmsChart = null;
    }
  }

  window.addEventListener("beforeunload", pmsCleanup);

  const pmsPointers = new Map();
  let pmsPinchStartDist = null;
  let pmsPinchStartWidth = null;
  let pmsPinchStartCenter = null;
  let pmsPanLast = null;

  function pmsPointerDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
  }

  function pmsGetScaleX() { return pmsChart?.scales?.x || null; }

  function pmsValueAt(clientX) {
    const scale = pmsGetScaleX();
    if (!scale) return null;
    const rect = pmsCanvas.getBoundingClientRect();
    const value = scale.getValueForPixel(clientX - rect.left);
    return Number.isFinite(value) ? value : null;
  }

  function pmsClampWindow(start, end) {
    // Ensure window width is at least MIN_WINDOW_MS
    let width = end - start;
    if (width > pmsDayEnd - pmsDayStart) width = pmsDayEnd - pmsDayStart;
    width = Math.max(width, MIN_WINDOW_MS);
    
    // Center the window and adjust if it goes out of bounds
    let center = (start + end) / 2;
    let half = width / 2;
    let nextStart = center - half;
    let nextEnd = center + half;
    
    // Clamp to day boundaries
    if (nextStart < pmsDayStart) {
      nextStart = pmsDayStart;
      nextEnd = nextStart + width;
    }
    if (nextEnd > pmsDayEnd) {
      nextEnd = pmsDayEnd;
      nextStart = nextEnd - width;
    }
    
    return { start: nextStart, end: nextEnd };
  }

  function pmsUpdateWindow(start, end) {
    const clamped = pmsClampWindow(start, end);
    pmsWindow.start = clamped.start;
    pmsWindow.end = clamped.end;
    if (pmsChart?.options?.scales?.x) {
      pmsChart.options.scales.x.min = clamped.start;
      pmsChart.options.scales.x.max = clamped.end;
      pmsChart.update("none");
    }
  }

  function pmsPan(direction, ratio = 1) {
    if (!pmsDayEnd || pmsDayEnd <= pmsDayStart) return;
    const span = pmsWindow.end - pmsWindow.start;
    const shift = Math.min(span * 0.25, 60 * 60 * 1000) * ratio;
    pmsUpdateWindow(pmsWindow.start + direction * shift, pmsWindow.end + direction * shift);
  }

  try {
    window.pmsPan = pmsPan;
  } catch (error) {
    // ignore in restricted contexts
  }

  function pmsZoom(centerMs, factor) {
    const currentSpan = Math.max(pmsWindow.end - pmsWindow.start, MIN_WINDOW_MS);
    const maxSpan = pmsDayEnd - pmsDayStart; // Full day range
    const nextSpan = Math.max(MIN_WINDOW_MS, Math.min(maxSpan, currentSpan * factor));
    const half = nextSpan / 2;
    const safeCenter = Number.isFinite(centerMs) ? centerMs : (pmsWindow.start + pmsWindow.end) / 2;
    pmsUpdateWindow(safeCenter - half, safeCenter + half);
  }

  function pmsWheel(ev) {
    const isHorizontal = Math.abs(ev.deltaX) > Math.abs(ev.deltaY) && Math.abs(ev.deltaX) > 0;
    const isZoomGesture = ev.ctrlKey || ev.metaKey;
    if (!isHorizontal && !isZoomGesture) return;

    ev.preventDefault();
    ev.stopPropagation();

    if (isHorizontal) {
      pmsPan(ev.deltaX > 0 ? 1 : -1, 1.25);
      return;
    }

    const center = pmsValueAt(ev.clientX) ?? (pmsWindow.start + pmsWindow.end) / 2;
    const zoomFactor = ev.deltaY < 0 ? 0.80 : 1.25;
    pmsZoom(center, zoomFactor);
  }

  function pmsPointerDown(e) {
    if (!pmsChart || !pmsCanvas) return;
    pmsCanvas.setPointerCapture?.(e.pointerId);
    pmsPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pmsPointers.size === 1) {
      pmsPanLast = pmsValueAt(e.clientX);
      pmsPinchStartDist = null;
    } else if (pmsPointers.size === 2) {
      const points = Array.from(pmsPointers.values());
      pmsPinchStartDist = pmsPointerDistance(points[0], points[1]);
      pmsPinchStartWidth = pmsWindow.end - pmsWindow.start;
      pmsPinchStartCenter = pmsValueAt((points[0].x + points[1].x) / 2);
      pmsPanLast = null;
    }
  }

  function pmsPointerMove(e) {
    if (!pmsChart || !pmsPointers.has(e.pointerId)) return;
    pmsPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const scale = pmsGetScaleX();
    if (!scale || !pmsDayEnd || pmsDayEnd <= pmsDayStart) return;

    if (pmsPointers.size === 1 && pmsPanLast != null) {
      const currentValue = pmsValueAt(e.clientX);
      if (currentValue == null) return;
      const delta = currentValue - pmsPanLast;
      if (delta !== 0) {
        pmsUpdateWindow(pmsWindow.start - delta, pmsWindow.end - delta);
        pmsPanLast = currentValue;
      }
    } else if (pmsPointers.size === 2 && pmsPinchStartDist && pmsPinchStartWidth && pmsPinchStartCenter != null) {
      const points = Array.from(pmsPointers.values());
      const distance = pmsPointerDistance(points[0], points[1]);
      if (distance <= 0) return;
      const ratio = distance / pmsPinchStartDist;
      const newWidth = Math.max(MIN_WINDOW_MS, Math.min(pmsPinchStartWidth / ratio, pmsDayEnd - pmsDayStart));
      pmsUpdateWindow(pmsPinchStartCenter - newWidth / 2, pmsPinchStartCenter + newWidth / 2);
    }
  }

  function pmsPointerUp(e) {
    pmsPointers.delete(e.pointerId);
    if (pmsPointers.size === 1) {
      const remaining = Array.from(pmsPointers.values())[0];
      pmsPanLast = pmsValueAt(remaining.x);
      pmsPinchStartDist = null;
      pmsPinchStartCenter = null;
    } else {
      pmsPanLast = null;
      pmsPinchStartDist = null;
      pmsPinchStartCenter = null;
    }
  }

  function setupPmsControls() {
    if (pmsChartFrame) {
      const panButtons = pmsChartFrame.querySelectorAll("[data-pms-pan]");
      panButtons.forEach((button) => {
        button.style.pointerEvents = "auto";
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          const direction = Number(button.dataset.pmsPan);
          pmsPan(direction, 1.5);
        });
      });

      pmsChartFrame.addEventListener("wheel", pmsWheel, { passive: false });
    }
  }

  function pmsShowOverlay(kind) {
    [$pmsChartLoading, $pmsChartNote, $pmsChartError].forEach((node) => {
      if (!node) return;
      node.style.display = "none";
    });
    if (kind === "loading" && $pmsChartLoading) $pmsChartLoading.style.display = "grid";
    if (kind === "note" && $pmsChartNote) $pmsChartNote.style.display = "grid";
    if (kind === "error" && $pmsChartError) $pmsChartError.style.display = "grid";
  }

  function pmsClearChart(showOverlayFlag = true) {
    if (!pmsChart) return;
    pmsChart.data.datasets.forEach((ds) => (ds.data = []));
    pmsChart.update("none");
    if (showOverlayFlag) pmsShowOverlay("note");
    if ($pmsDataDensity) $pmsDataDensity.textContent = "–";
  }

  function pickPmsRaw(v) {
    if (!v) return null;
    return v.A || v.F || null;
  }

  function pickPmsPoint(v, key) {
    const raw = pickPmsRaw(v);
    if (!raw) return null;
    const val = raw[key];
    return val != null ? Number(val) : null;
  }

  function normalizePmsHistory(obj) {
    const pm1Pts = [];
    const pm25Pts = [];
    const pm10Pts = [];

    for (const k of Object.keys(obj || {})) {
      const r = obj[k];
      if (!r) continue;
      const tsSec = r.ts != null ? Number(r.ts) : (isFinite(Number(k)) ? Number(k) : null);
      if (!tsSec) continue;
      const x = tsSec * 1000;
      const pm1 = pickPmsPoint(r, "pm1");
      const pm25 = pickPmsPoint(r, "pm25");
      const pm10 = pickPmsPoint(r, "pm10");
      if (pm1 != null) pm1Pts.push({ x, y: pm1 });
      if (pm25 != null) pm25Pts.push({ x, y: pm25 });
      if (pm10 != null) pm10Pts.push({ x, y: pm10 });
    }

    pm1Pts.sort((a, b) => a.x - b.x);
    pm25Pts.sort((a, b) => a.x - b.x);
    pm10Pts.sort((a, b) => a.x - b.x);
    return { pm1Pts, pm25Pts, pm10Pts };
  }

  function pmsSetData(pm1Pts, pm25Pts, pm10Pts) {
    if (!pmsChart) return;
    pmsChart.data.datasets[0].data = pm1Pts;
    pmsChart.data.datasets[1].data = pm25Pts;
    pmsChart.data.datasets[2].data = pm10Pts;
    pmsChart.update("none");
    pmsShowOverlay(null);

    const total = pm1Pts.length + pm25Pts.length + pm10Pts.length;
    if ($pmsDataDensity) {
      if (total === 0) $pmsDataDensity.textContent = "brak próbek";
      else if (total < 80) $pmsDataDensity.textContent = `${total} próbek · lekki`;
      else if (total < 200) $pmsDataDensity.textContent = `${total} próbek · umiarkowany`;
      else $pmsDataDensity.textContent = `${total} próbek · gęsty`;
    }
  }

  function pmsSetDay(dateStr) {
    const target = new Date(`${dateStr}T00:00:00`);
    pmsDayStart = target.getTime();
    pmsDayEnd = pmsDayStart + 86400000;
  }

  function pmsAppendRealtime(tsSec, fullRecord) {
    if (!pmsChart || !tsSec) return false;
    const x = tsSec * 1000;
    const raw = pickPmsRaw(fullRecord);
    if (!raw) return false;
    const values = {
      pm1: raw.pm1 != null ? Number(raw.pm1) : null,
      pm25: raw.pm25 != null ? Number(raw.pm25) : null,
      pm10: raw.pm10 != null ? Number(raw.pm10) : null
    };

    let updated = false;
    if (values.pm1 != null) { pmsChart.data.datasets[0].data.push({ x, y: values.pm1 }); updated = true; }
    if (values.pm25 != null) { pmsChart.data.datasets[1].data.push({ x, y: values.pm25 }); updated = true; }
    if (values.pm10 != null) { pmsChart.data.datasets[2].data.push({ x, y: values.pm10 }); updated = true; }
    if (updated) pmsChart.update("none");
    return updated;
  }

  function createPmsDataset(label, color, extra = {}) {
    return {
      label,
      data: [],
      borderColor: color,
      backgroundColor: withAlpha(color, 0.10),
      tension: extra.tension ?? 0.3,
      pointRadius: 0,
      pointHitRadius: 6,
      borderWidth: 2.5,
      borderJoinStyle: "round",
      borderCapStyle: "round",
      parsing: false,
      yAxisID: "y",
      fill: extra.fill ?? false,
      ...extra
    };
  }

  function buildPmsChart() {
    return new Chart(pmsCtx, {
      type: "line",
      data: {
        datasets: [
          createPmsDataset("PM 1.0 (μg/m³)", pmsPalette.pm1, { fill: true, tension: 0.35 }),
          createPmsDataset("PM 2.5 (μg/m³)", pmsPalette.pm25, { fill: true, tension: 0.35 }),
          createPmsDataset("PM 10 (μg/m³)", pmsPalette.pm10, { fill: true, tension: 0.35, borderDash: [6, 3] })
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        normalized: true,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 6, right: 8, bottom: 0, left: 0 } },
        parsing: false,
        plugins: {
          legend: {
            labels: {
              color: pmsPalette.text,
              font: { family: "Space Grotesk", size: 12 },
              usePointStyle: false
            }
          },
          tooltip: {
            backgroundColor: pmsPalette.panel,
            borderColor: pmsPalette.stroke,
            borderWidth: 1,
            titleColor: pmsPalette.text,
            bodyColor: pmsPalette.text,
            displayColors: true,
            padding: 10,
            callbacks: {
              label: (c) => {
                const y = c.parsed.y;
                if (c.datasetIndex === 0) return `PM 1.0: ${y.toFixed(1)} μg/m³`;
                if (c.datasetIndex === 1) return `PM 2.5: ${y.toFixed(1)} μg/m³`;
                return `PM 10: ${y.toFixed(1)} μg/m³`;
              },
              title: (items) => {
                if (!items.length) return "";
                return new Date(items[0].parsed.x).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
              }
            }
          },
          zoom: {
            limits: { x: { min: null, max: null }, y: { min: "original", max: "original" } },
            pan: { enabled: false },
            zoom: { wheel: { enabled: false }, pinch: { enabled: false }, drag: { enabled: false }, mode: "x" }
          }
        },
        scales: {
          x: {
            type: "linear",
            min: pmsWindow.start,
            max: pmsWindow.end,
            grid: { color: pmsPalette.grid },
            ticks: {
              color: pmsPalette.muted,
              maxTicksLimit: 8,
              callback: (value) => new Date(Number(value)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
          },
          y: {
            beginAtZero: true,
            grid: { color: pmsPalette.grid },
            ticks: { color: pmsPalette.muted }
          }
        },
      }
    });
  }

  async function pmsLoadDay(dateStr) {
    const token = ++pmsLoadToken;
    if ($pmsModeInfo) $pmsModeInfo.textContent = `Wybrany dzień: ${dateStr}`;
    pmsShowOverlay("loading");
    pmsClearChart(false);
    pmsSetDay(dateStr);

    try {
      const snap = await db.ref(HISTORY_BY_DAY_PATH(dateStr)).get();
      if (token !== pmsLoadToken) return;
      const dayObj = snap.val();

      if (dayObj) {
        const { pm1Pts, pm25Pts, pm10Pts } = normalizePmsHistory(dayObj);
        if (pm1Pts.length || pm25Pts.length || pm10Pts.length) {
          pmsSetData(pm1Pts, pm25Pts, pm10Pts);
          return;
        }
      }

      const fallbackSnap = await db.ref(HISTORY_FALLBACK_PATH).limitToLast(20000).get();
      if (token !== pmsLoadToken) return;
      const fallbackObj = fallbackSnap.val();

      if (!fallbackObj) {
        pmsShowOverlay("error");
        pushAlert(`Brak danych PM dla ${dateStr}`, "warn");
        return;
      }

      const filtered = {};
      const targetDate = new Date(`${dateStr}T00:00:00`);
      const dayStart = targetDate.getTime();
      const dayEnd = dayStart + 86400000;

      for (const k of Object.keys(fallbackObj)) {
        const r = fallbackObj[k];
        if (!r || r.ts == null) continue;
        const tsMs = Number(r.ts) * 1000;
        if (tsMs >= dayStart && tsMs < dayEnd) filtered[k] = r;
      }

      if (Object.keys(filtered).length === 0) {
        pmsShowOverlay("error");
        pushAlert(`Brak danych PM dla ${dateStr}`, "warn");
        return;
      }

      const { pm1Pts, pm25Pts, pm10Pts } = normalizePmsHistory(filtered);
      pmsSetData(pm1Pts, pm25Pts, pm10Pts);
    } catch (err) {
      console.error(err);
      pmsShowOverlay("error");
      pushAlert("Błąd pobierania danych PM", "error");
    }
  }

  function pmsRenderCal() {
    const y = pmsViewDate.getFullYear();
    const m = pmsViewDate.getMonth();
    if ($pmsCalTitle) $pmsCalTitle.textContent = `${monthNames[m]} ${y}`;
    if (!$pmsCalGrid) return;
    $pmsCalGrid.innerHTML = "";
    const offset = firstDayIndexMonday0(y, m);
    const dim = daysInMonth(y, m);
    const today = new Date();

    for (let i = 0; i < offset; i++) {
      const filler = document.createElement("div");
      filler.className = "day muted";
      filler.setAttribute("aria-hidden", "true");
      $pmsCalGrid.appendChild(filler);
    }

    for (let d = 1; d <= dim; d++) {
      const cellDate = new Date(y, m, d);
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "day";
      cell.textContent = String(d);
      if (sameDay(cellDate, today)) cell.classList.add("today");
      if (sameDay(cellDate, pmsSelectedDate)) cell.classList.add("selected");
      cell.addEventListener("click", async () => {
        pmsSelectedDate = cellDate;
        pmsRenderCal();
        await pmsLoadDay(toDateStr(pmsSelectedDate));
      });
      $pmsCalGrid.appendChild(cell);
    }
  }

  function pmsSubscribeLive() {
    pmsLiveRef = db.ref(`devices/${DEVICE_ID}/latest`);
    pmsLiveHandler = (snap) => {
      const v = snap.val();
      if (!v) return;
      const calib = v.A || v.F;
      if (calib) {
        if (calib.pm1 != null && $pm1) {
          $pm1.textContent = Number(calib.pm1).toFixed(1);
          const m1 = el("pm1Meta"); if (m1) m1.textContent = "LIVE";
        }
        if (calib.pm25 != null && $pm25) {
          $pm25.textContent = Number(calib.pm25).toFixed(1);
          const m25 = el("pm25Meta"); if (m25) m25.textContent = "LIVE";
        }
        if (calib.pm10 != null && $pm10) {
          $pm10.textContent = Number(calib.pm10).toFixed(1);
          const m10 = el("pm10Meta"); if (m10) m10.textContent = "LIVE";
        }
      }
      const ts = Number(v.ts) || null;
      if (ts) pmsAppendRealtime(ts, v);
    };

    pmsLiveRef.on("value", pmsLiveHandler);
  }

  function setupPmsGestures() {
    if (!pmsCanvas) return;
    pmsCanvas.style.touchAction = "none";
    pmsCanvas.addEventListener("pointerdown", pmsPointerDown);
    pmsCanvas.addEventListener("pointermove", pmsPointerMove);
    ["pointerup", "pointercancel", "pointerleave", "pointerout"].forEach((type) => {
      pmsCanvas.addEventListener(type, pmsPointerUp);
    });
  }

  if ($pmsCalPrev) $pmsCalPrev.addEventListener("click", () => {
    pmsViewDate = new Date(pmsViewDate.getFullYear(), pmsViewDate.getMonth() - 1, 1);
    pmsRenderCal();
  });
  if ($pmsCalNext) $pmsCalNext.addEventListener("click", () => {
    pmsViewDate = new Date(pmsViewDate.getFullYear(), pmsViewDate.getMonth() + 1, 1);
    pmsRenderCal();
  });
  if ($pmsBtnToday) $pmsBtnToday.addEventListener("click", async () => {
    pmsSelectedDate = new Date();
    pmsViewDate = new Date();
    pmsRenderCal();
    await pmsLoadDay(toDateStr(pmsSelectedDate));
  });
  if ($pmsBtnClear) $pmsBtnClear.addEventListener("click", () => pmsClearChart());

  ensureZoomPluginRegistered()
    .catch(() => null)
    .then(async () => {
      pmsChart = buildPmsChart();
      setupPmsControls();
      setupPmsGestures();
      pmsRenderCal();
      pmsSubscribeLive();
      await pmsLoadDay(toDateStr(pmsSelectedDate));

      let latest = 0;
      pmsChart.data.datasets.forEach((ds) =>
        (ds.data || []).forEach((pt) => { if (pt && pt.x > latest) latest = pt.x; })
      );
      if (!latest) latest = Date.now();
      const pad = computeRightPadding(REALTIME_WINDOW_MS);
      const end = Math.max(pmsDayStart + MIN_WINDOW_MS, latest - pad);
      const start = Math.max(pmsDayStart, end - PMS_INITIAL_WINDOW_MS);
      pmsUpdateWindow(start, end);
      for (let i = 0; i < INITIAL_PAN_STEPS; i++) pmsPan(1);
    })
    .catch((err) => {
      console.warn("[pms] chart init error:", err?.message || err);
      pmsRenderCal();
    });
})();