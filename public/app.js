// Modern IoT dashboard logic
const runtimeFirebaseConfig = window.__FIREBASE_CONFIG__ || {};
const firebaseConfig = {
  ...runtimeFirebaseConfig,
  databaseURL: localStorage.getItem("firebaseDatabaseURL")
    || runtimeFirebaseConfig.databaseURL
};

if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId || !firebaseConfig.databaseURL) {
  throw new Error("Missing Firebase configuration. Check firebase-config.js.");
}

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const el = (id) => document.getElementById(id);
const $temp = el("tempValue");
const $hum = el("humValue");
const $press = el("pressValue");
const $modeInfo = el("modeInfo");
const $chartNote = el("chartNote");
const $chartLoading = el("chartLoading");
const $chartError = el("chartError");
const $dataDensity = el("dataDensity");
const $statusPill = el("statusIndicator");
const $connectionLabel = el("connectionLabel");
const $lastSeen = el("lastSeen");

// Time meta cards
const $uptimeValue = el("uptimeValue");
const $projectStartTime = el("projectStartTime");
const $ntpClockValue = el("ntpClockValue");
const $ntpClockMeta = el("ntpClockMeta");

const $calGrid = el("calGrid");
const $calTitle = el("calTitle");
const $calPrev = el("calPrev");
const $calNext = el("calNext");

const $btnToday = el("btnToday");
const $btnClear = el("btnClear");
const $btnRefresh = el("btnRefresh");
const $toggleMotion = el("toggleMotion");

const DEVICE_ID = window.__DEVICE_ID__ || localStorage.getItem("firebaseDeviceId") || "device1";
const HISTORY_BY_DAY_PATH = (dateStr) => `devices/${DEVICE_ID}/historyByDay/${dateStr}`;
const HISTORY_FALLBACK_PATH = `devices/${DEVICE_ID}/history`;

console.info("[firebase] config", {
  projectId: firebaseConfig.projectId,
  databaseURL: firebaseConfig.databaseURL,
  deviceId: DEVICE_ID
});

// Time sync config (HTTP endpoint exposed by the device that loaded this page)
const TIME_ENDPOINT = localStorage.getItem("timeEndpoint") || "/api/time";
const TIME_SYNC_INTERVAL = 60000; // ms
const timeState = {
  baseMs: null, // server_ms - performance.now()
  startMs: null,
  lastSync: 0,
  source: "local",
  rtt: null
};

let latestRef = null;
let latestHandler = null;
let healthTimer = null;
let lastTsSec = null;
let currentLoadToken = 0;
let motionEnabled = true;

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function applyMotionSetting(enabled) {
  motionEnabled = enabled;
  document.documentElement.classList.toggle("motion-off", !enabled);
  $toggleMotion.textContent = enabled ? "Animacje: włączone" : "Animacje: wyłączone";
  $toggleMotion.setAttribute("aria-pressed", (!enabled).toString());
}

applyMotionSetting(true);
$toggleMotion.addEventListener("click", () => applyMotionSetting(!motionEnabled));

setupTitleAnimation();

function setStatus(state, detail = "") {
  const dot = $statusPill.querySelector(".dot");
  const label = $statusPill.querySelector(".status-label");
  dot.classList.remove("online", "reconnecting");

  switch (state) {
    case "online":
      dot.classList.add("online");
      label.textContent = detail || "Online";
      $connectionLabel.textContent = "online";
      break;
    case "reconnecting":
      dot.classList.add("reconnecting");
      label.textContent = detail || "Reconnecting";
      $connectionLabel.textContent = "reconnecting";
      break;
    case "offline":
    default:
      label.textContent = detail || "Offline";
      $connectionLabel.textContent = "offline";
      // Show placeholders for metric cards when offline to avoid displaying stale readings
      $temp.textContent = "--";
      $hum.textContent = "--";
      $press.textContent = "--";
      ["tempMeta", "humMeta", "pressMeta"].forEach((id) => {
        const n = el(id);
        if (n) n.textContent = "Offline";
      });
      break;
  }
}

