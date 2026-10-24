// Daily Plate — main application logic.
const APP_VERSION = '1.4.0';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const state = {
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
  }
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

// ---------- sync ----------
async function reloadAfterSync() {
  await loadFoods();
  await loadSettings();
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
    offEnabled: true, usdaEnabled: true, usdaKey: '', weightUnit: 'kg',
    ...(await DB.getSetting('prefs', {})),
  };
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
  $('#food-scan').addEventListener('click', async () => { const c = await Scanner.scan(); if (c) $('#food-barcode').value = c; });

  // amount dialog
  $('#amount-qty').addEventListener('input', renderAmountPreview);
  $('#amount-unit').addEventListener('change', renderAmountPreview);
  $('#amount-dialog').addEventListener('close', onAmountClose);

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
  $('#meals').innerHTML = MEALS.map(meal => {
    const items = entries.filter(e => e.meal === meal);
    const mt = totalsOf(items);
    return `<div class="card meal">
      <div class="meal-head"><h3>${meal}</h3><span class="hint">${fmt(mt.kcal || 0, 'kcal')} kcal</span>
        <button class="small" data-add="${meal}">+ Add</button></div>
      ${items.map(e => {
        const n = entryNutrients(e);
        return `<div class="entry" data-id="${e.id}">
          <div class="entry-main" data-edit="${e.id}">
            <div>${esc(e.food.name)}${e.food.brand ? ` <span class="hint">· ${esc(e.food.brand)}</span>` : ''}</div>
            <div class="hint">${esc(amountLabel(e))} · P ${fmt(n.protein)} · C ${fmt(n.carbs)} · F ${fmt(n.fat)}</div>
          </div>
          <div class="entry-kcal">${fmt(n.kcal, 'kcal')}</div>
          <button class="icon" data-del="${e.id}" aria-label="Delete">✕</button>
        </div>`;
      }).join('') || '<div class="hint empty">Nothing logged yet.</div>'}
    </div>`;
  }).join('');
  $$('#meals [data-add]').forEach(b => b.addEventListener('click', () => openAddDialog(b.dataset.add)));
  $$('#meals [data-del]').forEach(b => b.addEventListener('click', () => deleteEntry(b.dataset.del)));
  $$('#meals [data-edit]').forEach(b => b.addEventListener('click', () => editEntry(b.dataset.edit)));

  // notes etc
  $('#day-note').value = day.note || '';
  $('#day-weight').value = day.weight ?? '';
  $('#day-complete').checked = !!day.complete;
  $$('.unit-weight').forEach(s => (s.textContent = state.settings.weightUnit));

  // nutrient table
  $('#nutrient-table').innerHTML = `<table class="ntable"><thead><tr><th>Nutrient</th><th>Total</th><th>Goal</th><th>%</th></tr></thead><tbody>
    ${NUTRIENTS.map(n => {
      const v = totals[n.key]; const g = state.goals[n.key];
      const pct = g ? Math.round(((v || 0) / g) * 100) : null;
      return `<tr><td>${n.label}${n.limit ? ' <span class="hint">(limit)</span>' : ''}</td><td>${fmt(v, n.unit)} ${n.unit}</td><td>${g ?? '–'} ${n.unit}</td><td class="${n.limit && pct > 100 ? 'over' : ''}">${pct ?? '–'}%</td></tr>`;
    }).join('')}</tbody></table>
    <p class="hint">Missing values in a food are counted as zero, so micronutrient totals are a lower bound.</p>`;
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
  if (e.unit === 'g') return `${fmt(e.qty)} g`;
  if (e.unit === 'oz') return `${fmt(e.qty)} oz`;
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
  await DB.remove('entries', id);
  await renderDiary();
  toast(`Removed ${e ? e.food.name : 'entry'}`, 'Undo', async () => { if (e) { await DB.save('entries', e); renderDiary(); } });
}

async function copyYesterday() {
  const prev = await entriesFor(shiftDate(state.date, -1));
  if (!prev.length) return toast('Nothing logged the day before.');
  const now = Date.now();
  await DB.saveMany('entries', prev.map((e, i) => ({ ...e, id: uid(), date: state.date, createdAt: now + i })));
  toast(`Copied ${prev.length} item(s).`);
  renderDiary();
}

// ---------- add food ----------
// Meal that fits the current time of day (you can change it before saving).
function mealForNow() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  return h < 10.5 ? 'Breakfast' : h < 15 ? 'Lunch' : h >= 17 && h < 21 ? 'Dinner' : 'Snacks';
}

