// Borger Wedge Atelier on GitHub Pages: the page's data and its database live in the PRIVATE repository
// ElectronicBabylonianLiterature/ebl-api-data-preparation, branch 'atelier', and are read and written with the
// visitor's own GitHub token (kept only in this browser). This public site holds no data.
//   signs.b64, sep.json, ell.json, fonts/assurbanipal.ttf <- borger-fonts/pipeline/atelier/web/
//   collections white, black, guides, squares, signs     <- borger-fonts/pipeline/atelier-db/<collection>/<id>.json
// Every save is a commit on the branch (saves within 2 s go together); edits from elsewhere are fetched every minute.
(function () {
  const OWNER = 'ElectronicBabylonianLiterature', REPO = 'ebl-api-data-preparation';
  const qs = new URLSearchParams(location.search);
  const BRANCH = qs.get('branch') || 'atelier';
  const WEB = 'borger-fonts/pipeline/atelier/web/', DB = 'borger-fonts/pipeline/atelier-db/';
  const COLS = ['white', 'black', 'guides', 'squares', 'signs'];
  const TK = 'atelier-gh-token';
  let token = null; try { token = localStorage.getItem(TK); } catch (e) {}
  let ready, setReady; ready = new Promise(r => { setReady = r; });

  async function gh(method, path, body, accept) {
    const r = await fetch('https://api.github.com' + path, { method, cache: 'no-store', headers: {
      Authorization: 'Bearer ' + token, Accept: accept || 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { const t = await r.text().catch(() => ''); throw Object.assign(new Error('GitHub ' + r.status + ': ' + t.slice(0, 200)), { status: r.status }); }
    return accept === 'raw' ? r : r.status === 204 ? null : r.json();
  }
  const raw = path => fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path + '?ref=' + encodeURIComponent(BRANCH),
    { headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github.raw', 'X-GitHub-Api-Version': '2022-11-28' } });

  // ---------- sign-in ----------
  function signInBox(msg) {
    let el = document.getElementById('gh-signin');
    if (!el) {
      el = document.createElement('div'); el.id = 'gh-signin';
      el.style.cssText = 'position:fixed;inset:0;z-index:50;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px';
      el.innerHTML = `<form style="max-width:560px;width:100%;background:var(--panel,#fff);color:var(--ink,#000);border-radius:10px;padding:20px 22px;font:14px/1.5 var(--font-ui,sans-serif);box-shadow:0 10px 40px rgba(0,0,0,.3)">
        <h2 style="margin:0 0 8px;font-size:18px">Borger Wedge Atelier: sign in with GitHub</h2>
        <p style="margin:0 0 10px">The signs and the edits are kept in the private repository <b>${OWNER}/${REPO}</b> (branch <b>${BRANCH}</b>).
        To open them, paste a GitHub token that may read and write that repository. It is kept only in this browser.</p>
        <ol style="margin:0 0 12px 18px;padding:0">
          <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Settings → Fine-grained tokens → Generate new token</a>.</li>
          <li>Resource owner: <b>${OWNER}</b>. Repository access: <b>Only select repositories</b> → <b>${REPO}</b>.</li>
          <li>Repository permissions: <b>Contents: Read and write</b>. Generate, copy the token.</li>
        </ol>
        <p style="margin:0 0 12px;font-size:12px;opacity:.75">If the organization does not allow fine-grained tokens yet, a classic token with the <i>repo</i> scope works too.</p>
        <input id="gh-token" type="password" autocomplete="off" placeholder="github_pat_…" style="width:100%;box-sizing:border-box;padding:7px 9px;font:13px monospace">
        <div style="display:flex;gap:10px;align-items:center;margin-top:12px"><button type="submit" style="padding:6px 14px">Sign in</button><span id="gh-signin-msg" style="color:#a8541a;font-size:13px"></span></div>
      </form>`;
      document.body.appendChild(el);
      el.querySelector('form').onsubmit = async ev => {
        ev.preventDefault(); const t = el.querySelector('#gh-token').value.trim(); if (!t) return;
        token = t; el.querySelector('#gh-signin-msg').textContent = 'Checking…';
        try {
          const r = await gh('GET', '/repos/' + OWNER + '/' + REPO);
          if (!r.permissions || !r.permissions.push) throw new Error('this token may read the repository but not write to it');
          await gh('GET', '/repos/' + OWNER + '/' + REPO + '/git/ref/heads/' + BRANCH);
          try { localStorage.setItem(TK, t); } catch (e) {}
          el.remove(); setReady();
        } catch (e) { token = null; el.querySelector('#gh-signin-msg').textContent = e.status === 401 ? 'This token is not valid.' : e.status === 404 ? 'This token cannot see the repository.' : String(e.message || e); }
      };
    }
    el.querySelector('#gh-signin-msg').textContent = msg || '';
  }
  function signOut() { try { localStorage.removeItem(TK); } catch (e) {} location.reload(); }
  document.addEventListener('DOMContentLoaded', () => {
    if (!token) return signInBox();
    gh('GET', '/repos/' + OWNER + '/' + REPO + '/git/ref/heads/' + BRANCH).then(() => setReady())
      .catch(e => { token = null; signInBox(e.status === 401 ? 'The saved token no longer works: please paste a new one.' : String(e.message || e)); });
  });

  // ---------- the page's data files ----------
  window.atelierData = name => ready.then(() => raw(WEB + name));
  ready.then(async () => {           // the Assurbanipal font for the comparison panel
    try { const r = await raw(WEB + 'fonts/assurbanipal.ttf'); const f = new FontFace('Assurbanipal', await r.arrayBuffer()); await f.load(); document.fonts.add(f); } catch (e) { console.warn('font', e); }
  });

  // ---------- database: collections from the branch, saves as commits ----------
  const subs = {}, cache = {}, known = {};      // known[col][id] = blob sha on GitHub
  let head = null, ours = new Set();
  async function loadCol(col) {
    const q = 'query($o:String!,$n:String!,$e:String!){repository(owner:$o,name:$n){object(expression:$e){... on Tree{entries{name oid object{... on Blob{text isTruncated}}}}}}}';
    const r = await gh('POST', '/graphql', { query: q, variables: { o: OWNER, n: REPO, e: BRANCH + ':' + DB + col } });
    if (r.errors) throw new Error(r.errors[0].message);
    const obj = r.data.repository.object, m = {}, k = {};
    for (const e of obj ? obj.entries : []) {
      if (!e.name.endsWith('.json')) continue;
      let text = e.object && e.object.text;
      if (text == null || e.object.isTruncated) text = await (await raw(DB + col + '/' + e.name)).text();
      try { const d = JSON.parse(text); m[e.name.slice(0, -5)] = d && d.data ? d.data : d; k[e.name.slice(0, -5)] = e.oid; } catch (err) { console.warn('bad json', col, e.name); }
    }
    cache[col] = m; known[col] = k;
  }
  function fire(col) {
    const docs = Object.entries(cache[col] || {}).map(([id, d]) => ({ id, data: () => d }));
    for (const cb of subs[col] || []) { try { cb({ docs }); } catch (e) { console.error(e); } }
  }
  function setSquares(id, r) {
    if (typeof byName === 'undefined' || !byName.get(id)) return;
    const g = byName.get(id); if (r && r.length) g.r = r; else delete g.r;
  }
  function applySquares() {
    const go = () => {
      if (typeof byName === 'undefined' || !byName.size) return setTimeout(go, 100);
      addSigns();                              // the added signs first: their squares need them in the list
      for (const g of byName.values()) delete g.r;
      for (const [id, d] of Object.entries(cache.squares || {})) setSquares(id, d.r);
      if (typeof cur !== 'undefined' && cur && typeof render === 'function') render();
    };
    go();
  }
  const loaded = ready.then(async () => {
    head = (await gh('GET', '/repos/' + OWNER + '/' + REPO + '/git/ref/heads/' + BRANCH)).object.sha;
    await Promise.all(COLS.map(loadCol)); applySquares(); addSigns();
  });
  function addSigns() { if (window.atelierAddSigns) atelierAddSigns(Object.values(cache.signs || {})); }
  // the Black of a White document (black.js, the rule of the font build's w2b.py)
  function blackFor(id, body) {
    if (!window.AtelierBlack || typeof byName === 'undefined' || !byName.get(id)) return null;
    const g = byName.get(id);
    try { return { a: body.a, c: AtelierBlack.fromWhite((body.c || []).map(c => c.p), g.w, g.b).map(p => ({ p })), family: 'black', updatedAt: body.updatedAt, from: 'white' }; }
    catch (e) { console.error('black', e); return null; }
  }

  // pending writes: {repo path: text | null (delete)}, flushed as one commit
  let pending = {}, waiters = [], timer = null, busy = false;
  const status = { state: 'starting', error: null, last: null };
  function queue(path, text) {
    pending[path] = text; status.state = 'pending'; label();
    return new Promise((res, rej) => { waiters.push({ res, rej }); clearTimeout(timer); timer = setTimeout(flush, 2000); });
  }
  async function flush() {
    if (busy) { timer = setTimeout(flush, 500); return; }
    const batch = pending, ws = waiters; pending = {}; waiters = [];
    if (!Object.keys(batch).length) return;
    busy = true; status.state = 'syncing'; label();
    for (let attempt = 0; ; attempt++) {
      try {
        const ref = await gh('GET', '/repos/' + OWNER + '/' + REPO + '/git/ref/heads/' + BRANCH);
        const base = await gh('GET', '/repos/' + OWNER + '/' + REPO + '/git/commits/' + ref.object.sha);
        const entries = [];
        for (const [path, text] of Object.entries(batch)) {
          const [col, f] = path.slice(DB.length).split('/'); const id = f.slice(0, -5);
          if (text === null) { if (known[col] && known[col][id]) entries.push({ path, mode: '100644', type: 'blob', sha: null }); continue; }
          const b = await gh('POST', '/repos/' + OWNER + '/' + REPO + '/git/blobs', { content: text, encoding: 'utf-8' });
          entries.push({ path, mode: '100644', type: 'blob', sha: b.sha }); (known[col] = known[col] || {})[id] = b.sha;
        }
        if (entries.length) {
          const tree = await gh('POST', '/repos/' + OWNER + '/' + REPO + '/git/trees', { base_tree: base.tree.sha, tree: entries });
          const names = [...new Set(Object.keys(batch).filter(p => !p.includes('/squares/')).map(p => { const [col, f] = p.slice(DB.length).split('/'); return f.slice(0, -5) + ' (' + col + ')'; }))];
          const msg = 'Atelier (web): ' + (names.slice(0, 8).join(', ') || 'squares') + (names.length > 8 ? ' and ' + (names.length - 8) + ' more' : '');
          const c = await gh('POST', '/repos/' + OWNER + '/' + REPO + '/git/commits', { message: msg, tree: tree.sha, parents: [ref.object.sha] });
          await gh('PATCH', '/repos/' + OWNER + '/' + REPO + '/git/refs/heads/' + BRANCH, { sha: c.sha, force: false });
          head = c.sha; ours.add(c.sha);
        }
        for (const [path, text] of Object.entries(batch)) if (text === null) { const [col, f] = path.slice(DB.length).split('/'); if (known[col]) delete known[col][f.slice(0, -5)]; }
        status.state = Object.keys(pending).length ? 'pending' : 'synced'; status.error = null; status.last = new Date().toLocaleTimeString();
        ws.forEach(w => w.res()); break;
      } catch (e) {
        if ((e.status === 422 || e.status === 409) && attempt < 4) continue;      // someone pushed meanwhile: on the new head
        status.state = 'error'; status.error = String(e.message || e);
        Object.assign(batch, pending); pending = batch; waiters = ws.concat(waiters); // keep them, try again later
        timer = setTimeout(flush, 15000); break;
      }
    }
    busy = false; label();
  }
  const text = obj => JSON.stringify(obj, null, 2);
  const db = {
    collection: col => ({
      onSnapshot(cb, err) { (subs[col] = subs[col] || []).push(cb); loaded.then(() => fire(col)).catch(e => err && err(e)); return () => {}; }
    }),
    doc: path => {
      const [col, id] = path.split('/');
      return {
        async set(body) {
          await loaded; (cache[col] = cache[col] || {})[id] = body;
          const w = [queue(DB + col + '/' + id + '.json', text(body))];
          if (col === 'white' && window.AtelierSquares && typeof byName !== 'undefined' && byName.get(id)) {
            const r = AtelierSquares.squares((body.c || []).map(c => c.p), byName.get(id).p);
            setSquares(id, r);
            if (r) { (cache.squares = cache.squares || {})[id] = { r }; w.push(queue(DB + 'squares/' + id + '.json', text({ r }))); }
            else if (cache.squares && cache.squares[id]) { delete cache.squares[id]; w.push(queue(DB + 'squares/' + id + '.json', null)); }
          }
          // every White edit gives the Black (user, 2026-10-24: "all changes I do in outline should go into the black")
          const bk = col === 'white' ? blackFor(id, body) : null;
          if (bk) { (cache.black = cache.black || {})[id] = bk; w.push(queue(DB + 'black/' + id + '.json', text(bk))); fire('black'); }
          fire(col); await Promise.all(w);
        },
        async delete() {
          await loaded; if (cache[col]) delete cache[col][id];
          const w = [queue(DB + col + '/' + id + '.json', null)];
          if (col === 'white' && cache.squares && cache.squares[id]) { delete cache.squares[id]; setSquares(id, null); w.push(queue(DB + 'squares/' + id + '.json', null)); }
          if (col === 'white' && cache.black && cache.black[id]) { delete cache.black[id]; w.push(queue(DB + 'black/' + id + '.json', null)); fire('black'); }   // the Black too
          fire(col); await Promise.all(w);
        }
      };
    }
  };
  // edits pushed from elsewhere (another browser, the local atelier, a merge): every minute
  async function poll() {
    try {
      if (!busy && !Object.keys(pending).length) {
        const h = (await gh('GET', '/repos/' + OWNER + '/' + REPO + '/git/ref/heads/' + BRANCH)).object.sha;
        if (h !== head && !ours.has(h)) { await Promise.all(COLS.map(loadCol)); COLS.forEach(fire); applySquares(); addSigns(); }
        head = h; if (status.state === 'starting' || status.state === 'error') { status.state = 'synced'; status.error = null; }
      }
    } catch (e) { status.state = 'error'; status.error = String(e.message || e); }
    label(); setTimeout(poll, 60000);
  }
  loaded.then(() => { status.state = 'synced'; label(); setTimeout(poll, 60000); });

  function label() {
    let el = document.getElementById('gh-sync');
    if (!el) {
      const st = document.getElementById('status'); if (!st) return;
      el = document.createElement('span'); el.id = 'gh-sync';
      el.style.cssText = 'font-family: var(--font-data); font-size: 12px; color: var(--muted); margin-left: 4px; cursor: pointer';
      el.title = 'Click to sign out'; el.onclick = () => { if (confirm('Sign out of GitHub in this browser?')) signOut(); };
      st.after(el);
    }
    const n = Object.keys(pending).length;
    el.textContent = { synced: 'GitHub: saved', pending: 'GitHub: ' + n + ' waiting', syncing: 'GitHub: sending…', starting: 'GitHub: connecting…', error: 'GitHub: error' + (n ? ', ' + n + ' waiting' : '') }[status.state];
    el.title = (status.error ? status.error + '\n' : '') + OWNER + '/' + REPO + ', branch ' + BRANCH + (status.last ? '\nlast saved ' + status.last : '') + '\nClick to sign out';
    el.style.color = status.state === 'error' ? 'var(--warn)' : 'var(--muted)';
  }
  window.addEventListener('beforeunload', e => { if (Object.keys(pending).length || busy) { e.preventDefault(); e.returnValue = ''; } });

  const downloads = {
    async save({ filename, data }) {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml' })); a.download = filename;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }
  };
  window.claude = { use: async cap => { if (cap === 'db') return db; if (cap === 'downloads') return downloads; throw new Error('not available: ' + cap); } };
})();