function monitorHealth() {
  if (healthTimer) clearInterval(healthTimer);
  healthTimer = setInterval(() => {
    if (!lastTsSec) {
      setStatus("reconnecting", "Oczekiwanie na pierwszy odczyt");
      return;
    }
    const age = Date.now() / 1000 - lastTsSec;
    if (age < 20) setStatus("online", "Online");
    else if (age < 60) setStatus("reconnecting", "Brak nowych danych");
    else {
      setStatus("offline", "Brak danych > 60s");
    }
  }, 6000);
}

function setStatusFromAge(ageSeconds) {
  if (ageSeconds < 20) setStatus("online", "Online");
  else if (ageSeconds < 60) setStatus("reconnecting", "Brak nowych danych");
  else setStatus("offline", "Brak danych > 60s");
}

function updateClockDisplay(nowMs) {
  if ($ntpClockValue) $ntpClockValue.textContent = fmtClock(nowMs);
  // Show project start as a fixed datetime (YYYY-MM-DD HH:MM:SS) in uptimeValue
  if (timeState.startMs && $uptimeValue) {
    $uptimeValue.textContent = formatDateTime(timeState.startMs);
  } else if ($uptimeValue) {
    // Temporary static sample value until device provides start_ms
    $uptimeValue.textContent = "2025-01-01 00:00:00";
  }
  // Keep projectStartTime element for compatibility (show human readable)
  if (timeState.startMs && $projectStartTime) {
    const d = new Date(timeState.startMs);
    $projectStartTime.textContent = d.toLocaleString();
  } else if ($projectStartTime) {
    $projectStartTime.textContent = "2025-01-01 00:00:00";
  }
}

function fallbackToLocal(reason) {
  timeState.baseMs = Date.now() - performance.now();
  timeState.source = reason || "local";
  timeState.rtt = null;
  timeState.lastSync = Date.now();
  if ($ntpClockMeta) $ntpClockMeta.textContent = "Brak NTP — używam czasu lokalnego";
}

