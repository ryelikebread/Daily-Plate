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
  ['Coffee, brewed', {kcal:1,protein:0.1,carbs:0,fat:0,potassium:49}, [['1 cup',237]]],
];

function starterFoodRecords() {
  return STARTER_FOODS.map(([name, per100, servings], i) => ({
    id: 'starter-' + i,
    name,
    brand: '',
    source: 'starter',
    per100,
    servings: servings.map(([label, grams]) => ({ label, grams })),
  }));
}
