function setupTitleAnimation() {
  const titleTexts = document.querySelectorAll(".title-text");
  if (!titleTexts || titleTexts.length === 0) return;

  const defaultText = "T I C K I N G • B O M B";

  titleTexts.forEach((titleText) => {
    try {
      if (titleText.dataset.animated === "true") return;
      const raw = titleText.dataset.title || defaultText;
      const text = String(raw);
      titleText.setAttribute("aria-label", text.replace(/\s+/g, ""));
      titleText.dataset.animated = "true";
      titleText.textContent = "";

      text.split("").forEach((ch, idx) => {
        const span = document.createElement("span");
        span.className = "title-letter";
        span.textContent = ch === " " ? "\u00a0" : ch;
        span.style.animationDelay = `${idx * 0.08}s`;
        titleText.appendChild(span);

        setTimeout(() => span.classList.add("animate"), 50 + idx * 8);
      });
    } catch (err) {
      console.warn("Title animation failed for element", titleText, err);
    }
  });
}

function applyMotionSetting(enabled) {
  document.documentElement.classList.toggle("motion-off", !enabled);
  const toggleMotion = document.getElementById("toggleMotion");
  if (!toggleMotion) return;
  toggleMotion.textContent = enabled ? "Animacje: włączone" : "Animacje: wyłączone";
  toggleMotion.setAttribute("aria-pressed", (!enabled).toString());
}

function toast(message, tone = "info") {
  const toastEl = document.getElementById("toast");
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.className = `toast show ${tone}`;
  setTimeout(() => toastEl.classList.remove("show"), 2800);
}

function pushAlert(message, tone = "warn") {
  const alertStack = document.getElementById("alertStack");
  if (!alertStack) return;
  const div = document.createElement("div");
  div.className = `alert ${tone}`;
  div.textContent = message;
  alertStack.prepend(div);
  setTimeout(() => div.remove(), 6500);
}

function resetCards() {
  ["tempValue", "humValue", "pressValue"].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.textContent = "--";
  });
  ["tempMeta", "humMeta", "pressMeta"].forEach((id) => {
    const node = document.getElementById(id);
    if (node) node.textContent = "Czekam na dane";
  });
}