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
- The first time you tap **📷 Scan**, iPhone asks to use the camera: tap **Allow**. Home Screen apps may ask again after being closed for a while; that's normal.
- Exports open the iPhone share sheet: choose **Save to Files** to keep the backup.

**Hosting (getting an HTTPS address)**
- **GitHub Pages** (free, what this project uses): the `app/` folder is published from a GitHub repository. Pushing changes updates the app; your data is untouched because it lives on the phone.
- **Netlify Drop** (free, no GitHub): go to app.netlify.com/drop and drag the `app` folder onto the page. You get an HTTPS address immediately.

### Data on different devices

Each device keeps its own copy of your data. To keep your computer and iPhone in step automatically, turn on **Sync** (section 7). Without sync, move data by hand with **Full backup** on one device and **Restore backup** on the other.

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
| Barcode | Tap **📷 Scan** and point the camera at the barcode, or type the number and press **Look up**. See *Scanning barcodes* below. |
| Quick add | Just calories (and optionally protein/carbs/fat) when you don't know the exact food. |

### Scanning barcodes

1. In the Add dialog, tap **📷 Scan**. Allow camera access the first time.
2. Fit the barcode inside the white box, about a hand-width away, in good light. It reads it by itself (the phone buzzes on Android) and looks the product up.
3. If the product is found, choose the amount and save. If not, tap **Create custom food with barcode…**: the barcode is filled in, so next time a scan finds your own food instantly.

Other ways in the scanner:
- **Scan a photo**: pick or take a photo of the barcode instead of using the live camera. Handy if camera access is blocked or the live view won't focus.
- **Restart camera** if the picture freezes.
- In **Foods → + Custom food**, the **📷 Scan** button next to Barcode fills the number in for you.

It reads the barcodes on packaged food: EAN-13, EAN-8, UPC-A, UPC-E (and Code 128). It works offline, but finding the product needs an internet connection unless you've scanned it before.

If it says **camera access is blocked**: on iPhone open Settings → Apps → Safari → Camera → **Allow** (on older iOS: Settings → Safari → Camera), then tap Restart camera. On a computer, click the camera icon in the address bar and allow it.

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

## 7. Sync between computer and iPhone

Sync keeps every device's diary, foods, recipes, notes, weights and goals the same. It works through **one encrypted file stored in your own GitHub account** (a "secret gist"). There's no server to run and nobody else involved.

### How private is it?

- Your data is **encrypted on your device** with your sync passphrase before it's uploaded. GitHub (and anyone who somehow got the file) sees only scrambled text.
- The passphrase never leaves your devices. **If you forget it, the synced copy can't be read** (your local data on each device is still fine; just set up sync again with a new passphrase).
- The GitHub token is stored only on the device where you typed it. It's never included in backups or uploaded.

### One-time setup (about 3 minutes)

1. **Make a GitHub token** (on any device):
   1. Go to <https://github.com/settings/personal-access-tokens/new> (Settings → Developer settings → Fine-grained tokens → Generate new token).
   2. Name: `Daily Plate sync`. Expiration: choose a long one (e.g. 1 year), and put a reminder in your calendar to renew it.
   3. Repository access: **Public repositories** (it needs no repo access).
   4. Permissions → **Account permissions** → **Gists** → **Read and write**. Nothing else.
   5. Generate, then copy the token (starts with `github_pat_`). Save it in your password manager; GitHub shows it only once.
   - *Alternative:* a classic token with only the `gist` scope also works.
2. **Pick a sync passphrase.** At least 8 characters; a few random words is good. Save it in your password manager too.
3. **On your computer:** Daily Plate → Settings → *Sync between devices* → paste the token, type the passphrase → **Turn on sync**. It should say "Synced" and the header shows ✓ synced.
4. **On your iPhone:** do the same in the Home Screen app, with the **same token and the exact same passphrase**. Anything already on the phone is merged with what's on the computer; nothing is lost.

### Day to day

- Sync runs by itself: when the app opens, a few seconds after every change, every 5 minutes while open, and when you come back to the app or reconnect to the internet.
- **Sync now** forces it. The header shows ✓ synced, ↻ while syncing, or ⚠ sync if something's wrong (Settings shows the reason).
- Works offline: changes wait on the device and upload next time you're online.
- If the same item is changed on two devices, the most recent change wins. A deletion on one device removes the item everywhere.
- **Turn off on this device** stops syncing and forgets the token and passphrase on that device. Your data stays on the device.

### If something goes wrong

| Message | What to do |
|---|---|
| "Wrong sync passphrase" | Type the passphrase exactly as on your other device (it's case-sensitive). |
| "token is wrong or has expired" (401) | Make a new token (step 1), turn sync off and on again with it. |
| "needs the Gists permission" (403/404) | The token is missing *Gists: Read and write*. Edit the token on GitHub or make a new one. |
| "Offline" | Nothing to do; it syncs when you're back online. |

You can see the encrypted file at <https://gist.github.com/> (it's called "Daily Plate sync (encrypted)"). Don't edit it by hand. Deleting it is safe: the next sync creates a fresh one from your device's data.

---

## 8. Backup, export and restore


Your data lives in the browser's storage on that device. Clearing site data, or uninstalling the browser, deletes it. **Back up regularly** (e.g. weekly), even with sync on: sync copies mistakes (like a deletion) to every device, and a backup lets you undo them.

- **Full backup (JSON)**: everything (foods, entries, days, settings). This is the file you restore from.
- **Diary entries (CSV)**: one row per food logged, with all nutrients. Opens in Excel / Google Sheets.
- **Daily totals (CSV)**: one row per day with totals, weight, notes and the complete flag.
- **Restore backup**: pick a JSON backup. It merges into what's already there (same records are replaced, nothing is deleted), so it's also how you combine data from two devices.

The Settings page shows whether storage is "persistent" and when you last backed up.

---

## 9. Troubleshooting

| Problem | Fix |
|---|---|
| Online search says HTTP 429 | USDA's DEMO_KEY hit its limit. Add your own key in Settings. |
| Online search fails entirely | You're offline, or the network blocks those sites. Local foods still work. |
| No notifications | Allow notifications for the site in browser settings, keep the app open, and rely on the calendar event. |
| Data missing | Check you're on the same device, browser and address (e.g. `localhost:8080`, not `:8000`). Restore your latest backup. |
| Scanner won't read a barcode | Add more light, hold steady, move a little further away so the whole barcode fits in the box, or use **Scan a photo** or type the number. |
| Nutrient total looks low | Missing values in a food count as zero. Online and label data often omits vitamins and minerals. |

---

## 10. Running the automated tests

From the `food-tracker` folder (needs Node.js and Playwright with Chromium):

```
npm install playwright && npx playwright install chromium
node tests/smoke.test.js
```

`node tests/scanner.test.js` checks camera and photo scanning with generated barcodes. `node tests/sync.test.js` checks sync between three simulated devices against a fake GitHub.

The smoke test starts its own local server, fakes the online lookups, and checks logging, search, barcodes, quick add, custom foods, recipes, copy-day, trends, all exports, restore and the reminder banner.
