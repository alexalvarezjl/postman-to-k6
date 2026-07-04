# Project Context & Domain Language

This document provides the domain language, architecture, and testing seams for the Postman-to-k6 / Cypress Converter.

## Domain Vocabulary

- **Collection / Colección:** A group of API requests (Postman format v2.0/v2.1).
- **Request / Solicitud:** An individual HTTP request containing method, URL, headers, query parameters, body, and assertions.
- **Wizard Steps:** The multi-step progression in the UI:
  - **Step 1 (Import):** File drop or text pasting (Postman JSON / cURL).
  - **Step 2 (Preview):** List of parsed requests with checkboxes.
  - **Step 3 (Configure):** Framework-specific configurations (VUs, durations, thresholds, modules for k6; base URL, sleep, TypeScript for Cypress).
  - **Step 4 (Result):** Code editor preview, instructions, and download actions.
- **k6 / Cypress:** The target code frameworks generated.
- **TypeScript (TS) Toggle:** Option to generate a full Cypress project structure with typed custom commands and `.ts` file extensions.

## Architecture

The project has a strict separation of concerns:
1. **Frontend / SPA:** Clean frontend with glassmorphism styling (`style.css`), Vanilla JS DOM orchestration (`app.js`), and wizard step flow control. No bundler or package framework is used.
2. **Logic Layer:** Pure JavaScript engines that do not touch the DOM:
   - `converter.js` (`PostmanConverter`): Shared parser and formatter logic.
   - `curl-parser.js` (`cURLParser`): Parser for Bash cURL commands.
   - `generators/k6-generator.js` (`K6Generator`): Modular k6 code generator.
   - `generators/cypress-generator.js` (`CypressGenerator`): Modular Cypress JS/TS code generator.

## Testing Seams

When writing tests under TDD, respect the following pre-agreed seams:

### Seam 1: Core Parsing & Logic (Unit Level)
- **Target:** `PostmanConverter.detectBaseUrl`, `PostmanConverter.groupByFolder`, `cURLParser.parse`.
- **Assertion:** Input JSON/cURL string matches expected output structures.

### Seam 2: Code Generation (Integration Level)
- **Target:** `K6Generator.generateK6Script`, `CypressGenerator.generateCypressScript`, `CypressGenerator.generateCypressProject`.
- **Assertion:** Script output contains expected syntax, imports, headers, and correct file extensions.

### Seam 3: UI & Wizard Flow (End-to-End Level)
- **Target:** User actions on `index.html` (interacted via Cypress E2E tests).
- **Assertion:** Wizard steps transition correctly, fields clear upon reset, code block renders highlighted output, and toast notifications display.
