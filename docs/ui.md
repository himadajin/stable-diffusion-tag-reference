# Stable Diffusion Tag Reference UI

## Purpose

This document is the source of truth for the current UI design. It describes how the app should look, behave, and stay scoped as a tag reference tool.

The UI supports people working in ComfyUI who need to find Stable Diffusion prompt tags by Japanese names, categories, and surrounding context, then copy the corresponding English tag. It must stay quiet, dense, and reference-oriented.

This is not a tag editor, prompt editor, or prompt-management workspace.

## Fixed Principles

These principles are part of the product design, not incidental implementation choices.

- Keep the app light-mode only.
- Keep desktop and mobile information parity. Mobile may use a different layout, but it must not remove category browsing, search, favorites, tag copying, or context access.
- Avoid horizontal page scrolling. If horizontal scrolling appears, treat it as a layout defect.
- Use color only for meaningful state: active navigation, focus, copy feedback, and favorite state.
- Do not color-code categories.
- Avoid decorative gradients, ornamental backgrounds, large card-heavy layouts, and visuals that read as a generic generative-AI tool.
- Keep the feature set minimal: browse, search, copy, favorite, and navigate category context.
- Use Radix Themes and Radix primitives where practical, with lucide icons for clear icon actions.
- Prefer ordinary web interaction patterns over custom novelty.

## Information Architecture

The app has four primary user-facing areas:

- Category browsing: a top-level category with its original nested subcategory structure.
- Search: a global search across English tags, Japanese names, category paths, and free-input candidates.
- Favorites: a personal reference category made from official category-tag entries.
- Free-input candidates: searchable and copyable candidate tags that are not official category-tag entries.

Category browsing preserves the source category hierarchy. The sidebar behaves as a compact tree for browsing that hierarchy, so users can inspect category structure before moving the main content.

Favorites are a reading aid, not a source-data organization feature. They are stored in local browser state and shown in source category order and source data order.

## Layout

Desktop uses a fixed left sidebar and one main content area. There is no right sidebar.

Mobile uses the same left navigation model through a left-side Drawer. Do not replace category navigation with mobile Tabs. The Drawer is a responsive presentation of the same navigation structure, not a separate navigation system.

The main content header uses two compact rows:

- Current context: category title or search result title, with count information aligned away from the title.
- Global search: a single input for searching across all categories.

The header should be compact. It should not become a tall hero-like area.
When the current view is a source category or subcategory, the current-context row includes a small link-copy action for the shareable URL of the current category context.
The action should be an icon button with local, brief copied feedback. Do not use a global toast or large status message for URL copying.
Search results, favorites, and free-input candidate views do not expose shareable category URL copying.

## Navigation

The sidebar contains:

- Favorites at the top.
- Top-level source categories.
- Expandable source-category branches.
- Nested source sections for any expanded source category.

Category and section label selection changes the content immediately and resets or jumps the content scroll position to the selected browsing context.
Category and subcategory selection updates the URL fragment so the current browsing context can be shared and restored.
Explicit category and subcategory selections may add browser history entries. Section changes caused only by scrolling should not add browser history entries.

Routine category switching should not replace the list with a full-content loading state. Keep the current list stable until the next category data is ready, then swap content and reset scroll. If category loading becomes noticeably delayed, use a small inline status near the header rather than a page-level loading message.

Opening or closing a tree branch only changes the navigation disclosure state. It must not force the main content to scroll. Use a small caret disclosure target for branch expansion and collapse. Selecting the category or section label moves the main content to that category or section.

The active category branch is open by default. Users may also expand inactive source categories to inspect their sections before navigating. Keep expanded branches available until the user closes them or the page is reloaded.

If a selected section is inside a collapsed branch, the ancestor branch should keep a subtle current-child state so users do not lose orientation.

On mobile, selecting a top-level category may close the Drawer because the primary content has changed. Section jumps should also return focus to the content by closing the Drawer.