function openAddDialog(meal) {
  state.addMeal = meal;
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
  recent.forEach(e => { if (e.foodId) count[e.foodId] = (count[e.foodId] || 0) + 1; });
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

async function renderLocalResults() {
  const q = $('#add-search').value.trim().toLowerCase();
  let list;
  if (!q) {
    const ids = await recentFoodIds();
    list = ids.map(id => state.foods.get(id)).filter(Boolean).slice(0, 15);
    if (!list.length) list = [...state.foods.values()].slice(0, 15);
    $('#add-status').textContent = list.length ? (ids.length ? 'Recent foods' : 'Your foods') : '';
  } else {
    const words = q.split(/\s+/);
    list = [...state.foods.values()]
      .filter(f => words.every(w => (f.name + ' ' + (f.brand || '')).toLowerCase().includes(w)))
      .slice(0, 40);
    $('#add-status').textContent = list.length ? '' : 'No saved foods match. Press Enter or "Search online".';
  }
  renderResults('#add-results', list, f => pickFood(f));
}

function renderResults(container, list, onPick) {
  const el = $(container);
  el.innerHTML = list.map((f, i) => `<button type="button" class="result" data-i="${i}">
      <span><strong>${esc(f.name)}</strong>${f.brand ? ` · ${esc(f.brand)}` : ''}
      ${f.kind === 'restaurant' ? '<span class="tag tag-restaurant">restaurant</span>' : ''}<span class="tag tag-${f.source}">${sourceLabel(f.source)}</span></span>
      <span class="hint">${fmt(f.per100.kcal, 'kcal')} kcal / 100 g · P ${fmt(f.per100.protein)} C ${fmt(f.per100.carbs)} F ${fmt(f.per100.fat)}</span>
    </button>`).join('');
  el.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => onPick(list[+b.dataset.i])));
}

function sourceLabel(s) {
  return { custom: 'mine', recipe: 'recipe', starter: 'basic', off: 'Open Food Facts', usda: 'USDA', quick: 'quick' }[s] || s;
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
  if (!search.results.length && search.filter === 'restaurants') msg += ' Restaurant coverage in open data is limited: try the chain name plus the item (e.g. "taco bell burrito"), the All filter, or add it as a custom food from the chain\'s nutrition info.';
  if (res.errors.length) msg += ' ' + res.errors.join('; ');
  $('#add-status').textContent = msg;
  $('#add-more').hidden = !res.more;
  $('#add-attribution').hidden = !search.results.length;
  renderResults('#add-results', search.results, f => pickFood(f));
}