async function syncTimeFromDevice() {
  const t0 = performance.now();
  try {
    const res = await fetch(TIME_ENDPOINT, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const t1 = performance.now();
    const rtt = t1 - t0;
    const serverMs = Number(data.server_ms);
    if (!Number.isFinite(serverMs)) throw new Error("Brak pola server_ms");
    const estServerAtNow = serverMs + rtt / 2; // przybliżenie midpoint dla minimalizacji opóźnienia

    timeState.baseMs = estServerAtNow - t1;
    timeState.startMs = Number.isFinite(data.start_ms) ? Number(data.start_ms) : timeState.startMs;
    timeState.lastSync = Date.now();
    timeState.source = data.source || "device";
    timeState.rtt = Math.round(rtt);

    if ($ntpClockMeta) {
      $ntpClockMeta.textContent = `Źródło: ${timeState.source} • RTT ~${timeState.rtt} ms`;
    }
    if (!timeState.startMs && data.boot_ms) {
      timeState.startMs = Number(data.boot_ms);
    }
  } catch (err) {
    fallbackToLocal("local");
    pushAlert?.(`NTP fallback: ${err.message || err}`, "warn");
  }
}

function clockLoop() {
  if (timeState.baseMs !== null) {
    const nowMs = timeState.baseMs + performance.now();
    updateClockDisplay(nowMs);
  }
  requestAnimationFrame(clockLoop);
}

// bootstrap time sync
syncTimeFromDevice();
setInterval(syncTimeFromDevice, TIME_SYNC_INTERVAL);
requestAnimationFrame(clockLoop);

function showOverlay(name) {
  const map = { loading: $chartLoading, note: $chartNote, error: $chartError };
  Object.keys(map).forEach((k) => {
    if (!map[k]) return;
    map[k].style.display = name === k ? "flex" : "none";
  });
}

// Lightweight runtime loader for chartjs-plugin-zoom (to enable pinch/pan on touch).
const ZOOM_PLUGIN_URL = "https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@4.4.0/dist/chartjs-plugin-zoom.umd.min.js";
let zoomPluginPromise = null;

function loadZoomPlugin() {
  if (zoomPluginPromise) return zoomPluginPromise;
  zoomPluginPromise = new Promise((resolve, reject) => {
    const findPlugin = () => {
      const candidates = [
        window.ChartZoom,
        window["chartjs-plugin-zoom"],
        window.chartjsPluginZoom,
        window.chartjs_plugin_zoom,
        window.chartjs_plugin_zoom_default,
        window.chartjs_plugin_zoom_umd,
        window["chartjs-plugin-zoom"]?.default
      ];
      for (const c of candidates) if (c) return c;
      // Some UMD builds auto-register with Chart — return null to indicate that.
      return null;
    };

    const ready = () => resolve(findPlugin());
    // If plugin already present as a global candidate, resolve immediately.
    const pre = findPlugin();
    if (pre) { ready(); return; }
    const script = document.createElement("script");
    script.src = ZOOM_PLUGIN_URL;
    script.async = true;
    script.onload = () => {
      // small delay to allow UMD to attach globals
      setTimeout(ready, 0);
    };
    script.onerror = () => reject(new Error("Nie udało się załadować chartjs-plugin-zoom"));
    document.head.appendChild(script);
  });
  return zoomPluginPromise;
}

async function ensureZoomPluginRegistered() {
  try {
    const plugin = await loadZoomPlugin();
    if (plugin) {
      const p = plugin.default || plugin;
      try {
        Chart.register(p);
        console.info("[chart] chartjs-plugin-zoom załadowany i zarejestrowany");
      } catch (e) {
        console.warn("[chart] Błąd rejestracji pluginu zoom:", e?.message || e);
      }
    } else {
      // Plugin not returned — possibly auto-registered by UMD; check presence
      if (Chart && Chart.registry && Chart.registry.plugins && Chart.registry.plugins.length) {
        console.info("[chart] plugin zoom prawdopodobnie auto-zarejestrowany przez UMD");
      } else {
        console.warn("[chart] chartjs-plugin-zoom nie został znaleziony po załadowaniu");
      }
    }
  } catch (err) {
    console.warn("[chart] Pominięto zoom plugin (fallback):", err?.message || err);
  }
}

const ctx = el("mainChart").getContext("2d");
// Minimum visible window for zoom (ms). Reduced to allow stronger zoom-in.
// Keep a sane lower bound (60s) to avoid degenerate rendering and perf issues.
const MIN_WINDOW_MS = 1 * 60 * 1000;
// When showing live data, show the last N milliseconds (default 10 minutes)
const REALTIME_WINDOW_MS = 10 * 60 * 1000;
// Ratio of the window to keep as empty space on the right (e.g. 0.08 = 8%)
const RIGHT_PADDING_RATIO = 0.08;
// Max right padding in ms to avoid too large gaps
const RIGHT_PADDING_MAX_MS = 60 * 1000;

function computeRightPadding(windowMs) {
  const p = Math.round(windowMs * RIGHT_PADDING_RATIO);
  return Math.min(p, RIGHT_PADDING_MAX_MS);
}

// Initial maximum zoom amount to use on first render (use MIN_WINDOW_MS for strongest zoom)
const INITIAL_ZOOM_MS = MIN_WINDOW_MS;
// Number of synthetic pan-right steps to apply after initial window set (mimics 4x '>' clicks)
const INITIAL_PAN_STEPS = 4;
// Auto-follow newest data (if true, chart window moves to keep newest point at the end)
// Disabled per request to keep chart stable when new data arrives.
const AUTO_FOLLOW_LIVE = false;
let chartDayStart = 0;
let chartDayEnd = 0;
const chartWindow = { start: 0, end: 0 };
const chartFrame = document.querySelector(".chart-frame");
let myChart = null;

const readCssVar = (name, fallback) => {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return v ? v.trim() || fallback : fallback;
};

const withAlpha = (color, alpha) => {
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
};

const chartPalette = {
  temp: readCssVar("--warn", "#f97316"),
  hum: readCssVar("--accent", "#4be1ec"),
  press: readCssVar("--accent-2", "#a78bfa"),
  text: readCssVar("--text", "#e6edf7"),
  muted: readCssVar("--muted", "#9fb0c7"),
  stroke: readCssVar("--stroke", "#1f2a3d"),
  panel: readCssVar("--panel-2", "#0b101a"),
  grid: "rgba(255,255,255,0.04)"
};

// --- Touch / pointer gesture handling ---
const activePointers = new Map();
let pinchStartDist = null;
let pinchStartWidth = null;
let pinchStartCenterValue = null;
let panLastValue = null;

function pointerDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

function getScaleX() {
  return myChart?.scales?.x || null;
}

function valueAtClientX(clientX, canvas) {
  const scale = getScaleX();
  if (!scale) return null;
  const rect = canvas.getBoundingClientRect();
  const px = clientX - rect.left;
  return scale.getValueForPixel(px);
}

function handlePointerDown(e) {
  if (!myChart || !ctx?.canvas) return;
  ctx.canvas.setPointerCapture?.(e.pointerId);
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (activePointers.size === 1) {
    panLastValue = valueAtClientX(e.clientX, ctx.canvas);
    pinchStartDist = null;
  } else if (activePointers.size === 2) {
    const pts = Array.from(activePointers.values());
    pinchStartDist = pointerDistance(pts[0], pts[1]);
    pinchStartWidth = chartWindow.end - chartWindow.start;
    const centerPx = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
    const centerVal = valueAtClientX(centerPx.x, ctx.canvas);
    pinchStartCenterValue = centerVal;
    panLastValue = null;
  }
}

function handlePointerMove(e) {
  if (!myChart || !ctx?.canvas) return;
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  const scale = getScaleX();
  if (!scale || !chartDayEnd || chartDayEnd <= chartDayStart) return;

  if (activePointers.size === 1 && panLastValue != null) {
    const curVal = valueAtClientX(e.clientX, ctx.canvas);
    if (curVal == null) return;
    const delta = curVal - panLastValue;
    if (delta !== 0) {
      updateChartWindow(chartWindow.start - delta, chartWindow.end - delta);
      panLastValue = curVal;
    }
  } else if (activePointers.size === 2 && pinchStartDist && pinchStartWidth && pinchStartCenterValue != null) {
    const pts = Array.from(activePointers.values());
    const dist = pointerDistance(pts[0], pts[1]);
    if (dist <= 0) return;
    const ratio = dist / pinchStartDist;
    const newWidth = Math.max(MIN_WINDOW_MS, Math.min(pinchStartWidth / ratio, chartDayEnd - chartDayStart));
    const center = pinchStartCenterValue;
    updateChartWindow(center - newWidth / 2, center + newWidth / 2);
  }
}

function handlePointerUp(e) {
  activePointers.delete(e.pointerId);
  if (activePointers.size === 1) {
    const remaining = Array.from(activePointers.values())[0];
    panLastValue = valueAtClientX(remaining.x, ctx.canvas);
    pinchStartDist = null;
    pinchStartCenterValue = null;
  } else {
    panLastValue = null;
    pinchStartDist = null;
    pinchStartCenterValue = null;
  }
}

function setupPointerGestures(canvas) {
  if (!canvas) return;
  canvas.style.touchAction = "none"; // already set later, keep consistent
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  ["pointerup", "pointercancel", "pointerleave", "pointerout"].forEach((type) => {
    canvas.addEventListener(type, handlePointerUp);
  });
}

function createDataset(label, color, yAxisID, extra = {}) {
  return {
    label,
    data: [],
    borderColor: color,
    backgroundColor: withAlpha(color, 0.08),
    tension: extra.tension ?? 0.25,
    pointRadius: 0,
    pointHitRadius: 6,
    borderWidth: 2,
    borderJoinStyle: "round",
    borderCapStyle: "round",
    parsing: false,
    yAxisID,
    ...extra
  };
}

function createChart(context) {
  return new Chart(context, {
    type: "line",
    data: {
      datasets: [
        createDataset("Temperatura (°C)", chartPalette.temp, "y"),
        createDataset("Wilgotność (%)", chartPalette.hum, "y"),
        createDataset("Ciśnienie (hPa)", chartPalette.press, "y1", { borderDash: [4, 4], tension: 0.1 })
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      normalized: true,
      interaction: { mode: "index", intersect: false },
      layout: { padding: { top: 6, right: 8, bottom: 0, left: 0 } },
      plugins: {
        legend: {
          labels: {
            color: chartPalette.text,
            font: { family: "Space Grotesk", size: 12 },
            usePointStyle: false
          }
        },
        tooltip: {
          backgroundColor: chartPalette.panel,
          borderColor: chartPalette.stroke,
          borderWidth: 1,
          titleColor: chartPalette.text,
          bodyColor: chartPalette.text,
          displayColors: false,
          padding: 10,
          callbacks: {
            label: (ctx) => {
              const y = ctx.parsed.y;
              if (ctx.datasetIndex === 0) return `Temperatura: ${y.toFixed(1)} °C`;
              if (ctx.datasetIndex === 1) return `Wilgotność: ${Math.round(y)} %`;
              return `Ciśnienie: ${Math.round(y)} hPa`;
            },
            title: (items) => {
              if (!items.length) return "";
              return new Date(items[0].parsed.x).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            }
          }
        },
        // Keep plugin configured but disabled; custom pointer handlers handle pinch/pan.
        zoom: {
          limits: {
            x: { min: null, max: null },
            y: { min: "original", max: "original" }
          },
          pan: { enabled: false },
          zoom: { wheel: { enabled: false }, pinch: { enabled: false }, drag: { enabled: false }, mode: "x" }
        }
      },
      scales: {
        x: {
          type: "linear",
          grid: { color: chartPalette.grid },
          ticks: {
            color: chartPalette.muted,
            maxTicksLimit: 8,
            callback: (value) => new Date(Number(value)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          }
        },
        y: {
          type: "linear",
          position: "left",
          grid: { color: chartPalette.grid },
          ticks: { color: chartPalette.muted }
        },
        y1: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
          ticks: {
            color: chartPalette.press,
            stepSize: 5,
            callback: (value) => `${value} hPa`
          },
          min: 960,
          max: 1040
        }
      }
    }
  });
}

const chartReady = ensureZoomPluginRegistered()
  .catch(() => null)
  .then(() => {
    myChart = createChart(ctx);
    if (ctx?.canvas) {
      // Prevent browser page zoom/scroll from stealing pinch gestures on the chart.
      ctx.canvas.style.touchAction = "none";
      setupPointerGestures(ctx.canvas);
    }
    return myChart;
  });

function clampWindow(start, end) {
  if (!chartDayEnd || chartDayEnd <= chartDayStart) return { start, end };
  let width = end - start;
  if (width > chartDayEnd - chartDayStart) width = chartDayEnd - chartDayStart;
  width = Math.max(width, MIN_WINDOW_MS);
  let center = (start + end) / 2;
  let half = width / 2;
  let nextStart = center - half;
  let nextEnd = center + half;
  if (nextStart < chartDayStart) {
    nextStart = chartDayStart;
    nextEnd = nextStart + width;
  }
  if (nextEnd > chartDayEnd) {
    nextEnd = chartDayEnd;
    nextStart = nextEnd - width;
  }
  return { start: nextStart, end: nextEnd };
}

function updateChartWindow(start, end) {
  if (!chartDayEnd || chartDayEnd <= chartDayStart) return;
  const window = clampWindow(start, end);
  chartWindow.start = window.start;
  chartWindow.end = window.end;
  myChart.options.scales.x.min = window.start;
  myChart.options.scales.x.max = window.end;
  myChart.update("none");
}

function setDayWindow(dateStr) {
  const normalized = new Date(`${dateStr}T00:00:00`);
  chartDayStart = normalized.getTime();
  chartDayEnd = chartDayStart + 24 * 60 * 60 * 1000;
  updateChartWindow(chartDayStart, chartDayEnd);
}

function panChart(direction) {
  if (!chartDayEnd || chartDayEnd <= chartDayStart) return;
  const range = chartWindow.end - chartWindow.start;
  const shift = Math.min(range * 0.25, 60 * 60 * 1000);
  updateChartWindow(chartWindow.start + direction * shift, chartWindow.end + direction * shift);
}

function zoomChart(factor) {
  if (!chartDayEnd || chartDayEnd <= chartDayStart) return;
  const width = chartWindow.end - chartWindow.start;
  let newWidth = width * factor;
  newWidth = Math.min(newWidth, chartDayEnd - chartDayStart);
  newWidth = Math.max(newWidth, MIN_WINDOW_MS);
  const center = (chartWindow.end + chartWindow.start) / 2;
  updateChartWindow(center - newWidth / 2, center + newWidth / 2);
}

function handleChartWheel(event) {
  const isHorizontalPan = Math.abs(event.deltaX) > Math.abs(event.deltaY) && Math.abs(event.deltaX) > 0;
  const isZoomGesture = event.ctrlKey || event.metaKey;
  if (!isHorizontalPan && !isZoomGesture) return;
  event.preventDefault();

  if (isHorizontalPan) {
    panChart(event.deltaX > 0 ? 1 : -1);
    try { if (typeof window.pmsPan === 'function') window.pmsPan(event.deltaX > 0 ? 1 : -1); } catch (e) { /* ignore */ }
    return;
  }

  const zoomIn = event.deltaY < 0;
  // Stronger zoom-in factor for more granular zooming; keep zoom-out moderate.
  zoomChart(zoomIn ? 0.80 : 1.25);
}

const panButtons = chartFrame ? chartFrame.querySelectorAll("[data-pan]") : [];
panButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const dir = Number(btn.dataset.pan);
    panChart(dir);
    // also pan PMS chart if available
    try { if (typeof window.pmsPan === 'function') window.pmsPan(dir); } catch (e) { /* ignore */ }
  });
});
if (chartFrame) {
  chartFrame.addEventListener("wheel", handleChartWheel, { passive: false });
}

