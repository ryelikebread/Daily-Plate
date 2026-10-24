// Tests camera and photo barcode scanning with generated barcode images.
// The camera is faked with a canvas stream, and BarcodeDetector is removed so
// the bundled ZXing reader (the one iPhone uses) is exercised.
// Usage: node tests/scanner.test.js   (needs Playwright + Chromium)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
let failures = 0;
function check(cond, msg) { console.log((cond ? 'PASS ' : 'FAIL ') + msg); if (!cond) failures++; }

const PRODUCTS = {
  '5901234123457': { product_name: 'Scanned Crackers', brands: 'Testco', serving_quantity: 30, nutriments: { 'energy-kcal_100g': 420, proteins_100g: 9, carbohydrates_100g: 70, fat_100g: 12 } },
  // only the 13-digit form exists, to test the UPC-A → EAN-13 fallback
  '0036000291452': { product_name: 'Scanned Tissues Snack', brands: 'Upcco', nutriments: { 'energy-kcal_100g': 100, proteins_100g: 1, carbohydrates_100g: 20, fat_100g: 1 } },
};

// Runs in the page: draws an EAN-13 barcode onto a canvas.
const DRAW_EAN13 = `
window.drawEAN13 = function (canvas, digits, opts = {}) {
  const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const R = L.map(p => p.replace(/./g, b => b === '1' ? '0' : '1'));
  const G = R.map(p => p.split('').reverse().join(''));
  const PAR = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  const d = digits.split('').map(Number);
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (PAR[d[0]][i - 1] === 'L' ? L : G)[d[i]];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += R[d[i]];
  bits += '101';
  const m = opts.module || 4, quiet = 12 * m, h = opts.height || 160;
  const w = bits.length * m + quiet * 2;
  const W = opts.width || w + 80, H = opts.canvasHeight || h + 80;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = opts.bg || '#ddd'; ctx.fillRect(0, 0, W, H);
  const x0 = (W - w) / 2, y0 = (H - h) / 2;
  ctx.fillStyle = '#fff'; ctx.fillRect(x0, y0, w, h);
  ctx.fillStyle = '#000';
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') ctx.fillRect(x0 + quiet + i * m, y0 + 10, m, h - 20);
};`;

// Fake camera: getUserMedia returns a stream from a canvas showing a barcode.
const FAKE_CAMERA = (code) => `
${DRAW_EAN13}
delete window.BarcodeDetector;
window.__tracks = [];
navigator.mediaDevices.getUserMedia = async () => {
  const c = document.createElement('canvas');
  if (${JSON.stringify(code)}) drawEAN13(c, ${JSON.stringify(code)}, { width: 1280, canvasHeight: 720, module: 5, height: 220 });
  else { c.width = 1280; c.height = 720; c.getContext('2d').fillRect(0, 0, 1280, 720); } // nothing to scan
  const ctx = c.getContext('2d');
  // repaint so the stream keeps producing frames
  setInterval(() => { ctx.fillStyle = 'rgba(221,221,221,0.01)'; ctx.fillRect(0, 0, 2, 2); }, 50);
  const s = c.captureStream(15);
  window.__tracks.push(...s.getTracks());
  return s;
};`;

