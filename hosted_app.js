// Modern IoT dashboard logic
// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlg2aIgyNBH7zikO-p9-RJhlsa3mNtMZU",
  authDomain: "iot-esp32-zegar.firebaseapp.com",
  projectId: "iot-esp32-zegar",
  storageBucket: "iot-esp32-zegar.firebasestorage.app",
  messagingSenderId: "961962428654",
  appId: "1:961962428654:web:5b6e60b921596207d2cbff",
  databaseURL: "https://iot-esp32-zegar-default-rtdb.europe-west1.firebasedatabase.app"
};

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
const $toast = el("toast");
const $alertStack = el("alertStack");

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
const $titleTexts = document.querySelectorAll(".title-text");

const DEVICE_ID = "device1";
const HISTORY_BY_DAY_PATH = (dateStr) => `devices/${DEVICE_ID}/historyByDay/${dateStr}`;
const HISTORY_FALLBACK_PATH = `devices/${DEVICE_ID}/history`;

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

// --- Title animation (per-letter reveal) ---
function setupTitleAnimation() {
  if (!$titleTexts || $titleTexts.length === 0) return;

  const defaultText = "T I C K I N G • B O M B";

  $titleTexts.forEach(($titleText) => {
    try {
      if ($titleText.dataset.animated === "true") return;
      // Use data-title if present (allows custom text like SENSOR-PMS5003)
      const raw = $titleText.dataset.title || defaultText;
      const text = String(raw);
      $titleText.setAttribute("aria-label", text.replace(/\s+/g, ""));
      $titleText.dataset.animated = "true";
      $titleText.textContent = "";

      text.split("").forEach((ch, idx) => {
        const span = document.createElement("span");
        span.className = "title-letter";
        span.textContent = ch === " " ? "\u00a0" : ch;
        span.style.animationDelay = `${idx * 0.08}s`;
        $titleText.appendChild(span);

        // Trigger animation after a tiny delay to ensure DOM is ready
        setTimeout(() => span.classList.add("animate"), 50 + idx * 8);
      });
    } catch (err) {
      // silent fail for animation so rest of app continues
      console.warn('Title animation failed for element', $titleText, err);
    }
  });
}

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

function toast(message, tone = "info") {
  if (!$toast) return;
  $toast.textContent = message;
  $toast.className = `toast show ${tone}`;
  setTimeout(() => $toast.classList.remove("show"), 2800);
}

function pushAlert(message, tone = "warn") {
  if (!$alertStack) return;
  const div = document.createElement("div");
  div.className = `alert ${tone}`;
  div.textContent = message;
  $alertStack.prepend(div);
  setTimeout(() => div.remove(), 6500);
}

function resetCards() {
  $temp.textContent = "--";
  $hum.textContent = "--";
  $press.textContent = "--";
  ["tempMeta", "humMeta", "pressMeta"].forEach((id) => {
    const n = el(id);
    if (n) n.textContent = "Czekam na dane";
  });
}

