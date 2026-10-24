# Daily Plate — Installed Components

What Daily Plate consists of, what each piece does, what it installs or stores, and what it talks to.

## Summary

- **Runtime dependencies: one bundled library** (ZXing barcode reader, below). Otherwise plain HTML, CSS and JavaScript. No frameworks, no build step, no server-side code, no accounts, no analytics.
- **Runs in**: any modern browser (Chrome, Edge, Firefox, Safari).
- **Stores data in**: the browser's IndexedDB on the device you use it on.

## Files

| File | Purpose |
|---|---|
| `app/index.html` | Page layout: the four tabs (Diary, Foods, Trends, Settings) and the pop-up dialogs. |
| `app/styles.css` | Look and feel, light and dark mode, phone-sized layout. |
| `app/app.js` | Main logic: diary, adding food, amounts, custom foods, recipes, trends/charts, goals, reminders, export/import. |
| `app/db.js` | Small wrapper around the browser's IndexedDB database; records change times and deletions so sync can merge. |
| `app/scanner.js` | Camera barcode scanner: opens the camera, reads frames, falls back to reading a photo, explains camera-permission problems. |
| `app/vendor/zxing.min.js` | Bundled barcode-reading library (see Third-party code). Loaded only when you scan. |
| `app/vendor/zxing-LICENSE.txt` | Its licence text. |
| `app/sync.js` | Optional sync between devices through one encrypted secret GitHub Gist (merge, encryption, auto-sync). |
| `app/lookup.js` | Online search: Open Food Facts (text + barcode) and USDA FoodData Central (Branded, SR Legacy, Survey/FNDDS, Foundation). Brands / Restaurants / Basic filters, restaurant-chain recognition, paging, and the on-device search cache. Converts results to the app's per-100 g format. |
| `app/nutrients.js` | The 62 tracked nutrients (groups, units, default targets, USDA and Open Food Facts codes), derived values (net carbs, omega-3/6 totals) and the four meals. |
| `app/nutrient-info.js` | The "what it is / why it matters" explanation for every nutrient, written for Daily Plate, with links to the government sources. |
| `app/report.js` | The nutrient report (energy ring, macro and highlighted targets, scores, full grouped summary) and the explanation pop-up. |
| `app/starter-foods.js` | 24 common whole foods built in so the app is useful offline on day one. |
| `app/sw.js` | Service worker: caches the app files so it opens offline; opens the diary when a reminder notification is tapped. |
| `app/manifest.webmanifest` | Lets the browser install Daily Plate as an app (name, icon, colors). |
| `app/icon.svg` | App icon (browsers). |
| `app/apple-touch-icon.png` | 180×180 Home Screen icon for iPhone/iPad. |
| `app/icon-192.png`, `app/icon-512.png` | Install icons for Android/Chrome. |
| `tests/smoke.test.js` | Automated end-to-end test (developer use only). |
| `tests/foodscreen.test.js` | Automated test of the food screen, explanations, favorites, recents, issue flags and Edit a copy (developer use only). |
| `tests/database.test.js` | Automated test of brand/restaurant search, filters, paging, serving sizes and offline cache (developer use only). |
| `tests/scanner.test.js` | Automated scanner test with generated barcodes and a fake camera (developer use only). |
| `tests/sync.test.js` | Automated sync test with three simulated devices and a fake GitHub (developer use only). |
| `docs/USER_GUIDE.md` | How to run and use the app. |
| `docs/INSTALLED_COMPONENTS.md` | This file. |

## What gets stored on your device

When you open the app, the browser creates:

