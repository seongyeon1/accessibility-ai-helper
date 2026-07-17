# AI Accessibility Helper Design

## Goal

Build a browser-based open-source prototype that checks public-facing Korean information for accessibility issues that affect older adults, people with disabilities, children, and multicultural families.

## MVP Scope

- Text checker for difficult words, long sentences, passive administrative phrasing, and missing plain-language summaries.
- HTML checker for missing image alt text, weak heading structure, vague link labels, and unlabeled form controls.
- Contrast checker for foreground/background color pairs.
- Report UI that explains severity, affected users, and concrete fixes.

## Architecture

The app is a static web app with no server dependency. `src/analyzer.js` contains pure analysis functions that are tested with Node's built-in test runner. `src/app.js` connects those functions to the browser UI. `index.html` and `styles.css` provide an accessible, responsive interface suitable for demos and public-sector review.

## Design Direction

The visual design should feel like a civic inspection desk rather than a marketing page: calm, readable, and practical. The signature element is a "문턱 점수" panel that turns abstract accessibility findings into a visible barrier score.

## Constraints

- No paid API or network dependency.
- No build step.
- Works by opening the app through a simple local static server.
- AI features are represented as explainable heuristic checks in the MVP, with clear extension points for future LLM/OCR integrations.