function clearChart(showNote = true) {
  myChart.data.datasets.forEach((ds) => (ds.data = []));
  myChart.update("none");
  if (showNote) showOverlay("note");
  $dataDensity.textContent = "–";
}

function setChartData(tempPts, humPts, pressPts) {
  myChart.data.datasets[0].data = tempPts;
  myChart.data.datasets[1].data = humPts;
  myChart.data.datasets[2].data = pressPts;
  myChart.update("none");
  showOverlay(null);
  const total = tempPts.length + humPts.length + pressPts.length;
  if (total === 0) {
    $dataDensity.textContent = "brak próbek";
  } else if (total < 80) {
    $dataDensity.textContent = `${total} próbek · lekki`; 
  } else if (total < 200) {
    $dataDensity.textContent = `${total} próbek · umiarkowany`;
  } else {
    $dataDensity.textContent = `${total} próbek · gęsty`;
  }
}

function addPointIfMissing(datasetIndex, point) {
  const dataset = myChart.data.datasets[datasetIndex];
  if (!dataset || !point) return false;
  const exists = dataset.data.some((entry) => entry.x === point.x);
  if (exists) return false;
  dataset.data.push(point);
  dataset.data.sort((a, b) => a.x - b.x);
  return true;
}

function appendRealtimeData(tsSec, values) {
  if (!tsSec) return false;
  const targetDay = toDateStr(new Date(tsSec * 1000));
  if (targetDay !== toDateStr(selectedDate)) return false;
  const x = tsSec * 1000;
  let updated = false;
  if (values.temp != null) {
    updated = addPointIfMissing(0, { x, y: Number(values.temp) }) || updated;
  }
  if (values.hum != null) {
    updated = addPointIfMissing(1, { x, y: Number(values.hum) }) || updated;
  }
  if (values.press != null) {
    updated = addPointIfMissing(2, { x, y: Number(values.press) }) || updated;
  }
  if (updated) {
    myChart.update("none");
  }
  return updated;
}

