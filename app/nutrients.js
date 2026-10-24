// Nutrient definitions shared by the whole app.
// All food values are stored per 100 g using these keys and units.
//
// group   – section in the nutrient report
// indent  – nesting level under the row above (e.g. fiber under carbs)
// goal    – default daily target (adult reference values; editable in Settings).
//           Sources: NIH Office of Dietary Supplements RDA/AI tables and the
//           FDA Daily Values. null = no target, shown as a plain amount.
// limit   – the goal is a maximum rather than something to reach
// usda    – USDA FoodData Central nutrient numbers (first one found wins)
// off     – Open Food Facts nutriment key (always grams per 100 g there)
// core    – shown by default in the custom-food editor
const NUTRIENTS = [
  // General
  { key: 'kcal',      label: 'Energy',              unit: 'kcal', group: 'General', main: true, core: true, goal: 2000, usda: ['208'] },
  { key: 'water',     label: 'Water',               unit: 'g',    group: 'General', goal: 3700, usda: ['255'] },
  { key: 'alcohol',   label: 'Alcohol',             unit: 'g',    group: 'General', goal: null, usda: ['221'] },
  { key: 'caffeine',  label: 'Caffeine',            unit: 'mg',   group: 'General', goal: 400, limit: true, usda: ['262'], off: 'caffeine' },

  // Vitamins
  { key: 'thiamin',   label: 'B1 (Thiamin)',        unit: 'mg', group: 'Vitamins', goal: 1.2, usda: ['404'], off: 'vitamin-b1' },
  { key: 'riboflavin',label: 'B2 (Riboflavin)',     unit: 'mg', group: 'Vitamins', goal: 1.3, usda: ['405'], off: 'vitamin-b2' },
  { key: 'niacin',    label: 'B3 (Niacin)',         unit: 'mg', group: 'Vitamins', goal: 16,  usda: ['406'], off: 'vitamin-pp' },
  { key: 'pantothenic', label: 'B5 (Pantothenic acid)', unit: 'mg', group: 'Vitamins', goal: 5, usda: ['410'], off: 'pantothenic-acid' },
  { key: 'b6',        label: 'B6 (Pyridoxine)',     unit: 'mg', group: 'Vitamins', goal: 1.3, usda: ['415'], off: 'vitamin-b6' },
  { key: 'biotin',    label: 'B7 (Biotin)',         unit: 'µg', group: 'Vitamins', goal: 30,  usda: ['416'], off: 'biotin' },
  { key: 'folate',    label: 'B9 (Folate)',         unit: 'µg', group: 'Vitamins', goal: 400, usda: ['435', '417'], off: 'vitamin-b9' },
  { key: 'b12',       label: 'B12 (Cobalamin)',     unit: 'µg', group: 'Vitamins', goal: 2.4, usda: ['418'], off: 'vitamin-b12' },
  { key: 'choline',   label: 'Choline',             unit: 'mg', group: 'Vitamins', goal: 550, usda: ['421'], off: 'choline' },
  { key: 'vita',      label: 'Vitamin A',           unit: 'µg', group: 'Vitamins', goal: 900, usda: ['320'], off: 'vitamin-a' },
  { key: 'vitc',      label: 'Vitamin C',           unit: 'mg', group: 'Vitamins', core: true, goal: 90, usda: ['401'], off: 'vitamin-c' },
  { key: 'vitd',      label: 'Vitamin D',           unit: 'µg', group: 'Vitamins', core: true, goal: 15, usda: ['328'], off: 'vitamin-d' },
  { key: 'vite',      label: 'Vitamin E',           unit: 'mg', group: 'Vitamins', goal: 15,  usda: ['323'], off: 'vitamin-e' },
  { key: 'vitk',      label: 'Vitamin K',           unit: 'µg', group: 'Vitamins', goal: 120, usda: ['430'], off: 'vitamin-k' },

  // Minerals
  { key: 'calcium',   label: 'Calcium',     unit: 'mg', group: 'Minerals', core: true, goal: 1000, usda: ['301'], off: 'calcium' },
  { key: 'copper',    label: 'Copper',      unit: 'mg', group: 'Minerals', goal: 0.9,  usda: ['312'], off: 'copper' },
  { key: 'iron',      label: 'Iron',        unit: 'mg', group: 'Minerals', core: true, goal: 8, usda: ['303'], off: 'iron' },
  { key: 'magnesium', label: 'Magnesium',   unit: 'mg', group: 'Minerals', goal: 400,  usda: ['304'], off: 'magnesium' },
  { key: 'manganese', label: 'Manganese',   unit: 'mg', group: 'Minerals', goal: 2.3,  usda: ['315'], off: 'manganese' },
  { key: 'phosphorus',label: 'Phosphorus',  unit: 'mg', group: 'Minerals', goal: 700,  usda: ['305'], off: 'phosphorus' },
  { key: 'potassium', label: 'Potassium',   unit: 'mg', group: 'Minerals', core: true, goal: 3400, usda: ['306'], off: 'potassium' },
  { key: 'selenium',  label: 'Selenium',    unit: 'µg', group: 'Minerals', goal: 55,   usda: ['317'], off: 'selenium' },
  { key: 'sodium',    label: 'Sodium',      unit: 'mg', group: 'Minerals', core: true, goal: 2300, limit: true, usda: ['307'], off: 'sodium' },
  { key: 'zinc',      label: 'Zinc',        unit: 'mg', group: 'Minerals', goal: 11,   usda: ['309'], off: 'zinc' },

  // Carbohydrates
  { key: 'carbs',     label: 'Carbs (total)',       unit: 'g', group: 'Carbohydrates', main: true, core: true, goal: 250, usda: ['205'], off: 'carbohydrates' },
  { key: 'fiber',     label: 'Fiber',               unit: 'g', group: 'Carbohydrates', indent: 1, core: true, goal: 30, usda: ['291'], off: 'fiber' },
  { key: 'fibersol',  label: 'Fiber (soluble)',     unit: 'g', group: 'Carbohydrates', indent: 2, goal: null, usda: ['1082'], off: 'soluble-fiber' },
  { key: 'fiberins',  label: 'Fiber (insoluble)',   unit: 'g', group: 'Carbohydrates', indent: 2, goal: null, usda: ['1084'], off: 'insoluble-fiber' },
  { key: 'netcarbs',  label: 'Carbs (net)',         unit: 'g', group: 'Carbohydrates', indent: 1, goal: null, derived: true },
  { key: 'starch',    label: 'Starch',              unit: 'g', group: 'Carbohydrates', indent: 1, goal: null, usda: ['209'], off: 'starch' },
  { key: 'sugar',     label: 'Sugars',              unit: 'g', group: 'Carbohydrates', indent: 1, core: true, goal: null, usda: ['269', '2000'], off: 'sugars' },
  { key: 'addedsugar',label: 'Added sugars',        unit: 'g', group: 'Carbohydrates', indent: 2, goal: 50, limit: true, usda: ['539'], off: 'added-sugars' },

  // Lipids
  { key: 'fat',       label: 'Fat',                 unit: 'g',  group: 'Lipids', main: true, core: true, goal: 70, usda: ['204'], off: 'fat' },
  { key: 'mufa',      label: 'Fat (monounsaturated)', unit: 'g', group: 'Lipids', indent: 1, goal: null, usda: ['645'], off: 'monounsaturated-fat' },
  { key: 'pufa',      label: 'Fat (polyunsaturated)', unit: 'g', group: 'Lipids', indent: 1, goal: null, usda: ['646'], off: 'polyunsaturated-fat' },
  { key: 'omega3',    label: 'Omega-3',             unit: 'g',  group: 'Lipids', indent: 2, goal: 1.6, off: 'omega-3-fat' },
  { key: 'ala',       label: 'Omega-3 (ALA)',       unit: 'g',  group: 'Lipids', indent: 3, goal: null, usda: ['619', '851'], off: 'alpha-linolenic-acid' },
  { key: 'epa',       label: 'Omega-3 (EPA)',       unit: 'g',  group: 'Lipids', indent: 3, goal: null, usda: ['629'], off: 'eicosapentaenoic-acid' },
  { key: 'dpa',       label: 'Omega-3 (DPA)',       unit: 'g',  group: 'Lipids', indent: 3, goal: null, usda: ['631'] },
  { key: 'dha',       label: 'Omega-3 (DHA)',       unit: 'g',  group: 'Lipids', indent: 3, goal: null, usda: ['621'], off: 'docosahexaenoic-acid' },
  { key: 'omega6',    label: 'Omega-6',             unit: 'g',  group: 'Lipids', indent: 2, goal: 17, off: 'omega-6-fat' },
  { key: 'la',        label: 'Omega-6 (LA)',        unit: 'g',  group: 'Lipids', indent: 3, goal: null, usda: ['618', '675'], off: 'linoleic-acid' },
  { key: 'aa',        label: 'Omega-6 (AA)',        unit: 'g',  group: 'Lipids', indent: 3, goal: null, usda: ['620'], off: 'arachidonic-acid' },
  { key: 'satfat',    label: 'Fat (saturated)',     unit: 'g',  group: 'Lipids', indent: 1, core: true, goal: 20, limit: true, usda: ['606'], off: 'saturated-fat' },
  { key: 'transfat',  label: 'Fat (trans)',         unit: 'g',  group: 'Lipids', indent: 1, goal: null, usda: ['605'], off: 'trans-fat' },
  { key: 'chol',      label: 'Cholesterol',         unit: 'mg', group: 'Lipids', core: true, goal: 300, limit: true, usda: ['601'], off: 'cholesterol' },

  // Protein. Amino-acid targets are adult RDAs per kg (Institute of Medicine)
  // worked out for a 70 kg adult; edit them in Settings for your weight.
  { key: 'protein',   label: 'Protein',        unit: 'g', group: 'Protein', main: true, core: true, goal: 100, usda: ['203'], off: 'proteins' },
  { key: 'cystine',   label: 'Cystine',        unit: 'g', group: 'Protein', indent: 1, goal: null, usda: ['507'] },
  { key: 'histidine', label: 'Histidine',      unit: 'g', group: 'Protein', indent: 1, goal: 0.98, usda: ['512'] },
  { key: 'isoleucine',label: 'Isoleucine',     unit: 'g', group: 'Protein', indent: 1, goal: 1.33, usda: ['503'] },
  { key: 'leucine',   label: 'Leucine',        unit: 'g', group: 'Protein', indent: 1, goal: 2.94, usda: ['504'] },
  { key: 'lysine',    label: 'Lysine',         unit: 'g', group: 'Protein', indent: 1, goal: 2.66, usda: ['505'] },
  { key: 'methionine',label: 'Methionine',     unit: 'g', group: 'Protein', indent: 1, goal: null, usda: ['506'] },
  { key: 'phenylalanine', label: 'Phenylalanine', unit: 'g', group: 'Protein', indent: 1, goal: null, usda: ['508'] },
  { key: 'threonine', label: 'Threonine',      unit: 'g', group: 'Protein', indent: 1, goal: 1.4, usda: ['502'] },
  { key: 'tryptophan',label: 'Tryptophan',     unit: 'g', group: 'Protein', indent: 1, goal: 0.35, usda: ['501'] },
  { key: 'tyrosine',  label: 'Tyrosine',       unit: 'g', group: 'Protein', indent: 1, goal: null, usda: ['509'] },
  { key: 'valine',    label: 'Valine',         unit: 'g', group: 'Protein', indent: 1, goal: 1.68, usda: ['510'] },
];

