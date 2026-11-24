// The red squares that follow a White edit, in the browser: the same rule as pipeline/edit_squares.py.
// A cell (24 units) is ink when the edit covers more than half of it; a cell Borger inked stays ink down to 15 %
// coverage, one he left empty stays empty up to 85 %. On Borger's grid where he has squares, else on the edit's own.
window.AtelierSquares = (function () {
  const U = 24, RES = 2, ON = 0.5, KEEP_ON = 0.15, KEEP_OFF = 0.85;
  const mod = (a, n) => ((a % n) + n) % n;
  function points(cs) { const out = []; for (const c of cs) for (let i = 0; i + 1 < c.length; i += 2) out.push([c[i], c[i + 1]]); return out; }
  function phase(cs) {
    const cx = new Map(), cy = new Map();
    for (const [x, y] of points(cs)) { const a = mod(Math.round(x), U), b = mod(Math.round(y), U); cx.set(a, (cx.get(a) || 0) + 1); cy.set(b, (cy.get(b) || 0) + 1); }
    const best = m => [...m.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0])[0][0];
    return [best(cx), best(cy)];
  }
  function coverage(cs, x0, y1, nx, ny) {
    const s = U / RES, W = nx * s, H = ny * s;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true }); const p = new Path2D();
    for (const c of cs) {
      if (c.length < 6) continue;
      p.moveTo((c[0] - x0) / RES, (y1 - c[1]) / RES);
      for (let i = 2; i + 1 < c.length; i += 2) p.lineTo((c[i] - x0) / RES, (y1 - c[i + 1]) / RES);
      p.closePath();
    }
    ctx.fillStyle = '#000'; ctx.fill(p, 'nonzero');
    const a = ctx.getImageData(0, 0, W, H).data, cov = new Float32Array(nx * ny);
    for (let py = 0; py < H; py++) { const r = (py / s) | 0; for (let px = 0; px < W; px++) cov[r * nx + ((px / s) | 0)] += a[(py * W + px) * 4 + 3] / 255; }
    for (let i = 0; i < cov.length; i++) cov[i] /= s * s;
    return cov;
  }
  // outline loops of a set of cells (grid corners), collinear points removed
  function contours(cells, nx, ny, x0, y1) {
    const on = (r, c) => r >= 0 && c >= 0 && r < ny && c < nx && cells[r * nx + c];
    const edges = new Map(), key = (x, y) => x + ',' + y, add = (a, b) => { const k = key(...a); if (!edges.has(k)) edges.set(k, []); edges.get(k).push(b); };
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
      if (!on(r, c)) continue;
      if (!on(r - 1, c)) add([c, r], [c + 1, r]);
      if (!on(r, c + 1)) add([c + 1, r], [c + 1, r + 1]);
      if (!on(r + 1, c)) add([c + 1, r + 1], [c, r + 1]);
      if (!on(r, c - 1)) add([c, r + 1], [c, r]);
    }
    const out = [];
    for (const [k0] of edges) {
      while (edges.get(k0) && edges.get(k0).length) {
        const loop = []; let k = k0;
        while (edges.get(k) && edges.get(k).length) {
          const [x, y] = k.split(',').map(Number); loop.push([x, y]);
          const nxt = edges.get(k).pop(); if (!edges.get(k).length) edges.delete(k); k = key(...nxt);
          if (k === k0) break;
        }
        const pts = loop.filter((p, i) => { const a = loop[(i - 1 + loop.length) % loop.length], b = loop[(i + 1) % loop.length]; return !((a[0] === p[0] && p[0] === b[0]) || (a[1] === p[1] && p[1] === b[1])); });
        if (pts.length >= 3) out.push(pts.flatMap(([x, y]) => [x0 + x * U, y1 - y * U]));
      }
    }
    return out;
  }
  // -> new squares (contours) or null when they would be Borger's own
  function squares(edit, borger) {
    const E = (edit || []).filter(c => c.length >= 6), B = (borger || []).filter(c => c.length >= 6);
    if (!E.length) return null;
    let px, py, onGrid = false;
    if (B.length) { const [bx, by] = phase(B); onGrid = points(B).every(([x, y]) => mod(Math.round(x), U) === bx && mod(Math.round(y), U) === by); if (onGrid) { px = bx; py = by; } }
    if (!onGrid) [px, py] = phase(E);
    const all = points(E.concat(B)), xs = all.map(p => p[0]), ys = all.map(p => p[1]);
    const x0 = Math.floor((Math.min(...xs) - px) / U) * U + px - U, x1 = Math.max(...xs) + U;
    const y0 = Math.floor((Math.min(...ys) - py) / U) * U + py - U, y1 = Math.floor((Math.max(...ys) - py) / U) * U + py + 2 * U;
    const nx = Math.ceil((x1 - x0) / U), ny = Math.ceil((y1 - y0) / U);
    const ce = coverage(E, x0, y1, nx, ny), cells = new Uint8Array(nx * ny);
    let changed = -1;
    if (onGrid) {
      const cb = coverage(B, x0, y1, nx, ny); changed = 0;
      for (let i = 0; i < cells.length; i++) { const o = cb[i] > 0.5; cells[i] = o ? ce[i] >= KEEP_ON : ce[i] > KEEP_OFF; if (!!cells[i] !== o) changed++; }
    } else for (let i = 0; i < cells.length; i++) cells[i] = ce[i] > ON;
    return changed === 0 ? null : contours(cells, nx, ny, x0, y1);
  }
  return { squares };
})();
