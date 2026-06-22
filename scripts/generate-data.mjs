import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "data", "source");
const outputDir = path.join(root, "public", "data");
const categoryOutputDir = path.join(outputDir, "categories");
const searchOutputDir = path.join(outputDir, "search");
const SEARCH_CHUNK_SIZE = 5_000;

function jsonStringify(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, jsonStringify(value));
}

const SECTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function collectSectionTags(sectionsSource, category, pathParts = [], sectionIds = []) {
  const sections = [];
  const flatTags = [];

  if (!Array.isArray(sectionsSource)) {
    return { sections, flatTags };
  }

  const siblingIds = new Set();

  for (const sectionSource of sectionsSource) {
    const { id, name } = sectionSource;
    if (!SECTION_ID_PATTERN.test(id)) {
      throw new Error(`Invalid section id "${id}" in ${category.id}`);
    }
    if (siblingIds.has(id)) {
      throw new Error(`Duplicate sibling section id "${id}" in ${category.id}`);
    }
    siblingIds.add(id);

    const nextPath = [...pathParts, name];
    const nextSectionIds = [...sectionIds, id];
    const sectionId = nextSectionIds.join("__");

    if (Array.isArray(sectionSource.tags)) {
      const tags = sectionSource.tags.map((tag, index) => {
        const id = `${category.id}__${sectionId}__${String(index + 1).padStart(4, "0")}`;
        return {
          id,
          categoryId: category.id,
          categoryName: category.name,
          path: nextPath,
          sectionPath: nextSectionIds,
          en: tag.en,
          ja: tag.ja,
        };
      });
      sections.push({
        id: sectionId,
        name,
        path: nextPath,
        sectionPath: nextSectionIds,
        tagCount: tags.length,
        tags,
      });
      flatTags.push(...tags);
    } else {
      const child = collectSectionTags(sectionSource.children, category, nextPath, nextSectionIds);
      sections.push({
        id: sectionId,
        name,
        path: nextPath,
        sectionPath: nextSectionIds,
        tagCount: child.flatTags.length,
        children: child.sections,
      });
      flatTags.push(...child.flatTags);
    }
  }

  return { sections, flatTags };
}

function normalizeSearchText(value) {
  return value.normalize("NFKC").toLowerCase();
}

function searchTokens(value) {
  return new Set(
    normalizeSearchText(value)
      .split(/\s+/)
      .filter((word) => word.length >= 3),
  );
}

async function main() {
  const manifest = await readJson(path.join(sourceDir, "manifest.json"));

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(categoryOutputDir, { recursive: true });
  await mkdir(searchOutputDir, { recursive: true });

  const categorySummaries = [];
  const searchEntries = [];

  for (const categoryRef of manifest.categories) {
    const categorySource = await readJson(path.join(sourceDir, categoryRef.file));
    const category = { id: categorySource.id, name: categorySource.name };
    const { sections, flatTags } = collectSectionTags(categorySource.tree, category);
    const file = `categories/${category.id}.json`;

    await writeJson(path.join(outputDir, file), {
      id: category.id,
      name: category.name,
      tagCount: flatTags.length,
      sections,
    });

    categorySummaries.push({
      id: category.id,
      name: category.name,
      file,
      tagCount: flatTags.length,
    });

    for (const tag of flatTags) {
      searchEntries.push({
        type: "tag",
        id: tag.id,
        categoryId: tag.categoryId,
        categoryName: tag.categoryName,
        path: tag.path,
        sectionPath: tag.sectionPath,
        en: tag.en,
        ja: tag.ja,
        searchText: normalizeSearchText([tag.en, tag.ja, tag.categoryName, ...tag.path].join(" ")),
      });
    }
  }

  for (const chunkRef of manifest.freeInputTags.chunks) {
    const chunk = await readJson(path.join(sourceDir, chunkRef.file));
    for (const [index, item] of chunk.items.entries()) {
      const id = `free__${chunk.id}__${String(index + 1).padStart(4, "0")}`;
      searchEntries.push({
        type: "free",
        id,
        tag: item.tag,
        count: item.count,
        searchText: normalizeSearchText(item.tag),
      });
    }
  }

  const searchChunks = [];
  const tokenChunks = new Map();
  for (let start = 0; start < searchEntries.length; start += SEARCH_CHUNK_SIZE) {
    const index = searchChunks.length + 1;
    const id = `chunk-${String(index).padStart(3, "0")}`;
    const file = `search/${id}.json`;
    const entries = searchEntries.slice(start, start + SEARCH_CHUNK_SIZE);
    await writeJson(path.join(outputDir, file), { id, entries });
    searchChunks.push({ id, file, count: entries.length });

    for (const entry of entries) {
      for (const token of searchTokens(entry.searchText)) {
        if (!tokenChunks.has(token)) tokenChunks.set(token, new Set());
        tokenChunks.get(token).add(id);
      }
    }
  }

  const tokenIndex = Object.fromEntries(
    [...tokenChunks.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([token, chunkIds]) => [token, [...chunkIds].sort()]),
  );
  await writeJson(path.join(searchOutputDir, "token-index.json"), tokenIndex);

  await writeJson(path.join(outputDir, "manifest.json"), {
    version: 1,
    categories: categorySummaries,
    search: {
      chunks: searchChunks,
      tokenIndexFile: "search/token-index.json",
      totalCount: searchEntries.length,
    },
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
