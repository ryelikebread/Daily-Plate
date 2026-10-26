// Daily Plate — main application logic.
const APP_VERSION = '1.14.0';

// If the page is an older/newer copy than this script (a stale cached index.html),
// a missing element gets a throw-away stand-in so the app degrades instead of crashing.
const $ = (sel) => document.querySelector(sel) || document.createElement('div');
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
  photos: [], removedPhotos: [], // pictures on the open food screen
  date: todayStr(),
  foods: new Map(),
  goals: {},
  settings: {},
  addMeal: 'Breakfast',
  editingEntry: null,
  pendingFood: null,
  recipe: null,
};

// ---------- dates ----------
function todayStr(d = new Date()) {
  const z = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}
function shiftDate(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return todayStr(new Date(y, m - 1, d + days));
}
function prettyDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

// ---------- startup ----------
async function init() {
  $('#app-version').textContent = APP_VERSION;
  // iPhone/iPad in Safari but not yet added to the Home Screen: show install tips
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (isIOS && !standalone) $('#ios-install').hidden = false;
  await DB.open();
  if (!(await DB.getSetting('seeded', false))) {
    await DB.putMany('foods', starterFoodRecords());
    await DB.setSetting('seeded', true);
    await DB.setSetting('starterVersion', STARTER_VERSION);
  }
  await seedNewStarters();
  await loadFoods();
  await loadSettings();
  bindUI();
  await renderAll();
  registerServiceWorker();
  requestPersistence();
  setInterval(checkReminders, 60 * 1000);
  checkReminders();
  Sync.init({ onStatus: showSyncStatus, afterMerge: reloadAfterSync });
  renderSyncSettings();
}

// Adds built-in foods that shipped after this device was first set up (drinks in
// 1.13.0, more Cayman Jack flavors and barcodes in 1.13.1), and gives existing
// built-ins a barcode they gained. Anything you deleted stays deleted, and built-ins
// you edited are left alone. Bump STARTER_VERSION when the built-in list changes.
const STARTER_VERSION = 2;
async function seedNewStarters() {
  if ((await DB.getSetting('starterVersion', 0)) >= STARTER_VERSION) return;
  const have = new Map((await DB.all('foods')).map(f => [f.id, f]));
  const deleted = await DB.getSetting('tombstones', {});
  const add = [];
  for (const f of starterFoodRecords()) {
    const old = have.get(f.id);
    if (!old) { if (!deleted['foods/' + f.id]) add.push(f); }
    else if (f.barcode && !old.barcode && old.source === 'starter' && old.name === f.name) add.push({ ...old, barcode: f.barcode });
  }
  if (add.length) await DB.putMany('foods', add);
  await DB.setSetting('starterVersion', STARTER_VERSION);
}

// ---------- sync ----------
async function reloadAfterSync() {
  await loadFoods();
  await loadSettings();
  if (state.refreshMealsForm) state.refreshMealsForm();
  await renderDiary();
  if ($('#tab-foods').classList.contains('active')) renderFoodsList();
  if ($('#tab-trends').classList.contains('active')) renderTrends();
}

function showSyncStatus(text, isError) {
  $('#sync-status').textContent = text;
  const b = $('#sync-badge');
  b.hidden = false;
  b.textContent = isError ? '⚠ sync' : text.startsWith('Synced') ? '✓ synced' : text === 'Syncing…' ? '↻' : '';
  b.classList.toggle('err', !!isError);
  if (text === 'Sync is off') b.hidden = true;
}

async function renderSyncSettings() {
  const c = await Sync.config();
  const on = c.enabled && c.token && c.pass;
  $('#sync-setup').hidden = !!on;
  $('#sync-active').hidden = !on;
  if (!on) { $('#sync-status').textContent = 'Sync is off.'; $('#sync-badge').hidden = true; }
  else if (c.last && $('#sync-status').textContent === 'Sync is off.') $('#sync-status').textContent = 'Last synced ' + new Date(c.last).toLocaleString();
}

async function turnOnSync() {
  const token = $('#sync-token').value.trim();
  const pass = $('#sync-pass').value;
  if (!token) return toast('Paste your GitHub token first.');
  if (pass.length < 8) return toast('Use a passphrase of at least 8 characters.');
  const res = await Sync.enable(token, pass);
  if (res && res.error) {
    await Sync.disable();
    await renderSyncSettings();
    $('#sync-status').textContent = 'Could not turn on sync: ' + res.error.message;
  } else {
    $('#sync-token').value = ''; $('#sync-pass').value = '';
    await renderSyncSettings();
    toast('Sync is on.');
  }
}

async function loadFoods() {
  state.foods = new Map((await DB.all('foods')).map(f => [f.id, f]));
}

async function loadSettings() {
  const defGoals = Object.fromEntries(NUTRIENTS.map(n => [n.key, n.goal]));
  state.goals = { ...defGoals, ...(await DB.getSetting('goals', {})) };
  state.settings = {
    remEnabled: true, remTime: '21:00', remMeals: false, remMealTimes: '08:30,12:30,18:30',
    offEnabled: true, usdaEnabled: true, menustatEnabled: true, usdaKey: '', weightUnit: 'kg',
    ...(await DB.getSetting('prefs', {})),
  };
  const meals = await DB.getSetting('meals', null);
  MEALS.splice(0, MEALS.length, ...(Array.isArray(meals) && meals.length ? meals : DEFAULT_MEALS));
}

async function saveSettings() {
  await DB.setSetting('prefs', state.settings);
}

// ---------- UI wiring ----------
function bindUI() {
  $$('.tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  $('#diary-date').addEventListener('change', e => { if (e.target.value) setDate(e.target.value); });
  $('#prev-day').addEventListener('click', () => setDate(shiftDate(state.date, -1)));
  $('#next-day').addEventListener('click', () => setDate(shiftDate(state.date, 1)));
  $('#today-btn').addEventListener('click', () => setDate(todayStr()));

  $('#day-note').addEventListener('change', () => saveDay({ note: $('#day-note').value }));
  $('#day-weight').addEventListener('change', () => {
    const v = parseFloat($('#day-weight').value);
    saveDay({ weight: Number.isFinite(v) ? v : null });
  });
  $('#day-complete').addEventListener('change', async () => {
    await saveDay({ complete: $('#day-complete').checked });
    if ($('#day-complete').checked) { toast('Day marked complete. Nice work.'); hideBanner(); }
  });
  $('#copy-yesterday').addEventListener('click', copyYesterday);

  // add dialog
  $('#add-search').addEventListener('input', renderLocalResults);
  $('#add-search').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); onlineSearch(); } });
  $('#add-search').addEventListener('input', () => { $('#add-more').hidden = true; $('#add-attribution').hidden = true; });
  $('#qa-add').addEventListener('click', () => openAddDialog(mealForNow()));
  $('#qa-scan').addEventListener('click', () => { openAddDialog(mealForNow()); scanBarcode(); });
  $('#add-online').addEventListener('click', () => onlineSearch());
  $('#add-more').addEventListener('click', () => onlineSearch(true));
  $$('#add-dialog .chip').forEach(c => c.addEventListener('click', () => setSearchFilter(c.dataset.filter)));
  $('#add-barcode-go').addEventListener('click', () => barcodeLookup($('#add-barcode').value.trim()));
  $('#add-quick').addEventListener('click', () => { $('#add-dialog').close(); openQuickAdd(); });
  $('#add-scan').addEventListener('click', scanBarcode);
  $('#add-custom').addEventListener('click', () => openCustomFromAdd());
  $('#food-keep').addEventListener('change', updateFoodOk);
  $('#food-scan').addEventListener('click', async () => { const c = await Scanner.scan(); if (c) $('#food-barcode').value = c; });

  // amount dialog
  $('#amount-qty').addEventListener('input', renderAmountPreview);
  $('#amount-unit').addEventListener('change', renderAmountPreview);
  $('#amount-dialog').addEventListener('close', onAmountClose);
  $('#fav-toggle').addEventListener('click', toggleFavorite);
  $('#photo-input').addEventListener('change', async (ev) => {
    const files = [...ev.target.files]; ev.target.value = '';
    for (const f of files) {
      try { const blob = await shrinkImage(f); state.photos.push({ id: uid(), blob, url: URL.createObjectURL(blob), isNew: true }); }
      catch (_) { toast('Could not read that image.'); }
    }
    renderPhotoStrip();
  });
  $('#photo-strip').addEventListener('click', (ev) => {
    const rm = ev.target.closest('[data-rmphoto]');
    if (rm) {
      const i = state.photos.findIndex(p => p.id === rm.dataset.rmphoto);
      if (i >= 0) { const [p] = state.photos.splice(i, 1); if (!p.isNew) state.removedPhotos.push(p.id); URL.revokeObjectURL(p.url); renderPhotoStrip(); }
      return;
    }
    const img = ev.target.closest('[data-viewphoto]');
    if (img) showPhotos(state.photos.map(p => p.url), state.photos.findIndex(p => p.id === img.dataset.viewphoto));
  });
  $('#amount-same').addEventListener('change', () => {
    const on = $('#amount-same').checked && state.after;
    if (on) { $('#amount-meal').value = state.after.meal; if (state.after.time) $('#amount-time').value = state.after.time; }
    $('#amount-meal').disabled = !!on;
    $('#amount-time').disabled = !!on;
  });
  $('#food-menu-btn').addEventListener('click', (e) => { e.stopPropagation(); $('#food-menu').hidden = !$('#food-menu').hidden; });
  $$('#food-menu [data-act]').forEach(b => b.addEventListener('click', () => foodMenuAction(b.dataset.act)));
  $('#amount-dialog').addEventListener('click', (e) => { if (!e.target.closest('#food-menu, #food-menu-btn')) $('#food-menu').hidden = true; });
  $('#issue-dialog').addEventListener('close', onIssueClose);
  $('#issue-note').addEventListener('input', updateIssueLink);
  $('#issue-github').addEventListener('click', async () => { const f = await ensureSavedFood(); f.issue = { note: $('#issue-note').value.trim(), at: Date.now() }; await DB.save('foods', f); renderFoodHeader(); });
  $('#issue-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(issueDetails()); toast('Details copied.'); }
    catch (_) { toast('Could not copy on this device.'); }
  });
  $('#issue-clear').addEventListener('click', async () => {
    const f = await ensureSavedFood(); delete f.issue; await DB.save('foods', f);
    $('#issue-dialog').close('cancel'); renderFoodHeader(); toast('Flag cleared.');
  });

  // quick add
  $('#quick-dialog').addEventListener('close', onQuickClose);

  // foods
  $('#new-food').addEventListener('click', () => openFoodEditor(null));
  $('#new-recipe').addEventListener('click', () => openRecipeEditor(null));
  $('#foods-filter').addEventListener('input', renderFoodsList);
  $('#food-dialog').addEventListener('close', onFoodClose);
  $('#recipe-dialog').addEventListener('close', onRecipeClose);
  $('#recipe-search').addEventListener('input', renderRecipeResults);
  $('#recipe-servings').addEventListener('input', renderRecipePreview);

  // trends
  $('#trend-nutrient').innerHTML = NUTRIENTS.map(n => `<option value="${n.key}">${n.label}</option>`).join('');
  $('#trend-range').addEventListener('change', renderTrends);
  $('#trend-nutrient').addEventListener('change', renderTrends);

  // settings
  $('#save-goals').addEventListener('click', saveGoals);
  $('#rem-save').addEventListener('click', saveReminder);
  $('#pack-import').addEventListener('change', async (ev) => { const f = ev.target.files[0]; ev.target.value = ''; if (f) importPack(await f.text(), f.name); });
  $('#pack-url').addEventListener('click', async () => {
    const url = prompt('Web address of a pack file (CSV or JSON), for example a raw.githubusercontent.com link:');
    if (!url) return;
    try { const r = await fetch(url.trim()); if (!r.ok) throw new Error('HTTP ' + r.status); importPack(await r.text(), url); }
    catch (err) { toast('Could not load the pack: ' + err.message); }
  });
  $('#pack-export').addEventListener('click', exportPack);
  $('#pack-template').addEventListener('click', () => download('daily-plate-pack-template.csv', PACK_TEMPLATE, 'text/csv'));
  state.refreshMealsForm = bindMealsForm();
  $('#rem-test').addEventListener('click', async () => {
    const ok = await ensureNotifyPermission();
    notify('Daily Plate test', ok ? 'Notifications are working.' : 'Notifications are blocked; you will see in-app banners instead.');
  });
  $('#rem-ics').addEventListener('click', downloadIcs);
  $('#save-lookup').addEventListener('click', saveLookup);
  $('#sync-on').addEventListener('click', turnOnSync);
  $('#sync-now').addEventListener('click', () => Sync.syncNow());
  $('#sync-off').addEventListener('click', async () => { await Sync.disable(); renderSyncSettings(); toast('Sync turned off on this device. Your data stays here.'); });
  $('#export-json').addEventListener('click', exportJson);
  $('#export-csv').addEventListener('click', exportEntriesCsv);
  $('#export-daily-csv').addEventListener('click', exportDailyCsv);
  $('#import-json').addEventListener('change', importJson);

  $('#reminder-go').addEventListener('click', () => { showTab('diary'); setDate(todayStr()); hideBanner(); });
  $('#reminder-dismiss').addEventListener('click', hideBanner);

  // open a tab from the URL hash, e.g. index.html#diary
  const hash = location.hash.replace('#', '');
  if (['diary', 'foods', 'trends', 'settings'].includes(hash)) showTab(hash);
}

