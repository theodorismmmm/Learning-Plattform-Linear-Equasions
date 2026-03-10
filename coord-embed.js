'use strict';

/* ══════════════════════════════════════════════
   CoordEmbed – Self-contained coordinate system
   Adapted from MathSpaces (qqq/app.js) canvas logic
   ══════════════════════════════════════════════ */

class CoordEmbed {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Viewport defaults
    this.xMin = options.xMin !== undefined ? options.xMin : -10;
    this.xMax = options.xMax !== undefined ? options.xMax : 10;
    this.yMin = options.yMin !== undefined ? options.yMin : -10;
    this.yMax = options.yMax !== undefined ? options.yMax : 10;

    // Functions to plot: [{expr: '2x+1', color: '#cc0000'}]
    this.functions = (options.functions || []).map((f, i) => ({
      expr: typeof f === 'string' ? f : f.expr,
      color: typeof f === 'string' ? this._funcColor(i) : (f.color || this._funcColor(i))
    }));

    // Pre-placed points: [{x, y, label}]
    this.points = (options.points || []).map(p => ({ ...p }));

    // Interaction
    this.interactive = options.interactive !== false;
    this.readOnly = options.readOnly === true;
    this.onPointPlaced = options.onPointPlaced || null;

    // State
    this.placedPoint = null;
    this.hoverCoord = null;
    this._rafId = null;
    this._dirty = true;

    // Pan/zoom state
    this._isPanning = false;
    this._panStart = null;
    this._panOrigin = null;

    // Bind events
    this._bindEvents();

    // Initial resize + draw
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _funcColor(i) {
    const colors = ['#cc0000', '#0066ff', '#00aa44', '#ff8800', '#aa00cc'];
    return colors[i % colors.length];
  }

  // ── Coordinate transforms ─────────────────────────────────────────
  _toCanvasX(x) {
    return ((x - this.xMin) / (this.xMax - this.xMin)) * this.canvas.width;
  }
  _toCanvasY(y) {
    return this.canvas.height - ((y - this.yMin) / (this.yMax - this.yMin)) * this.canvas.height;
  }
  _fromCanvasX(px) {
    return this.xMin + (px / this.canvas.width) * (this.xMax - this.xMin);
  }
  _fromCanvasY(py) {
    return this.yMin + ((this.canvas.height - py) / this.canvas.height) * (this.yMax - this.yMin);
  }

