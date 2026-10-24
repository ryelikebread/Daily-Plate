// Tests device-to-device sync using a fake in-memory GitHub Gist API.
// Usage: node tests/sync.test.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const TOKEN = 'github_pat_TEST';
const PASS = 'correct horse battery';

let failures = 0;
function check(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; }

// ---- fake gist API ----
const gists = new Map();
let nextId = 1;
const calls = [];
async function gistApi(route) {
  const req = route.request();
  const url = new URL(req.url());
  calls.push(req.method() + ' ' + url.pathname);
  if (req.headers()['authorization'] !== 'Bearer ' + TOKEN) return route.fulfill({ status: 401, json: { message: 'Bad credentials' } });
  const m = url.pathname.match(/^\/gists(?:\/(\w+))?$/);
  if (!m) return route.fulfill({ status: 404, json: {} });
  const id = m[1];
  const view = (g) => ({ id: g.id, description: g.description, public: g.public, files: Object.fromEntries(Object.entries(g.files).map(([n, f]) => [n, { filename: n, content: f.content, truncated: false, raw_url: '' }])) });
  if (req.method() === 'GET' && !id) return route.fulfill({ json: [...gists.values()].map(g => ({ ...view(g), files: Object.fromEntries(Object.keys(g.files).map(n => [n, { filename: n }])) })) });
  if (req.method() === 'GET') return gists.has(id) ? route.fulfill({ json: view(gists.get(id)) }) : route.fulfill({ status: 404, json: {} });
  if (req.method() === 'POST') {
    const body = JSON.parse(req.postData());
    const g = { id: 'g' + nextId++, description: body.description, public: body.public, files: body.files };
    gists.set(g.id, g);
    return route.fulfill({ status: 201, json: view(g) });
  }
  if (req.method() === 'PATCH') {
    const g = gists.get(id); const body = JSON.parse(req.postData());
    Object.assign(g.files, body.files);
    return route.fulfill({ json: view(g) });
  }
  return route.fulfill({ status: 405, json: {} });
}

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
  const errors = [];

  async function device(name) {
    const ctx = await browser.newContext({ acceptDownloads: true });
    await ctx.route('https://api.github.com/**', gistApi);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(name + ': ' + e.message));
    await page.goto(base);
    await page.waitForSelector('#meals .meal');
    return page;
  }
  async function logFood(page, meal, search) {
    await page.click(`[data-add="${meal}"]`);
    await page.fill('#add-search', search);
    await page.click('#add-results .result');
    await page.click('#amount-ok');
    await page.waitForTimeout(300);
  }
  async function turnOn(page, pass = PASS) {
    await page.click('[data-tab="settings"]');
    await page.fill('#sync-token', TOKEN);
    await page.fill('#sync-pass', pass);
    await page.click('#sync-on');
    await page.waitForFunction(() => /Synced|problem|Could not/.test(document.querySelector('#sync-status').textContent), null, { timeout: 15000 });
    await page.click('[data-tab="diary"]');
  }
  const entryNames = (page) => page.$$eval('#meals .entry .entry-main > div:first-child', els => els.map(e => e.textContent.trim()));
  const syncNow = (page) => page.evaluate(() => Sync.syncNow());

  // Device A (computer): log banana, turn on sync
  const A = await device('A');
  await logFood(A, 'Breakfast', 'banana');
  await turnOn(A);
  check(gists.size === 1, 'turning on sync creates one gist');
  const gist = [...gists.values()][0];
  const content = gist.files['daily-plate-sync.json'].content;
  check(gist.public === false, 'gist is secret (not public)');
  check(!/Banana/i.test(content) && JSON.parse(content).data, 'gist content is encrypted (no food names visible)');
  check(/Synced/.test(await A.textContent('#sync-status')), 'device A shows Synced');

  // Device B (iPhone): has its own entry, then turns on sync → gets banana
  const B = await device('B');
  await logFood(B, 'Lunch', 'apple');
  await turnOn(B);
  let namesB = await entryNames(B);
  check(namesB.some(n => n.startsWith('Banana')) && namesB.some(n => n.startsWith('Apple')), 'device B now has both entries: ' + namesB.join(', '));

  // A syncs → gets apple
  await syncNow(A);
  await A.waitForTimeout(300);
  let namesA = await entryNames(A);
  check(namesA.some(n => n.startsWith('Apple')), 'device A receives device B\'s entry: ' + namesA.join(', '));

  // Deletion on B propagates to A
  await B.locator('#meals .entry', { hasText: 'Banana' }).locator('[data-del]').click();
  await B.waitForTimeout(300);
  await syncNow(B);
  await syncNow(A);
  await A.waitForTimeout(300);
  namesA = await entryNames(A);
  check(!namesA.some(n => n.startsWith('Banana')) && namesA.some(n => n.startsWith('Apple')), 'deleting on B removes it on A: ' + namesA.join(', '));

  // Goals edit on A reaches B
  await A.click('[data-tab="settings"]');
  await A.fill('[data-goal="kcal"]', '1800');
  await A.click('#save-goals');
  await A.waitForTimeout(300);
  await syncNow(A);
  await syncNow(B);
  await B.waitForTimeout(300);
  check((await B.textContent('#day-summary')).includes('1800'), 'calorie goal change on A shows on B');

  // Custom food + day note from B reach A
  await B.fill('#day-note', 'synced note');
  await B.dispatchEvent('#day-note', 'change');
  await B.waitForTimeout(300);
  await syncNow(B);
  await syncNow(A);
  await A.waitForTimeout(300);
  await A.click('[data-tab="diary"]');
  check((await A.inputValue('#day-note')) === 'synced note', 'day note from B appears on A');

  // Auto-sync after a change (no manual sync)
  const before = calls.filter(c => c.startsWith('PATCH')).length;
  await logFood(A, 'Dinner', 'salmon');
  await A.waitForTimeout(5500);
  check(calls.filter(c => c.startsWith('PATCH')).length > before, 'a change uploads automatically after a few seconds');

  // Wrong passphrase on device C is refused and doesn't touch the gist
  const snapshot = gist.files['daily-plate-sync.json'].content;
  const C = await device('C');
  await turnOn(C, 'wrong passphrase');
  check(/passphrase/i.test(await C.textContent('#sync-status')), 'wrong passphrase gives a clear error');
  check(await C.$eval('#sync-setup', e => !e.hidden), 'sync stays off after a wrong passphrase');
  check(gist.files['daily-plate-sync.json'].content === snapshot, 'wrong passphrase does not overwrite the gist');

  // Backup never contains the token or passphrase
  await A.click('[data-tab="settings"]');
  const [dl] = await Promise.all([A.waitForEvent('download'), A.click('#export-json')]);
  const text = fs.readFileSync(await dl.path(), 'utf8');
  check(!text.includes(TOKEN) && !text.includes(PASS), 'JSON backup excludes the sync token and passphrase');

  // Turning off keeps local data
  await A.click('#sync-off');
  await A.waitForTimeout(200);
  await A.click('[data-tab="diary"]');
  check((await entryNames(A)).length >= 2, 'turning sync off keeps local data');

  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