function normalizeHistoryObject(obj) {
  const tempPts = [];
  const humPts = [];
  const pressPts = [];

  for (const k of Object.keys(obj)) {
    const r = obj[k];
    if (!r) continue;

    const tsSec = r.ts != null ? Number(r.ts) : (isFinite(Number(k)) ? Number(k) : null);
    if (!tsSec) continue;

    const x = tsSec * 1000;
    if (r.t != null) tempPts.push({ x, y: Number(r.t) });
    if (r.h != null) humPts.push({ x, y: Number(r.h) });
    if (r.p != null) pressPts.push({ x, y: Number(r.p) });
  }

  tempPts.sort((a, b) => a.x - b.x);
  humPts.sort((a, b) => a.x - b.x);
  pressPts.sort((a, b) => a.x - b.x);

  return { tempPts, humPts, pressPts };
}

function toDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function loadDay(dateStr) {
  const token = ++currentLoadToken;
  $modeInfo.textContent = `Wybrany dzień: ${dateStr}`;
  showOverlay("loading");
  clearChart(false);
  setDayWindow(dateStr);

  try {
    const daySnap = await db.ref(HISTORY_BY_DAY_PATH(dateStr)).get();
    if (token !== currentLoadToken) return; // in case of newer request

    const dayObj = daySnap.val();
    if (dayObj) {
      const { tempPts, humPts, pressPts } = normalizeHistoryObject(dayObj);
      setChartData(tempPts, humPts, pressPts);
      return;
    }

    const fallbackSnap = await db.ref(HISTORY_FALLBACK_PATH).limitToLast(20000).get();
    if (token !== currentLoadToken) return;
    const fallbackObj = fallbackSnap.val();

    if (!fallbackObj) {
      showOverlay("error");
      pushAlert(`Brak danych dla ${dateStr}`, "warn");
      return;
    }

    // Filtruj dane fallbacka dla wybranego dnia
    const filtered = {};
    const targetDate = new Date(dateStr);
    const dayStart = targetDate.getTime();
    const dayEnd = dayStart + 86400000; // + 24h
    
    for (const k of Object.keys(fallbackObj)) {
      const r = fallbackObj[k];
      if (!r || r.ts == null) continue;
      
      const tsSec = Number(r.ts);
      const tsMs = tsSec * 1000;
      
      // Sprawdź czy punkt należy do wybranego dnia
      if (tsMs >= dayStart && tsMs < dayEnd) {
        filtered[k] = r;
      }
    }

    if (Object.keys(filtered).length === 0) {
      showOverlay("error");
      pushAlert(`Brak danych dla ${dateStr}`, "warn");
      return;
    }

    const { tempPts, humPts, pressPts } = normalizeHistoryObject(filtered);
    setChartData(tempPts, humPts, pressPts);
  } catch (err) {
    console.error(err);
    const message = String(err?.message || err || "");
    if (message.toLowerCase().includes("permission denied") || message.toLowerCase().includes("insufficient permissions")) {
      pushAlert("Firebase: brak dostępu do odczytu. Sprawdź reguły RTDB albo logowanie anonimowe.", "error");
    } else {
      pushAlert("Błąd pobierania danych", "error");
    }
    showOverlay("error");
  }
}

