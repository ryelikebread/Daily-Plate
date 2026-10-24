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
    setSetting: (key, value) => DB.put('settings', { key, value }),
    STORES,
  };
})();

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