function showTab(name) {
  $$('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.id === 'tab-' + name));
  if (name === 'foods') renderFoodsList();
  if (name === 'trends') renderTrends();
  if (name === 'settings') renderSettings();
}

async function renderAll() {
  await renderDiary();
  renderSettings();
}

function setDate(d) {
  state.date = d;
  renderDiary();
}

// ---------- diary ----------
async function entriesFor(date) {
  const list = await DB.byIndex('entries', 'date', date);
  return list.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

function entryNutrients(e) {
  return scaleNutrients(e.food.per100, e.grams);
}

function totalsOf(entries) {
  return entries.reduce((acc, e) => addNutrients(acc, entryNutrients(e)), {});
}

async function renderDiary() {
  $('#diary-date').value = state.date;
  const entries = await entriesFor(state.date);
  const day = (await DB.get('days', state.date)) || {};
  const totals = totalsOf(entries);

  // summary
  const kcal = totals.kcal || 0;
  const goal = state.goals.kcal || 0;
  const remaining = goal - kcal;
  const bars = NUTRIENTS.filter(n => n.main || ['fiber', 'sodium'].includes(n.key)).map(n => progressBar(n, totals[n.key] || 0)).join('');
  $('#day-summary').innerHTML = `
    <div class="sum-head">
      <div><div class="big">${fmt(kcal, 'kcal')}</div><div class="hint">eaten</div></div>
      <div><div class="big">${fmt(goal, 'kcal')}</div><div class="hint">goal</div></div>
      <div><div class="big ${remaining < 0 ? 'over' : ''}">${fmt(Math.abs(remaining), 'kcal')}</div><div class="hint">${remaining < 0 ? 'over' : 'left'}</div></div>
    </div>
    <div class="hint center">${esc(prettyDate(state.date))}${day.complete ? ' · ✓ complete' : ''}</div>
    ${bars}`;

  // meals
  const { list: mealList, extra: extraMeals } = mealsFor(entries);
  $('#meals').innerHTML = mealList.map(meal => {
    const items = entries.filter(e => e.meal === meal).sort(byTime);
    const mt = totalsOf(items);
    return `<div class="card meal">
      <div class="meal-head"><h3>${esc(meal)}${extraMeals.includes(meal) ? ' <span class="hint">(other)</span>' : ''}</h3><span class="hint">${fmt(mt.kcal || 0, 'kcal')} kcal</span>
        <button class="small" data-add="${esc(meal)}">+ Add</button></div>
      ${groupItems(items).map(g => g.length > 1 ? groupHtml(g) : entryHtml(g[0])).join('') || '<div class="hint empty">Nothing logged yet.</div>'}
    </div>`;
  }).join('');
  $$('#meals [data-add]').forEach(b => b.addEventListener('click', () => openAddDialog(b.dataset.add)));
  $$('#meals [data-del]').forEach(b => b.addEventListener('click', () => deleteEntry(b.dataset.del)));
  $$('#meals [data-delgroup]').forEach(b => b.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); deleteGroup(b.dataset.delgroup); }));
  $$('#meals [data-ungroup]').forEach(b => b.addEventListener('click', () => ungroup(b.dataset.ungroup)));
  $$('#meals details.group').forEach(d => {
    const el = d.querySelector('.group-report');
    const draw = () => { if (d.open && !el.dataset.done) { el.dataset.done = 1; const t = totalsOf(groupEntries.get(d.dataset.gid) || []); Report.render(el, t, { goals: state.goals, sections: ['energy', 'macros'] }); } };
    d.addEventListener('toggle', draw);
  });
  $$('#meals [data-edit]').forEach(b => b.addEventListener('click', () => editEntry(b.dataset.edit)));

  decoratePhotos();

  // notes etc
  $('#day-note').value = day.note || '';
  $('#day-weight').value = day.weight ?? '';
  $('#day-complete').checked = !!day.complete;
  $$('.unit-weight').forEach(s => (s.textContent = state.settings.weightUnit));

  // nutrient table
  Report.render($('#day-report'), entries.length ? totals : {}, { goals: state.goals });
  $('#day-report').insertAdjacentHTML('beforeend', '<p class="hint">Day totals add up what each food lists. Foods that don\'t list a nutrient count as zero for it, so vitamin and mineral totals are a minimum.</p>');
}

// ----- photos: pictures attached to entries (device-only, kept in the `photos` store) -----
function resetPhotos() {
  state.photos.forEach(p => URL.revokeObjectURL(p.url));
  state.photos = []; state.removedPhotos = [];
  renderPhotoStrip();
}

function renderPhotoStrip() {
  $('#photo-strip').innerHTML = state.photos.map(p => `<span class="ph"><img src="${p.url}" alt="Photo" data-viewphoto="${p.id}"><button type="button" class="ph-x" data-rmphoto="${p.id}" aria-label="Remove photo">✕</button></span>`).join('');
}

// Shrinks a picture to at most 1280 px on the long side (JPEG) so it stays small.
async function shrinkImage(file, max = 1280) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  if (bmp.close) bmp.close();
  return await new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', 0.8));
}

let viewUrls = [];
function showPhotos(urls, start = 0) {
  $('#photo-view').innerHTML = urls.map((u, i) => `<img src="${u}" alt="Photo ${i + 1}">`).join('');
  $('#photo-dialog').showModal();
  const imgs = $('#photo-view').querySelectorAll('img');
  if (imgs[start]) imgs[start].scrollIntoView({ block: 'nearest' });
}

// Adds small picture thumbnails to the diary rows that have photos.
async function decoratePhotos() {
  viewUrls.forEach(u => URL.revokeObjectURL(u)); viewUrls = [];
  const date = state.date;
  const list = (await DB.byIndex('photos', 'date', date).catch(() => [])).sort((a, b) => a.at - b.at);
  if (date !== state.date) return;
  const by = new Map();
  for (const p of list) { if (!by.has(p.entryId)) by.set(p.entryId, []); by.get(p.entryId).push(p); }
  for (const [id, ps] of by) {
    const host = document.querySelector(`#meals [data-edit="${id}"]`);
    if (!host) continue;
    const urls = ps.map(p => { const u = URL.createObjectURL(p.blob); viewUrls.push(u); return u; });
    const strip = document.createElement('div');
    strip.className = 'entry-photos';
    strip.innerHTML = urls.slice(0, 4).map(u => `<img src="${u}" alt="Photo">`).join('') + (urls.length > 4 ? `<span class="hint">+${urls.length - 4}</span>` : '');
    strip.addEventListener('click', (ev) => { ev.stopPropagation(); showPhotos(urls); });
    host.appendChild(strip);
  }
}

