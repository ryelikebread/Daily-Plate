// Online food lookups against open data sources:
//  - Open Food Facts (Open Database Licence): packaged and branded foods, barcodes
//  - USDA FoodData Central (U.S. public domain):
//      Branded Foods      – several hundred thousand U.S. brand-name products
//      SR Legacy          – generic foods, plus "Fast Foods" and "Restaurant Foods"
//                           groups that name major chains
//      Survey (FNDDS)     – foods "as eaten", incl. many "from fast food / restaurant" items
//      Foundation         – detailed generic foods
// Results are converted to the app's per-100 g format and tagged with a kind:
// 'brand', 'restaurant' or 'generic'. Searches are cached on the device so
// repeated searches are instant and still work offline.

const Lookup = (() => {
  const OFF_BASE = 'https://world.openfoodfacts.org';
  const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';
  const CACHE_DAYS = 14;
  const PAGE_SIZE = 25;

  // Restaurant chains, used to recognise restaurant items in the open data.
  // (Names only; no data is taken from the chains or any app.)
  const CHAINS = [
    "McDonald's", 'Burger King', "Wendy's", 'Taco Bell', 'KFC', 'Kentucky Fried Chicken', 'Subway', 'Starbucks',
    "Dunkin'", 'Dunkin Donuts', 'Chick-fil-A', "Domino's", 'Pizza Hut', "Papa John's", 'Little Caesars', 'Chipotle',
    'Panera', 'Popeyes', 'Sonic', "Arby's", 'Panda Express', 'Five Guys', 'Jack in the Box', "Carl's Jr", "Hardee's",
    'Dairy Queen', "Culver's", 'Whataburger', "Jersey Mike's", "Jimmy John's", 'Wingstop', "Zaxby's", "Raising Cane's",
    'In-N-Out', 'Shake Shack', "Applebee's", 'Olive Garden', "Chili's", 'IHOP', "Denny's", 'Cracker Barrel',
    'Texas Roadhouse', 'Outback', 'Red Lobster', 'Buffalo Wild Wings', 'Red Robin', 'Cheesecake Factory', 'Qdoba',
    "Moe's", 'Del Taco', 'El Pollo Loco', 'Krispy Kreme', 'Tim Hortons', 'Baskin Robbins', 'Cold Stone', 'Auntie Anne',
    'Jamba', 'Tropical Smoothie', 'Smoothie King', 'Sweetgreen', 'Cava', 'Noodles & Company', "P.F. Chang's",
    'Long John Silver', "Church's", "Bojangles", "Captain D's", 'Steak n Shake', 'White Castle', 'Krystal',
    'Pret A Manger', 'Greggs', "Nando's", 'Costa', 'Wagamama', 'Panago', 'Boston Market', 'Golden Corral',
  ];
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const CHAIN_KEYS = CHAINS.map(name => ({ name, key: norm(name) })).sort((a, b) => b.key.length - a.key.length);

  function chainOf(text) {
    const n = norm(text);
    if (!n) return null;
    const hit = CHAIN_KEYS.find(c => n.startsWith(c.key) || (c.key.length >= 5 && n.includes(c.key)));
    return hit ? hit.name : null;
  }

  const RESTAURANT_CATEGORIES = ['fast foods', 'restaurant foods'];

  // ---------- Open Food Facts ----------
  // Minerals/vitamins are stored in grams per 100 g there.
  function offToFood(p) {
    if (!p) return null;
    const n = p.nutriments || {};
    const g = (k) => (n[k] != null && n[k] !== '' ? Number(n[k]) : null);
    const mg = (k) => (g(k) != null ? g(k) * 1000 : null);
    const ug = (k) => (g(k) != null ? g(k) * 1e6 : null);
    let kcal = g('energy-kcal_100g');
    if (kcal == null && g('energy_100g') != null) kcal = g('energy_100g') / 4.184; // kJ -> kcal
    if (kcal == null) return null;
    const per100 = clean({
      kcal, protein: g('proteins_100g'), carbs: g('carbohydrates_100g'), fat: g('fat_100g'),
      satfat: g('saturated-fat_100g'), fiber: g('fiber_100g'), sugar: g('sugars_100g'),
      sodium: mg('sodium_100g'), potassium: mg('potassium_100g'), calcium: mg('calcium_100g'),
      iron: mg('iron_100g'), vitc: mg('vitamin-c_100g'), vitd: ug('vitamin-d_100g'),
      chol: mg('cholesterol_100g'),
    });
    const brand = (p.brands || '').split(',')[0].trim();
    const chain = chainOf(brand);
    const servings = [];
    const sq = parseFloat(p.serving_quantity);
    if (sq > 0) servings.push({ label: p.serving_size || `1 serving (${sq} g)`, grams: sq });
    return {
      id: 'off-' + (p.code || p._id || uid()),
      name: p.product_name || p.generic_name || 'Unnamed product',
      brand: chain || brand, source: 'off', kind: chain ? 'restaurant' : 'brand',
      barcode: p.code || '', per100, servings,
    };
  }

  async function offSearch(q, page = 1) {
    const fields = 'code,product_name,generic_name,brands,nutriments,serving_size,serving_quantity';
    const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=${PAGE_SIZE}&page=${page}&fields=${fields}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Open Food Facts: HTTP ' + r.status);
    const j = await r.json();
    const list = (j.products || []).map(offToFood).filter(Boolean);
    return { list, more: (j.count || 0) > page * PAGE_SIZE };
  }

  async function offBarcode(code) {
    const r = await fetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!r.ok) throw new Error('Open Food Facts: HTTP ' + r.status);
    const j = await r.json();
    return j.status === 1 ? offToFood({ code, ...j.product }) : null;
  }

  // ---------- USDA FoodData Central ----------
  const FDC_MAP = {
    '208': 'kcal', '203': 'protein', '205': 'carbs', '204': 'fat', '606': 'satfat',
    '291': 'fiber', '269': 'sugar', '307': 'sodium', '306': 'potassium', '301': 'calcium',
    '303': 'iron', '401': 'vitc', '328': 'vitd', '601': 'chol',
  };

  function fdcToFood(f) {
    const per100 = {};
    for (const fn of f.foodNutrients || []) {
      const num = String(fn.nutrientNumber || (fn.nutrient && fn.nutrient.number) || '');
      const key = FDC_MAP[num];
      const unit = (fn.unitName || (fn.nutrient && fn.nutrient.unitName) || '').toUpperCase();
      const val = fn.value != null ? fn.value : fn.amount;
      if (!key || val == null) continue;
      if (key === 'kcal' && unit === 'KJ') continue;
      per100[key] = Number(val);
    }
    // Foundation foods sometimes report energy only as Atwater factors (957/958)
    if (per100.kcal == null) {
      const atw = (f.foodNutrients || []).find(fn => ['957', '958'].includes(String(fn.nutrientNumber)));
      if (atw) per100.kcal = Number(atw.value);
    }
    if (per100.kcal == null) return null;

    const servings = [];
    if (f.servingSize > 0 && /^(g|grm|gram)/i.test(f.servingSizeUnit || '')) {
      servings.push({ label: f.householdServingFullText ? `${f.householdServingFullText} (${f.servingSize} g)` : `1 serving (${f.servingSize} g)`, grams: Number(f.servingSize) });
    }
    for (const m of (f.foodMeasures || []).slice().sort((a, b) => (a.rank || 0) - (b.rank || 0))) {
      const label = (m.disseminationText || '').trim();
      if (m.gramWeight > 0 && label && !/not specified/i.test(label) && !servings.some(s => s.label === label)) {
        servings.push({ label, grams: Number(m.gramWeight) });
      }
      if (servings.length >= 6) break;
    }

    const desc = f.description || 'USDA food';
    const category = String(f.foodCategory || '');
    let name = titleCase(desc);
    let brand = f.brandName || f.brandOwner || '';
    let kind = f.dataType === 'Branded' ? 'brand' : 'generic';
    const firstPart = desc.split(',')[0];
    const chain = chainOf(firstPart) || (kind === 'brand' ? chainOf(brand) : null);
    if (chain) {
      kind = 'restaurant';
      brand = chain;
      if (norm(firstPart).startsWith(norm(chain).slice(0, 4))) name = titleCase(desc.split(',').slice(1).join(',').trim() || desc);
    } else if (RESTAURANT_CATEGORIES.includes(category.toLowerCase()) || /\b(fast food|restaurant)\b/i.test(desc)) {
      kind = 'restaurant';
    }
    return {
      id: 'usda-' + f.fdcId, name, brand: chain || (brand ? titleCase(brand) : ''), source: 'usda', kind, category,
      barcode: f.gtinUpc || '', per100: clean(per100), servings,
    };
  }

  async function usdaSearch(q, apiKey, dataTypes, page = 1) {
    const key = apiKey || 'DEMO_KEY';
    const types = dataTypes.map(encodeURIComponent).join(',');
    const url = `${FDC_BASE}/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&pageSize=${PAGE_SIZE}&pageNumber=${page}&dataType=${types}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('USDA: HTTP ' + r.status + (r.status === 429 ? ' (hourly limit reached: add your own free API key in Settings)' : ''));
    const j = await r.json();
    return { list: (j.foods || []).map(fdcToFood).filter(Boolean), more: (j.totalPages || 0) > page };
  }

  // ---------- combined search ----------
  const FILTERS = {
    all:         { usda: ['Foundation', 'SR Legacy', 'Survey (FNDDS)', 'Branded'], off: true, keep: () => true },
    brands:      { usda: ['Branded'], off: true, keep: f => f.kind === 'brand' || f.kind === 'restaurant' },
    restaurants: { usda: ['SR Legacy', 'Survey (FNDDS)', 'Branded'], off: true, keep: f => f.kind === 'restaurant' },
    basic:       { usda: ['Foundation', 'SR Legacy', 'Survey (FNDDS)'], off: false, keep: f => f.kind === 'generic' },
  };

  // Mix sources so the first screen shows a bit of each, and drop duplicates.
  function interleave(lists) {
    const out = []; const seen = new Set();
    const max = Math.max(0, ...lists.map(l => l.length));
    for (let i = 0; i < max; i++) {
      for (const l of lists) {
        const f = l[i];
        if (!f) continue;
        const k = norm(f.name) + '|' + norm(f.brand);
        if (seen.has(k)) continue;
        seen.add(k); out.push(f);
      }
    }
    return out;
  }

  async function cached(key, fn) {
    const hit = await DB.get('lookupCache', key).catch(() => null);
    if (hit && Date.now() - hit.at < CACHE_DAYS * 86400000) return { ...hit.value, fromCache: true };
    try {
      const value = await fn();
      DB.put('lookupCache', { key, at: Date.now(), value }).catch(() => {});
      return value;
    } catch (err) {
      if (hit) return { ...hit.value, fromCache: true, stale: true };
      throw err;
    }
  }

  // search(q, {filter, page, settings}) -> {results, more, errors, fromCache}
  async function search(q, { filter = 'all', page = 1, settings = {} } = {}) {
    const F = FILTERS[filter] || FILTERS.all;
    const jobs = []; const names = [];
    if (settings.usdaEnabled !== false && F.usda.length) {
      names.push('USDA');
      jobs.push(cached(`usda|${F.usda.join('+')}|${page}|${q.toLowerCase()}`, () => usdaSearch(q, settings.usdaKey, F.usda, page)));
    }
    if (settings.offEnabled !== false && F.off) {
      names.push('Open Food Facts');
      jobs.push(cached(`off|${page}|${q.toLowerCase()}`, () => offSearch(q, page)));
    }
    if (!jobs.length) return { results: [], more: false, errors: ['Online lookup is turned off in Settings.'] };
    const settled = await Promise.allSettled(jobs);
    const ok = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
    const errors = settled.map((r, i) => (r.status === 'rejected' ? `${names[i]}: ${r.reason.message.replace(/^(USDA|Open Food Facts): /, '')}` : null)).filter(Boolean);
    // USDA results first within each round: they include serving sizes and restaurant groups
    const results = interleave(ok.map(v => v.list.filter(F.keep)));
    return { results, more: ok.some(v => v.more), errors, fromCache: ok.length > 0 && ok.every(v => v.fromCache) };
  }

  async function barcode(code) {
    const hit = await DB.get('lookupCache', 'barcode|' + code).catch(() => null);
    if (hit && hit.value) return hit.value;
    const f = await offBarcode(code);
    if (f) DB.put('lookupCache', { key: 'barcode|' + code, at: Date.now(), value: f }).catch(() => {});
    return f;
  }

  function clean(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (v != null && !Number.isNaN(v)) out[k] = Math.round(v * 100) / 100;
    return out;
  }

  // Tidy USDA's ALL-CAPS text: "BURGER KING, WHOPPER, with cheese" ->
  // "Burger King, whopper..." is avoided by title-casing the first part and
  // lower-casing later all-caps parts.
  function titleCase(s) {
    const parts = String(s).trim().split(/,\s*/);
    const out = parts.map((p, i) => {
      if (!/[A-Z]/.test(p) || p !== p.toUpperCase()) return p;
      const low = p.toLowerCase();
      return i === 0 ? low.replace(/(^|[\s(\/-])([a-z])/g, (m, a, c) => a + c.toUpperCase()).replace(/'S\b/g, "'s") : low;
    }).join(', ');
    return out.charAt(0).toUpperCase() + out.slice(1);
  }

  return { search, barcode, offSearch, offBarcode, usdaSearch, offToFood, fdcToFood, chainOf, FILTERS, CHAINS };
})();
