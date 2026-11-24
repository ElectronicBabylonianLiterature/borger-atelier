// "+ New sign": a sign the fonts do not have yet (a Unicode sign Borger did not draw, a new PUA sign, a sequence),
// started as a copy of an existing sign or empty. Kept in the collection signs/<glyph>.json {n, l, a, w, b, p, …};
// the font build adds it to all three families (encoded; a sequence becomes a ligature), and its White and Black
// edits work as for every other sign.
(function () {
  function hexName(s) {
    const parts = String(s || '').trim().toUpperCase().replace(/^U\+/, '').split(/[\s._+-]+/).map(p => p.replace(/^U\+?/, '')).filter(Boolean);
    if (!parts.length || !parts.every(p => /^[0-9A-F]{4,6}$/.test(p))) return null;
    return parts.map(p => 'u' + p).join('_');
  }
  async function newSign() {
    if (!db) { setStatus('Not connected: cannot add a sign', true); return; }
    const n = hexName(prompt('Code point of the new sign (hex), e.g. 12201, a free PUA such as 1000C3,\nor a sequence such as 12313-121A4:'));
    if (!n) return;
    if (byName.has(n)) { alert(n + ' is in the fonts already: it opens now.'); open(n); return; }
    const label = (prompt('Name of the sign (shown in the list), e.g. |LAM×KUR|+RU or MZL 531:') || '').trim() || n;
    const srcIn = prompt('Start from a copy of which sign? Its code point (e.g. 121F5), or leave empty for an empty sign:');
    const src = srcIn && srcIn.trim() ? hexName(srcIn) : null;
    if (srcIn && srcIn.trim() && (!src || !byName.has(src))) { alert('No sign ' + srcIn + ' in the atelier.'); return; }
    const g0 = src ? byName.get(src) : null;
    const copy = cs => (cs || []).map(c => c.slice());
    const w = g0 ? copy(contoursOf(src, 'w')) : [], b = g0 ? copy(contoursOf(src, 'b')) : [];
    const xMax = Math.max(0, ...w.map(c => Math.max(...c.filter((_, i) => !(i % 2)))));
    const a = g0 ? Math.ceil((xMax + 2 * DATA.unit) / DATA.unit) * DATA.unit : 20 * DATA.unit;
    const g = { n, l: label, sn: label, a, w, b, p: g0 ? copy(g0.r || g0.p) : [], q: [], mz: [], gl: [], go: '', lig: n.includes('_'),
                gen: true, added: true, from: src || '', createdAt: new Date().toISOString() };
    try { setStatus('Adding ' + n + '…'); await db.doc('signs/' + n).set(g); }
    catch (e) { setStatus('Sign not added', true); return; }
    if (!byName.has(n)) { G.push(g); byName.set(n, g); }
    renderList(); open(n); setStatus('Added ' + n + (src ? ' (copy of ' + src + ')' : ''));
  }
  // signs added earlier (collection signs/): into the list
  window.atelierAddSigns = function (docs) {
    const go = () => {
      if (typeof byName === 'undefined' || !byName.size) return setTimeout(go, 100);
      let k = 0;
      for (const g of docs) if (g && g.n && !byName.has(g.n)) { G.push(g); byName.set(g.n, g); k++; }
      if (k && typeof renderList === 'function') renderList();
    };
    go();
  };
  window.addEventListener('load', () => {
    const head = document.querySelector('aside .head .counts'); if (!head) return;
    const bt = document.createElement('button'); bt.id = 'new-sign'; bt.textContent = '+ New sign';
    bt.title = 'Add a sign the fonts do not have yet (copy of an existing sign, or empty); the font build adds it';
    bt.style.cssText = 'font-size:12px;padding:2px 8px'; bt.onclick = newSign; head.appendChild(bt);
  });
})();