// ----- food packs: CSV/JSON files of foods you can import or share -----
const PACK_TEMPLATE = 'name,brand,serving_label,serving_grams,kcal,protein,carbs,fat,satfat,fiber,sugar,sodium\n'
  + 'Example Burger,Example Diner,1 burger,220,540,25,46,28,10,3,9,950\n';

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ''));
}

// Turns pack rows into foods. Nutrient columns are amounts for the listed serving
// (serving_grams, default 100), converted to the app's per-100 g format.
function packFoods(text) {
  const t = text.trim();
  let items;
  if (t.startsWith('[') || t.startsWith('{')) {
    const j = JSON.parse(t);
    items = Array.isArray(j) ? j : j.foods || [];
  } else {
    const [head, ...rows] = parseCsv(t);
    const cols = head.map(h => h.trim().toLowerCase());
    items = rows.map(r => Object.fromEntries(cols.map((c, i) => [c, (r[i] || '').trim()])));
  }
  const foods = [];
  for (const it of items) {
    const name = String(it.name || '').trim();
    if (!name) continue;
    const brand = String(it.brand || '').trim();
    let per100 = {}, servings = [];
    if (it.per100 && typeof it.per100 === 'object') {
      per100 = it.per100;
      servings = Array.isArray(it.servings) ? it.servings : [];
    } else {
      const g = parseFloat(it.serving_grams) > 0 ? parseFloat(it.serving_grams) : 100;
      for (const n of NUTRIENTS) {
        if (n.derived) continue;
        const v = parseFloat(it[n.key]);
        if (Number.isFinite(v)) per100[n.key] = Math.round((v * 100 / g) * 100) / 100;
      }
      if (g !== 100) servings = [{ label: it.serving_label || '1 serving', grams: g }];
    }
    if (per100.kcal == null) continue;
    foods.push({
      id: 'custom-pack-' + (brand + ' ' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80),
      source: 'custom', kind: brand ? 'restaurant' : 'generic', name, brand, barcode: String(it.barcode || ''),
      per100, servings, createdAt: Date.now(), updatedAt: Date.now(), fromPack: true,
    });
  }
  return foods;
}

async function importPack(text, label) {
  try {
    const foods = packFoods(text);
    if (!foods.length) return toast('No foods found. Each row needs a name and kcal. See the CSV template.');
    await DB.saveMany('foods', foods);
    await loadFoods();
    renderFoodsList();
    toast(`Imported ${foods.length} food${foods.length === 1 ? '' : 's'} from ${String(label).split('/').pop()}.`);
  } catch (err) { toast('Could not read that pack: ' + err.message); }
}

async function exportPack() {
  const mine = [...state.foods.values()].filter(f => f.source === 'custom').map(f => ({ name: f.name, brand: f.brand || '', barcode: f.barcode || '', per100: f.per100, servings: f.servings || [] }));
  if (!mine.length) return toast('You have no custom foods to export yet.');
  download(`daily-plate-food-pack-${todayStr()}.json`, JSON.stringify({ pack: 'daily-plate', foods: mine }, null, 2), 'application/json');
}