function humanTime(tsSec) {
  if (!tsSec) return "--:--";
  const d = new Date(tsSec * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
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

// --- Time sync module (device -> browser) ---
function fmtClock(ms) {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms3 = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms3}`;
}

function fmtDuration(ms) {
  if (ms < 0) ms = 0;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

function formatDateTime(ms) {
  const d = new Date(ms);
  const Y = d.getFullYear();
  const M = String(d.getMonth() + 1).padStart(2, "0");
  const D = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${Y}-${M}-${D} ${hh}:${mm}:${ss}`;
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
  // Require ctrl/meta to avoid interfering with normal scrolling.
  if (!(event.ctrlKey || event.metaKey)) return;
  event.preventDefault();
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
chartFrame?.addEventListener("wheel", handleChartWheel, { passive: false });

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

    const fallbackSnap = await db.ref(HISTORY_FALLBACK_PATH).limitToLast(5000).get();
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
    pushAlert("Błąd pobierania danych", "error");
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

// =====================================================================
// PMS5003 Chart – independent chart with its own calendar, pan, zoom
// =====================================================================
(function initPmsChart() {
  // --- DOM references (all prefixed pms*) ---
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
  if (!pmsCanvas) { console.warn("[pms] brak canvas #pmsChart"); return; }
  const pmsCtx = pmsCanvas.getContext("2d");

  // Shift PMS controls to the right by 1.5x for better placement (uses left percent)
  (function adjustPmsControls() {
    try {
      const ctr = pmsChartFrame.querySelector('.chart-controls');
      if (!ctr) return;
      const cs = getComputedStyle(ctr);
      let left = cs.left;
      let parent = ctr.parentElement;
      let parentWidth = parent ? parent.clientWidth : 1;
      let percent = null;
      if (left && left.endsWith('%')) {
        percent = parseFloat(left);
      } else if (left && left.endsWith('px')) {
        const px = parseFloat(left);
        percent = (px / parentWidth) * 100;
      } else {
        // fallback default used in CSS
        percent = 47;
      }
      const newPercent = Math.min(percent * 1.15, 95);
      ctr.style.left = `${newPercent}%`;
      // keep vertical centering
      ctr.style.transform = ctr.style.transform || 'translate(-50%, -50%)';
    } catch (e) {
      /* ignore */
    }
  })();

  // --- PMS palette (distinct from main chart) ---
  const pmsPalette = {
    pm1:   "#34d399",  // green  (--good)
    pm25:  "#fcd34d",  // yellow (--warn)
    pm10:  "#f87171",  // red    (--error)
    text:  chartPalette.text,
    muted: chartPalette.muted,
    stroke: chartPalette.stroke,
    panel: chartPalette.panel,
    grid:  chartPalette.grid
  };

  // --- State ---
  let pmsChart = null;
  let pmsDayStart = 0;
  let pmsDayEnd = 0;
  const pmsWindow = { start: 0, end: 0 };
  let pmsLoadToken = 0;
  let pmsViewDate = new Date();
  let pmsSelectedDate = new Date();

  // --- Touch / pointer gesture handling (scoped) ---
  const pmsPointers = new Map();
  let pmsPinchStartDist = null;
  let pmsPinchStartWidth = null;
  let pmsPinchStartCenter = null;
  let pmsPanLast = null;

  function pmsGetScaleX() { return pmsChart?.scales?.x || null; }

  function pmsValueAt(clientX) {
    const scale = pmsGetScaleX();
    if (!scale) return null;
    const rect = pmsCanvas.getBoundingClientRect();
    return scale.getValueForPixel(clientX - rect.left);
  }

  function pmsPointerDown(e) {
    if (!pmsChart) return;
    pmsCanvas.setPointerCapture?.(e.pointerId);
    pmsPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pmsPointers.size === 1) {
      pmsPanLast = pmsValueAt(e.clientX);
      pmsPinchStartDist = null;
    } else if (pmsPointers.size === 2) {
      const pts = Array.from(pmsPointers.values());
      pmsPinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pmsPinchStartWidth = pmsWindow.end - pmsWindow.start;
      pmsPinchStartCenter = pmsValueAt((pts[0].x + pts[1].x) / 2);
      pmsPanLast = null;
    }
  }

  function pmsPointerMove(e) {
    if (!pmsChart || !pmsPointers.has(e.pointerId)) return;
    pmsPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const scale = pmsGetScaleX();
    if (!scale || !pmsDayEnd || pmsDayEnd <= pmsDayStart) return;

    if (pmsPointers.size === 1 && pmsPanLast != null) {
      const cur = pmsValueAt(e.clientX);
      if (cur == null) return;
      const delta = cur - pmsPanLast;
      if (delta !== 0) {
        pmsUpdateWindow(pmsWindow.start - delta, pmsWindow.end - delta);
        pmsPanLast = cur;
      }
    } else if (pmsPointers.size === 2 && pmsPinchStartDist && pmsPinchStartWidth && pmsPinchStartCenter != null) {
      const pts = Array.from(pmsPointers.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (dist <= 0) return;
      const ratio = dist / pmsPinchStartDist;
      const newW = Math.max(MIN_WINDOW_MS, Math.min(pmsPinchStartWidth / ratio, pmsDayEnd - pmsDayStart));
      pmsUpdateWindow(pmsPinchStartCenter - newW / 2, pmsPinchStartCenter + newW / 2);
    }
  }

  function pmsPointerUp(e) {
    pmsPointers.delete(e.pointerId);
    if (pmsPointers.size === 1) {
      const rem = Array.from(pmsPointers.values())[0];
      pmsPanLast = pmsValueAt(rem.x);
      pmsPinchStartDist = null;
      pmsPinchStartCenter = null;
    } else {
      pmsPanLast = null;
      pmsPinchStartDist = null;
      pmsPinchStartCenter = null;
    }
  }

  function setupPmsGestures() {
    pmsCanvas.style.touchAction = "none";
    pmsCanvas.addEventListener("pointerdown", pmsPointerDown);
    pmsCanvas.addEventListener("pointermove", pmsPointerMove);
    ["pointerup", "pointercancel", "pointerleave", "pointerout"].forEach((t) =>
      pmsCanvas.addEventListener(t, pmsPointerUp)
    );
  }

  // --- Overlays ---
  function pmsShowOverlay(name) {
    const map = { loading: $pmsChartLoading, note: $pmsChartNote, error: $pmsChartError };
    Object.keys(map).forEach((k) => {
      if (!map[k]) return;
      map[k].style.display = name === k ? "flex" : "none";
    });
  }

  // --- Window management ---
  function pmsClamp(start, end) {
    if (!pmsDayEnd || pmsDayEnd <= pmsDayStart) return { start, end };
    let w = end - start;
    if (w > pmsDayEnd - pmsDayStart) w = pmsDayEnd - pmsDayStart;
    w = Math.max(w, MIN_WINDOW_MS);
    let c = (start + end) / 2, h = w / 2;
    let ns = c - h, ne = c + h;
    if (ns < pmsDayStart) { ns = pmsDayStart; ne = ns + w; }
    if (ne > pmsDayEnd) { ne = pmsDayEnd; ns = ne - w; }
    return { start: ns, end: ne };
  }

  function pmsUpdateWindow(s, e) {
    if (!pmsDayEnd || pmsDayEnd <= pmsDayStart) return;
    const w = pmsClamp(s, e);
    pmsWindow.start = w.start;
    pmsWindow.end = w.end;
    pmsChart.options.scales.x.min = w.start;
    pmsChart.options.scales.x.max = w.end;
    pmsChart.update("none");
  }

  function pmsSetDay(dateStr) {
    const d = new Date(`${dateStr}T00:00:00`);
    pmsDayStart = d.getTime();
    pmsDayEnd = pmsDayStart + 86400000;
    pmsUpdateWindow(pmsDayStart, pmsDayEnd);
  }

  function pmsPan(dir, scale = 1) {
    if (!pmsDayEnd || pmsDayEnd <= pmsDayStart) return;
    const range = pmsWindow.end - pmsWindow.start;
    const baseShift = Math.min(range * 0.25, 3600000);
    const shift = Math.min(baseShift * scale, 3600000);
    pmsUpdateWindow(pmsWindow.start + dir * shift, pmsWindow.end + dir * shift);
  }

  // Expose pmsPan to global scope so other UI controls can pan both charts
  try { window.pmsPan = pmsPan; } catch (e) { /* ignore in sandboxed contexts */ }

  function pmsZoom(factor) {
    if (!pmsDayEnd || pmsDayEnd <= pmsDayStart) return;
    const w = pmsWindow.end - pmsWindow.start;
    let nw = w * factor;
    nw = Math.min(nw, pmsDayEnd - pmsDayStart);
    nw = Math.max(nw, MIN_WINDOW_MS);
    const c = (pmsWindow.end + pmsWindow.start) / 2;
    pmsUpdateWindow(c - nw / 2, c + nw / 2);
  }

  function pmsWheel(ev) {
    if (!(ev.ctrlKey || ev.metaKey)) return;
    ev.preventDefault();
    pmsZoom(ev.deltaY < 0 ? 0.80 : 1.25);
  }

  // --- Chart creation ---
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
    const chart = new Chart(pmsCtx, {
      type: "line",
      data: {
        datasets: [
          createPmsDataset("PM 1.0 (μg/m³)", pmsPalette.pm1, { fill: true, tension: 0.35 }),
          createPmsDataset("PM 2.5 (μg/m³)", pmsPalette.pm25, { fill: true, tension: 0.35 }),
          createPmsDataset("PM 10 (μg/m³)",  pmsPalette.pm10, { fill: true, tension: 0.35, borderDash: [6, 3] })
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
            grid: { color: pmsPalette.grid },
            ticks: {
              color: pmsPalette.muted,
              maxTicksLimit: 8,
              callback: (v) => new Date(Number(v)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            }
          },
          y: {
            type: "linear",
            position: "left",
            beginAtZero: true,
            grid: { color: pmsPalette.grid },
            ticks: {
              color: pmsPalette.muted,
              callback: (v) => `${v} μg/m³`
            },
            title: {
              display: true,
              text: "Stężenie (μg/m³)",
              color: pmsPalette.muted,
              font: { family: "Space Grotesk", size: 12 }
            }
          }
        }
      }
    });
    return chart;
  }

  // --- Data helpers ---

  // Extract a PM field from a record – handles nested A/F and flat fields.
  // Uses explicit != null checks so that 0 values are never discarded.
  function pickPm(r, field) {
    if (r.A && r.A[field] != null) return Number(r.A[field]);
    if (r.F && r.F[field] != null) return Number(r.F[field]);
    if (r[field] != null) return Number(r[field]);
    return null;
  }

  // Normalize a timestamp value (seconds or milliseconds) into milliseconds.
  // Accepts numeric seconds (e.g. 167...) or milliseconds (1.67e12).
  function tsToMs(v) {
    if (v == null) return null;
    const n = Number(v);
    if (!isFinite(n)) return null;
    // If value is already in milliseconds (>= 1e12), return as-is.
    if (Math.abs(n) > 1e12) return Math.round(n);
    // Otherwise assume seconds and convert to ms.
    return Math.round(n * 1000);
  }

  function pmsClearChart(showNote = true) {
    pmsChart.data.datasets.forEach((ds) => (ds.data = []));
    pmsChart.update("none");
    if (showNote) pmsShowOverlay("note");
    if ($pmsDataDensity) $pmsDataDensity.textContent = "–";
  }

  function pmsSetData(pm1Pts, pm25Pts, pm10Pts) {
    pmsChart.data.datasets[0].data = pm1Pts;
    pmsChart.data.datasets[1].data = pm25Pts;
    pmsChart.data.datasets[2].data = pm10Pts;
    pmsChart.update("none");
    pmsShowOverlay(null);
    const total = pm1Pts.length + pm25Pts.length + pm10Pts.length;
    if (!$pmsDataDensity) return;
    if (total === 0) {
      $pmsDataDensity.textContent = "brak próbek";
    } else if (total < 80) {
      $pmsDataDensity.textContent = `${total} próbek · lekki`;
    } else if (total < 200) {
      $pmsDataDensity.textContent = `${total} próbek · umiarkowany`;
    } else {
      $pmsDataDensity.textContent = `${total} próbek · gęsty`;
    }
  }

  function pmsAddPoint(dsIndex, pt) {
    const ds = pmsChart.data.datasets[dsIndex];
    if (!ds || !pt) return false;
    if (ds.data.some((e) => e.x === pt.x)) return false;
    ds.data.push(pt);
    ds.data.sort((a, b) => a.x - b.x);
    return true;
  }

  function pmsAppendRealtime(tsSec, vals) {
    if (!tsSec || !pmsChart) return false;
    const tsMs = tsToMs(tsSec);
    if (!tsMs) return false;
    const day = toDateStr(new Date(tsMs));
    if (day !== toDateStr(pmsSelectedDate)) return false;
    const x = tsMs;
    let up = false;
    const pm1  = pickPm(vals, "pm1");
    const pm25 = pickPm(vals, "pm25");
    const pm10 = pickPm(vals, "pm10");
    if (pm1  !== null) up = pmsAddPoint(0, { x, y: pm1 })  || up;
    if (pm25 !== null) up = pmsAddPoint(1, { x, y: pm25 }) || up;
    if (pm10 !== null) up = pmsAddPoint(2, { x, y: pm10 }) || up;
    if (up) pmsChart.update("none");
    return up;
  }

  function normalizePmsHistory(obj) {
    const pm1Pts = [], pm25Pts = [], pm10Pts = [];
    const keys = Object.keys(obj);
    // Diagnostic: dump first record so we can see the real structure
    if (keys.length > 0) {
      console.log("[pms-diag] records:", keys.length, "| first:", JSON.stringify(obj[keys[0]]).slice(0, 400));
    }
    let extracted = 0;
    for (const k of keys) {
      const r = obj[k];
      if (!r) continue;
      const rawTs = r.ts != null ? r.ts : (isFinite(Number(k)) ? Number(k) : null);
      const tsMs = tsToMs(rawTs);
      if (!tsMs) continue;
      const x = tsMs;
      const pm1  = pickPm(r, "pm1");
      const pm25 = pickPm(r, "pm25");
      const pm10 = pickPm(r, "pm10");
      if (pm1  !== null) { pm1Pts.push({ x, y: pm1 });  extracted++; }
      if (pm25 !== null) { pm25Pts.push({ x, y: pm25 }); extracted++; }
      if (pm10 !== null) { pm10Pts.push({ x, y: pm10 }); extracted++; }
    }
    console.log("[pms-diag] extracted", extracted, "points → pm1:", pm1Pts.length, "pm25:", pm25Pts.length, "pm10:", pm10Pts.length);
    pm1Pts.sort((a, b) => a.x - b.x);
    pm25Pts.sort((a, b) => a.x - b.x);
    pm10Pts.sort((a, b) => a.x - b.x);
    return { pm1Pts, pm25Pts, pm10Pts };
  }

  async function pmsLoadDay(dateStr) {
    const token = ++pmsLoadToken;
    if ($pmsModeInfo) $pmsModeInfo.textContent = `Wybrany dzień: ${dateStr}`;
    pmsShowOverlay("loading");
    pmsClearChart(false);
    pmsSetDay(dateStr);

    try {
      // ---- 1. Try historyByDay (same as main chart) ----
      console.log("[pms-diag] Loading day:", dateStr, "path:", HISTORY_BY_DAY_PATH(dateStr));
      const snap = await db.ref(HISTORY_BY_DAY_PATH(dateStr)).get();
      if (token !== pmsLoadToken) return;
      const dayObj = snap.val();
      console.log("[pms-diag] historyByDay exists:", !!dayObj, dayObj ? Object.keys(dayObj).length + " keys" : "");

      if (dayObj) {
        const { pm1Pts, pm25Pts, pm10Pts } = normalizePmsHistory(dayObj);
        if (pm1Pts.length || pm25Pts.length || pm10Pts.length) {
          pmsSetData(pm1Pts, pm25Pts, pm10Pts);
          return;
        }
        console.log("[pms-diag] historyByDay had data but no PM values, trying fallback...");
      }

      // ---- 2. Fallback: raw history (same path as main chart) ----
      console.log("[pms-diag] Fallback: reading", HISTORY_FALLBACK_PATH);
      const fbSnap = await db.ref(HISTORY_FALLBACK_PATH).limitToLast(5000).get();
      if (token !== pmsLoadToken) return;
      const fbObj = fbSnap.val();
      console.log("[pms-diag] fallback exists:", !!fbObj, fbObj ? Object.keys(fbObj).length + " keys" : "");

      if (!fbObj) {
        pmsShowOverlay("error");
        if ($pmsDataDensity) $pmsDataDensity.textContent = "brak próbek";
        return;
      }

      // Filter to selected day using local midnight
      const filtered = {};
      const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
      const dayEnd = dayStart + 86400000;
      for (const k of Object.keys(fbObj)) {
        const r = fbObj[k];
        if (!r) continue;
        const rawTs = r.ts != null ? r.ts : (isFinite(Number(k)) ? Number(k) : null);
        const tsMs = tsToMs(rawTs);
        if (!tsMs) continue;
        if (tsMs >= dayStart && tsMs < dayEnd) filtered[k] = r;
      }
      console.log("[pms-diag] filtered for day:", Object.keys(filtered).length, "records (range", dayStart, "-", dayEnd, ")");

      if (!Object.keys(filtered).length) {
        pmsShowOverlay("error");
        if ($pmsDataDensity) $pmsDataDensity.textContent = "brak próbek";
        return;
      }

      const { pm1Pts, pm25Pts, pm10Pts } = normalizePmsHistory(filtered);
      if (pm1Pts.length || pm25Pts.length || pm10Pts.length) {
        pmsSetData(pm1Pts, pm25Pts, pm10Pts);
      } else {
        // Data exists but no PM fields found – show error without hiding overlay
        pmsShowOverlay("error");
        if ($pmsDataDensity) $pmsDataDensity.textContent = "brak próbek";
      }
    } catch (err) {
      console.error("[pms] load error:", err);
      pmsShowOverlay("error");
    }
  }

  // --- Calendar ---
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
      const f = document.createElement("div");
      f.className = "day muted";
      f.setAttribute("aria-hidden", "true");
      $pmsCalGrid.appendChild(f);
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

  // Calendar navigation
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

  // --- Subscribe to live PMS data ---
  function pmsSubscribeLive() {
    const ref = db.ref(`devices/${DEVICE_ID}/latest`);
    ref.on("value", (snap) => {
      const v = snap.val();
      if (!v) return;
      // Prefer Atmospheric (A) calibration, fallback to Factory (F)
      const calib = v.A || v.F;
      // Update live cards
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
      // Append to chart if showing today – pass the FULL record so pickPm can find A/F
      const ts = Number(v.ts) || null;
      if (ts) pmsAppendRealtime(ts, v);
    });
  }

  // --- Pan buttons & wheel for PMS chart frame ---
  if (pmsChartFrame) {
    const panBtns = pmsChartFrame.querySelectorAll("[data-pms-pan]");
    panBtns.forEach((btn) => {
      // ensure button receives clicks even if CSS hides controls by default
      try { btn.style.pointerEvents = 'auto'; } catch (e) {}
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const dir = Number(btn.dataset.pmsPan);
        console.log("[pms] control click, dir=", dir);
        pmsPan(dir, 1.5);
      });
    });
    pmsChartFrame.addEventListener("wheel", pmsWheel, { passive: false });
  }

  // --- Bootstrap PMS chart (wait for zoom plugin, same as main) ---
  ensureZoomPluginRegistered()
    .catch(() => null)
    .then(async () => {
      pmsChart = buildPmsChart();
      setupPmsGestures();
      pmsRenderCal();
      pmsSubscribeLive();
      await pmsLoadDay(toDateStr(pmsSelectedDate));

      // Set initial zoom window (same logic as main chart)
      let latest = 0;
      pmsChart.data.datasets.forEach((ds) =>
        (ds.data || []).forEach((pt) => { if (pt && pt.x > latest) latest = pt.x; })
      );
      if (!latest) latest = Date.now();
      const pad = computeRightPadding(REALTIME_WINDOW_MS);
      const end = Math.max(pmsDayStart + MIN_WINDOW_MS, latest - pad);
      const start = Math.max(pmsDayStart, end - INITIAL_ZOOM_MS);
      pmsUpdateWindow(start, end);
      for (let i = 0; i < INITIAL_PAN_STEPS; i++) pmsPan(1);
    })
    .catch((err) => {
      console.warn("[pms] chart init error:", err?.message || err);
      // still try to render calendar
      pmsRenderCal();
    });
})();