| Item | Name | Contents |
|---|---|---|
| IndexedDB database | `daily-plate` | `foods` (your foods, recipes, saved lookups, starter foods; also each food's favorite star, recents-hidden time and any issue flag + note), `entries` (every diary item with a snapshot of its nutrition), `days` (notes, weight, complete flag), `lookupCache` (online search results and barcode lookups, kept 14 days for speed and offline use; safe to clear, not backed up or synced), `settings` (goals, reminder times, lookup options, last backup time, which reminders already fired today, deletion records for sync, and, if sync is on, the GitHub token, passphrase and gist id for this device only). |
| Cache Storage | `daily-plate-v6` | Copies of the app's own files for offline use. No personal data. |
| Service worker | `sw.js` | Registered for the site's address. Only when served over http(s). |
| Permissions (optional) | Notifications, Camera | Asked only when you save a reminder / press Scan. |
| Persistent storage request | — | The app asks the browser not to auto-clear its data. The browser decides. |

To remove everything: browser settings → site data for the app's address → Clear. (Back up first.)

## External services (only when you use online search)

| Service | Used for | Sent | Licence of data |
|---|---|---|---|
| Open Food Facts (`world.openfoodfacts.org`) | Packaged foods, barcode lookup | Your search words or the barcode | Open Database Licence (ODbL) |
| USDA FoodData Central (`api.nal.usda.gov`) | Generic foods, U.S. branded products (Branded Foods), fast-food/restaurant items (SR Legacy groups and Survey/FNDDS) | Your search words and the API key | U.S. public domain (CC0) |

| GitHub Gist API (`api.github.com`, `gist.githubusercontent.com`) | Sync between devices (only if you turn it on) | Your data **encrypted on the device** (AES-256-GCM, key from your passphrase via PBKDF2-SHA-256, 250,000 rounds) and your GitHub token | Your own private data |

Food lookups can be turned off in Settings; sync is off until you turn it on. Nothing else is contacted.

## Food data coverage

| Need | Source used | Coverage |
|---|---|---|
| Packaged / brand-name foods | USDA Branded Foods + Open Food Facts | Strong: hundreds of thousands of U.S. products plus millions worldwide; barcodes via Open Food Facts |
| Restaurant chain items | USDA SR Legacy "Fast Foods" / "Restaurant Foods", USDA FNDDS "from fast food/restaurant", Open Food Facts entries from known chains | Partial: classic items from the biggest U.S. chains; newer and regional items often missing |
| Generic foods | USDA Foundation, SR Legacy, FNDDS + 24 built-in basics | Strong |

Sources considered and **not** used: commercial food-tracker apps (excluded by the clean-room rule; no scraping), Nutritionix (commercial licence), FatSecret Platform (free tier exists but must be called through a server you run, with your own API keys; see the option offered in the project thread), scraping chain websites (terms of use).

The chain list in `lookup.js` holds only restaurant names, used to label results.

## Nutrient explanations and targets

- **Explanations** (`app/nutrient-info.js`) are short summaries written for Daily Plate in our own words, based on: NIH Office of Dietary Supplements consumer fact sheets (ods.od.nih.gov), NIH MedlinePlus (medlineplus.gov), the FDA (fda.gov: Daily Values, added sugars, sodium, trans fat, caffeine) and the Dietary Guidelines for Americans from USDA and HHS (dietaryguidelines.gov). Each explanation links to its sources. No text was copied from any app. Shown with a note that it is general information, not medical advice.
- **Default targets** (`app/nutrients.js`): adult RDA/AI values from the NIH ODS fact sheets, FDA Daily Values for limits (sodium 2,300 mg, saturated fat 20 g, added sugars 50 g, cholesterol 300 mg), FDA's 400 mg caffeine guide, and Institute of Medicine amino-acid RDAs per kg worked out for 70 kg. All editable in Settings.
- **Derived values**: net carbs = total carbs − fiber (not an official FDA/USDA term); omega-3 and omega-6 totals are summed from the individual fatty acids when a food doesn't list a total.
- **Not used**: proprietary nutrient databases (e.g. the one the reference screenshots came from). Only the general layout idea (sections with progress bars) was followed, with our own design, colours and wording.

## Third-party code

| Library | Version | Licence | Purpose | Where |
|---|---|---|---|---|
| ZXing for JavaScript (`@zxing/library`) | 0.21.3 | Apache License 2.0 (licence file shipped in the package; its package.json says MIT) | Reads barcodes from camera frames and photos. Used on iPhone and any browser without a built-in barcode reader; browsers that have one (Android Chrome) use the built-in reader instead. | `app/vendor/zxing.min.js` (unmodified `umd/index.min.js` from npm, SHA-256 `d7cc8f69dd70bdcf3ac00c9ae572bf2acb9f4132ba379c72df842e4db918652d`), licence in `app/vendor/zxing-LICENSE.txt` |

It's stored inside the app (not loaded from a CDN), so scanning works offline and nothing extra is downloaded from third parties. To update it: `npm pack @zxing/library@<version>`, copy `package/umd/index.min.js` to `app/vendor/zxing.min.js`, and bump the cache name in `app/sw.js`.

## Sync details

- Storage: one secret gist named "Daily Plate sync (encrypted)" containing `daily-plate-sync.json` in the GitHub account that owns the token. A secret gist is unlisted, not access-controlled, which is why the content is encrypted.
- Token: fine-grained personal access token with only **Account → Gists: Read and write** (or a classic token with only the `gist` scope). Stored in this device's IndexedDB; excluded from JSON backups.
- Merge rule: per record (food, diary entry, day), the newest change wins; deletions are remembered for a year so they reach every device. The calorie/nutrient goals sync; reminder times, lookup options and the token stay per device.
- File contents are gzip-compressed before encryption to stay small.

## Outside the app

| Item | Purpose |
|---|---|
| Google Calendar event "🍽️ Log today's food (Daily Plate)" | Daily 9:00 PM (America/New_York) recurring event with a pop-up alert, on Rye's primary calendar, marked Free and Private. Added 2026-10-24. Edit or delete it in Google Calendar. |

## Tools used only for development / testing

| Tool | Purpose | Needed to use the app? |
|---|---|---|
| Python 3 `http.server` | Simple local web server to open the app at `http://localhost:8080` | Only for "Option A" in the user guide |
| Node.js + Playwright + Chromium | Runs `tests/smoke.test.js` | No |

## Clean-room note

Daily Plate was designed from general, publicly known food-tracker concepts (food diary by meal, calorie and macro goals, micronutrient tracking, custom foods and recipes, barcode lookup, quick add, copy previous day, trends, export). No code, text, artwork, branding or food database was taken from Cronometer, MyFitnessPal or any other commercial app. Food data comes from open sources (Open Food Facts, USDA) or from you. Starter food values are rounded approximations of USDA public-domain data.

## iPhone-specific details

- `apple-mobile-web-app-*` tags in `index.html` make it open full-screen from the Home Screen with its own icon and title.
- Layout respects the iPhone notch and home bar (safe areas); text fields use 16 px text so Safari doesn't zoom in.
- An "Install on iPhone" tip shows in Settings when opened in Safari without being installed.
- Data on the iPhone is stored in that Home Screen app's own storage, separate from Safari and from any other device.

## Version

1.6.0 (2026-10-24): Report an issue gains "Add to GitHub list", a pre-filled new-issue link to ryelikebread/Daily-Plate (label food-data, created once on the repo). No token used; GitHub's own sign-in does the filing.

1.5.0 (2026-10-24): full food screen (energy ring, targets, scores, 62 nutrients in groups), tap-to-learn nutrient explanations, favorites, remove from recents, report-an-issue flags, Edit a copy.
1.4.0 (2026-10-24): Brands / Restaurants / Basic search filters, restaurant recognition, USDA serving sizes, paging, offline search cache; Add food and Scan barcode buttons on the Diary screen.
1.3.0 (2026-10-24): camera and photo barcode scanning (works on iPhone).
1.2.0 (2026-10-24): encrypted sync between devices via a secret GitHub Gist.
1.1.0 (2026-10-24): iPhone Home Screen support, fixed reminder banner always showing.
1.0.0 (2026-10-24): first release.

## Hosting files

| File | Purpose |
|---|---|
| `.github/workflows/pages.yml` | GitHub Actions workflow that publishes `app/` to GitHub Pages on every push to `main`. Uses GitHub's official Pages actions; nothing is installed in the app itself. |
