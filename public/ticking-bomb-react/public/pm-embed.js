(function autoSizePmEmbed() {
  const iframe = document.getElementById("pmEmbed");
  if (!iframe) return;

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

  iframe.addEventListener("load", () => {
    resize();
    try {
      const win = iframe.contentWindow;
      win?.addEventListener("resize", resize);
    } catch (error) {
      // ignore
    }
    window.setTimeout(resize, 150);
    window.setTimeout(resize, 600);
  });

  window.addEventListener("resize", resize);
  window.setTimeout(resize, 1000);
})();