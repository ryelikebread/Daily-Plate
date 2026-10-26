// Tests the "+ Custom food" option on the add-food screen: type in your own food,
// then log it once or save it for next time. Also the "Create … as a custom food"
// row under search results and the barcode-not-found path.
// Usage: node tests/customfood.test.js   (needs Playwright + Chromium)
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

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 14'] });
  await ctx.route('https://api.nal.usda.gov/**', r => r.fulfill({ json: { foods: [], totalPages: 0 } }));
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ json: { count: 0, products: [], status: 0 } }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector('#meals .meal');
  const entries = () => page.evaluate(() => DB.all('entries'));
  const foodsNamed = (n) => page.evaluate(n => [...state.foods.values()].filter(f => f.name === n), n);

  // 1. "+ Custom food" button, log once (not saved)
  await page.click('#qa-add');
  check(await page.isVisible('#add-custom'), 'add-food screen has a + Custom food button');
  await page.click('#add-custom');
  await page.waitForSelector('#food-dialog[open]');
  check(!(await page.isHidden('#food-log-opts')) && await page.isChecked('#food-keep'), 'shows "save to my foods" option, ticked by default');
  check(await page.textContent('#food-ok') === 'Save & log', 'button reads Save & log');
  await page.fill('#food-name', 'Grandma\'s stew');
  await page.fill('#food-basis', '350');
  await page.fill('[data-n="kcal"]', '420');
  await page.fill('[data-n="protein"]', '30');
  await page.uncheck('#food-keep');
  check(await page.textContent('#food-ok') === 'Log once', 'unticking changes the button to Log once');
  await page.click('#food-ok');
  await page.waitForSelector('#amount-dialog[open]');
  check(await page.textContent('#amount-title') === 'Grandma\'s stew', 'goes straight to the amount screen');
  check((await page.inputValue('#amount-unit')).startsWith('s:1 serving') && await page.inputValue('#amount-qty') === '1', 'defaults to 1 serving (the 350 g basis)');
  check((await page.textContent('#amount-meta')).includes('logged once'), 'source line says it was logged once');
  check((await page.textContent('#amount-preview')).includes('420 kcal'), 'preview shows 420 kcal');
  await page.click('#amount-ok');
  await page.waitForTimeout(300);
  let list = await entries();
  const stew = list.find(e => e.food.name === 'Grandma\'s stew');
  check(stew && Math.round(stew.grams) === 350 && Math.round(stew.food.per100.kcal * 3.5) === 420, 'diary entry saved with 350 g and 420 kcal');
  check((await foodsNamed('Grandma\'s stew')).length === 0, 'log once does not add it to your foods');
  check((await page.textContent('#meals')).includes('Grandma'), 'entry shows in the diary');

  // 2. "Create … as a custom food" under search results, saved for reuse
  await page.click('#qa-add');
  await page.fill('#add-search', 'Corner cafe muffin');
  await page.waitForSelector('#add-create');
  check((await page.textContent('#add-create')).includes('Corner cafe muffin'), 'search offers to create the typed name as a custom food');
  await page.click('#add-online');
  await page.waitForFunction(() => /online result/.test(document.querySelector('#add-status').textContent));
  check(await page.isVisible('#add-create'), 'still offered after an online search finds nothing');
  await page.click('#add-create');
  await page.waitForSelector('#food-dialog[open]');
  check(await page.inputValue('#food-name') === 'Corner cafe muffin', 'name is filled in from the search');
  await page.fill('[data-n="kcal"]', '400');
  await page.click('#food-ok');
  await page.waitForSelector('#amount-dialog[open]');
  await page.click('#amount-ok');
  await page.waitForTimeout(300);
  const muffin = await foodsNamed('Corner cafe muffin');
  check(muffin.length === 1 && muffin[0].source === 'custom', 'saved to your foods');
  list = await entries();
  check(list.some(e => e.food.name === 'Corner cafe muffin' && e.foodId === muffin[0].id), 'and logged to the diary');
  await page.click('#qa-add');
  await page.fill('#add-search', 'muffin');
  await page.waitForSelector('#add-results .result');
  check((await page.textContent('#add-results .result')).includes('Corner cafe muffin'), 'saved food shows up in search next time');

  // 3. Cancel goes back to the add-food screen and logs nothing
  const before = (await entries()).length;
  await page.click('#add-custom');
  await page.waitForSelector('#food-dialog[open]');
  await page.click('#food-dialog button[value="cancel"]');
  await page.waitForSelector('#add-dialog[open]');
  check((await entries()).length === before, 'cancel returns to the add screen without logging');

  // 4. Barcode not found -> custom food with the barcode, then logged
  await page.fill('#add-barcode', '012345678905');
  await page.click('#add-barcode-go');
  await page.waitForSelector('#create-from-barcode');
  await page.click('#create-from-barcode');
  await page.waitForSelector('#food-dialog[open]');
  check(await page.inputValue('#food-barcode') === '012345678905', 'barcode is filled in');
  await page.fill('#food-name', 'Store granola');
  await page.fill('[data-n="kcal"]', '450');
  await page.click('#food-ok');
  await page.waitForSelector('#amount-dialog[open]');
  await page.click('#amount-ok');
  await page.waitForTimeout(300);
  const gran = await foodsNamed('Store granola');
  check(gran.length === 1 && gran[0].barcode === '012345678905', 'barcode food saved for next scan');
  check((await entries()).some(e => e.food.name === 'Store granola'), 'barcode food logged');

  // 5. Foods tab "+ Custom food" still just saves (no logging step)
  const n = (await entries()).length;
  await page.click('nav [data-tab="foods"]');
  await page.click('#new-food');
  await page.waitForSelector('#food-dialog[open]');
  check(await page.isHidden('#food-log-opts') && await page.textContent('#food-ok') === 'Save food', 'Foods tab editor has no logging step');
  await page.fill('#food-name', 'Plain tofu');
  await page.click('#food-ok');
  await page.waitForTimeout(300);
  check(!(await page.isVisible('#amount-dialog')) && (await foodsNamed('Plain tofu')).length === 1 && (await entries()).length === n, 'saved without logging');

  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
