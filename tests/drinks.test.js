// Tests that drinks (including alcohol) can be found and logged:
//  - built-in drinks are seeded, and seeded for people who installed earlier
//  - "cayman jack" finds a drink without any network at all
//  - Open Food Facts products with no energy per 100 g still come through:
//    energy per serving is scaled, calories are worked out from carbs/alcohol,
//    and a can with no nutrition panel is still offered (marked)
//  - the Drinks filter keeps drinks only
//  - drinks can be logged in fluid ounces
// All network calls are mocked.
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let failures = 0;
function check(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; }

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

// Open Food Facts products of the kind that used to be dropped.
const OFF_PRODUCTS = [
  { // ready-made cocktail: no nutrition panel at all, only % alcohol
    code: '1111111111111', product_name: 'Margarita', brands: 'Cayman Jack',
    categories_tags: ['en:alcoholic-beverages', 'en:malt-cocktails'], quantity: '12 fl oz',
    nutriments: { alcohol_100g: 5.8 },
  },
  { // soda listing energy only per serving
    code: '2222222222222', product_name: 'Lemon Lime Soda', brands: 'Testco',
    categories_tags: ['en:beverages', 'en:sodas'], serving_size: '12 fl oz', serving_quantity: 355,
    nutriments: { 'energy-kcal_serving': 150, carbohydrates_100g: 10.4, sugars_100g: 10.4 },
  },
  { // hard seltzer with carbs and alcohol but no energy figure
    code: '3333333333333', product_name: 'Hard Seltzer Black Cherry', brands: 'Testclaw',
    categories_tags: ['en:alcoholic-beverages'], serving_quantity: 355,
    nutriments: { alcohol_100g: 5, carbohydrates_100g: 0.6 },
  },
  { // cocktail with no nutrition information whatsoever
    code: '5555555555555', product_name: 'Mystery Cocktail', brands: 'Testco',
    categories_tags: ['en:alcoholic-beverages'], nutriments: {},
  },
  { // not a drink and no energy: must still be dropped
    code: '4444444444444', product_name: 'Mystery Crackers', brands: 'Testco',
    categories_tags: ['en:biscuits'], nutriments: {},
  },
];

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  await ctx.route('https://api.nal.usda.gov/**', r => r.fulfill({ json: { foods: [], totalPages: 1 } }));
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ json: { count: OFF_PRODUCTS.length, products: OFF_PRODUCTS } }));
  await ctx.route('https://data.cityofnewyork.us/**', r => r.fulfill({ json: [], headers: { 'access-control-allow-origin': '*' } }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector('#meals .meal');

  // ---- built-in drinks ----
  const builtIn = await page.evaluate(async () => (await DB.all('foods')).filter(f => f.isDrink).map(f => ({ name: f.name, brand: f.brand, kcal: f.per100.kcal, alcohol: f.per100.alcohol })));
  check(builtIn.length >= 20, `built-in drinks are seeded (${builtIn.length})`);
  check(builtIn.some(f => /beer/i.test(f.name)) && builtIn.some(f => /wine/i.test(f.name)) && builtIn.some(f => /seltzer/i.test(f.name)), 'beer, wine and hard seltzer are built in');
  const cj = builtIn.find(f => f.brand === 'Cayman Jack');
  check(!!cj && cj.kcal > 0 && cj.alcohol > 0, 'Cayman Jack is built in with calories and alcohol: ' + JSON.stringify(cj));

  // typing it finds it with no network at all
  await page.click('#qa-add');
  await page.fill('#add-search', 'cayman jack');
  await page.dispatchEvent('#add-search', 'input');
  await page.waitForSelector('#add-results .result');
  const local = await page.$$eval('#add-results .result', r => r.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check(local.length >= 1 && /Cayman Jack/.test(local.join(' ')), 'searching "cayman jack" finds it offline: ' + local[0]);

  // ---- logging a drink in fluid ounces ----
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  const units = await page.$$eval('#amount-unit option', o => o.map(x => x.value));
  check(units.includes('floz') && units.includes('ml'), 'drinks offer fluid ounces and millilitres: ' + units.join(','));
  const brandLine = await page.textContent('#amount-brand');
  check(/drink/.test(brandLine) && /ABV/.test(brandLine), 'food screen shows it is a drink and its ABV: ' + brandLine);
  await page.selectOption('#amount-unit', 'floz');
  await page.fill('#amount-qty', '12');
  await page.dispatchEvent('#amount-qty', 'input');
  const kcal = await page.textContent('#amount-report .ring');
  check(/2[0-4]\d/.test(kcal), '12 fl oz of the margarita is about 220 kcal: ' + kcal.replace(/\s+/g, ' '));
  await page.click('#amount-ok');
  await page.waitForSelector('#amount-dialog', { state: 'hidden' });
  await page.waitForFunction(async () => (await DB.all('entries')).length > 0, null, { timeout: 5000 }).catch(() => {}); // saving finishes just after the screen closes
  await page.waitForFunction(() => /fl oz/.test(document.querySelector('#meals').textContent), null, { timeout: 5000 }).catch(() => {});
  const logged = await page.evaluate(async () => (await DB.all('entries')).map(e => ({ unit: e.unit, qty: e.qty, grams: e.grams })));
  check(logged.length === 1 && logged[0].unit === 'floz' && Math.round(logged[0].grams) === 355, 'the entry is stored in fluid ounces: ' + JSON.stringify(logged[0]));
  check(/12 fl oz/.test(await page.textContent('#meals')), 'the diary shows "12 fl oz"');

  // ---- online search keeps drinks the sources describe poorly ----
  await page.click('#qa-add');
  await page.click('#add-dialog .chip[data-filter="drinks"]');
  await page.fill('#add-search', 'seltzer');
  await page.click('#add-online');
  await page.waitForSelector('#add-results .result');
  await page.waitForFunction(() => /online result/.test(document.querySelector('#add-status').textContent));
  const online = await page.evaluate(() => search.results.map(f => ({ name: f.name, kcal: f.per100.kcal, incomplete: !!f.incomplete, estimated: !!f.estimated, isDrink: !!f.isDrink, servings: f.servings.map(s => s.label) })));
  const soda = online.find(f => f.name === 'Lemon Lime Soda');
  check(!!soda && Math.round(soda.kcal) === 42, 'energy listed per serving is scaled to 100 g: ' + JSON.stringify(soda && soda.kcal));
  const hs = online.find(f => f.name === 'Hard Seltzer Black Cherry');
  check(!!hs && hs.estimated && Math.round(hs.kcal) === 30, 'calories are worked out from carbs and alcohol: ' + JSON.stringify(hs && hs.kcal));
  const marg = online.find(f => f.name === 'Margarita');
  check(!!marg && marg.estimated && Math.round(marg.kcal) === 32, 'a can listing only % alcohol still gets calories: ' + JSON.stringify(marg && marg.kcal));
  check(!!marg && marg.servings.some(s => /12 fl oz/.test(s)), 'the container size becomes a serving: ' + JSON.stringify(marg && marg.servings));
  const mystery = online.find(f => f.name === 'Mystery Cocktail');
  check(!!mystery && mystery.incomplete && mystery.isDrink, 'a can with no nutrition panel at all is still offered, marked incomplete');
  check(!online.some(f => f.name === 'Mystery Crackers'), 'non-drinks with no nutrition are still dropped');
  check(online.every(f => f.isDrink), 'the Drinks filter keeps drinks only');
  const resultText = await page.$$eval('#add-results .result', r => r.map(x => x.textContent.replace(/\s+/g, ' ')));
  check(resultText.some(t => /No nutrition listed/.test(t)), 'the list says when nutrition is missing');

  // ---- drinks reach people who installed before this version ----
  const added = await page.evaluate(async () => {
    const drinks = (await DB.all('foods')).filter(f => f.id.startsWith('starter-drink-'));
    for (const d of drinks) await DB.del('foods', d.id);
    await DB.setSetting('starterVersion', 0);
    await seedNewStarters();
    return (await DB.all('foods')).filter(f => f.id.startsWith('starter-drink-')).length;
  });
  check(added >= 20, 'an older install gets the built-in drinks added (' + added + ')');
  const kept = await page.evaluate(async () => {
    const id = 'starter-drink-0';
    await DB.remove('foods', id);
    await DB.setSetting('starterVersion', 0);
    await seedNewStarters();
    return !(await DB.get('foods', id));
  });
  check(kept, 'a built-in drink you deleted stays deleted');

  // an install from 1.13.0 (Margarita without the pack barcode) gets the barcode added
  const patched = await page.evaluate(async () => {
    const m = (await DB.all('foods')).find(f => f.brand === 'Cayman Jack' && f.name === 'Margarita');
    delete m.barcode; await DB.put('foods', m);
    await DB.setSetting('starterVersion', 1);
    await seedNewStarters();
    return (await DB.get('foods', m.id)).barcode;
  });
  check(patched === '815829010044', 'an existing built-in gains its barcode: ' + patched);

  // ---- the Cayman Jack variety-pack barcode offers every flavor in the box ----
  await page.reload();
  await page.waitForSelector('#meals .meal');
  await page.click('#qa-add');
  await page.fill('#add-barcode', '815829010044');
  await page.click('#add-barcode-go');
  await page.waitForFunction(() => /different items/.test(document.querySelector('#add-status').textContent));
  const flavors = await page.$$eval('#add-results .result', r => r.map(x => x.textContent.replace(/\s+/g, ' ')));
  check(flavors.length === 4 && ['Margarita', 'Mexican Sunrise', 'Paloma', 'Agave Mule'].every(n => flavors.some(t => t.includes(n))), 'variety-pack UPC lists its 4 flavors: ' + flavors.map(t => t.split('·')[0].trim()).join(', '));
  await page.click('#add-results .result:has-text("Mexican Sunrise")');
  await page.waitForSelector('#amount-dialog[open]');
  check((await page.textContent('#amount-title')) === 'Mexican Sunrise', 'picking a flavor opens it');
  await page.click('#amount-dialog button[value="cancel"]');
  // the same code typed as a 13-digit EAN also works
  await page.click('#qa-add');
  await page.fill('#add-barcode', '0815829010044');
  await page.click('#add-barcode-go');
  await page.waitForFunction(() => /different items/.test(document.querySelector('#add-status').textContent));
  check((await page.$$('#add-results .result')).length === 4, 'the 13-digit spelling 0815829010044 finds the same pack');

  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close(); srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
