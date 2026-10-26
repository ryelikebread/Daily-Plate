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
| `app/lookup.js` | Online search: Open Food Facts (text + barcode), USDA FoodData Central (Branded, SR Legacy, Survey/FNDDS, Foundation) and MenuStat (NYC Open Data); chain nicknames/aliases, result ranking. Brands / Restaurants / Drinks / Basic filters, restaurant-chain and drink recognition, paging, and the on-device search cache. Converts results to the app's per-100 g format, including per-serving energy, calories derived from carbs/fat/protein/alcohol, % ABV to grams of alcohol, and container sizes as servings. |
| `app/nutrients.js` | The 62 tracked nutrients (groups, units, default targets, USDA and Open Food Facts codes), derived values (net carbs, omega-3/6 totals) and the four meals. |
| `app/nutrient-info.js` | The "what it is / why it matters" explanation for every nutrient, written for Daily Plate, with links to the government sources. |
| `app/report.js` | The nutrient report (energy ring, macro and highlighted targets, scores, full grouped summary) and the explanation pop-up. |
| `app/starter-foods.js` | 24 common whole foods plus about 30 drinks (soft drinks, juice, coffee/tea, beer, wine, spirits, hard seltzer, canned cocktails and a few well-known cans and bottles) built in so food and drink can be logged offline on day one. |
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
| `tests/drinks.test.js` | Automated test of built-in drinks, the Drinks filter, fluid-ounce logging and drinks with incomplete labels (developer use only). |
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
| MenuStat via NYC Open Data (`data.cityofnewyork.us`, dataset qgc5-ecnb, Socrata API) | Chain restaurant menu items (nutrition per item; historical snapshots, newest year kept per item) | Your search words (chain and item words) | NYC Open Data: published by the NYC Department of Health and Mental Hygiene for public use; no API key; attribute the source |
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
| Drinks, including alcohol | Open Food Facts + USDA (Branded, SR Legacy, FNDDS, Foundation) + MenuStat + ~30 built-in drinks | Soft drinks and juice: strong. Alcohol: patchy in the open data, because US alcohol labels need no Nutrition Facts panel (TTB, not FDA), so the built-in drinks and the derived-calorie handling below fill the gap |

Sources considered and **not** used: commercial food-tracker apps (excluded by the clean-room rule; no scraping), Nutritionix (commercial licence), FatSecret Platform (free tier exists but must be called through a server you run, with your own API keys; see the option offered in the project thread), scraping chain websites (terms of use).

The chain list in `lookup.js` holds only restaurant names, used to label results.

## How drinks are handled (added 1.13.0)

| Case | What the app does |
|---|---|
| Energy listed only per serving | Scales it to per 100 g using the serving weight or volume |
| No energy, but carbs/fat/protein/alcohol listed | Works the calories out (4/9/4 kcal per g, 7 for alcohol) and marks the food `estimated` (shown with a `*`) |
| % alcohol by volume | Converted to grams of alcohol per 100 g (×0.789, the density of ethanol) and stored as the `alcohol` nutrient |
| No nutrition information at all (common for US alcohol) | Kept and marked `incomplete`: shown as "No nutrition listed — add it yourself" instead of being hidden, so Edit a copy can be used |
| Container size ("12 fl oz", "355 ml") | Offered as a "1 container" serving |
| Any drink | `isDrink` flag; fluid ounces, millilitres and cups appear as serving units (1 ml ≈ 1 g) |

Drink recognition (`Lookup.isDrink` / `looksLikeDrink`) uses the data source's category, the presence of alcohol, and a list of drink words in `lookup.js`. Non-drinks with no calorie figure are still discarded, so ordinary searches are not filled with blank records.

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

1.13.0 (2026-10-26): drinks. Drinks filter; `isDrink`/`abv` on foods; drink recognition in `lookup.js` (category, alcohol, drink-word list); Open Food Facts results now use per-serving energy, `alcohol_100g` (% ABV × 0.789), `categories_tags` and `quantity` (container size as a serving); calories derived from carbs/fat/protein/alcohol are marked `estimated`; items with no energy figure are kept when they are drinks and marked `incomplete` (search cache keys v4); fluid-ounce/millilitre/cup serving units for drinks (`UNIT_GRAMS`); about 30 built-in drinks in `starter-foods.js`, added to existing installs by `seedNewStarters()` (setting `seededDrinks`, deletions respected). tests/drinks.test.js.

