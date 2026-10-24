// Optional sync between devices through one secret GitHub Gist.
//
// How it works:
//  - Each device keeps its full data locally (IndexedDB) and works offline.
//  - When sync is on, the device downloads the gist file, merges it with its
//    own data (newest change wins per record; deletions are remembered), saves
//    the result locally, and uploads it again if anything changed.
//  - The gist content is encrypted on the device with AES-GCM using a key
//    derived (PBKDF2, 250k rounds) from a passphrase that never leaves the
//    device. GitHub only ever sees ciphertext.
//  - The GitHub token only needs the "Gists: read and write" permission.

const Sync = (() => {
  const API = 'https://api.github.com';
  const FILE = 'daily-plate-sync.json';
  const DESC = 'Daily Plate sync (encrypted)';
  const RECORD_STORES = ['foods', 'entries', 'days'];

  let timer = null;
  let running = null;
  let hooks = { onStatus: () => {}, afterMerge: async () => {} };

  // ---------- helpers ----------
  const te = new TextEncoder();
  const td = new TextDecoder();

  function toB64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }

  async function gzip(bytes) {
    if (typeof CompressionStream === 'undefined') return { bytes, gz: false };
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), gz: true };
  }
  async function gunzip(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  const keyCache = new Map();
  async function deriveKey(pass, salt) {
    const id = pass + '|' + toB64(salt);
    if (keyCache.has(id)) return keyCache.get(id);
    const base = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    keyCache.set(id, key);
    return key;
  }

  async function encrypt(obj, pass) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const { bytes, gz } = await gzip(te.encode(JSON.stringify(obj)));
    const key = await deriveKey(pass, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, bytes);
    return JSON.stringify({ app: 'daily-plate-sync', v: 1, gz, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) });
  }

  async function decrypt(text, pass) {
    const p = JSON.parse(text);
    if (p.app !== 'daily-plate-sync') throw new Error('The sync gist does not contain Daily Plate data.');
    const key = await deriveKey(pass, fromB64(p.salt));
    let bytes;
    try {
      bytes = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(p.iv) }, key, fromB64(p.data)));
    } catch (_) {
      throw new Error('Wrong sync passphrase. It must be exactly the same on every device.');
    }
    if (p.gz) bytes = await gunzip(bytes);
    return JSON.parse(td.decode(bytes));
  }

  async function gh(path, token, opts = {}) {
    const headers = { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
    if (opts.body) headers['Content-Type'] = 'application/json';
    const r = await fetch(API + path, { ...opts, headers });
    if (!r.ok) {
      const err = new Error(`GitHub said ${r.status}` + ({
        401: ': the token is wrong or has expired',
        403: ': the token needs the "Gists: read and write" permission',
        404: ': not found (check the token has the Gists permission)',
      }[r.status] || ''));
      err.status = r.status;
      throw err;
    }
    return r.status === 204 ? null : r.json();
  }

  // ---------- data ----------
  const ts = (rec) => rec.updatedAt || rec.createdAt || 0;

  async function localSnapshot() {
    const snap = { tombstones: await DB.getSetting('tombstones', {}) };
    for (const s of RECORD_STORES) snap[s] = await DB.all(s);
    snap.settings = (await DB.all('settings')).filter(r => SYNCED_SETTINGS.includes(r.key));
    return snap;
  }

  function emptySnapshot() { return { foods: [], entries: [], days: [], settings: [], tombstones: {} }; }

  function merge(L, R) {
    const tomb = { ...(L.tombstones || {}) };
    for (const [k, v] of Object.entries(R.tombstones || {})) tomb[k] = Math.max(tomb[k] || 0, v);
    // forget tombstones after a year to keep the file small
    const cutoff = Date.now() - 365 * 86400000;
    for (const k of Object.keys(tomb)) if (tomb[k] < cutoff) delete tomb[k];

    const out = { tombstones: tomb };
    for (const store of [...RECORD_STORES, 'settings']) {
      const map = new Map();
      for (const rec of [...(L[store] || []), ...(R[store] || [])]) {
        const k = keyOf(store, rec);
        const ex = map.get(k);
        if (!ex || ts(rec) > ts(ex)) map.set(k, rec);
      }
      out[store] = [...map.entries()]
        .filter(([k, rec]) => !(tomb[store + '/' + k] >= ts(rec)))
        .map(([, rec]) => rec)
        .sort((a, b) => String(keyOf(store, a)).localeCompare(String(keyOf(store, b))));
    }
    return out;
  }

  // A stable fingerprint, to know whether anything differs.
  function fingerprint(snap) {
    const parts = [];
    for (const store of [...RECORD_STORES, 'settings']) {
      const list = (snap[store] || []).map(r => keyOf(store, r) + '@' + ts(r)).sort();
      parts.push(store + ':' + list.join(','));
    }
    parts.push('t:' + Object.keys(snap.tombstones || {}).sort().map(k => k + '@' + snap.tombstones[k]).join(','));
    return parts.join('|');
  }

  async function applyLocal(local, merged) {
    let changed = false;
    for (const store of RECORD_STORES) {
      const keep = new Set(merged[store].map(r => keyOf(store, r)));
      const localMap = new Map(local[store].map(r => [keyOf(store, r), r]));
      const toPut = merged[store].filter(r => { const l = localMap.get(keyOf(store, r)); return !l || ts(l) !== ts(r); });
      if (toPut.length) { await DB.putMany(store, toPut); changed = true; }
      for (const k of localMap.keys()) if (!keep.has(k)) { await DB.del(store, k); changed = true; }
    }
    const localSettings = new Map(local.settings.map(r => [r.key, r]));
    for (const r of merged.settings) {
      const l = localSettings.get(r.key);
      if (!l || ts(l) !== ts(r)) { await DB.put('settings', r); changed = true; }
    }
    await DB.put('settings', { key: 'tombstones', value: merged.tombstones });
    return changed;
  }

  // ---------- gist ----------
  async function findGist(token) {
    for (let page = 1; page <= 5; page++) {
      const list = await gh(`/gists?per_page=100&page=${page}`, token);
      const hit = list.find(g => g.description === DESC && g.files && g.files[FILE]);
      if (hit) return gh('/gists/' + hit.id, token);
      if (list.length < 100) break;
    }
    return null;
  }

  async function readGistFile(gist) {
    const f = gist.files && gist.files[FILE];
    if (!f) return null;
    if (f.truncated || f.content == null) {
      const r = await fetch(f.raw_url);
      if (!r.ok) throw new Error('Could not download the sync file (' + r.status + ')');
      return r.text();
    }
    return f.content;
  }

  // ---------- public ----------
  async function config() {
    return {
      enabled: await DB.getSetting('syncEnabled', false),
      token: await DB.getSetting('syncToken', ''),
      pass: await DB.getSetting('syncPass', ''),
      gistId: await DB.getSetting('syncGistId', ''),
      last: await DB.getSetting('syncLast', null),
    };
  }

  async function run() {
    const c = await config();
    if (!c.enabled || !c.token || !c.pass) return { skipped: true };
    hooks.onStatus('Syncing…');
    let gist = null;
    if (c.gistId) {
      try { gist = await gh('/gists/' + c.gistId, c.token); }
      catch (e) { if (e.status !== 404) throw e; }
    }
    if (!gist) {
      gist = await findGist(c.token);
      if (gist) await DB.put('settings', { key: 'syncGistId', value: gist.id });
    }
    const text = gist ? await readGistFile(gist) : null;
    const remote = text ? await decrypt(text, c.pass) : emptySnapshot();
    const local = await localSnapshot();
    const merged = merge(local, remote);
    const changedLocal = await applyLocal(local, merged);
    if (changedLocal) await hooks.afterMerge();

    if (!gist) {
      const created = await gh('/gists', c.token, { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: await encrypt(merged, c.pass) } } }) });
      await DB.put('settings', { key: 'syncGistId', value: created.id });
    } else if (fingerprint(merged) !== fingerprint(remote)) {
      await gh('/gists/' + gist.id, c.token, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: await encrypt(merged, c.pass) } } }) });
    }
    const now = Date.now();
    await DB.put('settings', { key: 'syncLast', value: now });
    hooks.onStatus('Synced ' + new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
    return { ok: true, changedLocal };
  }

  function syncNow() {
    if (running) return running;
    running = run()
      .catch(err => {
        const offline = err instanceof TypeError || (typeof navigator !== 'undefined' && navigator.onLine === false);
        hooks.onStatus(offline ? 'Offline: will sync when back online' : 'Sync problem: ' + err.message, true);
        return { error: err };
      })
      .finally(() => { running = null; });
    return running;
  }

  // Sync a few seconds after the last change, so quick edits go up together.
  function schedule(delay = 4000) {
    clearTimeout(timer);
    timer = setTimeout(syncNow, delay);
  }

  async function enable(token, pass) {
    await DB.put('settings', { key: 'syncToken', value: token });
    await DB.put('settings', { key: 'syncPass', value: pass });
    await DB.put('settings', { key: 'syncEnabled', value: true });
    return syncNow();
  }

  async function disable() {
    for (const k of ['syncEnabled', 'syncToken', 'syncPass', 'syncGistId', 'syncLast']) await DB.del('settings', k);
    hooks.onStatus('Sync is off');
  }

  function init(h) {
    hooks = { ...hooks, ...h };
    DB.onChange = () => schedule();
    setInterval(syncNow, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
    window.addEventListener('online', () => syncNow());
    return syncNow();
  }

  return { init, syncNow, schedule, enable, disable, config, merge, encrypt, decrypt, FILE, DESC };
})();
