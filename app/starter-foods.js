// A small starter list of common whole foods so the app is useful offline.
// Values are per 100 g, rounded, approximated from USDA SR Legacy data
// (U.S. government public domain). Verify against a label when precision matters.
const STARTER_FOODS = [
  ['Apple, raw', {kcal:52,protein:0.3,carbs:13.8,fat:0.2,fiber:2.4,sugar:10.4,sodium:1,potassium:107,calcium:6,iron:0.1,vitc:4.6}, [['1 medium',182]]],
  ['Banana, raw', {kcal:89,protein:1.1,carbs:22.8,fat:0.3,fiber:2.6,sugar:12.2,sodium:1,potassium:358,calcium:5,iron:0.3,vitc:8.7}, [['1 medium',118]]],
  ['Orange, raw', {kcal:47,protein:0.9,carbs:11.8,fat:0.1,fiber:2.4,sugar:9.4,potassium:181,calcium:40,iron:0.1,vitc:53.2}, [['1 medium',131]]],
  ['Avocado, raw', {kcal:160,protein:2,carbs:8.5,fat:14.7,satfat:2.1,fiber:6.7,sugar:0.7,sodium:7,potassium:485,calcium:12,iron:0.6,vitc:10}, [['1/2 fruit',68]]],
  ['Egg, whole, raw', {kcal:143,protein:12.6,carbs:0.7,fat:9.5,satfat:3.1,sugar:0.4,sodium:142,potassium:138,calcium:56,iron:1.8,vitd:2,chol:372}, [['1 large',50]]],
  ['Chicken breast, roasted', {kcal:165,protein:31,carbs:0,fat:3.6,satfat:1,sodium:74,potassium:256,calcium:15,iron:1,chol:85}, [['3 oz',85]]],
  ['Salmon, Atlantic, cooked', {kcal:206,protein:22.1,carbs:0,fat:12.4,satfat:2.5,sodium:61,potassium:384,calcium:15,iron:0.3,chol:63}, [['1 fillet (half)',154],['3 oz',85]]],
  ['Rice, white, cooked', {kcal:130,protein:2.7,carbs:28.2,fat:0.3,fiber:0.4,sodium:1,potassium:35,calcium:10,iron:0.2}, [['1 cup',158]]],
  ['Rice, brown, cooked', {kcal:112,protein:2.3,carbs:23.5,fat:0.8,fiber:1.8,sodium:5,potassium:79,calcium:10,iron:0.5}, [['1 cup',195]]],
  ['Pasta, cooked', {kcal:158,protein:5.8,carbs:30.9,fat:0.9,fiber:1.8,sodium:1,potassium:44,calcium:7,iron:0.5}, [['1 cup',140]]],
  ['Oats, rolled, dry', {kcal:379,protein:13.2,carbs:67.7,fat:6.5,satfat:1.1,fiber:10.1,sugar:1,sodium:6,potassium:362,calcium:52,iron:4.3}, [['1/2 cup',40]]],
  ['Bread, whole wheat', {kcal:252,protein:12.4,carbs:42.7,fat:3.5,fiber:6,sugar:4.4,sodium:450,potassium:250,calcium:161,iron:2.5}, [['1 slice',32]]],
  ['Milk, whole', {kcal:61,protein:3.2,carbs:4.8,fat:3.3,satfat:1.9,sugar:5.1,sodium:43,potassium:132,calcium:113,vitd:1.3,chol:10}, [['1 cup',244]]],
  ['Greek yogurt, plain, nonfat', {kcal:59,protein:10.2,carbs:3.6,fat:0.4,sugar:3.2,sodium:36,potassium:141,calcium:110}, [['1 container',170]]],
  ['Cheddar cheese', {kcal:403,protein:24.9,carbs:1.3,fat:33.1,satfat:21.1,sodium:621,calcium:721,iron:0.7,chol:105}, [['1 slice',28]]],
  ['Black beans, cooked', {kcal:132,protein:8.9,carbs:23.7,fat:0.5,fiber:8.7,sodium:1,potassium:355,calcium:27,iron:2.1}, [['1/2 cup',86]]],
  ['Almonds', {kcal:579,protein:21.2,carbs:21.6,fat:49.9,satfat:3.8,fiber:12.5,sugar:4.4,sodium:1,potassium:733,calcium:269,iron:3.7}, [['1 oz (~23 nuts)',28]]],
  ['Peanut butter, smooth', {kcal:588,protein:25,carbs:20,fat:50,satfat:10.3,fiber:6,sugar:9.2,potassium:649,calcium:43,iron:1.9}, [['1 tbsp',16]]],
  ['Olive oil', {kcal:884,protein:0,carbs:0,fat:100,satfat:13.8}, [['1 tbsp',13.5]]],
  ['Broccoli, raw', {kcal:34,protein:2.8,carbs:6.6,fat:0.4,fiber:2.6,sugar:1.7,sodium:33,potassium:316,calcium:47,iron:0.7,vitc:89.2}, [['1 cup chopped',91]]],
  ['Spinach, raw', {kcal:23,protein:2.9,carbs:3.6,fat:0.4,fiber:2.2,sugar:0.4,sodium:79,potassium:558,calcium:99,iron:2.7,vitc:28.1}, [['1 cup',30]]],
  ['Carrot, raw', {kcal:41,protein:0.9,carbs:9.6,fat:0.2,fiber:2.8,sugar:4.7,sodium:69,potassium:320,calcium:33,iron:0.3,vitc:5.9}, [['1 medium',61]]],
  ['Potato, baked, with skin', {kcal:93,protein:2.5,carbs:21.2,fat:0.1,fiber:2.2,sodium:10,potassium:535,calcium:15,iron:1.1,vitc:9.6}, [['1 medium',173]]],
  ['Coffee, brewed', {kcal:1,protein:0.1,carbs:0,fat:0,potassium:49}, [['1 cup (8 fl oz)',237],['1 mug (12 fl oz)',355]], {drink:1}],
];

