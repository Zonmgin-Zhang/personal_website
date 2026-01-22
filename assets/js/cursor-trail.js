/* Cursor trail effect (mouse only): large colorful mosaic blocks.
 * - Disabled on touch devices and when prefers-reduced-motion is set
 * - Non-interactive overlay (pointer-events: none)
 */

(() => {
  const prefersReducedMotion =
    window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const noHover = window.matchMedia && window.matchMedia("(hover: none)").matches;
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
    last: null,
    // grid / effect tuning
    cell: 22, // px (CSS pixels)
    radius: 220, // px (CSS pixels)
    stampsPerMove: 18,
    ttl: 850, // ms
    // tiles stored by cell key
    tiles: new Map(),
  };

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function resize() {
    state.dpr = clamp(window.devicePixelRatio || 1, 1, 2);
    state.w = Math.floor(window.innerWidth * state.dpr);
    state.h = Math.floor(window.innerHeight * state.dpr);
    canvas.width = state.w;
    canvas.height = state.h;
  }

  function snapToCell(v) {
    return Math.floor(v / state.cell) * state.cell;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function randomHue(baseHue) {
    // keep it colorful but stable-ish along a trail
    const jitter = rand(-80, 80);
    return (baseHue + jitter + 360) % 360;
  }

  function stampAt(x, y, now) {
    // x/y are CSS pixels
    const cx = snapToCell(x);
    const cy = snapToCell(y);
    const key = `${cx},${cy}`;

    const baseHue = (now * 0.04) % 360;
    const hue = randomHue(baseHue);
    const sat = 92;
    const light = rand(55, 70);

    state.tiles.set(key, {
      cx,
      cy,
      born: now,
      hue,
      sat,
      light,
      // slight size variance per tile
      size: state.cell * rand(0.85, 1.05),
    });
  }

  function stampMosaicAround(x0, y0, x1, y1) {
    const now = performance.now();
    // interpolate along the pointer path, so slow movement still leaves a dense trail
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.min(10, Math.floor(dist / 14)));

    for (let s = 0; s < steps; s++) {
      const t = steps === 1 ? 1 : (s + 1) / steps;
      const x = x0 + dx * t;
      const y = y0 + dy * t;

      for (let i = 0; i < state.stampsPerMove; i++) {
        const a = rand(0, Math.PI * 2);
        const r = Math.sqrt(Math.random()) * state.radius; // uniform in circle
        const sx = x + Math.cos(a) * r;
        const sy = y + Math.sin(a) * r;
        stampAt(sx, sy, now + i); // tiny offset => subtle hue variation
      }
    }
  }

  function onPointerMove(e) {
    if (e.pointerType !== "mouse") return;
    const x = e.clientX;
    const y = e.clientY;

    if (state.last) {
      stampMosaicAround(state.last.x, state.last.y, x, y);
    } else {
      stampMosaicAround(x, y, x, y);
    }

    state.last = { x, y };
  }

  function tick(now) {
    ctx.clearRect(0, 0, state.w, state.h);
    ctx.globalCompositeOperation = "source-over";

    const dead = [];
    for (const [key, tile] of state.tiles) {
      const age = now - tile.born;
      const t = clamp(age / state.ttl, 0, 1);
      const alpha = 1 - t;
      if (alpha <= 0.001) {
        dead.push(key);
        continue;
      }

      const cx = tile.cx * state.dpr;
      const cy = tile.cy * state.dpr;
      const size = tile.size * state.dpr;
      const pad = 1.2 * state.dpr;

      // a "blocky but soft" look: filled square + faint outline
      ctx.fillStyle = `hsla(${tile.hue}, ${tile.sat}%, ${tile.light}%, ${0.38 * alpha})`;
      ctx.fillRect(cx, cy, size, size);

      ctx.strokeStyle = `hsla(${tile.hue}, ${tile.sat}%, ${tile.light + 10}%, ${0.25 * alpha})`;
      ctx.lineWidth = 1 * state.dpr;
      ctx.strokeRect(cx + pad, cy + pad, Math.max(0, size - 2 * pad), Math.max(0, size - 2 * pad));
    }

    for (const key of dead) state.tiles.delete(key);
    requestAnimationFrame(tick);
  }

  // Init
  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener("pointermove", onPointerMove, { passive: true });

  requestAnimationFrame(tick);
})();

