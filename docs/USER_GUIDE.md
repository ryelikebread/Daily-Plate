# Daily Plate — User Guide

Daily Plate is a personal food diary. Its two jobs are:

1. **Archive** everything you eat, day by day, with calories and nutrients.
2. **Remind** you to eat and to finish each day's log.

All data stays on your device. Nothing is uploaded anywhere except the search words you type when you use online food lookup.

---

## 1. Starting the app

Daily Plate is a web app made of plain files in the `app/` folder. Pick one way to run it.

### Option A: on your computer (simplest)

1. Install Python 3 if you don't have it (macOS and Linux usually do).
2. Open a terminal in the `food-tracker` folder and run:
   ```
   python3 -m http.server 8080 --directory app
   ```
3. Open <http://localhost:8080> in Chrome, Edge, Firefox or Safari.
4. Optional: in Chrome/Edge, click the install icon in the address bar to install it as an app with its own window.

Leave the terminal running while you use it. Your data is kept by the browser, so it's still there next time you start the server **at the same address** (same port).

### Option B: on your iPhone (recommended for daily use)

Daily Plate is built to run as an iPhone Home Screen app. It needs to be on an HTTPS web address first (see "Hosting" below). Then:

1. Open the app's web address in **Safari** (it must be Safari for the install step).
2. Tap the **Share** button (square with an up arrow), scroll, tap **Add to Home Screen**, then **Add**.
3. From now on, open Daily Plate **from its Home Screen icon**, not from Safari. This matters because:
   - Safari can clear website data that hasn't been visited for a while; Home Screen apps are protected from that cleanup.
   - Notifications only work for Home Screen apps (iOS 16.4 or newer).
4. In the app: Settings → End-of-day reminder → tick **Remind me**, tap **Save reminder**, and tap **Allow** when iPhone asks about notifications.

It works offline after the first open. Online food search needs a connection.

**iPhone limits to know about**
- iPhone pauses web apps in the background, so in-app reminders only appear while Daily Plate is open or when you return to it. The 9 PM Google Calendar event is your dependable reminder.
- The camera **Scan** button doesn't appear on iPhone (Safari lacks the barcode reader it uses). Type the barcode number instead.
- Exports open the iPhone share sheet: choose **Save to Files** to keep the backup.

**Hosting (getting an HTTPS address)**
- **GitHub Pages** (free, what this project uses): the `app/` folder is published from a GitHub repository. Pushing changes updates the app; your data is untouched because it lives on the phone.
- **Netlify Drop** (free, no GitHub): go to app.netlify.com/drop and drag the `app` folder onto the page. You get an HTTPS address immediately.

### Data on different devices

Each device (and each browser, and each web address) keeps its **own separate copy** of your data. Your iPhone app does not see what you logged on your computer, and vice versa. To move data: Settings → **Full backup (JSON)** on the old device, send the file to the other device (AirDrop, Files, email), then Settings → **Restore backup** there. Restore merges, so nothing already on the target is lost. Pick one device as your main logger to keep it simple.

### Option C: double-click `index.html`

This works for logging, but offline caching and notifications are disabled when opened as a file. Use A or B for daily use.

---

## 2. The Diary tab (daily logging)

- **Date bar**: arrows move a day back/forward, **Today** jumps to today, or pick any date.
- **Summary card**: calories eaten, goal, and remaining, plus progress bars for protein, carbs, fat, fiber and sodium. Bars turn red when you go over a *limit* (calories, sodium, sugar, saturated fat, cholesterol).
- **Meals**: Breakfast, Lunch, Dinner, Snacks. Press **+ Add** on a meal.
  - Tap an entry to change its amount or move it to another meal.
  - Press **✕** to delete it. An **Undo** button appears for a few seconds.
- **Day notes**: free text about the day.
- **Body weight**: optional, shown on the Trends tab.
- **Day complete**: tick this when the day's log is finished. It stops that evening's reminder and shows a ✓ in the archive.
- **Copy yesterday's food**: copies every entry from the previous day into the current day.
- **All nutrients for this day**: full table of 14 nutrients against your goals.

### Adding food

In the Add dialog:

| Method | How |
|---|---|
| Your foods | Start typing. Searches foods you've saved, recipes, and the built-in basics. With an empty box, it shows your most-used foods from the last 30 days. |
| Online search | Type a name and press **Enter** or **Search online**. Searches Open Food Facts and USDA FoodData Central. Any food you pick is saved to your foods so it works offline next time. |
| Barcode | Type the number and press **Look up**. On Android Chrome a **Scan** button uses the camera. |
| Quick add | Just calories (and optionally protein/carbs/fat) when you don't know the exact food. |