1.12.0 (2026-10-24): expanded restaurant coverage. New MenuStat source (NYC Open Data dataset qgc5-ecnb; fields per menu item; calories, fats, cholesterol, sodium, carbs, sugar, fiber, protein; serving weight when listed). Chain nickname parsing (`Lookup.parseQuery`), canonical chain spelling sent to USDA/Open Food Facts, result ranking (chain, name words), search cache keys v3, search status lists sources searched. Setting `menustatEnabled`. Food packs: import CSV/JSON (file or web address) and export your custom foods (Foods tab). tests/restaurants.test.js. Sources considered but not used: FatSecret/Nutritionix/Edamam (proprietary or need a server), scraping any app or chain site.

1.11.0 (2026-10-24): (1) changing the meal or time of any part of a grouped item moves all its parts; (2) entries have an editable `time` (HH:MM, defaults to now for today; shown in the diary, sorts entries within a meal, CSV `time` column); (3) custom meals: setting `meals` (synced, added to SYNCED_SETTINGS), Settings > Meals to add, rename (renames existing entries), reorder, remove (entries of a removed meal show under "(other)"); `MEALS` in nutrients.js is changed in place, `DEFAULT_MEALS` holds the originals.

1.10.1 (2026-10-24): fix for phones running mixed cached versions (old page with new script or the reverse). Service worker now precaches all files together bypassing the HTTP cache (a failed download keeps the old version), fetches with revalidation (`cache: no-cache`), cache name daily-plate-v14. index.html carries a version meta tag and ?v= on every script/style; app.js compares its version with the page's and, on mismatch, clears caches, unregisters the service worker and reloads once. A missing page element no longer crashes startup. tests/versions.test.js checks the versions agree. Your data (IndexedDB) is never touched by any of this.

1.10.0 (2026-10-24): photos on diary entries. New IndexedDB store `photos` (DB_VERSION 3; id, entryId, date, blob, at; indexes entryId and date). Pictures are chosen with the phone's camera/library file picker (`<input type=file accept=image/*>`), shrunk in the browser to at most 1280 px JPEG, and kept only on that device: not synced, not in JSON backup (they would exceed the Gist size). Deleted with their entry (Undo restores them).

1.9.0 (2026-10-24): grouped diary items. Entries gain an optional `groupId`; entries sharing it show as one expandable line with combined nutrients (parts stay ordinary entries, so totals, sync, backup and older data work unchanged). Checkbox "Part of the same item as ..." on the food screen after Save & add another (default off). Delete whole item (with Undo), Ungroup, Copy yesterday keeps groups (new ids), CSV export has a `group` column.

1.8.1 (2026-10-24): barcode lookup tries every spelling of a code (as typed, leading zeros stripped, padded to 8/12/13/14 digits, UPC-E expanded to UPC-A, and with a missing/wrong check digit repaired) against Open Food Facts and USDA; USDA matches compare numeric values and tolerate a missing check digit; USDA foods missing calories are kept (kJ or macros used to estimate). A miss now lists the sources and spellings tried and warns when the check digit is invalid (scanner.js: variants, checkDigitOk).

1.8.0 (2026-10-24): "Save & add another" button on the food screen (new entries only): saves the food, then reopens the add list for the same meal.

1.7.1 (2026-10-24): fix: Open Food Facts HTTP 404 for an unknown barcode is now "not found" (not an error), so USDA UPC lookup and the Create-custom-food prompt work.

1.7.0 (2026-10-24): barcode lookups now also search USDA FoodData Central Branded foods by UPC (gtinUpc, exact match, leading zeros ignored) when Open Food Facts doesn't have the code. Uses the same USDA key as search; either source failing no longer blocks the other.

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
