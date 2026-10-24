# Daily Plate

A clean-room rewrite of the food-tracker idea behind apps like MyFitnessPal and Cronometer, made with Claude Code. Log what you eat, track calories and 14 nutrients, keep a permanent archive, and get reminded to eat and to finish each day's log.

**Use it:** https://ryelikebread.github.io/Daily-Plate/ (on iPhone: open in Safari → Share → Add to Home Screen)

All data stays on your device (browser IndexedDB). Food search uses open data from Open Food Facts and USDA FoodData Central. No code, text, artwork or data was copied from any commercial app.

- How to use it: [docs/USER_GUIDE.md](docs/USER_GUIDE.md)
- What's in it and what it stores: [docs/INSTALLED_COMPONENTS.md](docs/INSTALLED_COMPONENTS.md)
- Run locally: `python3 -m http.server 8080 --directory app`, then open http://localhost:8080
- Test: `node tests/smoke.test.js` (needs Playwright + Chromium)

Every push to `main` republishes the `app/` folder to GitHub Pages (`.github/workflows/pages.yml`).
