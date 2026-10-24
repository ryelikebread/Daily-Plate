# Daily Plate — Installed Components

What Daily Plate consists of, what each piece does, what it installs or stores, and what it talks to.

## Summary

- **Runtime dependencies: none.** Plain HTML, CSS and JavaScript. No frameworks, no npm packages, no build step, no server-side code, no accounts, no analytics.
- **Runs in**: any modern browser (Chrome, Edge, Firefox, Safari).
- **Stores data in**: the browser's IndexedDB on the device you use it on.

## Files

| File | Purpose |
|---|---|
| `app/index.html` | Page layout: the four tabs (Diary, Foods, Trends, Settings) and the pop-up dialogs. |
| `app/styles.css` | Look and feel, light and dark mode, phone-sized layout. |
| `app/app.js` | Main logic: diary, adding food, amounts, custom foods, recipes, trends/charts, goals, reminders, export/import. |
| `app/db.js` | Small wrapper around the browser's IndexedDB database. |
| `app/lookup.js` | Online search: Open Food Facts (text + barcode) and USDA FoodData Central. Converts results to the app's per-100 g format. |
| `app/nutrients.js` | The 14 tracked nutrients, their units and default goals, and the four meals. |
| `app/starter-foods.js` | 24 common whole foods built in so the app is useful offline on day one. |
| `app/sw.js` | Service worker: caches the app files so it opens offline; opens the diary when a reminder notification is tapped. |
| `app/manifest.webmanifest` | Lets the browser install Daily Plate as an app (name, icon, colors). |
| `app/icon.svg` | App icon (browsers). |
| `app/apple-touch-icon.png` | 180×180 Home Screen icon for iPhone/iPad. |
| `app/icon-192.png`, `app/icon-512.png` | Install icons for Android/Chrome. |
| `tests/smoke.test.js` | Automated end-to-end test (developer use only). |
| `docs/USER_GUIDE.md` | How to run and use the app. |
| `docs/INSTALLED_COMPONENTS.md` | This file. |

## What gets stored on your device

When you open the app, the browser creates:

| Item | Name | Contents |
|---|---|---|
| IndexedDB database | `daily-plate` | `foods` (your foods, recipes, saved lookups, starter foods), `entries` (every diary item with a snapshot of its nutrition), `days` (notes, weight, complete flag), `settings` (goals, reminder times, lookup options, last backup time, which reminders already fired today). |
| Cache Storage | `daily-plate-v2` | Copies of the app's own files for offline use. No personal data. |
| Service worker | `sw.js` | Registered for the site's address. Only when served over http(s). |
| Permissions (optional) | Notifications, Camera | Asked only when you save a reminder / press Scan. |
| Persistent storage request | — | The app asks the browser not to auto-clear its data. The browser decides. |

To remove everything: browser settings → site data for the app's address → Clear. (Back up first.)

## External services (only when you use online search)

| Service | Used for | Sent | Licence of data |
|---|---|---|---|
| Open Food Facts (`world.openfoodfacts.org`) | Packaged foods, barcode lookup | Your search words or the barcode | Open Database Licence (ODbL) |
| USDA FoodData Central (`api.nal.usda.gov`) | Generic and branded foods | Your search words and the API key | U.S. public domain |

Both can be turned off in Settings. Nothing else is contacted.

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

1.1.0 (2026-10-24): iPhone Home Screen support, fixed reminder banner always showing.
1.0.0 (2026-10-24): first release.

## Hosting files

| File | Purpose |
|---|---|
| `.github/workflows/pages.yml` | GitHub Actions workflow that publishes `app/` to GitHub Pages on every push to `main`. Uses GitHub's official Pages actions; nothing is installed in the app itself. |
