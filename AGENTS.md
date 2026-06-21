# AGENTS.md

## Repository Context

This repository is a Vite + React + TypeScript static site for browsing Stable Diffusion prompt tags. It is intended for GitHub Pages and should remain a client-only app with no server, database, user accounts, or persistent tag-editing state.

Before making product, data, UI, or verification changes, read:

- `docs/design.md`
- `docs/ui.md`

Treat those docs as living source material. If an intentional implementation change alters product behavior, data boundaries, UI direction, or verification expectations, update the relevant doc in the same change. Keep docs concise and implementation-facing; do not turn them into changelogs or long design history.

## Data Rules

- Repository-managed source data lives under `data/source/`.
- Generated app data lives under `public/data/`.
- Edit `data/source/` when changing tag source data.
- Run `npm run generate:data` after source data changes.
- Do not hand-edit `public/data/`; regenerate it from `data/source/`.
- Keep category tag data split by top-level category.
- Keep free-input tag data split into stable chunks.
- Preserve stable IDs, category IDs, category paths, and tag keys so generated search results can point back to source context.

## Commands

- Install dependencies with `npm install`.
- Generate app data with `npm run generate:data`.
- Start the local app with `npm run dev`.
- Build with `npm run build`.
- Run unit and data-integrity tests with `npm test`.
- Run browser workflow tests with `npm run test:e2e`.

For ordinary code, data, or generation changes, run:

```sh
npm test
npm run build
```

For UI, interaction, clipboard, search workflow, or responsive layout changes, also run:

```sh
npm run test:e2e
```

## UI Rules

- Use Radix Themes / Radix components where practical.
- Keep the UI light-mode only.
- Keep the visual tone quiet, dense, and reference-tool oriented.
- Use the existing slate + indigo direction from `docs/ui.md`.
- Use color only for meaningful states such as selection, focus, primary action, or copy success.
- Do not introduce decorative gradients, ornamental backgrounds, category color-coding, large card-heavy layouts, or flashy generative-AI-style visuals.
- Keep tag browsing, search, single-copy, temporary selection, reordering, bulk-copy, and clear flows available.
- Do not expand the app into a tag editor, prompt editor, weighting editor, or persistent prompt-management tool unless the user explicitly changes the product direction.
- Keep mobile and desktop access to the same information and operations, even if the layout differs.

## Dependency Rules

- Before adding a dependency, check whether existing React, Radix, standard Web APIs, or Node APIs are sufficient.
- Prefer small, focused dependencies only when they materially reduce complexity or risk.
- After adding or upgrading dependencies, run:

```sh
npm audit
```

Production dependencies should stay especially small because this is a static reference site.

## Testing Expectations

- Data tests should verify source schema, split-data integrity, regeneration assumptions, and generated index references.
- Browser tests should focus on user-visible workflows: category browsing, search, single-copy, temporary selection, and bulk-copy.
- Do not treat generated data as the source of truth in tests when the behavior should be proven from `data/source/`.
- When a test exposes a real product or data-boundary issue, fix the implementation rather than weakening the test.
