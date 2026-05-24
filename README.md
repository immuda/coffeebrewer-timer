# The Brew Timer v2.3

A premium, offline-capable Progressive Web App (PWA) designed to perfect your coffee brewing process.

## Features

- **Multi-Method Support:** Includes preset ratios and stage-timers for Pour Over, French Press, Espresso, AeroPress, and Cold Brew.
- **Smart Ratio Calculator:** Adjust your coffee dose or tweak the water ratio on the fly—all pouring stages calculate proportionally.
- **Coffee Beans Inventory:** Manage active coffee bags (Roaster, Origin, Roast Level, Roast Date, Tasting Notes), track remaining weights visually, select beans for brewing, and get warnings when the bag is running low.
- **Smart Temperature & Bloom Guide:** Dials in optimal brewing water temp, grind profile, and degassing bloom time automatically based on the roast date and level of your coffee bean bag.
- **Custom Recipe Builder:** Create recipes with custom stages (labels, lengths, and water distributions) and load them instantly into the brewer.
- **Advanced Stats Dashboard:** Track total cup counts, water volume, bean usage, average ratings, and view CSS-based bar charts.
- **Progressive Web App (PWA):** Installable on desktop and mobile. Works 100% offline.
- **Stage-by-Stage Timer:** Step-by-step visual and audible instructions so you never miss a pour.
- **Brew History Journal:** Log completed brews (records bean names and notes), rate them, and review your history.
- **Favorites:** Save your tweaked recipes to a favorites list for one-click loading.
- **Dark & Light Modes:** A gorgeous, glassmorphic UI that adapts to your preference.
- **Haptics & Audio:** Subtle vibrations on mobile and elegant chime alerts on stage transitions.

## Recent Updates (v2.3)

- **Unified Dashboard & Navigation:** Transitioned the application into a unified 4-tab mobile layout (Brew, Beans, Recipes, Journal) with a persistent bottom tab bar.
- **Smart Guide:** Select a bean bag and see temperature, grind, and degassing bloom recommendations. Dynamically adjusts the bloom stage countdown.
- **Custom Recipes CRUD:** Add, edit, and delete custom stage configurations (summing to 100% water).
- **Advanced Stats:** Dashboard with total counts and CSS bar charts showing method and rating distributions.
- **File Changes in this release:**
  - [index.html](file:///home/imran/antigravity/coffeebrewer-timer/index.html): Restructured layout into 4 tab section containers, added the bottom nav bar, custom recipe stage forms, and stats cards.
  - [css/style.css](file:///home/imran/antigravity/coffeebrewer-timer/css/style.css): Styled bottom tab bars, stats grids, tooltip visuals, CSS charts, and stage-builder inputs.
  - [js/script.js](file:///home/imran/antigravity/coffeebrewer-timer/js/script.js): Coded tab switching navigation, smart advice rules, custom recipe stage rows build/validation, and history stats logic.
  - [sw.js](file:///home/imran/antigravity/coffeebrewer-timer/sw.js): Bumped cache version to v2.3 to force refresh updated assets.

## Recent Updates (v2.2)

- **Coffee Beans Inventory & Logger:** Integrated a premium Coffee Beans Inventory Management system. Users can register their active coffee bags, select which bean they are brewing with, and automatically deduct the dose from their bag weight upon saving to history.
- **File Changes in v2.2:**
  - [index.html](file:///home/imran/antigravity/coffeebrewer-timer/index.html): Added the coffee beans dropdown selector in the main brewing card, a footer navigation button for Beans, and the Coffee Beans modal overlay (incorporating the List View and Add/Edit Form structures).
  - [css/style.css](file:///home/imran/antigravity/coffeebrewer-timer/css/style.css): Added visual styles for the selector, modal card progress bars, roast badges, and responsive form grids matching the glassmorphic theme.
  - [js/script.js](file:///home/imran/antigravity/coffeebrewer-timer/js/script.js): Added state tracking for the beans database, dynamic dropdown sync, warning thresholds, automatic weight deduction on logging a brew, and CRUD actions for bean bags.
  - [sw.js](file:///home/imran/antigravity/coffeebrewer-timer/sw.js): Bumped cache version to v2.2 to force refresh updated assets.

## Recent Updates (v2.1)

- **PWA Offline Support:** Registered the service worker correctly so the app can be cached and run offline.
- **Background Resiliency:** Refactored the timer calculations to use a date-difference system (`Date.now() - timerStartTime`), protecting the countdown from lagging due to browser tab background throttling.
- **Audio Context Management:** Integrated a reusable singleton `AudioContext` to prevent context leak warnings or crashes.
- **Keyboard Shortcut Improvements:** Disabled global hotkeys (e.g., Spacebar and R) when history or favorites modals are active.
- **Code Cleanups:** Removed dangling references and unused styles for the uncompleted AI parser feature.

## Project Structure

This project uses entirely vanilla HTML, CSS, and JavaScript. There are no build tools or compilers required.

- `index.html` - The core application layout and UI.
- `style.css` - All styling, theming tokens, and animations.
- `script.js` - The application logic, state management, and `localStorage` syncing.
- `sw.js` - The Service Worker that enables offline functionality.
- `manifest.json` - The PWA manifest for home-screen installation.

## How to Run Locally

You can serve this project using any basic HTTP server. For example:

1. Using Python:
   ```bash
   python3 -m http.server
   ```
2. Using Node:
   ```bash
   npx serve .
   ```

Then simply open `http://localhost:8000` or `http://localhost:3000` in your web browser.

## Contributing
Feel free to open a pull request if you want to add new brewing methods, tweak the UI, or add additional features like a built-in recipe sharing system!

---

**Disclaimer:** This application and its entire codebase were generated by **Antigravity**, an AI coding assistant. While every effort has been made to ensure accuracy and performance, please use it responsibly.
