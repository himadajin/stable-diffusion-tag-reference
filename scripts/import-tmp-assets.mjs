import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const tmpDir = path.join(root, "tmp", "prompt-alchemy-assets");
const sourceDir = path.join(root, "data", "source");
const tagsDir = path.join(sourceDir, "tags");
const freeInputDir = path.join(sourceDir, "free-input-tags");

const FREE_CHUNK_SIZE = 2_000;

const categoryIds = [
  "my-tags",
  "quality",
  "character",
  "composition",
  "style",
  "lighting",
  "color",
  "body",
  "action-pose",
  "clothing",
  "objects",
  "marks-symbols",
  "fantasy-people-creatures",
  "animals-creatures",
  "plants",
  "food",
  "nature-elements",
  "background",
];

function jsonStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, jsonStringify(value));
}

async function main() {
  const tags = await readJson(path.join(tmpDir, "tags.json"));
  const freeInputTags = await readJson(path.join(tmpDir, "free-input-tags.json"));
  const categories = Object.entries(tags);

  if (categories.length !== categoryIds.length) {
    throw new Error(`Expected ${categoryIds.length} categories, got ${categories.length}.`);
  }

  await rm(sourceDir, { recursive: true, force: true });
  await mkdir(tagsDir, { recursive: true });
  await mkdir(freeInputDir, { recursive: true });

  const categoryManifest = [];
  for (const [index, [name, tree]] of categories.entries()) {
    const id = categoryIds[index];
    const file = `tags/${id}.json`;
    await writeJson(path.join(sourceDir, file), {
      id,
      name,
      tree,
    });
    categoryManifest.push({ id, name, file });
  }

  const freeInputManifest = [];
  for (let start = 0; start < freeInputTags.length; start += FREE_CHUNK_SIZE) {
    const index = freeInputManifest.length + 1;
    const id = `chunk-${String(index).padStart(3, "0")}`;
    const file = `free-input-tags/${id}.json`;
    const items = freeInputTags.slice(start, start + FREE_CHUNK_SIZE);
    await writeJson(path.join(sourceDir, file), { id, items });
    freeInputManifest.push({ id, file, count: items.length });
  }

  await writeJson(path.join(sourceDir, "manifest.json"), {
    version: 1,
    importedFrom: "tmp/prompt-alchemy-assets",
    categories: categoryManifest,
    freeInputTags: {
      chunkSize: FREE_CHUNK_SIZE,
      chunks: freeInputManifest,
    },
  });

  await writeFile(
    path.join(sourceDir, "README.md"),
    [
      "# Source Data",
      "",
      "This directory contains the repository-managed Prompt Alchemy tag data used by the app.",
      "",
      "- `tags/`: category-tag source data split by top-level category.",
      "- `free-input-tags/`: free-input candidate source data split into stable numbered chunks.",
      "- `manifest.json`: the source manifest consumed by the normal data generation pipeline.",
      "",
      "The original download was staged under `tmp/prompt-alchemy-assets`. That directory is not a permanent input for tests, builds, or app runtime.",
      "",
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