const NUTRIENT_BY_KEY = Object.fromEntries(NUTRIENTS.map(n => [n.key, n]));
const NUTRIENT_GROUPS = ['General', 'Vitamins', 'Minerals', 'Carbohydrates', 'Lipids', 'Protein'];
// Shown as "Highlighted targets" on the food screen.
const HIGHLIGHTED = ['fiber', 'vitc', 'iron', 'b12', 'calcium', 'folate', 'vita', 'potassium', 'sodium', 'vitd'];

const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

// Values worked out from others when a food doesn't list them directly.
function withDerived(n) {
  const out = { ...n };
  if (out.carbs != null) out.netcarbs = Math.max(0, out.carbs - (out.fiber || 0));
  if (out.omega3 == null && [out.ala, out.epa, out.dpa, out.dha].some(v => v != null)) out.omega3 = (out.ala || 0) + (out.epa || 0) + (out.dpa || 0) + (out.dha || 0);
  if (out.omega6 == null && [out.la, out.aa].some(v => v != null)) out.omega6 = (out.la || 0) + (out.aa || 0);
  return out;
}

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
  const a = Math.abs(v);
  const digits = a >= 100 || unit === 'kcal' ? 0 : a >= 10 ? 1 : a >= 1 ? 1 : a === 0 ? 0 : 2;
  return Number(v).toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}
