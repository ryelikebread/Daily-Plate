// Tiny IndexedDB wrapper. All data lives in the browser's IndexedDB
// database "daily-plate" on this device.
const DB_NAME = 'daily-plate';
const DB_VERSION = 1;
const STORES = ['foods', 'entries', 'days', 'settings'];

const DB = (() => {
  let dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('foods')) {
          const s = db.createObjectStore('foods', { keyPath: 'id' });
          s.createIndex('barcode', 'barcode', { unique: false });
        }
        if (!db.objectStoreNames.contains('entries')) {
          const s = db.createObjectStore('entries', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('days')) db.createObjectStore('days', { keyPath: 'date' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function wrap(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function tx(store, mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      let result;
      Promise.resolve(fn(t.objectStore(store))).then(r => { result = r; });
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    });
  }

  return {
    open,
    get: (store, key) => tx(store, 'readonly', s => wrap(s.get(key))),
    all: (store) => tx(store, 'readonly', s => wrap(s.getAll())),
    put: (store, value) => tx(store, 'readwrite', s => wrap(s.put(value))),
    del: (store, key) => tx(store, 'readwrite', s => wrap(s.delete(key))),
    clear: (store) => tx(store, 'readwrite', s => wrap(s.clear())),
    byIndex: (store, index, value) => tx(store, 'readonly', s => wrap(s.index(index).getAll(value))),
    range: (store, index, lo, hi) => tx(store, 'readonly', s => wrap(s.index(index).getAll(IDBKeyRange.bound(lo, hi)))),
    async putMany(store, values) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readwrite');
        const s = t.objectStore(store);
        values.forEach(v => s.put(v));
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
      });
    },
    async getSetting(key, fallback) {
      const r = await DB.get('settings', key);
      return r ? r.value : fallback;
    },
    async setSetting(key, value) {
      await DB.put('settings', { key, value, updatedAt: Date.now() });
      if (SYNCED_SETTINGS.includes(key)) DB.changed();
    },

    // --- change-tracked writes (used by sync) ---
    // save/remove stamp updatedAt and keep a "tombstone" for deletions so
    // other devices learn that a record was deleted.
    async save(store, rec) {
      rec.updatedAt = Date.now();
      await DB.put(store, rec);
      await clearTombstones(store, [keyOf(store, rec)]);
      DB.changed();
      return rec;
    },
    async saveMany(store, recs) {
      const now = Date.now();
      recs.forEach(r => (r.updatedAt = now));
      await DB.putMany(store, recs);
      await clearTombstones(store, recs.map(r => keyOf(store, r)));
      DB.changed();
    },
    async remove(store, key) {
      await DB.del(store, key);
      const t = await DB.getSetting('tombstones', {});
      t[store + '/' + key] = Date.now();
      await DB.put('settings', { key: 'tombstones', value: t });
      DB.changed();
    },
    onChange: null,
    changed() { if (typeof DB.onChange === 'function') DB.onChange(); },
    STORES,
  };
})();

// Settings that follow you across devices when sync is on. Everything else
// in "settings" (reminder times, sync token, etc.) stays on the device.
const SYNCED_SETTINGS = ['goals'];
// Never exported in backups or uploaded: secrets and per-device bookkeeping.
const DEVICE_ONLY_SETTINGS = ['syncToken', 'syncPass', 'syncGistId', 'syncLast', 'syncEnabled', 'remindersSent', 'lastBackup', 'seeded'];

function keyOf(store, rec) { return store === 'days' ? rec.date : store === 'settings' ? rec.key : rec.id; }

async function clearTombstones(store, keys) {
  const t = await DB.getSetting('tombstones', {});
  let dirty = false;
  keys.forEach(k => { if (t[store + '/' + k]) { delete t[store + '/' + k]; dirty = true; } });
  if (dirty) await DB.put('settings', { key: 'tombstones', value: t });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
