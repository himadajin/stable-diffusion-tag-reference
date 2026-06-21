# AGENTS.md

## Repository Context

This repository is a Vite + React + TypeScript static site for browsing Stable Diffusion prompt tags. It is intended for GitHub Pages and should remain a client-only app with no server, database, user accounts, or persistent tag-editing state.

Before making product, data, UI, or verification changes, read:

- `docs/design.md`
- `docs/ui.md`

Treat `docs/design.md` and `docs/ui.md` as the current design authority. If implementation and docs disagree, do not silently follow either one: identify the mismatch, update the docs when the implementation represents the intended design, and keep future changes aligned with the docs.

Keep docs concise, current, and implementation-facing. Do not preserve old design history inside the active docs.

## Product Boundaries

- This is a tag reference browser, not a tag editor or prompt editor.
- Do not add tag creation, tag editing, reclassification, source-data curation, prompt editing, weighting editing, bulk-copy, or persistent "My Tags" workflows unless the product direction explicitly changes.
- Favorites are allowed only as local reading state for official category-tag entries.
- Free-input candidates are searchable and copyable, but they are not official category-tag entries and are not favoriteable.

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
- Format files with `npm run format`.
- Run formatter and linter checks with `npm run check`.
- Run linter-only checks with `npm run lint`.
- Run unit and data-integrity tests with `npm test`.
- Run browser workflow tests with `npm run test:e2e`.

For ordinary code, data, or generation changes, run:

```sh
npm run check
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
- Follow `docs/ui.md` for layout, visual language, and interaction details.
- Use color only for meaningful states such as active navigation, focus, copy feedback, and favorite state.
- Do not introduce decorative gradients, ornamental backgrounds, category color-coding, large card-heavy layouts, or flashy generative-AI-style visuals.
- Keep tag browsing, search, English-tag single-copy, favorites, and category navigation flows available.
- Keep mobile and desktop access to the same information and operations, even if the layout differs.
- Do not reintroduce table-style tag browsing, tag-list header rows, sticky current-section bars, mobile category tabs, right sidebars, separate copy icon columns, selected-tag lists, bulk copy, or My Tags.
- Avoid horizontal page scrolling; treat it as a layout defect.

## Formatting and Linting

- Biome is the formatter and linter for this repository.
- Keep generated and bulky outputs out of formatter/linter scope: `public/data/`, `dist/`, `.vite/`, `coverage/`, and `test-results/`.
- Use `npm run check` before handing off ordinary code changes.
- Use `npm run check:write` or `npm run format` to apply mechanical formatting changes.
- Do not hand-format generated data; update `data/source/` and regenerate instead.

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
- Browser tests should focus on user-visible workflows: category browsing, subcategory navigation, search, single-copy, favorites, and responsive layout.
- Do not treat generated data as the source of truth in tests when the behavior should be proven from `data/source/`.
- When a test exposes a real product or data-boundary issue, fix the implementation rather than weakening the test.