function filterLabel(f) {
  return { all: 'all foods', brands: 'brands', restaurants: 'restaurants', basic: 'basic foods' }[f] || f;
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
  const local = [...state.foods.values()].find(f => f.barcode && forms.includes(String(f.barcode)));
  if (local) return pickFood(local);
  $('#add-status').textContent = 'Looking up barcode ' + code + '…';
  try {
    for (const c of forms) {
      const f = await Lookup.barcode(c);
      if (f) return pickFood(f);
    }
    $('#add-status').textContent = 'Barcode not found. You can create it as a custom food.';
    $('#add-results').innerHTML = `<button type="button" class="result" id="create-from-barcode">+ Create custom food with barcode ${esc(code)}</button>`;
    $('#create-from-barcode').addEventListener('click', () => { $('#add-dialog').close(); openFoodEditor(null, { barcode: code }); });
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
function unitOptions(food) {
  const opts = (food.servings || []).map(s => ({ value: 's:' + s.label, label: `${s.label} (${fmt(s.grams)} g)`, grams: s.grams }));
  opts.push({ value: 'g', label: 'grams', grams: 1 }, { value: 'oz', label: 'ounces', grams: 28.3495 });
  return opts;
}

function openAmountDialog(food, entry) {
  state.pendingFood = food;
  state.editingEntry = entry;
  $('#amount-title').textContent = food.name;
  const opts = unitOptions(food);
  $('#amount-unit').innerHTML = opts.map(o => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('');
  $('#amount-meal').innerHTML = MEALS.map(m => `<option>${m}</option>`).join('');
  if (entry) {
    $('#amount-qty').value = entry.qty;
    $('#amount-unit').value = ['g', 'oz'].includes(entry.unit) ? entry.unit : 's:' + entry.unit;
    $('#amount-meal').value = entry.meal;
  } else {
    $('#amount-qty').value = opts.length > 2 ? 1 : 100;
    $('#amount-unit').value = opts[0].value;
    $('#amount-meal').value = state.addMeal;
  }
  renderAmountPreview();
  $('#amount-dialog').showModal();
  $('#amount-qty').select();
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
  $('#amount-preview').textContent = `${fmt(grams)} g → ${fmt(n.kcal, 'kcal')} kcal · P ${fmt(n.protein)} g · C ${fmt(n.carbs)} g · F ${fmt(n.fat)} g`;
}

async function onAmountClose() {
  if ($('#amount-dialog').returnValue !== 'ok') return;
  const food = state.pendingFood;
  const { qty, grams, unit } = currentGrams();
  if (!(grams > 0)) return;
  const base = state.editingEntry || { id: uid(), date: state.date, createdAt: Date.now() };
  const entry = {
    ...base,
    meal: $('#amount-meal').value,
    foodId: food.id,
    // snapshot of the food, so the archive stays accurate if the food is edited later
    food: { name: food.name, brand: food.brand || '', source: food.source, per100: food.per100 },
    qty, unit, grams,
    updatedAt: Date.now(),
  };
  await DB.save('entries', entry);
  renderDiary();
}

async function editEntry(id) {
  const e = await DB.get('entries', id);
  if (!e) return;
  if (e.unit === 'quick') return toast('Quick-add entries can be deleted and re-added.');
  const food = state.foods.get(e.foodId) || { id: e.foodId, ...e.food, servings: [] };
  if (!['g', 'oz'].includes(e.unit) && !(food.servings || []).some(s => s.label === e.unit)) {
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
    id: uid(), date: state.date, meal: state.addMeal, createdAt: Date.now(), foodId: null,
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
      <div class="hint">${fmt(f.per100.kcal, 'kcal')} kcal / 100 g · P ${fmt(f.per100.protein)} C ${fmt(f.per100.carbs)} F ${fmt(f.per100.fat)}</div></div>
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
function openFoodEditor(food, prefill = {}) {
  editingFood = food;
  $('#food-dialog-title').textContent = food ? 'Edit food' : 'Custom food';
  $('#food-name').value = food ? food.name : '';
  $('#food-brand').value = food ? food.brand || '' : '';
  $('#food-barcode').value = food ? food.barcode || '' : prefill.barcode || '';
  $('#food-basis').value = 100;
  $('#food-nutrients').innerHTML = NUTRIENTS.map(n => `<label>${n.label} (${n.unit})
      <input type="number" step="any" min="0" data-n="${n.key}" value="${food && food.per100[n.key] != null ? food.per100[n.key] : ''}"></label>`).join('');
  $('#food-servings').value = food ? (food.servings || []).map(s => `${s.label} = ${s.grams}`).join('\n') : '';
  $('#food-dialog').showModal();
}

function parseServings(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const m = l.match(/^(.*?)\s*=\s*([\d.]+)\s*g?$/i);
    return m && parseFloat(m[2]) > 0 ? { label: m[1] || '1 serving', grams: parseFloat(m[2]) } : null;
  }).filter(Boolean);
}

async function onFoodClose() {
  if ($('#food-dialog').returnValue !== 'ok') return;
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
  await DB.save('foods', food);
  state.foods.set(food.id, food);
  renderFoodsList();
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
  $('#goals-form').innerHTML = NUTRIENTS.map(n => `<label>${n.label} (${n.unit})${n.limit ? ' max' : ''}
    <input type="number" step="any" min="0" data-goal="${n.key}" value="${state.goals[n.key] ?? ''}"></label>`).join('');
  const s = state.settings;
  $('#rem-enabled').checked = s.remEnabled;
  $('#rem-time').value = s.remTime;
  $('#rem-meals').checked = s.remMeals;
  $('#rem-meal-times').value = s.remMealTimes;
  $('#off-enabled').checked = s.offEnabled;
  $('#usda-enabled').checked = s.usdaEnabled;
  $('#usda-key').value = s.usdaKey;
  $('#weight-unit').value = s.weightUnit;
  storageStatus();
}

async function saveGoals() {
  $$('#goals-form [data-goal]').forEach(inp => { const v = parseFloat(inp.value); if (Number.isFinite(v)) state.goals[inp.dataset.goal] = v; });
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
  const entries = (await DB.all('entries')).sort((a, b) => a.date.localeCompare(b.date) || MEALS.indexOf(a.meal) - MEALS.indexOf(b.meal));
  const head = ['date', 'meal', 'food', 'brand', 'source', 'amount', 'unit', 'grams', ...NUTRIENTS.map(n => `${n.key}_${n.unit}`)];
  const rows = entries.map(e => { const n = entryNutrients(e); return [e.date, e.meal, e.food.name, e.food.brand, e.food.source, e.qty, e.unit, round2(e.grams), ...NUTRIENTS.map(x => round2(n[x.key]))]; });
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

init().catch(err => {
  document.body.insertAdjacentHTML('afterbegin', `<div class="banner">Daily Plate could not start: ${esc(err.message)}</div>`);
  console.error(err);
});
