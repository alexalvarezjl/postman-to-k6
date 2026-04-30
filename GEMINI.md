# Project Instructions: Postman → k6 Converter

## Project Overview
A 100% browser-based SPA that converts Postman collections or cURL commands into k6 performance testing scripts.

## Tech Stack
- **Languages:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Libraries:** JSZip (for multi-file export).
- **Architecture:** Flat structure with separate files for UI (app.js), logic (converter.js, curl-parser.js), and styling (style.css).

## Development Conventions
- **Vanilla JS:** No build tools, bundlers, or frameworks (React/Vue). Stick to standard DOM APIs.
- **State Management:** Use the central `state` object in `app.js` for reactive-like state management.
- **Styling:** Use the CSS variable system defined in `style.css` (`:root` block) for consistent colors and spacing. Use `--method-*` variables for HTTP method coloring.
- **Naming:** use camelCase for variables and functions. Use SCREAMING_SNAKE_CASE for constants.
- **DOM Access:** 
  - Use the `$` helper for `getElementById`.
  - Cache all persistent DOM elements in the `DOM` object at the top of `app.js`.
  - Avoid direct DOM manipulation inside logic files (`converter.js`, `curl-parser.js`).

## Architecture & Responsibilities
- `index.html`: Defines the 4-step wizard UI. Each step is a `.step-card`.
- `style.css`: Contains all styling, including dark mode, glassmorphism (`backdrop-filter`), and syntax highlighting classes (`.kw`, `.fn`, etc.).
- `converter.js`: Pure logic for parsing Postman JSON and generating k6 code. Exposes `window.PostmanConverter`. It should NOT touch the DOM.
- `curl-parser.js`: Specialized parser for converting cURL commands. It should NOT touch the DOM.
- `app.js`: Orchestrates the UI, handles events, and bridges the user input to the converter logic.

## Workflow Rules
- **Testing:** Since there is no automated test suite, always verify changes by opening `index.html` in a browser and performing a sample conversion (Postman or cURL).
- **Adding Features:** 
  - If it's a new conversion capability, modify `converter.js`.
  - If it's a new UI element, update `index.html` and `app.js`.
  - If it's a new k6 option, update the config reading in `app.js` and generation in `converter.js`.
- **k6 Idioms:** Follow official k6 best practices (e.g., using `check`, `Thresholds`, `options`, `setup`).
- **Performance:** Keep the converter logic efficient; it runs entirely on the main thread.

## Memory Locations
- Private project notes: `.gemini/tmp/postman-to-k6/memory/`
- Global preferences: `~/.gemini/GEMINI.md`
