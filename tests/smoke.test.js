// End-to-end smoke test for Daily Plate.
// Usage: node tests/smoke.test.js   (starts its own static server; needs Playwright + Chromium)
// Online lookups are mocked so the test runs without internet.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json' };

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

const OFF_PRODUCT = { code: '0123456789012', product_name: 'Test Granola', brands: 'Acme', serving_size: '45 g', serving_quantity: 45,
  nutriments: { 'energy-kcal_100g': 450, proteins_100g: 10, carbohydrates_100g: 60, fat_100g: 18, sodium_100g: 0.2, fiber_100g: 7 } };
const FDC = { foods: [{ fdcId: 1, description: 'LENTILS, COOKED', foodNutrients: [
  { nutrientNumber: '208', unitName: 'KCAL', value: 116 }, { nutrientNumber: '203', unitName: 'G', value: 9 },
  { nutrientNumber: '205', unitName: 'G', value: 20 }, { nutrientNumber: '204', unitName: 'G', value: 0.4 },
  { nutrientNumber: '303', unitName: 'MG', value: 3.3 }] }] };

let failures = 0;
function check(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; }

(async () => {
  const srv = await serve();
  const base = `http://localhost:${srv.address().port}/`;
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://world.openfoodfacts.org/**', r => {
    const u = r.request().url();
    if (u.includes('/api/v2/product/')) return r.fulfill({ json: { status: 1, product: OFF_PRODUCT } });
    return r.fulfill({ json: { products: [OFF_PRODUCT] } });
  });
  await page.route('https://api.nal.usda.gov/**', r => r.fulfill({ json: FDC }));

  await page.goto(base);
  await page.waitForSelector('#meals .meal');
  check(await page.locator('#meals .meal').count() === 4, 'diary shows 4 meals');

  // add starter food: banana, 1 medium
  await page.click('[data-add="Breakfast"]');
  await page.fill('#add-search', 'banana');
  await page.click('#add-results .result');
  await page.click('#amount-ok');
  await page.waitForSelector('.entry');
  const kcal1 = await page.textContent('#day-summary .big');
  check(kcal1.trim() === '105', `banana logged → 105 kcal (got ${kcal1})`);

  // online search (mocked)
  await page.click('[data-add="Lunch"]');
  await page.fill('#add-search', 'lentils');
  await page.click('#add-online');
  await page.waitForSelector('#add-results .result .tag-usda');
  check(await page.locator('#add-results .result').count() === 2, 'online search returns OFF + USDA results');
  await page.locator('#add-results .result', { hasText: 'Lentils' }).click();
  await page.selectOption('#amount-unit', 'g');
  await page.fill('#amount-qty', '200');
  await page.click('#amount-ok');
  await page.waitForTimeout(500);
  check((await page.textContent('#day-summary .big')).trim() === '337', 'lentils 200 g adds 232 kcal → 337');

  // barcode lookup (mocked)
  await page.click('[data-add="Snacks"]');
  await page.fill('#add-barcode', '0123456789012');
  await page.click('#add-barcode-go');
  await page.waitForSelector('#amount-dialog[open]');
  await page.click('#amount-ok');
  await page.waitForTimeout(500);
  check((await page.textContent('#day-summary .big')).trim() === '540', 'barcode granola 45 g adds 203 kcal → 540');

  // quick add
  await page.click('[data-add="Dinner"]');
  await page.click('#add-quick');
  await page.fill('#quick-kcal', '500');
  await page.fill('#quick-protein', '30');
  await page.click('#quick-dialog button.primary');
  await page.waitForTimeout(500);
  check((await page.textContent('#day-summary .big')).trim() === '1040', 'quick add 500 kcal → 1040');

  // custom food
  await page.click('[data-tab="foods"]');
  await page.click('#new-food');
  await page.fill('#food-name', 'Protein shake');
  await page.fill('#food-basis', '300');
  await page.fill('[data-n="kcal"]', '150');
  await page.fill('[data-n="protein"]', '30');
  await page.click('#food-dialog button.primary');
  await page.waitForTimeout(500);
  check(await page.locator('#foods-list', { hasText: 'Protein shake' }).count() === 1, 'custom food saved');

  // recipe
  await page.click('#new-recipe');
  await page.fill('#recipe-name', 'Overnight oats');
  await page.fill('#recipe-servings', '2');
  await page.fill('#recipe-search', 'oats');
  await page.click('#recipe-results .result');
  await page.fill('#recipe-search', 'milk');
  await page.click('#recipe-results .result');
  const prev = await page.textContent('#recipe-preview');
  check(/Per serving/.test(prev), 'recipe preview shows per-serving values: ' + prev);
  await page.click('#recipe-dialog button.primary');
  await page.waitForTimeout(500);
  check(await page.locator('#foods-list .tag-recipe').count() === 1, 'recipe saved');

  // log recipe serving, edit amount, delete
  await page.click('[data-tab="diary"]');
  await page.click('[data-add="Breakfast"]');
  await page.fill('#add-search', 'overnight');
  await page.click('#add-results .result');
  await page.click('#amount-ok');
  await page.waitForTimeout(500);
  check(await page.locator('.entry', { hasText: 'Overnight oats' }).count() === 1, 'recipe logged to diary');

  // day complete + note + weight
  await page.fill('#day-note', 'Test day');
  await page.dispatchEvent('#day-note', 'change');
  await page.fill('#day-weight', '70.5');
  await page.dispatchEvent('#day-weight', 'change');
  await page.check('#day-complete');
  await page.waitForTimeout(500);

  // copy to next day
  await page.click('#next-day');
  await page.click('#copy-yesterday');
  await page.waitForFunction(() => document.querySelectorAll('#meals .entry').length >= 5, null, { timeout: 3000 }).catch(() => {});
  check(await page.locator('#meals .entry').count() === 5, 'copy yesterday copies 5 entries');

  // trends
  await page.click('[data-tab="trends"]');
  await page.waitForSelector('#trend-chart svg');
  check(await page.locator('#archive-list tr.click').count() >= 2, 'archive lists logged days');

  // exports
  await page.click('[data-tab="settings"]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-json')]);
  const backup = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check(backup.app === 'daily-plate' && backup.entries.length === 10, 'JSON backup has 10 entries');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#export-csv')]);
  const csv = fs.readFileSync(await dl2.path(), 'utf8');
  check(csv.split('\n').length === 11 && csv.startsWith('date,meal,food'), 'entries CSV has header + 10 rows');
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#export-daily-csv')]);
  check(fs.readFileSync(await dl3.path(), 'utf8').includes('Test day'), 'daily CSV includes note');
  const [dl4] = await Promise.all([page.waitForEvent('download'), page.click('#rem-ics')]);
  check(fs.readFileSync(await dl4.path(), 'utf8').includes('RRULE:FREQ=DAILY'), 'ICS reminder is daily recurring');

  // restore into a fresh browser profile
  const ctx2 = await browser.newContext();
  const p2 = await ctx2.newPage();
  await p2.goto(base + '#settings');
  await p2.setInputFiles('#import-json', await dl.path());
  await p2.waitForTimeout(500);
  await p2.click('[data-tab="trends"]');
  await p2.waitForTimeout(300);
  check(await p2.locator('#archive-list tr.click').count() >= 2, 'backup restores into a fresh profile');

  // reminder banner: set reminder time to 00:00 on a day that is not complete
  const p3 = await (await browser.newContext()).newPage();
  await p3.goto(base);
  await p3.waitForSelector('#meals .meal');
  await p3.evaluate(async () => { state.settings.remTime = '23:59'; await DB.setSetting('remindersSent', {}); });
  check(!(await p3.isVisible('#reminder-banner')), 'no reminder banner before reminder time');
  await p3.evaluate(async () => { state.settings.remTime = '00:00'; await checkReminders(); });
  check(await p3.isVisible('#reminder-banner'), 'end-of-day reminder banner appears when day not complete');

  await page.screenshot({ path: path.join(__dirname, 'screenshot-settings.png'), fullPage: true });
  await page.click('[data-tab="diary"]');
  await page.click('#prev-day');
  await page.waitForTimeout(500);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: path.join(__dirname, 'screenshot-diary.png'), fullPage: true });

  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