// ----- times and meals -----
const nowTime = () => { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
function timeLabel(t) {
  if (!/^\d{2}:\d{2}$/.test(t || '')) return '';
  return new Date('2000-01-01T' + t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
// meals shown in the diary: your list, then any meal names found on entries that aren't in it
function mealsFor(entries) {
  const extra = [...new Set(entries.map(e => e.meal))].filter(m => m && !MEALS.includes(m));
  return { list: [...MEALS, ...extra], extra };
}
// order inside a meal: by time when set, otherwise as added
const byTime = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || (a.createdAt || 0) - (b.createdAt || 0);

function renderMealsForm(list) {
  $('#meals-form').innerHTML = list.map((m, i) => `<div class="row meal-row" data-orig="${esc(m.orig)}">
    <input type="text" value="${esc(m.name)}" maxlength="30" aria-label="Meal name">
    <button type="button" class="small ghost" data-mup="${i}" aria-label="Move up">↑</button>
    <button type="button" class="small ghost" data-mdown="${i}" aria-label="Move down">↓</button>
    <button type="button" class="small ghost" data-mdel="${i}" aria-label="Remove meal">✕</button></div>`).join('');
}
function readMealsForm() {
  return [...$$('#meals-form .meal-row')].map(r => ({ orig: r.dataset.orig, name: r.querySelector('input').value.trim() }));
}
function bindMealsForm() {
  const refresh = () => renderMealsForm(MEALS.map(m => ({ orig: m, name: m })));
  $('#meals-form').addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    const list = readMealsForm();
    const i = Number(b.dataset.mup ?? b.dataset.mdown ?? b.dataset.mdel);
    if (b.dataset.mup != null && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
    if (b.dataset.mdown != null && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
    if (b.dataset.mdel != null) list.splice(i, 1);
    renderMealsForm(list);
  });
  $('#meal-add').addEventListener('click', () => { renderMealsForm([...readMealsForm(), { orig: '', name: '' }]); const ins = $$('#meals-form input'); ins[ins.length - 1].focus(); });
  $('#meals-save').addEventListener('click', async () => {
    const list = readMealsForm().filter(m => m.name);
    const names = list.map(m => m.name);
    if (!names.length) return toast('Keep at least one meal.');
    if (new Set(names.map(n => n.toLowerCase())).size !== names.length) return toast('Meal names must be different.');
    const renames = list.filter(m => m.orig && m.orig !== m.name);
    if (renames.length) {
      const map = new Map(renames.map(m => [m.orig, m.name]));
      const changed = (await DB.all('entries')).filter(e => map.has(e.meal)).map(e => ({ ...e, meal: map.get(e.meal) }));
      if (changed.length) await DB.saveMany('entries', changed);
    }
    MEALS.splice(0, MEALS.length, ...names);
    await DB.setSetting('meals', names);
    renderMealsForm(names.map(n => ({ orig: n, name: n })));
    await renderDiary();
    toast('Meals saved.');
  });
  refresh();
  return refresh;
}

// ----- grouped items: foods marked "part of the same item" share a groupId -----
const groupEntries = new Map();
function groupItems(items) {
  const out = []; const byGroup = new Map();
  for (const e of items) {
    if (!e.groupId) { out.push([e]); continue; }
    if (!byGroup.has(e.groupId)) { const g = []; byGroup.set(e.groupId, g); out.push(g); }
    byGroup.get(e.groupId).push(e);
  }
  return out;
}

function entryHtml(e, part) {
  const n = entryNutrients(e);
  return `<div class="entry${part ? ' part' : ''}" data-id="${e.id}">
    <div class="entry-main" data-edit="${e.id}">
      <div>${esc(e.food.name)}${e.food.brand ? ` <span class="hint">· ${esc(e.food.brand)}</span>` : ''}</div>
      <div class="hint">${e.time ? timeLabel(e.time) + ' · ' : ''}${esc(amountLabel(e))} · P ${fmt(n.protein)} · C ${fmt(n.carbs)} · F ${fmt(n.fat)}</div>
    </div>
    <div class="entry-kcal">${fmt(n.kcal, 'kcal')}</div>
    <button class="icon" data-del="${e.id}" aria-label="Delete">✕</button>
  </div>`;
}

function groupHtml(g) {
  groupEntries.set(g[0].groupId, g);
  const t = totalsOf(g); const gid = g[0].groupId;
  return `<details class="group" data-gid="${gid}">
    <summary class="entry"><div class="entry-main"><div>${esc(g[0].food.name)} <span class="hint">+ ${g.length - 1} more</span></div>
      <div class="hint">${g[0].time ? timeLabel(g[0].time) + ' · ' : ''}${g.length} parts · P ${fmt(t.protein)} · C ${fmt(t.carbs)} · F ${fmt(t.fat)}</div></div>
      <div class="entry-kcal">${fmt(t.kcal, 'kcal')}</div>
      <button type="button" class="icon" data-delgroup="${gid}" aria-label="Delete whole item">✕</button></summary>
    <div class="group-parts">${g.map(e => entryHtml(e, true)).join('')}
      <div class="group-report"></div>
      <div class="row end"><button type="button" class="small ghost" data-ungroup="${gid}">Ungroup parts</button></div></div>
  </details>`;
}

async function deleteGroup(gid) {
  const parts = (await entriesFor(state.date)).filter(e => e.groupId === gid);
  const ph = [];
  for (const e of parts) { ph.push(...await DB.byIndex('photos', 'entryId', e.id).catch(() => [])); await DB.remove('entries', e.id); }
  for (const p of ph) await DB.del('photos', p.id);
  await renderDiary();
  toast(`Removed ${parts[0] ? parts[0].food.name : 'item'} and ${Math.max(0, parts.length - 1)} part(s)`, 'Undo', async () => { await DB.saveMany('entries', parts); await DB.putMany('photos', ph); renderDiary(); });
}

async function ungroup(gid) {
  const parts = (await entriesFor(state.date)).filter(e => e.groupId === gid).map(e => { const c = { ...e }; delete c.groupId; return c; });
  await DB.saveMany('entries', parts);
  renderDiary();
  toast('Parts are now separate entries.');
}

function progressBar(n, v) {
  const g = state.goals[n.key] || 0;
  const pct = g ? Math.min(100, (v / g) * 100) : 0;
  const over = g && v > g;
  const cls = over ? (n.limit || n.key === 'kcal' ? 'bad' : 'good') : '';
  return `<div class="pbar"><div class="pbar-label"><span>${n.label}</span><span>${fmt(v, n.unit)} / ${g} ${n.unit}</span></div>
    <div class="pbar-track"><div class="pbar-fill ${cls}" style="width:${pct}%"></div></div></div>`;
}

function amountLabel(e) {
  if (e.unit === 'quick') return 'quick add';
  if (UNIT_GRAMS[e.unit]) return `${fmt(e.qty)} ${e.unit === 'floz' ? 'fl oz' : e.unit}`;
  return `${e.qty === 1 ? '' : fmt(e.qty) + ' × '}${e.unit} (${fmt(e.grams)} g)`;
}

async function saveDay(patch) {
  const day = (await DB.get('days', state.date)) || { date: state.date };
  Object.assign(day, patch, { updatedAt: Date.now() });
  await DB.save('days', day);
  renderDiary();
}

async function deleteEntry(id) {
  const e = await DB.get('entries', id);
  const ph = await DB.byIndex('photos', 'entryId', id).catch(() => []);
  await DB.remove('entries', id);
  for (const p of ph) await DB.del('photos', p.id);
  await renderDiary();
  toast(`Removed ${e ? e.food.name : 'entry'}`, 'Undo', async () => { if (e) { await DB.save('entries', e); await DB.putMany('photos', ph); renderDiary(); } });
}

async function copyYesterday() {
  const prev = await entriesFor(shiftDate(state.date, -1));
  if (!prev.length) return toast('Nothing logged the day before.');
  const now = Date.now();
  const gmap = new Map(); // keep grouped items grouped, with fresh group ids
  await DB.saveMany('entries', prev.map((e, i) => {
    const c = { ...e, id: uid(), date: state.date, createdAt: now + i };
    if (e.groupId) { if (!gmap.has(e.groupId)) gmap.set(e.groupId, uid()); c.groupId = gmap.get(e.groupId); }
    return c;
  }));
  toast(`Copied ${prev.length} item(s).`);
  renderDiary();
}

// ---------- add food ----------
// Meal that fits the current time of day (you can change it before saving).
function mealForNow() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const usual = h < 10.5 ? 'Breakfast' : h < 15 ? 'Lunch' : h >= 17 && h < 21 ? 'Dinner' : 'Snacks';
  if (MEALS.includes(usual)) return usual;
  return MEALS[Math.min(MEALS.length - 1, Math.floor((h / 24) * MEALS.length))]; // custom meals: spread across the day
}

function openAddDialog(meal, after) {
  state.addMeal = meal;
  state.after = after || null; // the food just saved with "Save & add another"
  $('#add-meal-name').textContent = meal;
  $('#add-search').value = '';
  $('#add-barcode').value = '';
  $('#add-status').textContent = '';
  $('#add-more').hidden = true;
  $('#add-attribution').hidden = true;
  renderLocalResults();
  $('#add-dialog').showModal();
  $('#add-search').focus();
}

async function recentFoodIds() {
  // food ids from the last 30 days, most-used first
  const from = shiftDate(todayStr(), -30);
  const recent = await DB.range('entries', 'date', from, '9999-12-31');
  const count = {};
  recent.forEach(e => {
    if (!e.foodId) return;
    const f = state.foods.get(e.foodId);
    if (f && f.recentHiddenAt && (e.createdAt || 0) <= f.recentHiddenAt) return; // removed from recents
    count[e.foodId] = (count[e.foodId] || 0) + 1;
  });
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

async function renderLocalResults() {
  const q = $('#add-search').value.trim().toLowerCase();
  let list;
  if (!q) {
    const favs = [...state.foods.values()].filter(f => f.favorite).sort((a, b) => a.name.localeCompare(b.name));
    const ids = await recentFoodIds();
    const recents = ids.map(id => state.foods.get(id)).filter(f => f && !f.favorite).slice(0, 15);
    list = [...favs, ...recents];
    if (!list.length) list = [...state.foods.values()].slice(0, 15);
    $('#add-status').textContent = list.length ? [favs.length ? '★ Favorites' : '', recents.length ? 'Recent foods' : ''].filter(Boolean).join(', then ') || 'Your foods' : '';
  } else {
    const words = q.split(/\s+/);
    list = [...state.foods.values()]
      .filter(f => words.every(w => (f.name + ' ' + (f.brand || '')).toLowerCase().includes(w)))
      .slice(0, 40);
    $('#add-status').textContent = list.length ? '' : 'No saved foods match. Press Enter or "Search online", or create it as a custom food.';
  }
  renderResults('#add-results', list, f => pickFood(f));
  addCreateButton();
}

function renderResults(container, list, onPick) {
  const el = $(container);
  el.innerHTML = list.map((f, i) => `<button type="button" class="result" data-i="${i}">
      <span>${f.favorite ? '<span class="fav-mark">★</span> ' : ''}${f.issue ? '⚠ ' : ''}<strong>${esc(f.name)}</strong>${f.brand ? ` · ${esc(f.brand)}` : ''}
      ${f.kind === 'restaurant' ? '<span class="tag tag-restaurant">restaurant</span>' : ''}<span class="tag tag-${f.source}">${sourceLabel(f.source)}</span></span>
      <span class="hint">${f.incomplete ? 'No nutrition listed — add it yourself' : `${fmt(f.per100.kcal, 'kcal')} kcal${f.estimated ? '*' : ''} ${f.perServingOnly ? 'per serving' : '/ 100 g'} · P ${fmt(f.per100.protein)} C ${fmt(f.per100.carbs)} F ${fmt(f.per100.fat)}`}${f.isDrink ? ' · drink' : ''}</span>
    </button>`).join('');
  el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => onPick(list[+b.dataset.i])));
}

function sourceLabel(s) {
  return { custom: 'mine', recipe: 'recipe', starter: 'basic', off: 'Open Food Facts', usda: 'USDA', menustat: 'MenuStat', quick: 'quick' }[s] || s;
}

// Online search with a Brands / Restaurants / Basic filter and paging.
const search = { q: '', filter: 'all', page: 1, results: [] };

async function onlineSearch(nextPage = false) {
  const q = $('#add-search').value.trim();
  if (!q) { $('#add-status').textContent = 'Type a food, brand or restaurant first.'; return; }
  if (!nextPage) Object.assign(search, { q, page: 1, results: [] });
  else search.page += 1;
  $('#add-status').textContent = nextPage ? 'Loading more…' : `Searching ${filterLabel(search.filter)} online…`;
  $('#add-more').hidden = true;
  const res = await Lookup.search(search.q, { filter: search.filter, page: search.page, settings: state.settings });
  const seen = new Set(search.results.map(f => f.id));
  search.results.push(...res.results.filter(f => !seen.has(f.id)));
  let msg = `${search.results.length} online result(s)` + (res.fromCache ? ' (saved from an earlier search)' : '') + '.';
  if (!nextPage && res.sources && res.sources.length) msg += ` Searched: ${res.sources.join(', ')}${res.chain ? ` (recognised chain: ${res.chain})` : ''}.`;
  if (!search.results.length && search.filter === 'drinks') msg += ' No drinks found. US alcohol labels do not have to list nutrition facts, so cans and bottles are often missing from the open data: try the built-in drinks (type "beer", "wine", "seltzer", "margarita"), or add it as a custom food.';
  if (!search.results.length && (search.filter === 'restaurants' || res.chain)) msg += ' Not found in the open data. MenuStat menus are historical snapshots and newer items may be missing. Try fewer words, the All filter, add it as a custom food, or import a food pack (Foods tab).';
  if (res.errors.length) msg += ' ' + res.errors.join('; ');
  $('#add-status').textContent = msg;
  $('#add-more').hidden = !res.more;
  $('#add-attribution').hidden = !search.results.length;
  renderResults('#add-results', search.results, f => pickFood(f));
  addCreateButton();
}

// Last row of the search results: make the typed name into your own food and log it.
function addCreateButton() {
  const q = $('#add-search').value.trim();
  if (!q) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'add-create';
  b.className = 'result-create'; // not .result, so it never counts as a search hit
  b.innerHTML = `<span><strong>+ Create “${esc(q)}” as a custom food</strong></span><span class="hint">Type in its calories and any nutrients, then log it</span>`;
  b.addEventListener('click', () => openCustomFromAdd({ name: q }));
  $('#add-results').appendChild(b);
}

// Custom food started from the add-food screen: fill it in, then pick the amount and log it.
function openCustomFromAdd(prefill = {}) {
  $('#add-dialog').close();
  openFoodEditor(null, { ...prefill, log: true });
}

function filterLabel(f) {
  return { all: 'all foods', brands: 'brands', restaurants: 'restaurants', drinks: 'drinks', basic: 'basic foods' }[f] || f;
}

function setSearchFilter(f) {
  search.filter = f;
  $$('#add-dialog .chip').forEach(c => c.classList.toggle('active', c.dataset.filter === f));
  if ($('#add-search').value.trim()) onlineSearch();
}

async function barcodeLookup(code) {
  code = String(code || '').replace(/\D/g, '');
  if (!code) return;
  const forms = Scanner.variants(code); // UPC-A and EAN-13 spellings of the same code
  const local = [...state.foods.values()].filter(f => f.barcode && forms.includes(String(f.barcode)));
  if (local.length === 1) return pickFood(local[0]);
  if (local.length > 1) { // a multipack's box code is shared by every flavor in it
    $('#add-status').textContent = `Barcode ${code} is on a pack with ${local.length} different items. Pick the one you had:`;
    return renderResults('#add-results', local, f => pickFood(f));
  }
  $('#add-status').textContent = 'Looking up barcode ' + code + '…';
  try {
    let lastError = null;
    for (const c of forms) {
      try {
        const f = await Lookup.barcode(c, state.settings);
        if (f) return pickFood(f);
      } catch (err) { lastError = err; }
    }
    if (lastError) throw lastError;
    const tried = [state.settings.offEnabled !== false && 'Open Food Facts', state.settings.usdaEnabled !== false && 'USDA FoodData Central'].filter(Boolean);
    const bad = !Scanner.checkDigitOk(code) ? ` The check digit doesn't add up for ${code}, so the number may have a typo or be a store-only code (I also tried it with the digit fixed).` : '';
    $('#add-status').textContent = `Barcode not found. Tried ${tried.join(' and ') || 'no online sources (both are off in Settings)'} with ${forms.length} spelling${forms.length > 1 ? 's' : ''} of the code (${forms.join(', ')}).${bad} You can create it as a custom food.`;
    $('#add-results').innerHTML = `<button type="button" class="result" id="create-from-barcode">+ Create custom food with barcode ${esc(code)}</button>`;
    $('#create-from-barcode').addEventListener('click', () => openCustomFromAdd({ barcode: code }));
  } catch (err) {
    $('#add-status').textContent = 'Lookup failed: ' + err.message;
  }
}

async function scanBarcode() {
  const code = await Scanner.scan();
  if (!code) return;
  $('#add-barcode').value = code;
  barcodeLookup(code);
}

async function pickFood(food) {
  // online results are saved locally so they're available offline next time
  if (!state.foods.has(food.id)) {
    food.createdAt = Date.now();
    await DB.save('foods', food);
    state.foods.set(food.id, food);
  }
  $('#add-dialog').close();
  openAmountDialog(state.foods.get(food.id), null);
}

// ---------- amount dialog ----------
// Units that are not a named serving. Drinks are measured by volume, and 1 ml of
// a drink weighs about 1 g, so volume units are offered for them.
const UNIT_GRAMS = { g: 1, oz: 28.3495, floz: 29.5735, ml: 1, cup: 236.6 };
const VOLUME_UNITS = ['floz', 'ml', 'cup'];
const UNIT_LABEL = { g: 'grams', oz: 'ounces (weight)', floz: 'fluid ounces (US)', ml: 'millilitres', cup: 'cups (8 fl oz)' };

function unitOptions(food, entry = state.editingEntry) {
  const opts = (food.servings || []).map(s => ({ value: 's:' + s.label, label: `${s.label} (${fmt(s.grams)} g)`, grams: s.grams }));
  const volume = food.isDrink || (entry && VOLUME_UNITS.includes(entry.unit));
  const units = [...(volume ? VOLUME_UNITS : []), 'g', 'oz'];
  units.forEach(u => opts.push({ value: u, label: UNIT_LABEL[u], grams: UNIT_GRAMS[u] }));
  return opts;
}

function openAmountDialog(food, entry) {
  state.pendingFood = food;
  state.editingEntry = entry;
  $('#amount-title').textContent = food.name;
  $('#food-menu').hidden = true;
  renderFoodHeader();
  const opts = unitOptions(food, entry);
  $('#amount-unit').innerHTML = opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  const mealOpts = entry && entry.meal && !MEALS.includes(entry.meal) ? [...MEALS, entry.meal] : MEALS;
  $('#amount-meal').innerHTML = mealOpts.map(m => `<option>${esc(m)}</option>`).join('');
  if (entry) {
    $('#amount-qty').value = entry.qty;
    $('#amount-unit').value = UNIT_GRAMS[entry.unit] ? entry.unit : 's:' + entry.unit;
    $('#amount-meal').value = entry.meal;
    $('#amount-time').value = entry.time || '';
  } else {
    $('#amount-time').value = state.date === todayStr() ? nowTime() : '';
    $('#amount-qty').value = opts.length > 2 ? 1 : 100;
    $('#amount-unit').value = opts[0].value;
    $('#amount-meal').value = state.addMeal;
  }
  $('#amount-more').hidden = !!entry;
  resetPhotos();
  if (entry) DB.byIndex('photos', 'entryId', entry.id).then(list => {
    if (state.editingEntry !== entry) return;
    state.photos = list.sort((a, b) => a.at - b.at).map(p => ({ id: p.id, blob: p.blob, url: URL.createObjectURL(p.blob), isNew: false }));
    renderPhotoStrip();
  }).catch(() => {});
  const after = !entry && state.after;
  $('#amount-same-row').hidden = !after;
  $('#amount-same').checked = false; // default: a separate entry
  $('#amount-meal').disabled = false;
  $('#amount-time').disabled = false;
  if (after) $('#amount-same-text').textContent = `Part of the same item as ${after.name}`;
  renderAmountPreview();
  $('#amount-dialog').showModal();
  $('#amount-dialog .sheet-body').scrollTop = 0;
}

const DATASET_LABEL = { 'SR Legacy': 'USDA SR Legacy', 'Foundation': 'USDA Foundation Foods', 'Survey (FNDDS)': 'USDA FNDDS', 'Branded': 'USDA Branded Foods' };
function sourceText(f) {
  if (f.source === 'usda') return DATASET_LABEL[f.dataset] || 'USDA FoodData Central';
  if (f.source === 'menustat') return `MenuStat, NYC Health Dept (menu year ${f.menuYear || 'unknown'}${f.perServingOnly ? '; serving weight not listed' : ''})`;
  return { off: 'Open Food Facts', starter: 'Built-in basics (USDA, rounded)', custom: f.oneOff ? 'Your custom food (logged once, not saved to your foods)' : 'Your custom food', recipe: 'Your recipe', quick: 'Quick add' }[f.source] || f.source;
}

// Star, brand, data source, nutrient count and any issue flag for the food screen.
function renderFoodHeader() {
  const f = state.pendingFood;
  const saved = state.foods.get(f.id) || f;
  const fav = !!saved.favorite;
  $('#fav-toggle').textContent = fav ? '★' : '☆';
  $('#fav-toggle').classList.toggle('on', fav);
  $('#fav-toggle').setAttribute('aria-pressed', String(fav));
  $('#menu-fav-label').textContent = fav ? 'Remove from favorites' : 'Add to favorites';
  const listed = NUTRIENTS.filter(n => !n.derived && f.per100 && f.per100[n.key] != null).length;
  $('#amount-brand').textContent = [f.brand, f.kind === 'restaurant' ? 'restaurant' : '', f.isDrink ? 'drink' : '', f.abv ? f.abv + '% ABV' : ''].filter(Boolean).join(' · ');
  const caveat = f.incomplete ? ' · No nutrition facts in the data source (common for alcohol): use "Edit a copy" to type the label in'
    : f.estimated ? ' · Calories worked out from the carbs, fat, protein and alcohol listed'
    : '';
  $('#amount-meta').textContent = `${listed} listed nutrient${listed === 1 ? '' : 's'} · Data source: ${sourceText(f)}${caveat}${f.note && f.source === 'starter' ? ' · ' + f.note : ''}`;
  $('#amount-flag').hidden = !saved.issue;
  $('#amount-flag').textContent = saved.issue ? `⚠ You flagged this food: ${saved.issue.note || 'no note'}` : '';
}

// Make sure the food on screen is saved in "Your foods" before changing it.
async function ensureSavedFood() {
  const f = state.pendingFood;
  if (!state.foods.has(f.id)) {
    const rec = { ...f, createdAt: Date.now() };
    delete rec.oneOff;
    await DB.save('foods', rec);
    state.foods.set(rec.id, rec);
  }
  return state.foods.get(f.id);
}

async function toggleFavorite() {
  const f = await ensureSavedFood();
  f.favorite = !f.favorite;
  await DB.save('foods', f);
  state.pendingFood = { ...state.pendingFood, favorite: f.favorite };
  renderFoodHeader();
  toast(f.favorite ? 'Added to favorites. Favorites show first when you add food.' : 'Removed from favorites.');
}

async function foodMenuAction(act) {
  $('#food-menu').hidden = true;
  const f = state.pendingFood;
  if (act === 'fav') return toggleFavorite();
  if (act === 'recent') {
    const saved = await ensureSavedFood();
    saved.recentHiddenAt = Date.now();
    await DB.save('foods', saved);
    return toast(`${f.name} removed from recents. It's still in your foods.`);
  }
  if (act === 'report') return openIssueDialog();
  if (act === 'copy') {
    const logging = !state.editingEntry; // opened from adding food: log the copy next
    $('#amount-dialog').close();
    return openFoodEditor(null, { copyFrom: f, log: logging });
  }
}

function sourceUrl(f) {
  if (f.source === 'off' && f.barcode) return `https://world.openfoodfacts.org/product/${encodeURIComponent(f.barcode)}`;
  if (f.source === 'usda' && /^usda-\d+$/.test(f.id)) return `https://fdc.nal.usda.gov/food-details/${f.id.slice(5)}/nutrients`;
  if (f.source === 'menustat') return 'https://data.cityofnewyork.us/d/qgc5-ecnb';
  return null;
}

function openIssueDialog() {
  const f = state.foods.get(state.pendingFood.id) || state.pendingFood;
  $('#issue-food').textContent = `${f.name}${f.brand ? ' · ' + f.brand : ''} (${sourceText(f)})`;
  $('#issue-note').value = f.issue ? f.issue.note : '';
  const url = sourceUrl(f);
  $('#issue-source').hidden = !url;
  if (url) {
    $('#issue-source').href = url;
    $('#issue-source').textContent = f.source === 'off' ? 'Fix it on Open Food Facts' : f.source === 'menustat' ? 'View the MenuStat dataset' : 'View it on USDA FoodData Central';
  }
  $('#issue-clear').hidden = !f.issue;
  updateIssueLink();
  $('#issue-dialog').showModal();
}

// Pre-filled "new issue" page in the project's GitHub repo (no token needed).
const ISSUE_REPO = 'https://github.com/ryelikebread/Daily-Plate/issues/new';
function updateIssueLink() {
  const f = state.foods.get(state.pendingFood.id) || state.pendingFood;
  const title = `Food data: ${f.name}${f.brand ? ' (' + f.brand + ')' : ''}`.slice(0, 120);
  const body = issueDetails().slice(0, 4000);
  $('#issue-github').href = `${ISSUE_REPO}?labels=food-data&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
}

function issueDetails() {
  const f = state.foods.get(state.pendingFood.id) || state.pendingFood;
  const lines = [`Food: ${f.name}`, f.brand ? `Brand: ${f.brand}` : '', `Source: ${sourceText(f)}`, f.barcode ? `Barcode: ${f.barcode}` : '', sourceUrl(f) ? `Link: ${sourceUrl(f)}` : '',
    `Issue: ${$('#issue-note').value || '(no note)'}`, 'Per 100 g: ' + NUTRIENTS.filter(n => f.per100[n.key] != null).map(n => `${n.label} ${fmt(f.per100[n.key], n.unit)} ${n.unit}`).join(', ')];
  return lines.filter(Boolean).join('\n');
}

async function onIssueClose() {
  if ($('#issue-dialog').returnValue !== 'ok') return;
  const f = await ensureSavedFood();
  f.issue = { note: $('#issue-note').value.trim(), at: Date.now() };
  await DB.save('foods', f);
  renderFoodHeader();
  toast('Flag saved on this food.');
}

function currentGrams() {
  const food = state.pendingFood;
  const qty = parseFloat($('#amount-qty').value) || 0;
  const opt = unitOptions(food).find(o => o.value === $('#amount-unit').value);
  return { qty, grams: qty * (opt ? opt.grams : 1), unit: opt ? (opt.value.startsWith('s:') ? opt.value.slice(2) : opt.value) : 'g' };
}

function renderAmountPreview() {
  const { grams } = currentGrams();
  const n = scaleNutrients(state.pendingFood.per100, grams);
  $('#amount-preview').textContent = `Nutrition for ${fmt(grams)} g: ${fmt(n.kcal, 'kcal')} kcal`;
  Report.render($('#amount-report'), n, { goals: state.goals });
}

async function onAmountClose() {
  const rv = $('#amount-dialog').returnValue;
  const photos = state.photos, removed = state.removedPhotos;
  state.photos = []; state.removedPhotos = [];
  if (rv !== 'ok' && rv !== 'more') { photos.forEach(p => URL.revokeObjectURL(p.url)); return; }
  const food = state.pendingFood;
  const { qty, grams, unit } = currentGrams();
  if (!(grams > 0)) return;
  const base = state.editingEntry || { id: uid(), date: state.date, createdAt: Date.now() };
  const entry = {
    ...base,
    meal: $('#amount-meal').value,
    time: $('#amount-time').value || '',
    foodId: food.id,
    // snapshot of the food, so the archive stays accurate if the food is edited later
    food: { name: food.name, brand: food.brand || '', source: food.source, per100: food.per100 },
    qty, unit, grams,
    updatedAt: Date.now(),
  };
  if (!state.editingEntry && state.after && $('#amount-same').checked) {
    // join the previous food's group (the previous entry becomes the group's first part)
    const prev = await DB.get('entries', state.after.entryId);
    if (prev) {
      if (!prev.groupId) { prev.groupId = uid(); await DB.save('entries', prev); }
      entry.groupId = prev.groupId;
      entry.meal = prev.meal;
      entry.time = prev.time || entry.time;
    }
  }
  await DB.save('entries', entry);
  // a grouped item moves as a whole: new meal or time on one part applies to all parts
  if (state.editingEntry && entry.groupId && (base.meal !== entry.meal || (base.time || '') !== entry.time)) {
    const sibs = (await DB.byIndex('entries', 'date', entry.date)).filter(e => e.groupId === entry.groupId && e.id !== entry.id);
    if (sibs.length) await DB.saveMany('entries', sibs.map(e => ({ ...e, meal: entry.meal, time: entry.time })));
  }
  for (const id of removed) await DB.del('photos', id);
  for (const p of photos) if (p.isNew) await DB.put('photos', { id: p.id, entryId: entry.id, date: entry.date, blob: p.blob, at: Date.now() });
  photos.forEach(p => URL.revokeObjectURL(p.url));
  renderDiary();
  if (rv === 'more') { toast(`Added ${food.name}. Pick another.`); openAddDialog(entry.meal, { entryId: entry.id, name: food.name, meal: entry.meal, time: entry.time }); }
  else state.after = null;
}

async function editEntry(id) {
  const e = await DB.get('entries', id);
  if (!e) return;
  if (e.unit === 'quick') return toast('Quick-add entries can be deleted and re-added.');
  const food = state.foods.get(e.foodId) || { id: e.foodId, ...e.food, servings: [] };
  if (!UNIT_GRAMS[e.unit] && !(food.servings || []).some(s => s.label === e.unit)) {
    food.servings = [...(food.servings || []), { label: e.unit, grams: e.grams / e.qty }];
  }
  openAmountDialog(food, e);
}

// ---------- quick add ----------
function openQuickAdd() {
  ['kcal', 'protein', 'carbs', 'fat'].forEach(k => ($('#quick-' + k).value = ''));
  $('#quick-name').value = 'Quick add';
  $('#quick-dialog').showModal();
  $('#quick-kcal').focus();
}

async function onQuickClose() {
  if ($('#quick-dialog').returnValue !== 'ok') return;
  const per100 = {};
  ['kcal', 'protein', 'carbs', 'fat'].forEach(k => { const v = parseFloat($('#quick-' + k).value); if (Number.isFinite(v)) per100[k] = v; });
  if (per100.kcal == null) return toast('Enter calories for a quick add.');
  await DB.save('entries', {
    id: uid(), date: state.date, meal: state.addMeal, time: state.date === todayStr() ? nowTime() : '', createdAt: Date.now(), foodId: null,
    food: { name: $('#quick-name').value || 'Quick add', brand: '', source: 'quick', per100 },
    qty: 1, unit: 'quick', grams: 100,
  });
  renderDiary();
}

// ---------- foods tab ----------
function renderFoodsList() {
  const q = $('#foods-filter').value.trim().toLowerCase();
  const order = { recipe: 0, custom: 1, off: 2, usda: 3, starter: 4 };
  const list = [...state.foods.values()]
    .filter(f => !q || (f.name + ' ' + (f.brand || '')).toLowerCase().includes(q))
    .sort((a, b) => (order[a.source] ?? 9) - (order[b.source] ?? 9) || a.name.localeCompare(b.name));
  $('#foods-list').innerHTML = list.map(f => `<div class="card food-row">
      <div><strong>${esc(f.name)}</strong>${f.brand ? ` · ${esc(f.brand)}` : ''} <span class="tag tag-${f.source}">${sourceLabel(f.source)}</span>
      <div class="hint">${fmt(f.per100.kcal, 'kcal')} kcal ${f.perServingOnly ? 'per serving' : '/ 100 g'} · P ${fmt(f.per100.protein)} C ${fmt(f.per100.carbs)} F ${fmt(f.per100.fat)}</div></div>
      <div class="row"><button class="small" data-edit="${esc(f.id)}">Edit</button><button class="small ghost" data-del="${esc(f.id)}">Delete</button></div>
    </div>`).join('') || '<p class="hint">No foods yet.</p>';
  $$('#foods-list [data-edit]').forEach(b => b.addEventListener('click', () => {
    const f = state.foods.get(b.dataset.edit);
    f.source === 'recipe' ? openRecipeEditor(f) : openFoodEditor(f);
  }));
  $$('#foods-list [data-del]').forEach(b => b.addEventListener('click', async () => {
    const f = state.foods.get(b.dataset.del);
    await DB.remove('foods', f.id); state.foods.delete(f.id); renderFoodsList();
    toast(`Deleted ${f.name}. Past diary entries keep their values.`, 'Undo', async () => { await DB.save('foods', f); state.foods.set(f.id, f); renderFoodsList(); });
  }));
}

let editingFood = null;
let foodLogMode = false; // true when the editor was opened while adding food to the diary
function openFoodEditor(food, prefill = {}) {
  editingFood = food;
  foodLogMode = !food && !!prefill.log;
  $('#food-log-opts').hidden = !foodLogMode;
  $('#food-keep').checked = true;
  updateFoodOk();
  const src = food || prefill.copyFrom || null; // "Edit a copy" pre-fills from another food
  $('#food-dialog-title').textContent = food ? 'Edit food' : prefill.copyFrom ? 'Edit a copy' : 'Custom food';
  $('#food-name').value = food ? food.name : prefill.copyFrom ? prefill.copyFrom.name + ' (my copy)' : prefill.name || '';
  $('#food-brand').value = src ? src.brand || '' : '';
  $('#food-barcode').value = src ? src.barcode || '' : prefill.barcode || '';
  $('#food-basis').value = 100;
  const input = (n) => `<label>${n.label} (${n.unit})
      <input type="number" step="any" min="0" data-n="${n.key}" value="${src && src.per100[n.key] != null ? src.per100[n.key] : ''}"></label>`;
  const editable = NUTRIENTS.filter(n => !n.derived);
  const extra = editable.filter(n => !n.core);
  const extraFilled = src && extra.some(n => src.per100[n.key] != null);
  $('#food-nutrients').innerHTML = editable.filter(n => n.core).map(input).join('') +
    `<details class="goal-group" style="grid-column:1/-1" ${extraFilled ? 'open' : ''}><summary>More nutrients (vitamins, minerals, fats, amino acids)</summary>
      ${NUTRIENT_GROUPS.map(g => { const l = extra.filter(n => n.group === g); return l.length ? `<h4 class="rgroup">${g}</h4><div class="grid2">${l.map(input).join('')}</div>` : ''; }).join('')}</details>`;
  $('#food-servings').value = src ? (src.servings || []).map(s => `${s.label} = ${s.grams}`).join('\n') : '';
  $('#food-dialog').showModal();
  if (foodLogMode && !prefill.copyFrom) $(prefill.name ? '[data-n="kcal"]' : '#food-name').focus();
}

function updateFoodOk() {
  $('#food-ok').textContent = !foodLogMode ? 'Save food' : $('#food-keep').checked ? 'Save & log' : 'Log once';
}

function parseServings(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)\s*=\s*([\d.]+)\s*g?$/i);
    return m && parseFloat(m[2]) > 0 ? { label: m[1] || '1 serving', grams: parseFloat(m[2]) } : null;
  }).filter(Boolean);
}

async function onFoodClose() {
  const logging = foodLogMode;
  foodLogMode = false;
  if ($('#food-dialog').returnValue !== 'ok') { if (logging) $('#add-dialog').showModal(); return; }
  const keep = !logging || $('#food-keep').checked;
  const basis = parseFloat($('#food-basis').value) || 100;
  const per100 = {};
  $$('#food-nutrients [data-n]').forEach(inp => {
    const v = parseFloat(inp.value);
    if (Number.isFinite(v)) per100[inp.dataset.n] = Math.round((v * 100 / basis) * 100) / 100;
  });
  const food = {
    ...(editingFood || { id: 'custom-' + uid(), source: 'custom', createdAt: Date.now() }),
    name: $('#food-name').value.trim() || 'Unnamed food',
    brand: $('#food-brand').value.trim(),
    barcode: $('#food-barcode').value.trim(),
    per100,
    servings: parseServings($('#food-servings').value),
    updatedAt: Date.now(),
  };
  if (basis !== 100 && !food.servings.some(s => s.grams === basis)) food.servings.unshift({ label: '1 serving', grams: basis });
  if (food.source === 'starter' || food.source === 'off' || food.source === 'usda') food.edited = true;
  if (!keep) {
    // log once: the diary entry keeps its own copy of the values, nothing goes into "Your foods"
    food.id = 'oneoff-' + uid();
    food.oneOff = true; // only on this screen; dropped if you star it or flag it (that saves it)
    return openAmountDialog(food, null);
  }
  await DB.save('foods', food);
  state.foods.set(food.id, food);
  renderFoodsList();
  if (logging) return openAmountDialog(food, null);
  toast(`Saved ${food.name}`);
}

// ---------- recipes ----------
function openRecipeEditor(food) {
  state.recipe = food
    ? { ...food, ingredients: (food.ingredients || []).map(i => ({ ...i })) }
    : { id: 'recipe-' + uid(), source: 'recipe', name: '', ingredients: [], recipeServings: 4, createdAt: Date.now() };
  $('#recipe-dialog-title').textContent = food ? 'Edit recipe' : 'New recipe';
  $('#recipe-name').value = state.recipe.name;
  $('#recipe-servings').value = state.recipe.recipeServings || 1;
  $('#recipe-search').value = '';
  $('#recipe-results').innerHTML = '';
  renderRecipeIngredients();
  $('#recipe-dialog').showModal();
}

function renderRecipeIngredients() {
  const r = state.recipe;
  $('#recipe-ingredients').innerHTML = r.ingredients.map((ing, i) => `<div class="entry">
      <div class="entry-main">${esc(ing.name)}</div>
      <input type="number" step="any" min="0" value="${ing.grams}" data-g="${i}" style="width:5em"> g
      <button type="button" class="icon" data-rm="${i}" aria-label="Remove">✕</button></div>`).join('') || '<p class="hint">No ingredients yet.</p>';
  $$('#recipe-ingredients [data-g]').forEach(inp => inp.addEventListener('input', () => { r.ingredients[+inp.dataset.g].grams = parseFloat(inp.value) || 0; renderRecipePreview(); }));
  $$('#recipe-ingredients [data-rm]').forEach(b => b.addEventListener('click', () => { r.ingredients.splice(+b.dataset.rm, 1); renderRecipeIngredients(); }));
  renderRecipePreview();
}

function renderRecipeResults() {
  const q = $('#recipe-search').value.trim().toLowerCase();
  if (!q) { $('#recipe-results').innerHTML = ''; return; }
  const list = [...state.foods.values()].filter(f => f.id !== state.recipe.id && f.name.toLowerCase().includes(q)).slice(0, 10);
  renderResults('#recipe-results', list, f => {
    const grams = f.servings && f.servings[0] ? f.servings[0].grams : 100;
    state.recipe.ingredients.push({ foodId: f.id, name: f.name, grams, per100: f.per100 });
    $('#recipe-search').value = ''; $('#recipe-results').innerHTML = '';
    renderRecipeIngredients();
  });
}

function computeRecipe(r) {
  let total = {}; let grams = 0;
  r.ingredients.forEach(ing => {
    const f = state.foods.get(ing.foodId);
    const per100 = f ? f.per100 : ing.per100;
    total = addNutrients(total, scaleNutrients(per100, ing.grams));
    grams += ing.grams;
  });
  const per100 = {};
  if (grams > 0) for (const [k, v] of Object.entries(total)) per100[k] = Math.round((v * 100 / grams) * 100) / 100;
  return { total, grams, per100 };
}

function renderRecipePreview() {
  const servings = parseFloat($('#recipe-servings').value) || 1;
  const { total, grams } = computeRecipe(state.recipe);
  $('#recipe-preview').textContent = grams
    ? `Whole recipe: ${fmt(grams)} g, ${fmt(total.kcal, 'kcal')} kcal. Per serving: ${fmt(grams / servings)} g, ${fmt((total.kcal || 0) / servings, 'kcal')} kcal, P ${fmt((total.protein || 0) / servings)} g.`
    : '';
}

async function onRecipeClose() {
  if ($('#recipe-dialog').returnValue !== 'ok') return;
  const r = state.recipe;
  const servings = parseFloat($('#recipe-servings').value) || 1;
  const { grams, per100 } = computeRecipe(r);
  if (!r.ingredients.length || !grams) return toast('A recipe needs at least one ingredient.');
  const food = {
    ...r,
    name: $('#recipe-name').value.trim() || 'My recipe',
    brand: '',
    recipeServings: servings,
    per100,
    servings: [{ label: '1 serving', grams: Math.round((grams / servings) * 10) / 10 }, { label: 'whole recipe', grams }],
    updatedAt: Date.now(),
  };
  await DB.save('foods', food);
  state.foods.set(food.id, food);
  renderFoodsList();
  toast(`Saved recipe ${food.name}`);
}

// ---------- trends ----------
async function dailyTotals(from, to) {
  const entries = await DB.range('entries', 'date', from, to);
  const byDate = {};
  entries.forEach(e => { byDate[e.date] = addNutrients(byDate[e.date] || {}, entryNutrients(e)); });
  return byDate;
}

async function renderTrends() {
  const days = parseInt($('#trend-range').value, 10);
  const key = $('#trend-nutrient').value || 'kcal';
  const n = NUTRIENT_BY_KEY[key];
  const to = todayStr(); const from = shiftDate(to, -(days - 1));
  const totals = await dailyTotals(from, to);
  const dates = []; for (let i = 0; i < days; i++) dates.push(shiftDate(from, i));
  const values = dates.map(d => (totals[d] ? totals[d][key] || 0 : null));
  const logged = values.filter(v => v != null);
  const avg = logged.length ? logged.reduce((a, b) => a + b, 0) / logged.length : 0;
  const allDays = await DB.all('days');
  const streak = await loggingStreak();

  $('#trend-stats').innerHTML = `<div class="sum-head">
    <div><div class="big">${logged.length}/${days}</div><div class="hint">days logged</div></div>
    <div><div class="big">${fmt(avg, n.unit)}</div><div class="hint">avg ${n.unit}/day</div></div>
    <div><div class="big">${streak}</div><div class="hint">day streak</div></div></div>`;
  $('#trend-chart').innerHTML = barChart(dates, values, state.goals[key], n);

  const weights = dates.map(d => { const day = allDays.find(x => x.date === d); return day && day.weight != null ? day.weight : null; });
  $('#weight-chart').innerHTML = weights.some(w => w != null) ? lineChart(dates, weights) : '<p class="hint">Log body weight on the Diary tab to see it here.</p>';

  // archive: every day with entries or notes, newest first
  const allEntries = await DB.all('entries');
  const byDate = {};
  allEntries.forEach(e => { (byDate[e.date] = byDate[e.date] || []).push(e); });
  allDays.forEach(d => { byDate[d.date] = byDate[d.date] || []; });
  const dayMap = Object.fromEntries(allDays.map(d => [d.date, d]));
  const archive = Object.keys(byDate).sort().reverse();
  $('#archive-list').innerHTML = archive.length ? `<table class="ntable"><thead><tr><th>Date</th><th>Items</th><th>kcal</th><th></th></tr></thead><tbody>
    ${archive.map(d => { const t = totalsOf(byDate[d]); return `<tr class="click" data-date="${d}"><td>${esc(prettyDate(d))}</td><td>${byDate[d].length}</td><td>${fmt(t.kcal || 0, 'kcal')}</td><td>${dayMap[d] && dayMap[d].complete ? '✓' : ''}</td></tr>`; }).join('')}
    </tbody></table>` : '<p class="hint">Your archive will appear here as you log days.</p>';
  $$('#archive-list [data-date]').forEach(r => r.addEventListener('click', () => { showTab('diary'); setDate(r.dataset.date); }));
}

async function loggingStreak() {
  let d = todayStr(); let streak = 0;
  // today counts if logged; otherwise start from yesterday
  if (!(await DB.byIndex('entries', 'date', d)).length) d = shiftDate(d, -1);
  while ((await DB.byIndex('entries', 'date', d)).length) { streak++; d = shiftDate(d, -1); }
  return streak;
}

function barChart(dates, values, goal, n) {
  const W = 640, H = 220, P = 30;
  const max = Math.max(goal || 0, ...values.map(v => v || 0)) * 1.1 || 1;
  const bw = (W - P * 2) / dates.length;
  const y = v => H - P - (v / max) * (H - P * 2);
  const bars = values.map((v, i) => v == null ? '' :
    `<rect x="${P + i * bw + bw * 0.1}" y="${y(v)}" width="${bw * 0.8}" height="${H - P - y(v)}" class="bar ${goal && v > goal && (n.limit || n.key === 'kcal') ? 'over' : ''}"><title>${dates[i]}: ${fmt(v, n.unit)} ${n.unit}</title></rect>`).join('');
  const goalLine = goal ? `<line x1="${P}" x2="${W - P}" y1="${y(goal)}" y2="${y(goal)}" class="goal"/><text x="${W - P}" y="${y(goal) - 4}" text-anchor="end" class="axis">goal ${goal}</text>` : '';
  const labels = [0, Math.floor(dates.length / 2), dates.length - 1].map(i => `<text x="${P + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle" class="axis">${dates[i].slice(5)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${n.label} per day">${bars}${goalLine}${labels}
    <line x1="${P}" x2="${W - P}" y1="${H - P}" y2="${H - P}" class="baseline"/></svg>`;
}

function lineChart(dates, values) {
  const W = 640, H = 180, P = 30;
  const pts = values.map((v, i) => [i, v]).filter(p => p[1] != null);
  const vs = pts.map(p => p[1]);
  const min = Math.min(...vs) - 1, max = Math.max(...vs) + 1;
  const x = i => P + (i / Math.max(1, dates.length - 1)) * (W - P * 2);
  const y = v => H - P - ((v - min) / (max - min)) * (H - P * 2);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])},${y(p[1])}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Body weight"><path d="${path}" class="line"/>
    ${pts.map(p => `<circle cx="${x(p[0])}" cy="${y(p[1])}" r="3" class="dot"><title>${dates[p[0]]}: ${p[1]} ${state.settings.weightUnit}</title></circle>`).join('')}
    <text x="${P}" y="14" class="axis">${fmt(max - 1)} ${state.settings.weightUnit}</text><text x="${P}" y="${H - 8}" class="axis">${fmt(min + 1)}</text></svg>`;
}

// ---------- settings ----------
function renderSettings() {
  const goalInput = (n) => `<label>${n.label} (${n.unit})${n.limit ? ' max' : ''}
    <input type="number" step="any" min="0" data-goal="${n.key}" value="${state.goals[n.key] ?? ''}" placeholder="no target"></label>`;
  const goalable = NUTRIENTS.filter(n => !n.derived);
  $('#goals-form').innerHTML = goalable.filter(n => n.main).map(goalInput).join('') +
    NUTRIENT_GROUPS.map(g => `<details class="goal-group" style="grid-column:1/-1"><summary>${g}</summary><div class="grid2">${goalable.filter(n => n.group === g && !n.main).map(goalInput).join('')}</div></details>`).join('') +
    '<p class="hint" style="grid-column:1/-1">Defaults are typical adult reference values (NIH RDA/AI and FDA Daily Values). Leave a box empty for no target. Amino-acid targets assume a 70 kg (154 lb) adult.</p>';
  const s = state.settings;
  $('#rem-enabled').checked = s.remEnabled;
  $('#rem-time').value = s.remTime;
  $('#rem-meals').checked = s.remMeals;
  $('#rem-meal-times').value = s.remMealTimes;
  $('#off-enabled').checked = s.offEnabled;
  $('#usda-enabled').checked = s.usdaEnabled;
  $('#menustat-enabled').checked = s.menustatEnabled !== false;
  $('#usda-key').value = s.usdaKey;
  $('#weight-unit').value = s.weightUnit;
  storageStatus();
}

async function saveGoals() {
  $$('#goals-form [data-goal]').forEach(inp => { const v = parseFloat(inp.value); state.goals[inp.dataset.goal] = Number.isFinite(v) ? v : null; });
  await DB.setSetting('goals', state.goals);
  toast('Goals saved.');
  renderDiary();
}

async function saveReminder() {
  const s = state.settings;
  s.remEnabled = $('#rem-enabled').checked;
  s.remTime = $('#rem-time').value || '21:00';
  s.remMeals = $('#rem-meals').checked;
  s.remMealTimes = $('#rem-meal-times').value;
  await saveSettings();
  if (s.remEnabled || s.remMeals) await ensureNotifyPermission();
  toast('Reminder saved.');
}

async function saveLookup() {
  const s = state.settings;
  s.offEnabled = $('#off-enabled').checked;
  s.usdaEnabled = $('#usda-enabled').checked;
  s.menustatEnabled = $('#menustat-enabled').checked;
  s.usdaKey = $('#usda-key').value.trim();
  s.weightUnit = $('#weight-unit').value;
  await saveSettings();
  toast('Settings saved.');
  renderDiary();
}

async function storageStatus() {
  let text = 'Data is stored in this browser on this device.';
  if (navigator.storage && navigator.storage.persisted) {
    const p = await navigator.storage.persisted().catch(() => false);
    text += p ? ' Storage is marked persistent (the browser will not clear it automatically).' : ' Storage is not yet persistent; install the app or back up regularly.';
  }
  const last = await DB.getSetting('lastBackup', null);
  text += last ? ` Last backup: ${new Date(last).toLocaleString()}.` : ' No backup made yet.';
  $('#storage-status').textContent = text;
}

// ---------- reminders ----------
async function ensureNotifyPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

async function notify(title, body) {
  showBanner(body);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = navigator.serviceWorker && (await navigator.serviceWorker.getRegistration());
    if (reg) await reg.showNotification(title, { body, icon: 'icon.svg', tag: 'daily-plate', data: { url: './#diary' } });
    else new Notification(title, { body, icon: 'icon.svg' });
  } catch (_) { /* banner already shown */ }
}

function showBanner(text) { $('#reminder-text').textContent = text; $('#reminder-banner').hidden = false; }
function hideBanner() { $('#reminder-banner').hidden = true; }

function nowHHMM() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

async function checkReminders() {
  const s = state.settings;
  const today = todayStr();
  const now = nowHHMM();
  const sent = await DB.getSetting('remindersSent', {});
  const mark = async (k) => { sent[k] = today; await DB.setSetting('remindersSent', sent); };

  if (s.remEnabled && now >= s.remTime && sent.eod !== today) {
    const day = (await DB.get('days', today)) || {};
    if (!day.complete) {
      const count = (await DB.byIndex('entries', 'date', today)).length;
      await notify('Time to wrap up today', count
        ? `You've logged ${count} item(s) today. Add anything missing and mark the day complete.`
        : "You haven't logged any food today. Did you eat? Add it now so your archive stays complete.");
    }
    await mark('eod');
  }

  if (s.remMeals) {
    const times = s.remMealTimes.split(',').map(t => t.trim()).filter(t => /^\d{2}:\d{2}$/.test(t));
    for (const [i, t] of times.entries()) {
      const key = 'meal' + i;
      if (now >= t && sent[key] !== today && (i === times.length - 1 || now < times[i + 1])) {
        const meal = MEALS[Math.min(i, MEALS.length - 1)];
        const has = (await DB.byIndex('entries', 'date', today)).some(e => e.meal === meal);
        if (!has) await notify(`${meal} time`, `Have you eaten ${meal.toLowerCase()}? Log it in Daily Plate.`);
        await mark(key);
      }
    }
  }
}

function downloadIcs() {
  const t = ($('#rem-time').value || state.settings.remTime).replace(':', '');
  const start = todayStr().replace(/-/g, '') + 'T' + t + '00';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Daily Plate//Reminder//EN',
    'BEGIN:VEVENT', `UID:daily-plate-${uid()}@local`, `DTSTAMP:${stamp}`,
    `DTSTART:${start}`, 'DURATION:PT10M', 'RRULE:FREQ=DAILY',
    "SUMMARY:Log today's food (Daily Plate)",
    'DESCRIPTION:Open Daily Plate\\, finish today\'s log and mark the day complete.',
    'TRANSP:TRANSPARENT',
    'BEGIN:VALARM', 'ACTION:DISPLAY', "DESCRIPTION:Log today's food", 'TRIGGER:PT0M', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  download('daily-plate-reminder.ics', ics, 'text/calendar');
}

// ---------- export / import ----------
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

async function exportJson() {
  const data = { app: 'daily-plate', version: APP_VERSION, exportedAt: new Date().toISOString() };
  for (const s of DB.STORES) data[s] = await DB.all(s);
  data.settings = data.settings.filter(r => !DEVICE_ONLY_SETTINGS.includes(r.key)); // never export the sync token or passphrase
  download(`daily-plate-backup-${todayStr()}.json`, JSON.stringify(data, null, 2), 'application/json');
  await DB.setSetting('lastBackup', Date.now());
  storageStatus();
}

async function exportEntriesCsv() {
  const entries = (await DB.all('entries')).sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal) || byTime(a, b));
  const head = ['date', 'meal', 'time', 'food', 'brand', 'source', 'amount', 'unit', 'grams', 'group', ...NUTRIENTS.map(n => `${n.key}_${n.unit}`)];
  const rows = entries.map(e => { const n = entryNutrients(e); return [e.date, e.meal, e.time || '', e.food.name, e.food.brand, e.food.source, e.qty, e.unit, round2(e.grams), e.groupId || '', ...NUTRIENTS.map(x => round2(n[x.key]))]; });
  download(`daily-plate-entries-${todayStr()}.csv`, [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}

async function exportDailyCsv() {
  const totals = await dailyTotals('0000-01-01', '9999-12-31');
  const days = Object.fromEntries((await DB.all('days')).map(d => [d.date, d]));
  const dates = [...new Set([...Object.keys(totals), ...Object.keys(days)])].sort();
  const head = ['date', 'complete', 'weight', 'note', ...NUTRIENTS.map(n => `${n.key}_${n.unit}`)];
  const rows = dates.map(d => [d, days[d] && days[d].complete ? 'yes' : '', days[d] && days[d].weight, days[d] && days[d].note, ...NUTRIENTS.map(n => round2(totals[d] && totals[d][n.key]))]);
  download(`daily-plate-daily-${todayStr()}.csv`, [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
}

function round2(v) { return v == null ? '' : Math.round(v * 100) / 100; }

async function importJson(ev) {
  const file = ev.target.files[0];
  ev.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.app !== 'daily-plate') throw new Error('Not a Daily Plate backup file.');
    // merge: records with the same id are replaced, others kept
    for (const s of DB.STORES) {
      if (!Array.isArray(data[s])) continue;
      const recs = s === 'settings' ? data[s].filter(r => !DEVICE_ONLY_SETTINGS.includes(r.key) && r.key !== 'tombstones') : data[s];
      await DB.putMany(s, recs);
    }
    Sync.schedule(500);
    await loadFoods(); await loadSettings(); await renderAll();
    toast(`Restored backup from ${data.exportedAt || 'file'}.`);
  } catch (err) {
    toast('Restore failed: ' + err.message);
  }
}

// ---------- misc ----------
let toastTimer;
function toast(text, actionLabel, action) {
  const el = $('#toast');
  el.innerHTML = esc(text) + (actionLabel ? ` <button class="small">${esc(actionLabel)}</button>` : '');
  el.hidden = false;
  if (actionLabel) el.querySelector('button').addEventListener('click', () => { el.hidden = true; action(); });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 5000);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

async function requestPersistence() {
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch (_) {}
}

// re-check reminders and refresh "today" when the app comes back into view
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });

// Page and script must be the same version; if not, drop caches and reload once.
async function ensureFreshPage() {
  const meta = document.querySelector('meta[name="dp-version"]');
  if (meta && meta.content === APP_VERSION) return false;
  let tried = false;
  try { tried = sessionStorage.getItem('dp-refreshed') === APP_VERSION; sessionStorage.setItem('dp-refreshed', APP_VERSION); } catch (_) {}
  if (tried) return false;
  try {
    if (window.caches) for (const k of await caches.keys()) await caches.delete(k);
    const regs = navigator.serviceWorker ? await navigator.serviceWorker.getRegistrations() : [];
    for (const r of regs) await r.unregister();
  } catch (_) {}
  location.reload();
  return true;
}

ensureFreshPage().then(stop => stop || init()).catch(err => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="banner">Daily Plate could not start: ${esc(err.message)}</div>`);
  console.error(err);
});