After picking a food, choose the amount: a serving size (e.g. "1 medium"), grams, or ounces. The preview shows the calories and macros before you save.

---

## 3. The Foods tab (custom foods and recipes)

- **+ Custom food**: enter a name, optional brand and barcode, and nutrition values. Set "values are per ___ g" to match the label (e.g. 30 g per serving); the app converts to per 100 g and adds that serving size for you. Extra serving sizes go one per line as `label = grams`, e.g. `1 cup = 240`.
- **+ Recipe**: name it, set how many servings it makes, and add ingredients from your foods with gram amounts. The recipe becomes a food with "1 serving" and "whole recipe" sizes.
- **Edit / Delete** any food. Deleting or editing a food never changes past diary entries: each entry keeps a copy of the nutrition values it was logged with, so your archive stays accurate.

Tags show where a food came from: **basic** (built-in), **mine**, **recipe**, **Open Food Facts**, **USDA**.

---

## 4. The Trends tab (history and archive)

- **Range**: 7, 30, 90 or 365 days. **Show**: any nutrient.
- **Stats**: days logged, daily average, and your current logging streak.
- **Chart**: one bar per day with your goal as a dashed line.
- **Body weight**: line chart of weights you logged.
- **Archive**: every day you've logged, newest first. Tap a row to open that day.

---

## 5. Reminders

There are two layers, so a reminder is never missed:

1. **Google Calendar event** (already set up): "🍽️ Log today's food (Daily Plate)" every day at 9:00 PM Eastern, with a pop-up alert. Change the time in Google Calendar like any event.
2. **In-app reminders** (Settings → End-of-day reminder):
   - **Remind me at** a time (default 21:00). If the day isn't marked complete by then, you get a notification and a banner. The message tells you if nothing has been logged yet, as a nudge to eat.
   - **Also nudge me at meal times**: comma-separated times (default `08:30,12:30,18:30` for breakfast, lunch, dinner). You're nudged only if that meal is still empty.
   - **Send test notification** to check that your browser allows notifications.
   - **Download calendar reminder (.ics)** creates a daily recurring event you can import into any calendar app (Apple Calendar, Outlook, etc.).

In-app reminders only fire while Daily Plate is open in a tab or as an installed app. Each reminder fires once per day.

---

## 6. Settings

- **Daily goals**: targets for all 14 nutrients. Defaults are general adult reference values; adjust to your needs.
- **Online food lookup**: turn Open Food Facts and USDA on/off. For USDA, `DEMO_KEY` is used unless you paste your own free key from <https://api.data.gov/signup/> (recommended; DEMO_KEY is heavily rate-limited).
- **Weight unit**: kg or lb (label only; values are stored as you type them).

---

## 7. Backup, export and restore

Your data lives in the browser's storage on that device. Clearing site data, or uninstalling the browser, deletes it. **Back up regularly** (e.g. weekly).

- **Full backup (JSON)**: everything (foods, entries, days, settings). This is the file you restore from.
- **Diary entries (CSV)**: one row per food logged, with all nutrients. Opens in Excel / Google Sheets.
- **Daily totals (CSV)**: one row per day with totals, weight, notes and the complete flag.
- **Restore backup**: pick a JSON backup. It merges into what's already there (same records are replaced, nothing is deleted), so it's also how you combine data from two devices.

The Settings page shows whether storage is "persistent" and when you last backed up.

---

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| Online search says HTTP 429 | USDA's DEMO_KEY hit its limit. Add your own key in Settings. |
| Online search fails entirely | You're offline, or the network blocks those sites. Local foods still work. |
| No notifications | Allow notifications for the site in browser settings, keep the app open, and rely on the calendar event. |
| Data missing | Check you're on the same device, browser and address (e.g. `localhost:8080`, not `:8000`). Restore your latest backup. |
| Nutrient total looks low | Missing values in a food count as zero. Online and label data often omits vitamins and minerals. |

---

## 9. Running the automated test

From the `food-tracker` folder (needs Node.js and Playwright with Chromium):

```
npm install playwright && npx playwright install chromium
node tests/smoke.test.js
```

It starts its own local server, fakes the online lookups, and checks logging, search, barcodes, quick add, custom foods, recipes, copy-day, trends, all exports, restore and the reminder banner.