function subscribeLatest() {
  latestRef = db.ref(`devices/${DEVICE_ID}/latest`);
  latestHandler = (snap) => {
    const v = snap.val();
    if (!v) {
      resetCards();
      setStatus("reconnecting", "Brak danych (LIVE)");
      return;
    }

    lastTsSec = Number(v.ts) || null;
    $temp.textContent = Number(v.t).toFixed(1);
    $hum.textContent = Math.round(Number(v.h));
    $press.textContent = Math.round(Number(v.p));
    $lastSeen.textContent = humanTime(lastTsSec);
    ["tempMeta", "humMeta", "pressMeta"].forEach((id) => {
      const n = el(id);
      if (n) n.textContent = "LIVE";
    });
    const age = Date.now() / 1000 - lastTsSec;
    setStatusFromAge(age);
    const updated = appendRealtimeData(lastTsSec, { temp: v.t, hum: v.h, press: v.p });
    // If we're showing today's data and new point appended, follow live end but leave small right padding
    const isToday = toDateStr(selectedDate) === toDateStr(new Date());
    if (updated && isToday && AUTO_FOLLOW_LIVE) {
      const latestMs = lastTsSec * 1000;
      const pad = computeRightPadding(REALTIME_WINDOW_MS);
      const end = Math.max(chartDayStart + MIN_WINDOW_MS, latestMs - pad);
      const start = Math.max(chartDayStart, end - REALTIME_WINDOW_MS);
      updateChartWindow(start, end);
    }
  };

  latestRef.on("value", latestHandler);
  monitorHealth();
}

