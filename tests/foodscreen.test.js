// Tests the detailed food screen: nutrient report, explanations, favorites,
// recents, issue flags and "Edit a copy", using a fake USDA food with many nutrients.
// Usage: node tests/foodscreen.test.js   (needs Playwright + Chromium)
const { chromium, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let failures = 0;
function check(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; }

const N = (num, unit, value) => ({ nutrientNumber: num, unitName: unit, value });
const BUN = { fdcId: 123456, dataType: 'SR Legacy', description: 'Rolls, hot dog or hamburger', foodCategory: 'Baked Products',
  foodMeasures: [{ disseminationText: '1 roll', gramWeight: 43, rank: 1 }],
  foodNutrients: [
    N('208', 'KCAL', 279), N('203', 'G', 9.8), N('205', 'G', 50.1), N('204', 'G', 3.9), N('291', 'G', 1.8), N('269', 'G', 7.3), N('209', 'G', 36.7),
    N('255', 'G', 34.3), N('606', 'G', 0.8), N('645', 'G', 0.7), N('646', 'G', 1.8), N('619', 'G', 0.2), N('618', 'G', 1.6), N('605', 'G', 0),
    N('601', 'MG', 0), N('404', 'MG', 0.5), N('405', 'MG', 0.3), N('406', 'MG', 4.2), N('415', 'MG', 0.1), N('435', 'UG', 131), N('417', 'UG', 90),
    N('418', 'UG', 0.2), N('320', 'UG', 29.6), N('401', 'MG', 1.3), N('323', 'MG', 0.3), N('430', 'UG', 4.8),
    N('301', 'MG', 144), N('312', 'MG', 0.1), N('303', 'MG', 3.4), N('304', 'MG', 23), N('315', 'MG', 0.5), N('305', 'MG', 101), N('306', 'MG', 122),
    N('317', 'UG', 27.2), N('307', 'MG', 494), N('309', 'MG', 0.7),
    N('507', 'G', 0.2), N('512', 'G', 0.2), N('503', 'G', 0.3), N('504', 'G', 0.6), N('505', 'G', 0.2), N('506', 'G', 0.2), N('508', 'G', 0.4),
    N('502', 'G', 0.3), N('501', 'G', 0.1), N('509', 'G', 0.3), N('510', 'G', 0.4),
  ] };

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
  const ctx = await browser.newContext({ ...devices['iPhone 14'], colorScheme: 'dark' });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await ctx.route('https://api.nal.usda.gov/**', r => r.fulfill({ json: { foods: [BUN], totalPages: 1 } }));
  await ctx.route('https://world.openfoodfacts.org/**', r => r.fulfill({ json: { count: 0, products: [] } }));
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector('#meals .meal');
  const shots = path.join(__dirname, 'screens'); fs.mkdirSync(shots, { recursive: true });

  // open the food screen from an online search
  await page.click('#qa-add');
  await page.click('#add-dialog .chip[data-filter="basic"]');
  await page.fill('#add-search', 'hot dog bun');
  await page.click('#add-online');
  await page.waitForSelector('#add-results .result');
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  await page.selectOption('#amount-unit', 'g');
  await page.fill('#amount-qty', '100');
  await page.dispatchEvent('#amount-qty', 'input');

  check(/4[0-9] listed nutrients · Data source: USDA SR Legacy/.test(await page.textContent('#amount-meta')), 'shows nutrient count and data source: ' + await page.textContent('#amount-meta'));
  const secs = await page.$$eval('#amount-report details.rsec summary', s => s.map(x => x.textContent.trim()));
  check(secs.join('|') === 'Energy summary|Macronutrient targets|Highlighted targets|Nutrient scores|Complete nutrient summary', 'report has all five sections: ' + secs.join(', '));
  check((await page.textContent('#amount-report .ring')).includes('279'), 'energy ring shows 279 kcal');
  const legend = await page.$$eval('#amount-report .legend-row', r => r.map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  check(legend[0].startsWith('Protein 15%') && legend[1].startsWith('Net carbs 72%') && legend[2].startsWith('Fat 13%'), 'calorie split matches protein/net carbs/fat: ' + legend.join(' | '));
  check(legend[1].includes('48.3 g'), 'net carbs = carbs − fiber (48.3 g)');
  const folate = await page.locator('#amount-report details[data-sec="full"] .nrow', { hasText: 'B9 (Folate)' }).first().textContent();
  check(/131 \/ 400 µg/.test(folate) && /33%/.test(folate), 'folate uses DFE value (131 µg, 33%): ' + folate.replace(/\s+/g, ' '));
  const omega3 = await page.locator('#amount-report .nrow', { hasText: /^\s*Omega-3\s/ }).first().textContent();
  check(/0\.2 \/ 1\.6 g/.test(omega3), 'omega-3 total worked out from ALA: ' + omega3.replace(/\s+/g, ' '));
  check(await page.locator('#amount-report .nrow.plain', { hasText: 'Starch' }).count() === 1, 'nutrients without a target show as plain amounts');
  check(await page.locator('#amount-report .nrow', { hasText: 'Valine' }).count() === 1, 'amino acids are listed');
  check(await page.locator('#amount-report .nrow.ind3', { hasText: 'Omega-3 (ALA)' }).count() === 1, 'sub-nutrients are indented under their parent');
  const sodium = await page.locator('#amount-report .nrow', { hasText: 'Sodium' }).last().textContent();
  check(/max/.test(sodium), 'limits are marked "max"');
  check(await page.locator('#amount-report .nrow', { hasText: 'Biotin' }).count() === 0, 'nutrients the food doesn\'t list are hidden by default');
  await page.check('#amount-report [data-showmissing]');
  check(await page.locator('#amount-report .nrow', { hasText: 'Biotin' }).first().textContent().then(t => t.includes('not listed')), '"Show nutrients not listed" reveals them');

  // amounts scale with the serving
  await page.fill('#amount-qty', '200'); await page.dispatchEvent('#amount-qty', 'input');
  check((await page.textContent('#amount-report .ring')).includes('558'), 'report updates when the amount changes (200 g → 558 kcal)');
  await page.fill('#amount-qty', '100'); await page.dispatchEvent('#amount-qty', 'input');
  await page.screenshot({ path: path.join(shots, 'food-top.png') });

  // tap a nutrient for its explanation
  await page.locator('#amount-report .nrow', { hasText: 'Iron' }).first().click();
  await page.waitForSelector('#info-dialog[open]');
  const info = await page.textContent('#info-body');
  check((await page.textContent('#info-title')) === 'Iron' && /What it is/.test(info) && /Why it matters/.test(info), 'tapping Iron opens its explanation');
  check(await page.locator('#info-body a[href^="https://ods.od.nih.gov/factsheets/Iron"]').count() === 1, 'explanation links to the NIH source');
  check(/not medical advice/.test(info), 'explanation includes the not-medical-advice note');
  check(/Here: 3\.4 mg/.test(info) && /target: 8 mg/.test(info), 'explanation shows this food\'s amount and your target');
  await page.screenshot({ path: path.join(shots, 'info.png') });
  await page.click('#info-dialog button[value="close"]');

  // collapse a section and it stays collapsed next time
  await page.click('#amount-report details[data-sec="highlight"] summary');
  check(!(await page.$eval('#amount-report details[data-sec="highlight"]', d => d.open)), 'sections collapse');

  // favorite via star
  await page.click('#fav-toggle');
  await page.waitForTimeout(200);
  check((await page.textContent('#fav-toggle')) === '★', 'star turns on');

  // report issue
  await page.click('#food-menu-btn');
  check(await page.isVisible('#food-menu'), '⋯ menu opens');
  await page.click('#food-menu [data-act="report"]');
  await page.waitForSelector('#issue-dialog[open]');
  check((await page.getAttribute('#issue-source', 'href')) === 'https://fdc.nal.usda.gov/food-details/123456/nutrients', 'issue dialog links to the USDA entry');
  await page.fill('#issue-note', 'sodium seems high');
  const gh = await page.getAttribute('#issue-github', 'href');
  check(gh.startsWith('https://github.com/ryelikebread/Daily-Plate/issues/new?labels=food-data') && decodeURIComponent(gh).includes('sodium seems high'), 'GitHub list link is pre-filled with the note');
  await page.click('#issue-dialog button[value="ok"]');
  await page.waitForTimeout(200);
  check((await page.textContent('#amount-flag')).includes('sodium seems high'), 'issue flag shows on the food');

  // save to diary; diary day report
  await page.click('#amount-ok');
  await page.waitForTimeout(300);
  await page.click('#tab-diary details.card summary');
  check(await page.locator('#day-report details.rsec').count() === 5, 'diary day shows the same full report');

  // Save & add another: saves, then reopens the add list for the same meal
  await page.click('#qa-add');
  await page.waitForTimeout(300);
  const mealBefore = await page.textContent('#add-meal-name');
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  check(await page.isVisible('#amount-more'), 'Save & add another is offered for new entries');
  await page.click('#amount-more');
  await page.waitForSelector('#add-dialog[open]');
  check((await page.textContent('#add-meal-name')) === mealBefore, 'add list reopens for the same meal');
  await page.click('#add-dialog button[value="cancel"], #add-dialog [data-close]').catch(() => page.keyboard.press('Escape'));
  await page.waitForTimeout(200);

  // Part-of-same-item checkbox groups foods into one expandable diary line
  await page.click('#amount-more'.replace('#amount-more','#add-dialog button[value="cancel"]')).catch(() => {});
  await page.click('#qa-add');
  await page.waitForTimeout(300);
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  check(!(await page.isVisible('#amount-same')), 'no "same item" box on the first food');
  await page.click('#amount-more');
  await page.waitForSelector('#add-dialog[open]');
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  check(await page.isVisible('#amount-same') && !(await page.isChecked('#amount-same')), '"same item" box shows on the next food, unchecked by default');
  await page.check('#amount-same');
  await page.click('#amount-ok');
  await page.waitForTimeout(300);
  check(await page.locator('#meals details.group').count() === 1, 'checked food joins the previous one as one grouped diary line');
  const gt = await page.textContent('#meals details.group > summary');
  check(/\+ 1 more/.test(gt) && /2 parts/.test(gt), 'group line shows part count: ' + gt.replace(/\s+/g, ' '));
  await page.click('#meals details.group > summary .entry-main');
  await page.waitForTimeout(200);
  check(await page.locator('#meals details.group .group-parts .entry').count() === 2, 'group expands to show its parts');
  // delete whole group, then undo
  await page.click('#meals details.group > summary [data-delgroup]');
  await page.waitForTimeout(200);
  check(await page.locator('#meals details.group').count() === 0, 'deleting the item removes all its parts');
  await page.click('.toast button, #toast button').catch(() => {});
  await page.waitForTimeout(300);
  check(await page.locator('#meals details.group').count() === 1, 'Undo restores the whole group');
  await page.click('#meals details.group > summary .entry-main');
  await page.click('#meals details.group [data-ungroup]');
  await page.waitForTimeout(300);
  check(await page.locator('#meals details.group').count() === 0, 'Ungroup separates the parts');

  // copy yesterday keeps a group together (regroup, then copy it to the next day)
  await page.click('#meals [data-del]').catch(() => {});
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const all = await DB.all('entries');
    const d = all[0].date; const gid = 'g-test';
    await DB.saveMany('entries', all.slice(0, 2).map(e => ({ ...e, groupId: gid })));
  });
  const today = await page.inputValue('#diary-date');
  const next = new Date(today + 'T12:00:00'); next.setDate(next.getDate() + 1);
  await page.fill('#diary-date', next.toISOString().slice(0, 10));
  await page.dispatchEvent('#diary-date', 'change');
  await page.waitForTimeout(300);
  await page.click('#copy-yesterday');
  await page.waitForTimeout(400);
  check(await page.locator('#meals details.group').count() === 1, 'Copy yesterday keeps grouped items grouped');
  await page.fill('#diary-date', today);
  await page.dispatchEvent('#diary-date', 'change');
  await page.waitForTimeout(300);

  // photos on an entry (1x1 PNG), shown as thumbnail, kept when edited, deleted with the entry
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.click('#qa-add');
  await page.waitForTimeout(300);
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  await page.setInputFiles('#photo-input', { name: 'meal.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForSelector('#photo-strip img');
  check(await page.locator('#photo-strip img').count() === 1, 'chosen photo appears in the food screen');
  await page.click('#amount-ok');
  await page.waitForSelector('#meals .entry-photos img');
  check(await page.locator('#meals .entry-photos img').count() === 1, 'diary row shows the photo thumbnail');
  await page.click('#meals .entry-photos');
  await page.waitForSelector('#photo-dialog[open]');
  check(await page.locator('#photo-view img').count() === 1, 'tapping the thumbnail opens the photo viewer');
  await page.click('#photo-dialog button[value="close"]');
  const withPhoto = page.locator('#meals .entry', { has: page.locator('.entry-photos') }).first();
  await withPhoto.locator('[data-edit]').click();
  await page.waitForSelector('#amount-dialog[open]');
  await page.waitForSelector('#photo-strip img');
  check(await page.locator('#photo-strip img').count() === 1, 'photo is loaded when the entry is edited');
  await page.click('#photo-strip [data-rmphoto]');
  await page.click('#amount-ok');
  await page.waitForTimeout(400);
  check(await page.locator('#meals .entry-photos').count() === 0, 'removing the photo in edit takes it off the diary row');
  check(await page.evaluate(async () => (await DB.all('photos')).length) === 0, 'photo record is deleted from the device');

  // favorites first; remove from recents
  await page.click('#qa-add');
  await page.waitForTimeout(300);
  let first = await page.textContent('#add-results .result');
  check(/★/.test(first) && /Rolls/.test(first), 'favorites show first when adding food');
  check(/⚠/.test(first), 'flagged food shows ⚠ in lists');
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  await page.click('#fav-toggle'); // unfavorite
  await page.click('#food-menu-btn');
  await page.click('#food-menu [data-act="recent"]');
  await page.waitForTimeout(200);
  await page.click('#amount-dialog button[value="cancel"]');
  await page.click('#qa-add');
  await page.waitForTimeout(300);
  const list = await page.$$eval('#add-results .result', r => r.map(x => x.textContent));
  check(!list.slice(0, 5).some(t => /Rolls/.test(t) && /★/.test(t)) && /Your foods|Recent/.test(await page.textContent('#add-status')) && !(await page.textContent('#add-status')).includes('Recent'), 'removed food no longer shows in recents');

  // edit a copy
  await page.fill('#add-search', 'rolls');
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  await page.click('#food-menu-btn');
  await page.click('#food-menu [data-act="copy"]');
  await page.waitForSelector('#food-dialog[open]');
  check((await page.inputValue('#food-name')).endsWith('(my copy)') && (await page.inputValue('[data-n="b12"]')) === '0.2', 'Edit a copy pre-fills every nutrient');
  await page.fill('[data-n="sodium"]', '300');
  await page.click('#food-dialog button.primary');
  await page.waitForTimeout(300);
  const foods = await page.evaluate(() => [...state.foods.values()].filter(f => /Rolls/.test(f.name)).map(f => [f.source, f.per100.sodium]));
  check(foods.some(([s, na]) => s === 'custom' && na === 300) && foods.some(([s, na]) => s === 'usda' && na === 494), 'copy is a separate custom food; original unchanged');

  // full-page screenshot of the report for review
  await page.click('#qa-add');
  await page.fill('#add-search', 'rolls, hot');
  await page.click('#add-results .result');
  await page.waitForSelector('#amount-dialog[open]');
  await page.$eval('#amount-report details[data-sec="highlight"]', d => { d.open = true; });
  await page.$eval('#amount-report details[data-sec="scores"]', d => { d.open = true; });
  await page.setViewportSize({ width: 390, height: 4200 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(shots, 'food-full.png') });

  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