## Tag List Design

The category view is a dictionary-style list, not a data table.

Do not show a table header row such as `English tag / 日本語名 / カテゴリ文脈`. The page title, section separators, row layout, and search context provide enough structure.

Category rows show:

- Favorite action for official tags.
- English tag copy button.
- Japanese name.

Category context should not be repeated in every normal category row when the user is already browsing inside that context. Use section separators and navigation state instead.

Favorites and search results may show source context because those views mix entries from multiple categories.

Section rows are lightweight separators. They are not sticky bars and should not compete visually with tag rows.

Use virtualization or equivalent rendering discipline for large lists, but keep that internal. The user-facing design is a stable dictionary list.

## Copy Interaction

English tags and free-input candidates are copied by clicking the tag text button itself. Do not add a separate copy icon column.

Copy feedback should be local and brief, such as an inline icon change inside the tag button. Do not show global toasts, large banners, or persistent "copied" text.

Only the English tag or candidate text is a copy target. Japanese names and category labels should not become copy targets by accident.

## Favorites Interaction

Favorites apply only to official category-tag entries. Free-input candidates are copyable, but not favoriteable.

Use a lucide `Heart` icon for favorite actions:

- Unselected: neutral outline.
- Selected: ruby/red fill and stroke.

The red favorite state is intentional because the icon is a heart. Do not change favorite state to indigo only to reduce the palette.

Favorite feedback should be the icon state change itself. Do not add a toast or separate status panel for this interaction.

## Search

Search is global and uses a single input. Do not add filter panels or advanced controls unless the product scope changes.

Search results are grouped by entry type:

- Official tags.
- Free-input candidates.

Official tag results show the English tag, Japanese name, favorite action, and source context. Context links should let users jump back to the relevant category area.

Free-input candidates are copyable and clearly separated from official tags. They do not have favorites or source category navigation.

## Visual Language

Use Radix Themes with this general direction:

- `appearance="light"`
- `grayColor="slate"`
- `accentColor="indigo"`
- solid panel backgrounds
- small to medium radius
- restrained spacing

Use slate and white surfaces for the base UI. Use indigo for active navigation, focus, and copy feedback. Use ruby/red for selected favorites. Avoid adding new accent colors unless the state meaning is clear.

English tag buttons may use monospace text because the value is a literal prompt token. The surrounding UI should use normal system UI typography.

Keep density high enough for reference work. Avoid large cards, oversized headings inside the app shell, and marketing-style spacing.

## Flexible Decisions

These details may change during normal UI maintenance as long as the fixed principles stay intact:

- Exact breakpoints.
- Sidebar and Drawer width within the no-horizontal-scroll constraint.
- Row height and spacing.
- Font sizes within the dense reference-tool direction.
- Count placement.
- Search result wording.
- Internal virtualization implementation.
- Minor Radix component choices.
- Section disclosure affordances.

When changing these details, verify both desktop and mobile layouts.

## Do Not Reintroduce

Do not reintroduce these patterns as routine implementation details. If one becomes necessary, treat it as a product/design change and update this document before implementation.

- Table-style tag browsing.
- Table header rows for the tag list.
- Sticky current-section bars above the list.
- Mobile category Tabs.
- A right sidebar.
- Separate copy icon columns.
- Selected-tag lists.
- Bulk copy.
- "My Tags" or persistent tag collections.
- Tag editing, tag creation, reclassification, or curation workflows.
- Prompt editing or weighting editing.
- Category color-coding.
- Decorative gradients or generative-AI-style visual effects.
- Horizontal page scrolling.

## Verification

For UI changes, verify:

- Desktop and mobile expose the same core information and operations.
- Category navigation works through sidebar/Drawer, not Tabs.
- Tag rows remain copyable without a separate copy icon column.
- Favorites use heart icons and ruby/red selected state.
- Search results show context where mixed-category results need it.
- No horizontal page scrolling appears.
- The old table header pattern is absent.