// Calendar
let viewDate = new Date();
let selectedDate = new Date();
const monthNames = [
  "Styczeń","Luty","Marzec","Kwiecień","Maj","Czerwiec",
  "Lipiec","Sierpień","Wrzesień","Październik","Listopad","Grudzień"
];

function firstDayIndexMonday0(year, month) {
  const js = new Date(year, month, 1).getDay();
  return (js + 6) % 7;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function renderCalendar() {
  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();
  $calTitle.textContent = `${monthNames[m]} ${y}`;
  $calGrid.innerHTML = "";

  const offset = firstDayIndexMonday0(y, m);
  const dim = daysInMonth(y, m);
  const today = new Date();

  for (let i = 0; i < offset; i++) {
    const filler = document.createElement("div");
    filler.className = "day muted";
    filler.setAttribute("aria-hidden", "true");
    $calGrid.appendChild(filler);
  }

  for (let d = 1; d <= dim; d++) {
    const cellDate = new Date(y, m, d);
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "day";
    cell.textContent = String(d);

    if (sameDay(cellDate, today)) cell.classList.add("today");
    if (sameDay(cellDate, selectedDate)) cell.classList.add("selected");

    cell.addEventListener("click", async () => {
      selectedDate = cellDate;
      renderCalendar();
      await loadDay(toDateStr(selectedDate));
    });

    $calGrid.appendChild(cell);
  }
}

$calPrev.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  renderCalendar();
});