  // ── Resize ───────────────────────────────────────────────────────
  _resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = rect.width || 300;
    const h = rect.height || 280;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.scale(dpr, dpr);
    this._dirty = true;
    this._schedDraw();
  }

  // ── Event binding ────────────────────────────────────────────────
  _bindEvents() {
    const c = this.canvas;

    // Hover — show coordinates
    c.addEventListener('mousemove', e => {
      const r = c.getBoundingClientRect();
      const x = this._fromCanvasX((e.clientX - r.left) * (c.width / r.width));
      const y = this._fromCanvasY((e.clientY - r.top) * (c.height / r.height));
      this.hoverCoord = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
      this._dirty = true;
      this._schedDraw();

      // Pan
      if (this._isPanning && !this.readOnly) {
        const dx = this._fromCanvasX((e.clientX - r.left) * (c.width / r.width)) - this._panStart.x;
        const dy = this._fromCanvasY((e.clientY - r.top) * (c.height / r.height)) - this._panStart.y;
        this.xMin = this._panOrigin.xMin - dx;
        this.xMax = this._panOrigin.xMax - dx;
        this.yMin = this._panOrigin.yMin - dy;
        this.yMax = this._panOrigin.yMax - dy;
        this._dirty = true;
        this._schedDraw();
      }
    });

    c.addEventListener('mouseleave', () => {
      this.hoverCoord = null;
      this._dirty = true;
      this._schedDraw();
    });

    // Click — place answer point (if interactive)
    c.addEventListener('click', e => {
      if (!this.interactive || this.readOnly) return;
      const r = c.getBoundingClientRect();
      const x = this._fromCanvasX((e.clientX - r.left) * (c.width / r.width));
      const y = this._fromCanvasY((e.clientY - r.top) * (c.height / r.height));
      const rx = Math.round(x * 10) / 10;
      const ry = Math.round(y * 10) / 10;
      this.placedPoint = { x: rx, y: ry };
      this._dirty = true;
      this._schedDraw();
      if (this.onPointPlaced) this.onPointPlaced(rx, ry);
    });

    // Pan: mousedown / mouseup
    if (!this.readOnly) {
      c.addEventListener('mousedown', e => {
        if (e.button !== 1 && !e.altKey) return; // middle-click or alt+drag to pan
        e.preventDefault();
        const r = c.getBoundingClientRect();
        const x = this._fromCanvasX((e.clientX - r.left) * (c.width / r.width));
        const y = this._fromCanvasY((e.clientY - r.top) * (c.height / r.height));
        this._isPanning = true;
        this._panStart = { x, y };
        this._panOrigin = { xMin: this.xMin, xMax: this.xMax, yMin: this.yMin, yMax: this.yMax };
      });
      window.addEventListener('mouseup', () => { this._isPanning = false; });

      // Scroll zoom
      c.addEventListener('wheel', e => {
        e.preventDefault();
        const r = c.getBoundingClientRect();
        const mx = this._fromCanvasX((e.clientX - r.left) * (c.width / r.width));
        const my = this._fromCanvasY((e.clientY - r.top) * (c.height / r.height));
        const factor = e.deltaY > 0 ? 1.1 : 0.9;
        this.xMin = mx + (this.xMin - mx) * factor;
        this.xMax = mx + (this.xMax - mx) * factor;
        this.yMin = my + (this.yMin - my) * factor;
        this.yMax = my + (this.yMax - my) * factor;
        this._dirty = true;
        this._schedDraw();
      }, { passive: false });

      // Touch support
      let lastTouches = null;
      c.addEventListener('touchstart', e => {
        lastTouches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
      });
      c.addEventListener('touchmove', e => {
        e.preventDefault();
        const touches = Array.from(e.touches).map(t => ({ x: t.clientX, y: t.clientY }));
        const r = c.getBoundingClientRect();
        if (touches.length === 1 && lastTouches && lastTouches.length === 1) {
          // Pan
          const dx = this._fromCanvasX((touches[0].x - r.left) * (c.width / r.width))
                   - this._fromCanvasX((lastTouches[0].x - r.left) * (c.width / r.width));
          const dy = this._fromCanvasY((touches[0].y - r.top) * (c.height / r.height))
                   - this._fromCanvasY((lastTouches[0].y - r.top) * (c.height / r.height));
          this.xMin -= dx; this.xMax -= dx;
          this.yMin -= dy; this.yMax -= dy;
        } else if (touches.length === 2 && lastTouches && lastTouches.length === 2) {
          // Pinch zoom
          const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
          const prevDist = dist(lastTouches[0], lastTouches[1]);
          const currDist = dist(touches[0], touches[1]);
          if (prevDist > 0) {
            const factor = prevDist / currDist;
            const cx = (touches[0].x + touches[1].x) / 2;
            const cy = (touches[0].y + touches[1].y) / 2;
            const mx = this._fromCanvasX((cx - r.left) * (c.width / r.width));
            const my = this._fromCanvasY((cy - r.top) * (c.height / r.height));
            this.xMin = mx + (this.xMin - mx) * factor;
            this.xMax = mx + (this.xMax - mx) * factor;
            this.yMin = my + (this.yMin - my) * factor;
            this.yMax = my + (this.yMax - my) * factor;
          }
        }
        lastTouches = touches;
        this._dirty = true;
        this._schedDraw();
      }, { passive: false });
    }
  }

  // ── Schedule a redraw (rAF-based) ────────────────────────────────
  _schedDraw() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      if (this._dirty) {
        this._draw();
        this._dirty = false;
      }
    });
  }

  // ── Main draw ────────────────────────────────────────────────────
  _draw() {
    const ctx = this.ctx;
    const W = this.canvas.width / (window.devicePixelRatio || 1);
    const H = this.canvas.height / (window.devicePixelRatio || 1);

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, W, H);

    this._drawGrid(ctx, W, H);
    this._drawAxes(ctx, W, H);

    // Plot functions
    this.functions.forEach(fn => {
      try { this._plotFunction(ctx, W, H, fn.expr, fn.color); } catch (e) { /* silent */ }
    });

    // Pre-placed labeled points
    this.points.forEach(p => this._drawPoint(ctx, W, H, p.x, p.y, p.label, '#00aaff'));

    // User-placed point
    if (this.placedPoint) {
      this._drawPoint(ctx, W, H, this.placedPoint.x, this.placedPoint.y,
        `(${this.placedPoint.x}, ${this.placedPoint.y})`, '#cc0000');
    }

    // Hover coordinate display
    if (this.hoverCoord) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(6, H - 26, 140, 20);
      ctx.fillStyle = '#9090b0';
      ctx.font = '11px monospace';
      ctx.fillText(`x=${this.hoverCoord.x}  y=${this.hoverCoord.y}`, 12, H - 12);
    }
  }

  _drawGrid(ctx, W, H) {
    const step = this._niceStep();
    ctx.strokeStyle = '#252540';
    ctx.lineWidth = 1;

    // Vertical grid lines
    const x0 = Math.ceil(this.xMin / step) * step;
    for (let x = x0; x <= this.xMax; x += step) {
      const px = this._toCanvasX(x);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, H);
      ctx.stroke();
    }

    // Horizontal grid lines
    const y0 = Math.ceil(this.yMin / step) * step;
    for (let y = y0; y <= this.yMax; y += step) {
      const py = this._toCanvasY(y);
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(W, py);
      ctx.stroke();
    }
  }

  _drawAxes(ctx, W, H) {
    const step = this._niceStep();
    const ox = this._toCanvasX(0);
    const oy = this._toCanvasY(0);

    ctx.strokeStyle = '#35355a';
    ctx.lineWidth = 1.5;

    // X axis
    if (oy >= 0 && oy <= H) {
      ctx.beginPath();
      ctx.moveTo(0, oy);
      ctx.lineTo(W, oy);
      ctx.stroke();
    }

    // Y axis
    if (ox >= 0 && ox <= W) {
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, H);
      ctx.stroke();
    }

    // Tick labels
    ctx.fillStyle = '#9090b0';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const x0 = Math.ceil(this.xMin / step) * step;
    for (let x = x0; x <= this.xMax; x += step) {
      if (Math.abs(x) < step * 0.01) continue;
      const px = this._toCanvasX(x);
      const ty = Math.min(Math.max(oy + 3, 3), H - 14);
      ctx.fillText(this._fmtNum(x), px, ty);
    }

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const y0 = Math.ceil(this.yMin / step) * step;
    for (let y = y0; y <= this.yMax; y += step) {
      if (Math.abs(y) < step * 0.01) continue;
      const py = this._toCanvasY(y);
      const tx = Math.min(Math.max(ox - 3, 3), W - 3);
      ctx.fillText(this._fmtNum(y), tx, py);
    }

    // Origin label
    if (ox >= 0 && ox <= W && oy >= 0 && oy <= H) {
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText('0', Math.max(ox - 3, 3), oy + 3);
    }

    // Axis arrows
    ctx.strokeStyle = '#9090b0';
    ctx.lineWidth = 1;
    const arr = 6;
    // X arrow
    if (oy >= 0 && oy <= H) {
      ctx.beginPath();
      ctx.moveTo(W - arr, oy - arr / 2);
      ctx.lineTo(W, oy);
      ctx.lineTo(W - arr, oy + arr / 2);
      ctx.stroke();
      ctx.fillStyle = '#9090b0';
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('x', W - 14, oy + 4);
    }
    // Y arrow
    if (ox >= 0 && ox <= W) {
      ctx.beginPath();
      ctx.moveTo(ox - arr / 2, arr);
      ctx.lineTo(ox, 0);
      ctx.lineTo(ox + arr / 2, arr);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillText('y', ox + 4, 2);
    }
  }

  _plotFunction(ctx, W, H, exprRaw, color) {
    const step = (this.xMax - this.xMin) / (W * 2); // 2 samples per pixel
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    let prevY = null;

    for (let x = this.xMin; x <= this.xMax + step; x += step) {
      let y;
      try { y = this._evalExpr(exprRaw, x); } catch (e) { started = false; continue; }
      if (!isFinite(y) || isNaN(y)) { started = false; prevY = null; continue; }

      // Jump detection: if slope is huge, lift pen
      if (prevY !== null && Math.abs(y - prevY) > (this.yMax - this.yMin) * 2) {
        started = false;
      }
      prevY = y;

      const px = this._toCanvasX(x);
      const py = this._toCanvasY(y);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  _drawPoint(ctx, W, H, x, y, label, color) {
    const px = this._toCanvasX(x);
    const py = this._toCanvasY(y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (label) {
      ctx.fillStyle = '#f0f0f0';
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, px + 7, py - 4);
    }
  }

  // ── Nice grid step ───────────────────────────────────────────────
  _niceStep() {
    const range = Math.max(this.xMax - this.xMin, this.yMax - this.yMin);
    const raw = range / 10;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / p;
    if (f < 1.5) return p;
    if (f < 3.5) return 2 * p;
    if (f < 7.5) return 5 * p;
    return 10 * p;
  }

  _fmtNum(n) {
    if (Number.isInteger(n)) return String(n);
    return parseFloat(n.toFixed(2)).toString();
  }

  // ── Expression evaluator ─────────────────────────────────────────
  // Supports: +, -, *, /, ^, x, abs(), sqrt(), sin(), cos(), implicit mult
  _evalExpr(raw, xVal) {
    // Normalize
    let expr = raw.trim()
      .toLowerCase()
      // Strip "y =" prefix if present
      .replace(/^y\s*=\s*/, '')
      // Implicit multiplication: 2x → 2*x, 2(… → 2*(…, x( → x*(
      .replace(/(\d)(x)/g, '$1*$2')
      .replace(/(\d)\(/g, '$1*(')
      .replace(/(x)\(/g, '$1*(')
      // Power operator
      .replace(/\^/g, '**')
      // trig / math functions
      .replace(/abs\(/g, 'Math.abs(')
      .replace(/sqrt\(/g, 'Math.sqrt(')
      .replace(/sin\(/g, 'Math.sin(')
      .replace(/cos\(/g, 'Math.cos(')
      .replace(/pi/g, String(Math.PI))
      .replace(/π/g, String(Math.PI));

    // Security: only allow safe characters
    const safe = expr.replace(/Math\.\w+/g, '').replace(/x/g, '0');
    if (!/^[\d\s\+\-\*\/\.\(\)]+$/.test(safe)) {
      throw new Error('unsafe expression');
    }

    // eslint-disable-next-line no-new-func
    return Function('"use strict"; var x=' + xVal + '; return (' + expr + ');')();
  }

  // ── Public API ───────────────────────────────────────────────────
  setFunctions(fns) {
    this.functions = fns.map((f, i) => ({
      expr: typeof f === 'string' ? f : f.expr,
      color: typeof f === 'string' ? this._funcColor(i) : (f.color || this._funcColor(i))
    }));
    this._dirty = true;
    this._schedDraw();
  }

  addPoint(x, y, label, color) {
    this.points.push({ x, y, label, color: color || '#00aaff' });
    this._dirty = true;
    this._schedDraw();
  }

  clearPoints() {
    this.points = [];
    this.placedPoint = null;
    this._dirty = true;
    this._schedDraw();
  }

  reset(xMin, xMax, yMin, yMax) {
    this.xMin = xMin !== undefined ? xMin : -10;
    this.xMax = xMax !== undefined ? xMax : 10;
    this.yMin = yMin !== undefined ? yMin : -10;
    this.yMax = yMax !== undefined ? yMax : 10;
    this._dirty = true;
    this._schedDraw();
  }

  getPlacedPoint() {
    return this.placedPoint;
  }

  redraw() {
    this._dirty = true;
    this._schedDraw();
  }
}
