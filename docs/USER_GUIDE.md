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
- **+ Add food / 📷 Scan barcode** (big buttons under the date): the quickest way in. They pick the meal that fits the time of day; you can change the meal before saving.
- **Meals**: Breakfast, Lunch, Dinner, Snacks. Press **+ Add** on a meal to add straight to it.
  - Tap an entry to change its amount or move it to another meal.
  - Press **✕** to delete it. An **Undo** button appears for a few seconds.
- **Day notes**: free text about the day.
- **Body weight**: optional, shown on the Trends tab.
- **Day complete**: tick this when the day's log is finished. It stops that evening's reminder and shows a ✓ in the archive.
- **Copy yesterday's food**: copies every entry from the previous day into the current day.
- **All nutrients for this day**: the full nutrient report (energy ring, targets, scores and all nutrients) for the day's totals. Tap any nutrient for an explanation.

### Adding food

In the add window (opened by **+ Add food** or a meal's **+ Add**):

| Method | How |
|---|---|
| Your foods | Start typing. Searches foods you've saved, recipes, and the built-in basics. With an empty box, it shows your most-used foods from the last 30 days. |
| Online search | Type a food, brand or restaurant item and press **Enter** or **Search online**. Pick a filter first if you like (see *Brands and restaurants* below). Any food you pick is saved to your foods so it works offline next time. |
| Barcode | Tap **📷 Scan** and point the camera at the barcode, or type the number and press **Look up**. See *Scanning barcodes* below. |
| Quick add | Just calories (and optionally protein/carbs/fat) when you don't know the exact food. |

### Brands and restaurants

Above the results are five filters:

| Filter | Searches | Good for |
|---|---|---|
| **All** | Everything below | When you're not sure |
| **Brands** | USDA Branded Foods (several hundred thousand U.S. products) + Open Food Facts (millions of products worldwide) | Packaged food: "Chobani vanilla", "Clif bar" |
| **Restaurants** | USDA's fast-food and restaurant groups, USDA "from fast food / restaurant" foods, and products from ~80 known chains | Chain menu items: "Big Mac", "Taco Bell burrito" |
| **Drinks** | All of the above, keeping only drinks | Soda, juice, coffee, beer, wine, spirits, hard seltzer, canned cocktails |
| **Basic foods** | USDA generic foods | Whole foods and home cooking: "chicken thigh", "rice" |

- Restaurant items show an orange **restaurant** tag, with the chain as the brand. Many come with real serving sizes like "1 item" or "1 sandwich".
- **More results** loads the next page.
- Every search is saved on your device for two weeks, so repeating a search is instant and works offline.

**Restaurant coverage.** Restaurant search now uses three open sources together: **MenuStat** (the New York City Health Department's collection of menu nutrition for 100+ U.S. chains, published on NYC Open Data), USDA's fast-food and restaurant records, and Open Food Facts. Type the chain the way you would say it ("mcdonalds big mac", "bk whopper", "chick fil a nuggets"): common spellings and nicknames are recognised, the chain's own items are listed first, and the message under the search box shows which sources were searched and which chain was recognised.

Honest limits:
- MenuStat is a set of **historical snapshots** (each item shows its menu year, e.g. 2019). New and limited-time items, and chains that opened recently, are often missing, and recipes change.
- MenuStat usually gives numbers **per menu item** without the item's weight. Those show as "1 serving as listed (weight not given)": log it by servings, not grams. Calories, fat, saturated and trans fat, cholesterol, sodium, carbs, sugar, fiber and protein are listed; vitamins and minerals are not, so those totals are minimums.
- Not every chain is covered. If something is missing, use the next two options.

**Food packs (Foods tab > Food packs).** For anything the open data lacks, make or get a pack: a CSV or JSON file of foods.
1. **Download CSV template**, fill in one row per menu item (`name`, `brand`, `serving_label`, `serving_grams`, then calories and nutrients for that serving), and **Import pack file**. Rows without calories are skipped. Foods with a brand count as restaurant/brand foods.
2. You can also **Import from web address** (for example a file shared in a GitHub repo, using its raw link), and **Export my foods** to share your own custom foods as a pack with someone else.
3. Imported foods are your own foods: they work offline, sync, and can be edited. Only import packs from sources you trust, and check the numbers against the restaurant's published nutrition info.

You can turn MenuStat off in Settings > Online food lookup.

**Adding several foods in a row**: on the food screen, **Save & add another** saves the food to the meal and immediately reopens the add list for that same meal, so you can add sides, toppings or extras one after another. Press **Save** on the last one.

**Time**: every entry has a time (the food screen's *Time* row, filled with the current time for today; clear it if you don't want one). The time shows on the diary row, and entries sort by time within a meal. Edit it by tapping the entry. A grouped item has one time and one meal: changing either on any part moves the whole item.

**Your own meals**: Settings > **Meals**. Type new names, use ↑ ↓ to reorder, ✕ to remove, **+ Add meal**, then **Save meals**. Renaming a meal renames it on everything you already logged. If you remove a meal, its past entries stay and show in a card marked "(other)". Your meal list syncs between devices.

**Photos**: on the food screen, tap **📷 Add photo** to take a picture or choose one from your library (several at once is fine). Photos are shrunk to save space, appear as small thumbnails on that diary row (tap them to view full size), and can be removed by editing the entry. They stay on the device where you added them: they are not synced between devices and are not in the backup file, so don't rely on them as your only copy. Deleting an entry deletes its photos (Undo brings them back).

**Part of the same item**: on the second and later foods a box reads *Part of the same item as ...* (unticked by default, meaning a separate entry). Tick it for things like a burger plus toppings: they show as one diary line ("Burger + 2 more") with combined calories and macros. Tap the line to see the parts, edit or delete a single part, see combined energy and macros, or press **Ungroup parts**. The ✕ on the grouped line deletes the whole item (Undo is offered). Copy yesterday keeps groups together, and the CSV export has a group column.

### Drinks, beer, wine and cocktails

Drinks count as food here, and the **Drinks** filter searches only drinks. A few things are specific to them.

**Built-in drinks (work offline, no search needed).** About 30 drinks are built in: water, sparkling water, tea, coffee, cola (regular and diet), lemon-lime soda, orange juice, lemonade, sports and energy drinks, beer (regular and light), red and white wine, 80-proof spirits, hard cider, hard seltzer, a mixed margarita, and a few cans and bottles people buy often (Cayman Jack Margarita and Mango Margarita, White Claw, Bud Light Seltzer and Lime-A-Rita, Mike's Hard Lemonade, Coca-Cola, Diet Coke, Pepsi, Red Bull). Type any part of the name or brand — "cayman jack", "beer", "wine", "seltzer" — and it appears straight away, even with no signal. If you already had Daily Plate installed, these are added the next time you open it, and anything you deleted stays deleted.

**Fluid ounces.** On the food screen for a drink, the serving list includes **fluid ounces (US)**, **millilitres** and **cups** as well as the usual cans and bottles (a drink weighs about 1 g per ml, which is how volume becomes grams). So "12 fl oz" of a can logs exactly one can.

**Alcohol.** Alcohol is one of the 62 tracked nutrients (7 kcal per gram), so beer, wine and cocktails count towards your day, and the drink's ABV shows on its food screen.

**Why some cans used to come up empty.** In the US, alcohol is regulated by the TTB rather than the FDA, so a can of hard seltzer or a ready-made cocktail is not required to carry a Nutrition Facts panel, and sodas often list calories only per serving. Daily Plate used to drop anything without calories per 100 g, which is why a search for "Cayman Jack" returned nothing. Now it:

- scales a per-serving calorie figure up to per 100 g;
- works out calories from whatever is listed (carbs, fat, protein and alcohol), marking the number with a `*`;
- still shows a can that lists nothing at all, labelled **"No nutrition listed — add it yourself"**. Open it, use the food screen's **⋯ > Edit a copy**, and type the numbers from the can; your copy is saved as your own food and syncs to your other devices.

A calorie figure worked out from a partial label can be low (it only counts what the label lists), so for anything you drink often it is worth typing the can's own numbers once with Edit a copy.

### Scanning barcodes

1. On the Diary tab tap **📷 Scan barcode** (or **📷 Scan** inside any meal's + Add window). Allow camera access the first time.
2. Fit the barcode inside the white box, about a hand-width away, in good light. It reads it by itself (the phone buzzes on Android) and looks the product up.
3. If the product is found, choose the amount and save. If not, tap **Create custom food with barcode…**: the barcode is filled in, so next time a scan finds your own food instantly.

Other ways in the scanner:
- **Scan a photo**: pick or take a photo of the barcode instead of using the live camera. Handy if camera access is blocked or the live view won't focus.
- **Restart camera** if the picture freezes.
- In **Foods → + Custom food**, the **📷 Scan** button next to Barcode fills the number in for you.

It reads the barcodes on packaged food: EAN-13, EAN-8, UPC-A, UPC-E (and Code 128). It works offline, but finding the product needs an internet connection unless you've scanned it before.

**Codes that don't match exactly**: many websites show a code with leading zeros, without its last (check) digit, or in the short 8-digit UPC-E form. The app tries all of these spellings automatically. If nothing is found it tells you which sources and spellings it tried, and warns when the number's check digit is wrong (a likely typo or a store-only code).

**UPC lookup**: a scanned (or typed) UPC is checked against Open Food Facts first, then against the UPC records in USDA FoodData Central Branded foods (US packaged products). Your own saved foods with that barcode are matched first. Turn either source off in Settings if you prefer.

If it says **camera access is blocked**: on iPhone open Settings → Apps → Safari → Camera → **Allow** (on older iOS: Settings → Safari → Camera), then tap Restart camera. On a computer, click the camera icon in the address bar and allow it.

### The food screen

Picking a food opens its full screen:

- **Amount, Serving size, Meal** at the top. Everything below updates as you change the amount.
- Under that: the brand, **how many nutrients this food lists** and its **data source** (e.g. USDA SR Legacy, USDA Branded Foods, Open Food Facts, your custom food).
- Sections you can open and close by tapping their title (the app remembers which you keep open):
  - **Energy summary**: a ring showing how the calories split between protein, net carbs, fat (and alcohol).
  - **Macronutrient targets**: energy, protein, net carbs and fat against your daily goals.
  - **Highlighted targets**: key vitamins and minerals (fiber, vitamin C, iron, B12, calcium, folate, vitamin A, potassium, sodium, vitamin D) at a glance.
  - **Nutrient scores**: the average % of your targets this amount covers, overall and for vitamins, minerals and amino acids.
  - **Complete nutrient summary**: up to 62 nutrients grouped into General, Vitamins, Minerals, Carbohydrates, Lipids and Protein (amino acids). Nutrients with a target show a bar and %; those without a target show the amount. Limits (sodium, saturated fat, added sugars, cholesterol, caffeine) are marked **max** and turn red when you go over. Only nutrients the food actually lists are shown; tick **Show nutrients not listed** to see the rest.
- **Tap any nutrient** (or a ring label) to read what it is, why it matters, your target, and links to the government source (NIH Office of Dietary Supplements, MedlinePlus, FDA, Dietary Guidelines for Americans). This is general information, not medical advice.
- **☆ star** next to the name: add to favorites. Favorites appear first, marked ★, when you add food.
- **⋯ menu**:
  - **Add to / Remove from favorites**
  - **Remove from recents**: hides it from the recent list (it stays in your foods and comes back if you log it again).
  - **Report an issue**: write what looks wrong. The food gets a ⚠ flag with your note on this device. From there you can open the source entry (Open Food Facts lets anyone correct a product; USDA shows its official record) or **Copy details** to send to someone. **Add to GitHub list** opens a pre-filled issue (labelled `food-data`) in the Daily Plate repo at github.com/ryelikebread/Daily-Plate/issues; sign in to GitHub and tap Submit there. The list of reports is the repo's Issues page. No password or token is stored in the app for this.
  - **Edit a copy**: makes your own editable copy with every nutrient filled in. The original stays as it was.

The same full report is on the **Diary** tab under *All nutrients for this day*, for the whole day's totals.

How much detail you get depends on the source: USDA generic foods (SR Legacy, Foundation, FNDDS) list the most nutrients, often 40+, including amino acids and fatty acids. Branded products and Open Food Facts usually list just what's on the label (about 10 to 15).

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

- **Daily goals**: calories and macros at the top, then a section per group (vitamins, minerals, carbohydrates, lipids, protein/amino acids). Defaults are typical adult reference values (NIH RDA/AI, FDA Daily Values); amino-acid targets assume a 70 kg adult. Clear a box for no target.
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
| Online search says HTTP 429 | USDA's DEMO_KEY hit its limit (it allows only about 30 searches an hour, 50 a day). Get your own free key at api.data.gov/signup (1,000 searches an hour) and paste it in Settings. |
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

`node tests/foodscreen.test.js` checks the food screen, explanations, favorites, recents, issue flags and Edit a copy. `node tests/database.test.js` checks brand/restaurant search, filters, paging and the offline cache. `node tests/scanner.test.js` checks camera and photo scanning with generated barcodes. `node tests/sync.test.js` checks sync between three simulated devices against a fake GitHub. `node tests/drinks.test.js` checks the built-in drinks, the Drinks filter, logging in fluid ounces and drinks whose labels list little or nothing.

The smoke test starts its own local server, fakes the online lookups, and checks logging, search, barcodes, quick add, custom foods, recipes, copy-day, trends, all exports, restore and the reminder banner.


## If the app won't start after an update ("Daily Plate could not start")

This means your phone mixed old and new files. Your food log is safe: it is stored separately from the app's files and updating never erases it.
1. Fully close Daily Plate (swipe it away in the app switcher) and open it again, twice.
2. If it still fails, wait 10 minutes and try again.
3. Still failing: in Safari open the site (ryelikebread.github.io/Daily-Plate) in a normal tab and reload it. If you use the Home Screen icon, that should be enough.
4. Last resort: iPhone Settings > Apps > Safari > Advanced > Website Data, remove only the Daily Plate entry. This DOES delete the data stored on the phone, so only do it if sync is on and has finished (or you made a backup in Settings), then turn sync on again and it pulls everything back.


`node tests/restaurants.test.js` checks chain nicknames, MenuStat results and ranking, and food pack import.
