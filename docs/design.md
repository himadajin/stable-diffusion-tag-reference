# Stable Diffusion Tag Reference Design

## Purpose

This repository builds a static reference site for browsing Stable Diffusion prompt tags while working in tools such as ComfyUI.

Users should be able to find an English prompt tag from Japanese names, category structure, and surrounding context, then copy that tag for use elsewhere. The app also supports local favorites for frequently referenced official tags.

The product exists to make repository-managed tag data easier to browse. It does not exist to edit, curate, or reorganize that data through the UI.

## Product Boundaries

The app is:

- A Vite + React + TypeScript static SPA.
- Intended for GitHub Pages hosting.
- Client-only, with no server, database, accounts, or cloud sync.
- A reference browser for repository-managed source data.
- A single-copy workflow for English prompt tags and free-input candidates.
- A local favorite reference aid for official category-tag entries.

The app is not:

- A tag editor.
- A tag creation tool.
- A source-data curation workflow.
- A prompt editor.
- A weighting editor.
- A prompt assembly workspace.
- A bulk-copy tool.
- A persistent "My Tags" collection manager.
- A replacement for maintaining source data in `data/source/`.

Favorites are allowed only as browser-local reading state. They must not become a source-data maintenance or classification feature.

## Design Authority

This document is the product and data design authority. `docs/ui.md` is the UI design authority.

When implementation and docs disagree, do not silently follow either one. Identify the mismatch. If the implementation reflects the intended design, update the relevant docs so future work can use docs as the source of truth.

Intentional changes to product behavior, data boundaries, UI direction, or verification expectations should update the relevant docs in the same change.

## Data Model

Repository-managed source data lives under `data/source/`.

Generated app data lives under `public/data/`. Generated data is a build artifact derived from source data and should not be hand-edited.

Category-tag source data is split by top-level category. Free-input candidate source data is split into stable chunks. The split structure exists so large data can be maintained and tested without relying on temporary files or a single oversized JSON file.

Generated data should provide:

- Category browsing data that preserves the original top-level and nested subcategory structure.
- Search index data for English tags, Japanese names, free-input candidates, and category paths.
- Stable IDs or keys that allow generated entries to point back to their source context.

English tags may repeat across different source contexts. Repetition is valid when entries remain distinguishable by stable ID and category path.

## Core Features

Category browsing lets users select a top-level category and navigate the original nested subcategory structure.

Search is global. It should cover official tags, Japanese names, category paths, and free-input candidates. Results should include enough context to return to nearby source-category entries.

Copy is intentionally narrow. Users copy one English tag or free-input candidate at a time. The app should not assemble prompt text or support bulk-copy workflows.

Favorites apply only to official category-tag entries. Favorites are stored in `localStorage` under `prompt-tag-viewer:favorites:v1` as tag IDs. The favorites view should display entries in source category order and source data order, not in a separate user-defined organization.

Free-input candidates are searchable and copyable. They are not official category-tag entries and are not favoriteable.

## UI Relationship

UI layout, interaction, and visual rules belong in `docs/ui.md`.

The product-level requirements for UI are:

- Keep category browsing, search, single-copy, favorites, and context navigation available.
- Keep desktop and mobile information parity.
- Avoid expanding the app into editing, prompt management, or source-data maintenance.
- Preserve source category context so users can find nearby related tags.

## Verification Strategy

Use Vitest for data and transformation correctness:

- Source schema validation.
- Split-data integrity.
- Regeneration assumptions.
- Generated category references.
- Search index references.
- Duplicate handling where source context distinguishes repeated English tags.

Use Playwright for browser-only workflows:

- Category browsing.
- Subcategory navigation.
- Global search.
- Single-copy behavior.
- Favorites add/remove and favorites category display.
- Responsive layout and no horizontal page scrolling.

Do not treat generated data as the source of truth when a test should prove source-data integrity. Prefer testing from `data/source/` and the generation pipeline.

## Completion Conditions

- The app runs as a Vite + React + TypeScript static SPA suitable for GitHub Pages.
- Repository-managed source data is under `data/source/`.
- Category-tag source data is split by top-level category.
- Free-input candidate source data is split into stable chunks.
- Generated app data can be regenerated from source data.
- Generated entries preserve stable references to source category IDs, category paths, and tag IDs or keys.
- Users can browse categories and nested subcategories.
- Users can search official tags, Japanese names, category paths, and free-input candidates.
- Users can copy individual English tags and free-input candidates.
- Users can favorite official tags and browse favorites in source order.
- The UI contains no tag editing, prompt editing, weighting editing, bulk-copy, or source-data curation workflow.
- Data tests verify schema, split integrity, transformation logic, and generated reference consistency.
- Browser tests verify the core user-visible workflows.
