// Guards against shipping a mixed-version app: index.html, app.js and the
// service worker must agree, or phones can load an old page with new code.
const fs = require('fs');
const html = fs.readFileSync('app/index.html', 'utf8');
const js = fs.readFileSync('app/app.js', 'utf8');
const sw = fs.readFileSync('app/sw.js', 'utf8');
let bad = 0;
const check = (ok, m) => { console.log((ok ? 'PASS ' : 'FAIL ') + m); if (!ok) bad++; };
const v = js.match(/APP_VERSION = '([^']+)'/)[1];
check(new RegExp(`name="dp-version" content="${v}"`).test(html), `index.html meta version is ${v}`);
const tags = [...html.matchAll(/(?:src|href)="[^"?]+\.(?:js|css)(\?v=[^"]*)?"/g)];
check(tags.every(t => t[1] === '?v=' + v), 'every script/style in index.html carries ?v=' + v);
const ids = [...js.matchAll(/\$\('#([\w-]+)'\)/g)].map(m => m[1]);
const missing = [...new Set(ids)].filter(id => !new RegExp(`id="${id}"`).test(html) && !js.includes(`id="${id}"`) && !js.includes(`id=\\"${id}\\"`));
console.log('ids not found statically (may be created at runtime): ' + missing.join(', '));
const files = [...sw.matchAll(/'([^']+\.(?:js|css|html|png|svg|webmanifest))'/g)].map(m => m[1]);
check(files.every(f => fs.existsSync('app/' + f)), 'every file the service worker precaches exists');
process.exit(bad ? 1 : 0);