// Drinks, including alcohol. US alcohol labels are not required to carry a
// Nutrition Facts panel, so beer, wine, spirits, hard seltzer and ready-made
// cocktails are often missing from the open databases. These built-ins mean a
// drink can always be logged, online or not.
//  - Generic entries: per 100 g, from USDA SR Legacy (U.S. public domain).
//  - Branded entries: per 100 g worked out from the published label figures for
//    one can/bottle. Approximate - check the can when precision matters.
// UPC printed on the Cayman Jack 12-pack variety box (each can has its own code).
const CJ_VARIETY_PACK = '815829010044';
const STARTER_DRINKS = [
  ['Water, tap', {kcal:0,water:100}, [['1 cup (8 fl oz)',237],['1 bottle (16.9 fl oz)',500]]],
  ['Sparkling water, unsweetened', {kcal:0,water:100,sodium:1}, [['1 can (12 fl oz)',355]]],
  ['Tea, black, brewed', {kcal:1,carbs:0.3,potassium:37,caffeine:20}, [['1 cup (8 fl oz)',237]]],
  ['Cola, with caffeine', {kcal:37,carbs:9.6,sugar:9,sodium:4,potassium:2,caffeine:9}, [['1 can (12 fl oz)',368],['1 bottle (20 fl oz)',591]]],
  ['Cola, diet, with caffeine', {kcal:1,carbs:0.1,sodium:6,potassium:9,caffeine:13}, [['1 can (12 fl oz)',355]]],
  ['Lemon-lime soda', {kcal:40,carbs:10.4,sugar:10.1,sodium:10,potassium:1}, [['1 can (12 fl oz)',368]]],
  ['Orange juice, not from concentrate', {kcal:45,protein:0.7,carbs:10.4,fat:0.2,sugar:8.4,sodium:1,potassium:200,calcium:11,vitc:50}, [['1 cup (8 fl oz)',248]]],
  ['Lemonade', {kcal:43,carbs:11,sugar:10.4,sodium:4,potassium:15,vitc:4}, [['1 cup (8 fl oz)',248]]],
  ['Sports drink (electrolyte)', {kcal:25,carbs:6,sugar:5.8,sodium:41,potassium:10}, [['1 bottle (20 fl oz)',591],['1 cup (8 fl oz)',237]]],
  ['Energy drink, sweetened', {kcal:45,carbs:11,sugar:10.6,protein:0.4,sodium:30,caffeine:32}, [['1 can (8.4 fl oz)',248],['1 can (16 fl oz)',473]]],
  ['Beer, regular (5% ABV)', {kcal:43,protein:0.5,carbs:3.6,alcohol:3.9,sodium:4,potassium:27}, [['1 can/bottle (12 fl oz)',355],['1 pint (16 fl oz)',473]], {abv:5}],
  ['Beer, light (4.2% ABV)', {kcal:29,protein:0.2,carbs:1.6,alcohol:3.1,sodium:4,potassium:17}, [['1 can/bottle (12 fl oz)',355]], {abv:4.2}],
  ['Wine, red, table (13.5% ABV)', {kcal:85,protein:0.1,carbs:2.6,sugar:0.6,alcohol:10.6,sodium:4,potassium:127,iron:0.5}, [['1 glass (5 fl oz)',147]], {abv:13.5}],
  ['Wine, white, table (12.5% ABV)', {kcal:82,protein:0.1,carbs:2.6,sugar:1,alcohol:10,sodium:5,potassium:71}, [['1 glass (5 fl oz)',147]], {abv:12.5}],
  ['Spirits, 80 proof (vodka, gin, rum, whiskey)', {kcal:231,carbs:0,alcohol:33.4,potassium:2}, [['1 shot (1.5 fl oz)',42]], {abv:40}],
  ['Hard seltzer (5% ABV)', {kcal:28,carbs:0.6,sugar:0.6,alcohol:3.9,sodium:3}, [['1 can (12 fl oz)',355]], {abv:5}],
  ['Hard cider (4.5% ABV)', {kcal:49,carbs:5.6,sugar:5.1,alcohol:3.6,sodium:2,potassium:19}, [['1 can/bottle (12 fl oz)',355]], {abv:4.5}],
  ['Margarita, mixed drink', {kcal:153,carbs:9.5,sugar:9,alcohol:14.8,sodium:21}, [['1 glass (4 fl oz)',118]], {abv:18}],
  ['Margarita', {kcal:62,carbs:4.8,sugar:4.5,alcohol:4.6,sodium:6}, [['1 bottle/can (12 fl oz)',355]], {brand:'Cayman Jack', abv:5.8, barcode:CJ_VARIETY_PACK, note:'Label values for one 12 fl oz bottle (about 220 kcal), spread over 100 g. Check the bottle.'}],
  ['Mango Margarita', {kcal:62,carbs:4.8,sugar:4.5,alcohol:4.6,sodium:6}, [['1 bottle/can (12 fl oz)',355]], {brand:'Cayman Jack', abv:5.8, note:'Approximate: same as the original Margarita. Check the bottle.'}],
  ['Hard Seltzer, Black Cherry', {kcal:28,carbs:0.6,sugar:0.6,alcohol:3.9,sodium:3}, [['1 can (12 fl oz)',355]], {brand:'White Claw', abv:5, note:'Label values for one 12 fl oz can (100 kcal, 2 g carbs).'}],
  ['Hard Seltzer', {kcal:28,carbs:0.6,alcohol:3.9,sodium:3}, [['1 can (12 fl oz)',355]], {brand:'Bud Light Seltzer', abv:5, note:'Label values for one 12 fl oz can (100 kcal).'}],
  ['Hard Lemonade, Original', {kcal:63,carbs:9.3,sugar:9,alcohol:3.9,sodium:7}, [['1 bottle (11.2 fl oz)',331]], {brand:"Mike's", abv:5, note:'Label values for one 11.2 fl oz bottle (about 220 kcal).'}],
  ['Classic Lime Margarita', {kcal:74,carbs:7.5,sugar:7,alcohol:3.9,sodium:11}, [['1 can (11.2 fl oz)',331]], {brand:'Bud Light Lime-A-Rita', abv:5, note:'Label values for one 11.2 fl oz can (about 245 kcal).'}],
  ['Cola', {kcal:39,carbs:10.6,sugar:10.6,sodium:1,caffeine:9}, [['1 can (12 fl oz)',368],['1 bottle (20 fl oz)',591]], {brand:'Coca-Cola', note:'Label values: 140 kcal and 39 g sugar per 12 fl oz can.'}],
  ['Diet Coke', {kcal:0,carbs:0,sodium:11,caffeine:13}, [['1 can (12 fl oz)',355]], {brand:'Coca-Cola', note:'Label values: 0 kcal per 12 fl oz can.'}],
  ['Pepsi', {kcal:41,carbs:11.1,sugar:11.1,sodium:8,caffeine:10}, [['1 can (12 fl oz)',368]], {brand:'Pepsi', note:'Label values: 150 kcal and 41 g sugar per 12 fl oz can.'}],
  ['Energy Drink, Original', {kcal:45,carbs:11,sugar:10.6,protein:0.4,sodium:40,caffeine:32}, [['1 can (8.4 fl oz)',248]], {brand:'Red Bull', note:'Label values: 110 kcal per 8.4 fl oz can.'}],
  ['Cold Brew Coffee, black', {kcal:1,carbs:0,caffeine:85}, [['1 cup (8 fl oz)',237]], {note:'Black coffee; caffeine varies a lot by brew.'}],
  // The rest of the Cayman Jack variety pack (UPC on the 12-pack box, shared by every
  // flavor in it). Per-flavor figures aren't in the open data: these use the
  // Margarita's (about 220 kcal per 12 fl oz can). Check the can.
  ['Mexican Sunrise', {kcal:62,carbs:4.8,sugar:4.5,alcohol:4.6,sodium:6}, [['1 can (12 fl oz)',355]], {brand:'Cayman Jack', abv:5.8, barcode:CJ_VARIETY_PACK, note:'Approximate: based on the Cayman Jack Margarita. Check the can, and use Edit a copy to put in its own numbers.'}],
  ['Paloma', {kcal:62,carbs:4.8,sugar:4.5,alcohol:4.6,sodium:6}, [['1 can (12 fl oz)',355]], {brand:'Cayman Jack', abv:5.8, barcode:CJ_VARIETY_PACK, note:'Approximate: based on the Cayman Jack Margarita. Check the can, and use Edit a copy to put in its own numbers.'}],
  ['Agave Mule', {kcal:62,carbs:4.8,sugar:4.5,alcohol:4.6,sodium:6}, [['1 can (12 fl oz)',355]], {brand:'Cayman Jack', abv:5.8, barcode:CJ_VARIETY_PACK, note:'Approximate: based on the Cayman Jack Margarita. Check the can, and use Edit a copy to put in its own numbers.'}],
];

// Both lists become records the app stores on first run. Drinks carry isDrink so
// the Drinks filter and the fluid-ounce/ml serving units apply to them.
function starterFoodRecords() {
  const make = (prefix, rows, drinkByDefault) => rows.map(([name, per100, servings, extra = {}], i) => ({
    id: prefix + i,
    name,
    brand: extra.brand || '',
    source: 'starter',
    per100,
    servings: servings.map(([label, grams]) => ({ label, grams })),
    isDrink: extra.drink != null ? !!extra.drink : drinkByDefault,
    ...(extra.abv != null ? { abv: extra.abv } : {}),
    ...(extra.note ? { note: extra.note } : {}),
    ...(extra.barcode ? { barcode: extra.barcode } : {}),
  }));
  return [...make('starter-', STARTER_FOODS, false), ...make('starter-drink-', STARTER_DRINKS, true)];
}
