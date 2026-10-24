// Tests restaurant search: chain aliases, MenuStat (NYC Open Data) results and ranking,
// and importing a food pack. All network calls are mocked.
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

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

const ROWS = [
  { menu_item_id: '1', year: '2019', restaurant_item_name: "McDonald's Big Mac", restaurant: "McDonald's", item_name: 'Big Mac', food_category: 'Burgers', calories: '540', total_fat: '28', saturated_fat: '10', trans_fat: '1', cholesterol: '80', sodium: '950', carbohydrates: '46', protein: '25', sugar: '9', dietary_fiber: '3' },
  { menu_item_id: '2', year: '2017', restaurant_item_name: "McDonald's Big Mac", restaurant: "McDonald's", item_name: 'Big Mac', food_category: 'Burgers', calories: '530', total_fat: '27', carbohydrates: '45', protein: '24' },
  { menu_item_id: '3', year: '2019', restaurant_item_name: "McDonald's Big Mac Bacon", restaurant: "McDonald's", item_name: 'Big Mac Bacon', food_category: 'Burgers', serving_size: '8', serving_size_unit: 'oz', calories: '600', total_fat: '34', carbohydrates: '40', protein: '30' },
];

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  const urls = [];
  await ctx.route('https://api.nal.usda.gov/**', r => { urls.push(r.request().url()); r.fulfill({ json: { foods: [], totalPages: 1 } }); });
  await ctx.route('https://world.openfoodfacts.org/**', r => { urls.push(r.request().url()); r.fulfill({ json: { count: 0, products: [] } }); });
  await ctx.route('https://data.cityofnewyork.us/**', r => { urls.push(r.request().url()); r.fulfill({ json: ROWS, headers: { 'access-control-allow-origin': '*' } }); });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector('#meals .meal');

  // alias parsing
  const parsed = await page.evaluate(() => [Lookup.parseQuery('mcdonalds big mac'), Lookup.parseQuery('bk whopper'), Lookup.parseQuery('chick fil a nuggets'), Lookup.parseQuery('apple')]);
  check(parsed[0].chain === "McDonald's" && parsed[0].rest === 'big mac', 'mcdonalds -> McDonald\'s');
  check(parsed[1].chain === 'Burger King' && parsed[1].rest === 'whopper', 'bk -> Burger King');
  check(parsed[2].chain === 'Chick-fil-A' && parsed[2].rest === 'nuggets', 'three-word chain name found');
  check(parsed[3].chain === null, 'plain food has no chain');

  // restaurant search
  await page.click('#qa-add');
  await page.click('#add-dialog .chip[data-filter="restaurants"]');
  await page.fill('#add-search', 'mcdonalds big mac');
  await page.click('#add-online');
  await page.waitForSelector('#add-results .result');
  const names = await page.$$eval('#add-results .result', r => r.map(x => x.textContent));
  check(names.length === 2, 'older duplicate of the same item is dropped (got ' + names.length + ')');
  check(/Big Mac/.test(names[0]) && !/Bacon/.test(names[0]), 'exact item ranks first: ' + names[0].replace(/\s+/g, ' '));
  const ms = urls.find(u => u.includes('cityofnewyork'));
  check(ms && decodeURIComponent(ms).replace(/\+/g, " ").includes("like 'MCDONALD%S%'") && decodeURIComponent(ms).replace(/\+/g, " ").includes("'%BIG%'") && decodeURIComponent(ms).replace(/\+/g, " ").includes("'%MAC%'"), 'MenuStat query uses the chain and each word: ' + (ms ? decodeURIComponent(ms).replace(/\+/g, " ") : 'none'));
  check(urls.some(u => u.includes('usda') && decodeURIComponent(u).includes("McDonald's big mac")), 'USDA is asked with the canonical chain spelling');
  const status = await page.textContent('#add-status');
  check(/Searched: .*MenuStat/.test(status) && /McDonald's/.test(status), 'status lists sources and recognised chain: ' + status);

  // food screen
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  const meta = await page.textContent('#amount-meta');
  check(/MenuStat/.test(meta) && /2019/.test(meta) && /serving weight not listed/.test(meta), 'source text names MenuStat, year and the missing weight: ' + meta);
  await page.fill('#amount-qty', '1');
  await page.dispatchEvent('#amount-qty', 'input');
  check((await page.textContent('#amount-report .ring')).includes('540'), 'one serving as listed gives the listed 540 kcal');
  await page.click('#amount-dialog button[value="cancel"]');

  // food pack import (CSV)
  await page.click('[data-tab="foods"]');
  const csv = 'name,brand,serving_label,serving_grams,kcal,protein,carbs,fat\n"Local Diner Burger, double",Local Diner,1 burger,250,800,40,50,48\nBad row,,,,,,,\n';
  const file = path.join(os.tmpdir(), 'pack.csv'); fs.writeFileSync(file, csv);
  await page.setInputFiles('#pack-import', file);
  await page.waitForTimeout(500);
  const foods = await page.evaluate(async () => (await DB.all('foods')).filter(f => f.fromPack));
  check(foods.length === 1 && foods[0].name === 'Local Diner Burger, double' && foods[0].brand === 'Local Diner', 'CSV pack imports valid rows only');
  check(foods[0] && Math.round(foods[0].per100.kcal) === 320 && foods[0].servings[0].grams === 250, 'per-serving numbers convert to per-100 g: ' + JSON.stringify(foods[0] && foods[0].per100.kcal));
  check(await page.locator('#foods-list', { hasText: 'Local Diner Burger' }).count() === 1, 'imported food appears in the Foods list');

  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close(); srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
