# Source Data

This directory contains the repository-managed Prompt Alchemy tag data used by the app.

- `tags/`: category-tag source data split by top-level category.
- `free-input-tags/`: free-input candidate source data split into stable numbered chunks.
- `manifest.json`: the source manifest consumed by the normal data generation pipeline.

The original download was staged under `tmp/prompt-alchemy-assets`. That directory is not a permanent input for tests, builds, or app runtime.
