// Online food lookups against two open data sources:
//  - Open Food Facts (open database, ODbL licence): packaged foods + barcodes
//  - USDA FoodData Central (U.S. public domain): generic and branded foods
// Results are converted into the app's per-100g food format.

const Lookup = (() => {
  const OFF_BASE = 'https://world.openfoodfacts.org';
  const FDC_BASE = 'https://api.nal.usda.gov/fdc/v1';

  // Open Food Facts stores minerals/vitamins in grams per 100 g.
  function offToFood(p) {
    if (!p) return null;
    const n = p.nutriments || {};
    const g = (k) => (n[k] != null && n[k] !== '' ? Number(n[k]) : null);
    const mg = (k) => (g(k) != null ? g(k) * 1000 : null);
    const ug = (k) => (g(k) != null ? g(k) * 1e6 : null);
    let kcal = g('energy-kcal_100g');
    if (kcal == null && g('energy_100g') != null) kcal = g('energy_100g') / 4.184; // kJ -> kcal
    const per100 = clean({
      kcal, protein: g('proteins_100g'), carbs: g('carbohydrates_100g'), fat: g('fat_100g'),
      satfat: g('saturated-fat_100g'), fiber: g('fiber_100g'), sugar: g('sugars_100g'),
      sodium: mg('sodium_100g'), potassium: mg('potassium_100g'), calcium: mg('calcium_100g'),
      iron: mg('iron_100g'), vitc: mg('vitamin-c_100g'), vitd: ug('vitamin-d_100g'),
      chol: mg('cholesterol_100g'),
    });
    const name = p.product_name || p.generic_name || 'Unnamed product';
    if (kcal == null) return null;
    const servings = [];
    const sq = parseFloat(p.serving_quantity);
    if (sq > 0) servings.push({ label: p.serving_size || `1 serving (${sq} g)`, grams: sq });
    return {
      id: 'off-' + (p.code || p._id || uid()),
      name, brand: (p.brands || '').split(',')[0].trim(), source: 'off',
      barcode: p.code || '', per100, servings,
    };
  }

  async function offSearch(q) {
    const url = `${OFF_BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=20&fields=code,product_name,generic_name,brands,nutriments,serving_size,serving_quantity`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('Open Food Facts: HTTP ' + r.status);
    const j = await r.json();
    return (j.products || []).map(offToFood).filter(Boolean);
  }

  async function offBarcode(code) {
    const r = await fetch(`${OFF_BASE}/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!r.ok) throw new Error('Open Food Facts: HTTP ' + r.status);
    const j = await r.json();
    return j.status === 1 ? offToFood(j.product) : null;
  }

  // USDA nutrient numbers -> app keys
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
    if (f.servingSize && /^g|grm$/i.test(f.servingSizeUnit || '')) {
      servings.push({ label: f.householdServingFullText || `1 serving (${f.servingSize} g)`, grams: Number(f.servingSize) });
    }
    return {
      id: 'usda-' + f.fdcId,
      name: titleCase(f.description || 'USDA food'),
      brand: f.brandOwner || f.brandName || '', source: 'usda',
      barcode: f.gtinUpc || '', per100: clean(per100), servings,
    };
  }

  async function usdaSearch(q, apiKey) {
    const key = apiKey || 'DEMO_KEY';
    const url = `${FDC_BASE}/foods/search?api_key=${encodeURIComponent(key)}&query=${encodeURIComponent(q)}&pageSize=20&dataType=${encodeURIComponent('Foundation,SR Legacy,Branded')}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error('USDA: HTTP ' + r.status + (r.status === 429 ? ' (rate limit: add your own API key in Settings)' : ''));
    const j = await r.json();
    return (j.foods || []).map(fdcToFood).filter(Boolean);
  }

  function clean(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj)) if (v != null && !Number.isNaN(v)) out[k] = Math.round(v * 100) / 100;
    return out;
  }

  function titleCase(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }

  return { offSearch, offBarcode, usdaSearch, offToFood, fdcToFood };
})();