$calNext.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  renderCalendar();
});

$btnToday.addEventListener("click", async () => {
  selectedDate = new Date();
  viewDate = new Date();
  renderCalendar();
  await loadDay(toDateStr(selectedDate));
});

$btnClear.addEventListener("click", () => {
  clearChart();
});

$btnRefresh.addEventListener("click", async () => {
  await loadDay(toDateStr(selectedDate));
});

function cleanup() {
  if (latestRef && latestHandler) latestRef.off("value", latestHandler);
  if (healthTimer) clearInterval(healthTimer);
}

window.addEventListener("beforeunload", cleanup);

// Start after chart (and optional zoom plugin) is ready
chartReady.then(async () => {
  resetCards();
  subscribeLatest();
  renderCalendar();
  // Load data for selected date (defaults to today) and then set live window
  await loadDay(toDateStr(selectedDate));
  // Determine latest timestamp from datasets
  let latest = 0;
  try {
    myChart.data.datasets.forEach((ds) => {
      (ds.data || []).forEach((pt) => {
        if (pt && pt.x > latest) latest = pt.x;
      });
    });
  } catch (e) {
    latest = 0;
  }
  if (!latest) latest = Date.now();
  const pad = computeRightPadding(REALTIME_WINDOW_MS);
  const end = Math.max(chartDayStart + MIN_WINDOW_MS, latest - pad);
  // For initial view use the strongest zoom (INITIAL_ZOOM_MS); keep real-time follow window logic elsewhere
  const start = Math.max(chartDayStart, end - INITIAL_ZOOM_MS);
  updateChartWindow(start, end);

  // Apply synthetic pan-right steps to mimic pressing '>' button multiple times
  const applyInitialPan = () => {
    for (let i = 0; i < INITIAL_PAN_STEPS; i++) {
      panChart(1);
    }
  };
  applyInitialPan();
}).catch((err) => {
  console.warn("[chart] Inicjalizacja z pominiętym pluginem zoom:", err?.message || err);
  resetCards();
  subscribeLatest();
  renderCalendar();
  loadDay(toDateStr(selectedDate));
});
