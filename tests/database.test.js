// Tests brand/restaurant search, filters, paging, serving sizes and the
// offline search cache, with realistic (fake) USDA and Open Food Facts replies.
// Usage: node tests/database.test.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let failures = 0;
function check(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; }

const nut = (kcal, p, c, f, na) => [
  { nutrientNumber: '208', unitName: 'KCAL', value: kcal }, { nutrientNumber: '203', unitName: 'G', value: p },
  { nutrientNumber: '205', unitName: 'G', value: c }, { nutrientNumber: '204', unitName: 'G', value: f },
  { nutrientNumber: '307', unitName: 'MG', value: na }];

const USDA_FOODS = [
  { fdcId: 170720, dataType: 'SR Legacy', description: "McDONALD'S, BIG MAC", foodCategory: 'Fast Foods', foodNutrients: nut(257, 11.8, 20.1, 15, 460),
    foodMeasures: [{ disseminationText: '1 item', gramWeight: 219, rank: 1 }, { disseminationText: 'Quantity not specified', gramWeight: 219, rank: 2 }] },
  { fdcId: 2706100, dataType: 'Survey (FNDDS)', description: 'Cheeseburger, from fast food, 1 medium patty', foodCategory: 'Burgers', foodNutrients: nut(263, 13.6, 24.6, 12.3, 590),
    foodMeasures: [{ disseminationText: '1 cheeseburger', gramWeight: 130, rank: 1 }] },
  { fdcId: 2000001, dataType: 'Branded', description: 'BIG MAC STYLE SAUCE', brandOwner: 'Generic Sauce Co.', servingSize: 30, servingSizeUnit: 'g', householdServingFullText: '2 Tbsp', foodNutrients: nut(400, 1, 10, 38, 900) },
  { fdcId: 170000, dataType: 'SR Legacy', description: 'Beef, ground, 85% lean meat / 15% fat, patty, cooked, broiled', foodCategory: 'Beef Products', foodNutrients: nut(250, 25.9, 0, 15.4, 76) },
];
const OFF_PRODUCTS = [
  { code: '0049000000443', product_name: 'Big Mac sandwich', brands: "McDonald's", nutriments: { 'energy-kcal_100g': 250, proteins_100g: 12, carbohydrates_100g: 20, fat_100g: 14 } },
  { code: '3017620422003', product_name: 'Hazelnut spread', brands: 'Choco Brand', serving_quantity: 15, nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 } },
];

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p === '/') p = '/index.html';
      const f = path.join(ROOT, p);
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { resp.writeHead(404); return resp.end(); }
      resp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(resp);
    }).listen(0, () => res(srv));
  });
}

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const usdaCalls = []; let offline = false;
  await ctx.route('https://api.nal.usda.gov/**', r => {
    if (offline) return r.abort('internetdisconnected');
    const u = new URL(r.request().url());
    usdaCalls.push(u.searchParams.get('dataType') + ' p' + u.searchParams.get('pageNumber'));
    const types = u.searchParams.get('dataType').split(',');
    const page = +u.searchParams.get('pageNumber');
    const foods = page === 1 ? USDA_FOODS.filter(f => types.includes(f.dataType)) : [{ ...USDA_FOODS[0], fdcId: 999, description: "BURGER KING, WHOPPER" }];
    return r.fulfill({ json: { foods, totalPages: 2 } });
  });
  await ctx.route('https://world.openfoodfacts.org/**', r => offline ? r.abort('internetdisconnected') : r.fulfill({ json: { count: 2, products: OFF_PRODUCTS } }));
  await ctx.route('https://data.cityofnewyork.us/**', r => offline ? r.abort('internetdisconnected') : r.fulfill({ json: [] }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector('#meals .meal');

  // unit checks for chain recognition and names
  const unit = await page.evaluate(() => ({
    a: Lookup.chainOf("McDONALD'S"), b: Lookup.chainOf('Chick-fil-A, Inc.'), c: Lookup.chainOf('Apple, raw'),
    d: Lookup.fdcToFood({ fdcId: 1, dataType: 'SR Legacy', description: 'KFC, Fried Chicken, ORIGINAL RECIPE, Breast, meat and skin with breading', foodCategory: 'Fast Foods', foodNutrients: [{ nutrientNumber: '208', unitName: 'KCAL', value: 250 }] }),
  }));
  check(unit.a === "McDonald's" && unit.b === 'Chick-fil-A' && unit.c === null, 'restaurant chains are recognised (and plain foods are not)');
  check(unit.d.kind === 'restaurant' && unit.d.brand === 'KFC' && /^Fried Chicken/.test(unit.d.name), 'USDA restaurant item gets chain as brand and a readable name: ' + unit.d.name);

  async function searchWith(filter, q) {
    await page.click(`#add-dialog .chip[data-filter="${filter}"]`);
    await page.fill('#add-search', q);
    await page.click('#add-online');
    await page.waitForFunction(() => /online result|limited|Online lookup/.test(document.querySelector('#add-status').textContent));
    return page.$$eval('#add-results .result', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  }

  await page.click('[data-add="Lunch"]');
  let rows = await searchWith('restaurants', 'big mac');
  check(rows.length === 3, 'Restaurants filter shows only restaurant items (' + rows.length + '): ' + rows.join(' | '));
  check(rows.every(r => r.includes('restaurant')), 'restaurant results are tagged');
  check(rows.some(r => r.startsWith("Big Mac · McDonald's")), 'USDA chain item is shown as "Big Mac · McDonald\'s"');
  check(!rows.some(r => /Sauce|Hazelnut|Beef/.test(r)), 'brand and generic items are excluded from Restaurants');
  check(usdaCalls[usdaCalls.length - 1].startsWith('SR Legacy,Survey (FNDDS),Branded'), 'Restaurants searches the right USDA datasets');
  check(await page.isVisible('#add-attribution'), 'data source attribution is shown with online results');

  // paging
  check(await page.isVisible('#add-more'), 'More results button appears when there are more pages');
  await page.click('#add-more');
  await page.waitForFunction(() => document.querySelectorAll('#add-results .result').length > 3);
  rows = await page.$$eval('#add-results .result', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  check(rows.some(r => r.startsWith("Whopper · Burger King")), 'More results loads page 2');

  rows = await searchWith('brands', 'big mac');
  check(rows.some(r => r.includes('Sauce')) && rows.some(r => r.includes('Hazelnut')) && !rows.some(r => r.includes('Beef')), 'Brands filter shows branded products only');
  check(usdaCalls[usdaCalls.length - 1].startsWith('Branded '), 'Brands searches USDA Branded Foods only');

  rows = await searchWith('basic', 'big mac');
  check(rows.length === 1 && rows[0].includes('Beef'), 'Basic foods filter shows generic foods only');

  // serving sizes from USDA measures; "Quantity not specified" dropped
  rows = await searchWith('restaurants', 'big mac');
  await page.locator('#add-results .result', { hasText: "Big Mac · McDonald's" }).locator('xpath=.').first().click();
  await page.waitForSelector('#amount-dialog[open]');
  const units = await page.$$eval('#amount-unit option', os => os.map(o => o.textContent));
  check(units[0] === '1 item (219 g)' && !units.some(u => /not specified/.test(u)), 'restaurant item offers its real serving size: ' + units.join(', '));
  await page.click('#amount-ok');
  await page.waitForTimeout(400);
  check((await page.textContent('#day-summary .big')).trim() === '563', '1 Big Mac (219 g × 257 kcal/100 g) logs 563 kcal');

  // offline: the same search comes from the cache
  offline = true;
  const callsBefore = usdaCalls.length;
  await page.click('[data-add="Dinner"]');
  rows = await searchWith('restaurants', 'big mac');
  check(rows.length >= 3 && usdaCalls.length === callsBefore, 'repeated search works offline from the saved results');
  check(/saved from an earlier search/.test(await page.textContent('#add-status')), 'status says results came from the saved search');
  rows = await searchWith('restaurants', 'pizza');
  check(rows.length === 0 && /limited|USDA/.test(await page.textContent('#add-status')), 'a new search while offline explains the problem');

  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