const DENIED_CAMERA = `
delete window.BarcodeDetector;
navigator.mediaDevices.getUserMedia = async () => { throw new DOMException('Permission denied', 'NotAllowedError'); };`;

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
  const lookups = [];

  async function open(initScript) {
    const ctx = await browser.newContext();
    await ctx.route('https://world.openfoodfacts.org/**', r => {
      const code = r.request().url().match(/product\/(\d+)\.json/)[1];
      lookups.push(code);
      const p = PRODUCTS[code];
      return p ? r.fulfill({ json: { status: 1, product: { code, ...p } } }) : r.fulfill({ status: 404, json: { code, status: 0, status_verbose: 'product not found' } });
    });
    if (initScript) await ctx.addInitScript(initScript);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector('#meals .meal');
    return page;
  }

  // 1. Live camera scan (ZXing) → lookup → amount dialog
  let page = await open(FAKE_CAMERA('5901234123457'));
  await page.click('[data-add="Snacks"]');
  await page.click('#add-scan');
  await page.waitForSelector('#amount-dialog[open]', { timeout: 15000 }).catch(() => {});
  check(await page.isVisible('#amount-dialog[open]'), 'camera scan finds the barcode and opens the food');
  check((await page.textContent('#amount-title')) === 'Scanned Crackers', 'scanned product is the right one');
  check(await page.evaluate(() => window.__tracks.every(t => t.readyState === 'ended')), 'camera is switched off after a successful scan');
  check(await page.evaluate(() => typeof window.ZXing === 'object'), 'bundled ZXing reader was loaded (no BarcodeDetector)');
  await page.click('#amount-ok');
  await page.waitForTimeout(300);
  check(await page.locator('#meals .entry', { hasText: 'Scanned Crackers' }).count() === 1, 'scanned food logs to the diary');

  // 2. UPC-A barcode: reader returns 12 digits, lookup falls back to 13-digit form
  page = await open(FAKE_CAMERA('0036000291452'));
  await page.click('#qa-scan'); // the Scan barcode button on the Diary screen
  await page.waitForSelector('#amount-dialog[open]', { timeout: 15000 }).catch(() => {});
  check((await page.textContent('#amount-title')) === 'Scanned Tissues Snack', 'UPC-A code is found via its EAN-13 form (lookups: ' + lookups.slice(-2).join(', ') + ')');

  // 3. Cancel turns the camera off
  page = await open(FAKE_CAMERA(null)); // camera sees no barcode
  await page.click('[data-add="Lunch"]');
  await page.click('#add-scan');
  await page.waitForTimeout(800);
  await page.click('#scan-cancel');
  await page.waitForTimeout(200);
  check(!(await page.isVisible('#scan-dialog')), 'cancel closes the scanner');
  check(await page.evaluate(() => window.__tracks.length > 0 && window.__tracks.every(t => t.readyState === 'ended')), 'cancel switches the camera off');

  // 4. Food editor Scan fills the barcode field
  page = await open(FAKE_CAMERA('5901234123457'));
  await page.click('[data-tab="foods"]');
  await page.click('#new-food');
  await page.click('#food-scan');
  await page.waitForFunction(() => document.querySelector('#food-barcode').value, null, { timeout: 15000 }).catch(() => {});
  check((await page.inputValue('#food-barcode')) === '5901234123457', 'Scan in the custom food editor fills the barcode');

  // 5. Camera blocked → clear message → photo fallback works
  page = await open(DENIED_CAMERA);
  await page.click('[data-add="Breakfast"]');
  await page.click('#add-scan');
  await page.waitForTimeout(500);
  const msg = await page.textContent('#scan-status');
  check(/blocked/i.test(msg) && /photo/i.test(msg), 'blocked camera shows how to fix it: ' + msg);
  const png = await page.evaluate(DRAW_EAN13 + `; const c = document.createElement('canvas'); drawEAN13(c, '5901234123457', { module: 3 }); c.toDataURL('image/png')`);
  const file = path.join(os.tmpdir(), 'barcode-test.png');
  fs.writeFileSync(file, Buffer.from(png.split(',')[1], 'base64'));
  await page.setInputFiles('#scan-photo', file);
  await page.waitForSelector('#amount-dialog[open]', { timeout: 15000 }).catch(() => {});
  check((await page.textContent('#amount-title')) === 'Scanned Crackers', 'scanning a photo works when the camera is blocked');

  // 6. Photo with no barcode gives a helpful message
  page = await open(DENIED_CAMERA);
  await page.click('[data-add="Breakfast"]');
  await page.click('#add-scan');
  const blank = await page.evaluate(`(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#888'; x.fillRect(0, 0, 400, 300); return c.toDataURL('image/png'); })()`);
  fs.writeFileSync(file, Buffer.from(blank.split(',')[1], 'base64'));
  await page.setInputFiles('#scan-photo', file);
  await page.waitForFunction(() => /No barcode/.test(document.querySelector('#scan-status').textContent), null, { timeout: 15000 }).catch(() => {});
  check(/No barcode/.test(await page.textContent('#scan-status')), 'photo without a barcode says so');

  // 7. Code missing from Open Food Facts is found by UPC in USDA Branded foods
  page = await open(FAKE_CAMERA('0012345678905'));
  await page.context().route('https://api.nal.usda.gov/**', r => r.fulfill({ json: { totalPages: 1, foods: [
    { fdcId: 777, dataType: 'Branded', description: 'OTHER CEREAL', brandOwner: 'Acme', gtinUpc: '999999999999', foodNutrients: [{ nutrientNumber: '208', unitName: 'KCAL', value: 100 }] },
    { fdcId: 778, dataType: 'Branded', description: 'USDA UPC CEREAL', brandOwner: 'Acme', gtinUpc: '012345678905', foodNutrients: [{ nutrientNumber: '208', unitName: 'KCAL', value: 380 }] }] } }));
  await page.click('#qa-scan');
  await page.waitForSelector('#amount-dialog[open]', { timeout: 15000 }).catch(() => {});
  check((await page.textContent('#amount-title')).includes('Usda Upc Cereal'), 'UPC missing from Open Food Facts is found in USDA Branded: ' + await page.textContent('#amount-title'));

  // 8. Kroger-style code typed without its check digit; USDA stores it as 011110136350
  page = await open(null);
  await page.context().route('https://api.nal.usda.gov/**', r => r.fulfill({ json: { totalPages: 1, foods: r.request().url().includes('query=011110136350') ? [
    { fdcId: 888, dataType: 'Branded', description: 'STORE BRAND OATS', brandOwner: 'Kroger', gtinUpc: '011110136350', foodNutrients: [{ nutrientNumber: '208', unitName: 'KCAL', value: 370 }] }] : [] } }));
  await page.click('#qa-add');
  await page.fill('#add-barcode', '0001111013635');
  await page.click('#add-barcode-go');
  await page.waitForSelector('#amount-dialog[open]', { timeout: 10000 }).catch(() => {});
  check((await page.textContent('#amount-title')).includes('Store Brand Oats'), 'code typed without check digit is found: ' + await page.textContent('#amount-title'));

  // 9. A miss explains what was tried and flags a bad check digit
  page = await open(null);
  await page.context().route('https://api.nal.usda.gov/**', r => r.fulfill({ json: { totalPages: 1, foods: [] } }));
  await page.click('#qa-add');
  await page.fill('#add-barcode', '0001111013635');
  await page.click('#add-barcode-go');
  await page.waitForFunction(() => /not found/i.test(document.querySelector('#add-status').textContent), null, { timeout: 10000 }).catch(() => {});
  const miss = await page.textContent('#add-status');
  check(/Open Food Facts and USDA/.test(miss) && /check digit/.test(miss), 'miss lists sources tried and check-digit warning: ' + miss);

  check(errors.length === 0, 'no page errors ' + errors.join(' | '));
  await browser.close();
  srv.close();
  console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED');
  process.exit(failures ? 1 : 0);
})();
