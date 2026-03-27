(function autoSizePmEmbed() {
  const iframe = document.getElementById("pmEmbed");
  if (!iframe) return;

  const timeoutIds = [];
  let embeddedWindow = null;

  const resize = () => {
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !doc.body || !doc.documentElement) return;
      const height = Math.max(
        doc.body.scrollHeight,
        doc.documentElement.scrollHeight,
        doc.body.offsetHeight,
        doc.documentElement.offsetHeight
      );
      iframe.style.height = `${height}px`;
    } catch (error) {
      // same-origin should allow access; ignore if frame is not ready yet
    }
  };

  const scheduleResize = (delay) => {
    timeoutIds.push(window.setTimeout(resize, delay));
  };

  const handleLoad = () => {
    resize();
    try {
      embeddedWindow = iframe.contentWindow || null;
      embeddedWindow?.addEventListener("resize", resize);
    } catch (error) {
      // ignore
    }
    scheduleResize(150);
    scheduleResize(600);
  };

  const cleanup = () => {
    iframe.removeEventListener("load", handleLoad);
    window.removeEventListener("resize", resize);

    try {
      embeddedWindow?.removeEventListener("resize", resize);
    } catch (error) {
      // ignore
    }

    embeddedWindow = null;
    timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIds.splice(0);
  };

  iframe.addEventListener("load", handleLoad);
  window.addEventListener("resize", resize);
  window.addEventListener("beforeunload", cleanup);
  scheduleResize(1000);
})();