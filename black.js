// Black Heads from a White Heads edit, in the browser: the rule of pipeline/recovered/w2b.py (which the font build
// uses). A hollow of the White is filled when it is a head hollow: either the generated White of this sign has the
// same hollow (overlap > 60 %) and the generated Black fills it, or it is new and as small as an element head's
// hollow (< 6000 units²). Every other hollow stays open.
// Needs polygon-clipping (polygonClipping).
window.AtelierBlack = (function () {
  const SMALL = 6000;
  const ring = c => { const r = []; for (let i = 0; i + 1 < c.length; i += 2) r.push([c[i], c[i + 1]]); return r; };
  const signed = c => { let s = 0; const n = c.length / 2; for (let i = 0; i < n; i++) { const j = (i + 1) % n; s += c[2 * i] * c[2 * j + 1] - c[2 * j] * c[2 * i + 1]; } return s / 2; };
  const ringArea = r => { let s = 0; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; s += p[0] * q[1] - q[0] * p[1]; } return Math.abs(s / 2); };
  const mpArea = mp => mp.reduce((s, poly) => s + poly.reduce((t, r, i) => t + (i ? -1 : 1) * ringArea(r), 0), 0);
  function hollows(cs) {
    const tot = cs.reduce((s, c) => s + signed(c), 0), outer = tot > 0 ? 1 : -1;
    return cs.filter(c => c.length >= 6 && signed(c) * outer < 0);
  }
  // nonzero winding of a point in a set of contours (contours may overlap, as the HI model writes them)
  function winding(x, y, cs) {
    let w = 0;
    for (const c of cs) {
      const n = c.length / 2;
      for (let i = 0; i < n; i++) {
        const x1 = c[2 * i], y1 = c[2 * i + 1], j = (i + 1) % n, x2 = c[2 * j], y2 = c[2 * j + 1];
        if (y1 <= y) { if (y2 > y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) > 0) w++; }
        else if (y2 <= y && (x2 - x1) * (y - y1) - (x - x1) * (y2 - y1) < 0) w--;
      }
    }
    return w;
  }
  // share of a hollow (ring) that is ink in the contours cs: sampled on a 3-unit grid inside the ring
  function inkShare(r, cs) {
    const xs = r.map(p => p[0]), ys = r.map(p => p[1]), rr = [r.flat()];
    let n = 0, k = 0;
    for (let y = Math.min(...ys) + 1.5; y < Math.max(...ys); y += 3)
      for (let x = Math.min(...xs) + 1.5; x < Math.max(...xs); x += 3)
        if (winding(x, y, rr) !== 0) { n++; if (winding(x, y, cs) !== 0) k++; }
    return n ? k / n : 0;
  }
  function iou(a, b) {
    const i = mpArea(polygonClipping.intersection(a, b)), u = mpArea(polygonClipping.union(a, b));
    return u ? i / u : 0;
  }
  // white: contours of the edit; wRef, bRef: the generated White and Black of the sign (may be empty)
  function fromWhite(white, wRef, bRef) {
    const w = (white || []).filter(c => c.length >= 6);
    const b = (bRef || []).filter(c => c.length >= 6), refs = [];
    for (const c of hollows((wRef || []).filter(c => c.length >= 6))) {
      const q = [[ring(c)]], a = ringArea(ring(c)); if (a < 1) continue;
      refs.push({ q, fill: b.length > 0 && inkShare(ring(c), b) > 0.9 });      // the generated Black fills this hollow
    }
    const drop = new Set();
    for (const c of hollows(w)) {
      const q = [[ring(c)]], a = ringArea(ring(c)); if (a < 1) continue;
      let best = null, bi = 0;
      for (const r of refs) { const v = iou(q, r.q); if (v > bi) { bi = v; best = r; } }
      const fill = best && bi > 0.6 ? best.fill : a < SMALL;
      if (fill) drop.add(c);
    }
    // filled as w2b does (union with the hollow's area): the hollow's contour stays and the same shape is added as
    // ink, turning the other way (nonzero: inside it the counts cancel to ink)
    const rev = c => { const o = []; for (let i = c.length - 2; i >= 0; i -= 2) o.push(c[i], c[i + 1]); return o; };
    return w.map(c => c.slice()).concat([...drop].map(rev));
  }
  return { fromWhite };
})();
