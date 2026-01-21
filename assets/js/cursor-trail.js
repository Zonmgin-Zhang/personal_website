/* Cursor trail effect (mouse only)
 * - Disabled on touch devices and when prefers-reduced-motion is set
 * - Non-interactive overlay (pointer-events: none)
 */

(() => {
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const noHover =
    window.matchMedia && window.matchMedia("(hover: none)").matches;
  const hasTouch =
    (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
    (navigator.msMaxTouchPoints && navigator.msMaxTouchPoints > 0);

  if (prefersReducedMotion || noHover || hasTouch) return;

  const canvas = document.createElement("canvas");
  canvas.id = "cursor-trail-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  const state = {
    dpr: 1,
    w: 0,
    h: 0,
    points: [],
    maxPoints: 140,
    last: null,
    rgb: { r: 120, g: 180, b: 255 }, // fallback
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function hexToRgb(hex) {
    const h = (hex || "").trim();
    if (!h.startsWith("#")) return null;
    const s = h.slice(1);
    if (s.length !== 6) return null;
    const n = Number.parseInt(s, 16);
    if (Number.isNaN(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function updateThemeColor() {
    const root = document.documentElement;
    const styles = window.getComputedStyle(root);
    const color = styles.getPropertyValue("--global-theme-color");
    const rgb = hexToRgb(color);
    if (rgb) state.rgb = rgb;
  }

  function resize() {
    state.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    state.w = Math.floor(window.innerWidth * state.dpr);
    state.h = Math.floor(window.innerHeight * state.dpr);
    canvas.width = state.w;
    canvas.height = state.h;
  }

  function pushPoint(x, y) {
    const now = performance.now();
    state.points.push({
      x: x * state.dpr,
      y: y * state.dpr,
      r: (1.6 + Math.random() * 1.8) * state.dpr,
      a: 1,
      born: now,
      ttl: 550 + Math.random() * 250, // ms
      vx: (Math.random() - 0.5) * 0.15 * state.dpr,
      vy: (Math.random() - 0.5) * 0.15 * state.dpr,
    });

    if (state.points.length > state.maxPoints) {
      state.points.splice(0, state.points.length - state.maxPoints);
    }
  }

  function spawnAlongLine(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const step = 10; // px
    const n = Math.max(1, Math.min(12, Math.floor(dist / step)));
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 1 : (i + 1) / n;
      pushPoint(x0 + dx * t, y0 + dy * t);
    }
  }

  function onPointerMove(e) {
    if (e.pointerType !== "mouse") return;
    const x = e.clientX;
    const y = e.clientY;

    if (state.last) {
      spawnAlongLine(state.last.x, state.last.y, x, y);
    } else {
      pushPoint(x, y);
    }

    state.last = { x, y };
  }

  function tick(now) {
    ctx.clearRect(0, 0, state.w, state.h);

    // Slight glow by additive blending
    ctx.globalCompositeOperation = "lighter";

    const { r, g, b } = state.rgb;
    const next = [];

    for (const p of state.points) {
      const age = now - p.born;
      const t = clamp(age / p.ttl, 0, 1);
      const alpha = 1 - t;
      if (alpha <= 0) continue;

      // tiny drift
      p.x += p.vx;
      p.y += p.vy;

      const radius = p.r * (0.9 + 0.25 * (1 - t));
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${0.35 * alpha})`;
      ctx.fill();

      next.push(p);
    }

    state.points = next;
    requestAnimationFrame(tick);
  }

  // Init
  updateThemeColor();
  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // Track dark/light mode toggles
  const mo = new MutationObserver(updateThemeColor);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  requestAnimationFrame(tick);
})();

