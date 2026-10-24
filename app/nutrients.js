// Nutrient definitions shared by the whole app.
// All food values are stored per 100 g using these keys and units.
const NUTRIENTS = [
  { key: 'kcal',    label: 'Calories',      unit: 'kcal', main: true,  goal: 2000 },
  { key: 'protein', label: 'Protein',       unit: 'g',    main: true,  goal: 100 },
  { key: 'carbs',   label: 'Carbs',         unit: 'g',    main: true,  goal: 250 },
  { key: 'fat',     label: 'Fat',           unit: 'g',    main: true,  goal: 70 },
  { key: 'satfat',  label: 'Saturated fat', unit: 'g',    goal: 20, limit: true },
  { key: 'fiber',   label: 'Fiber',         unit: 'g',    goal: 30 },
  { key: 'sugar',   label: 'Sugars',        unit: 'g',    goal: 50, limit: true },
  { key: 'sodium',  label: 'Sodium',        unit: 'mg',   goal: 2300, limit: true },
  { key: 'potassium', label: 'Potassium',   unit: 'mg',   goal: 3400 },
  { key: 'calcium', label: 'Calcium',       unit: 'mg',   goal: 1000 },
  { key: 'iron',    label: 'Iron',          unit: 'mg',   goal: 8 },
  { key: 'vitc',    label: 'Vitamin C',     unit: 'mg',   goal: 90 },
  { key: 'vitd',    label: 'Vitamin D',     unit: 'µg',   goal: 15 },
  { key: 'chol',    label: 'Cholesterol',   unit: 'mg',   goal: 300, limit: true },
];

const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map(n => [n.key, n]));

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

// Scale a per-100g nutrient object to a given gram amount.
function scaleNutrients(per100, grams) {
  const out = {};
  for (const n of NUTRIENTS) {
    const v = per100 && per100[n.key];
    if (v != null && !Number.isNaN(v)) out[n.key] = (v * grams) / 100;
  }
  return out;
}

function addNutrients(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b || {})) out[k] = (out[k] || 0) + v;
  return out;
}

function fmt(v, unit) {
  if (v == null || Number.isNaN(v)) return '–';
  const digits = Math.abs(v) >= 100 || unit === 'kcal' ? 0 : Math.abs(v) >= 10 ? 1 : 1;
  return Number(v).toFixed(digits).replace(/\.0$/, '');
}
