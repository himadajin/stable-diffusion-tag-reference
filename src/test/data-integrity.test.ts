import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type SourceManifest = {
  categories: Array<{ id: string; name: string; file: string }>;
  freeInputTags: { chunks: Array<{ id: string; file: string; count: number }> };
};

type SourceCategory = {
  id: string;
  name: string;
  tree: SourceSection[];
};

type SourceTag = {
  en: string;
  ja: string;
  path: string[];
  sectionPath: string[];
};

type SourceSection = {
  id: string;
  name: string;
  tags?: Array<{ en: string; ja: string }>;
  children?: SourceSection[];
};

type GeneratedManifest = {
  categories: Array<{ id: string; file: string; tagCount: number }>;
  search: {
    chunks: Array<{ id: string; file: string; count: number }>;
    tokenIndexFile?: string;
    totalCount: number;
  };
};

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = path.join(root, "data/source");
const generatedRoot = path.join(root, "public/data");
const sectionIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function collectTags(
  sections: SourceSection[],
  pathParts: string[] = [],
  sectionPath: string[] = [],
): SourceTag[] {
  return sections.flatMap((section) => {
    const nextPath = [...pathParts, section.name];
    const nextSectionPath = [...sectionPath, section.id];
    const tags =
      section.tags?.map((tag) => ({
        en: tag.en,
        ja: tag.ja,
        path: nextPath,
        sectionPath: nextSectionPath,
      })) ?? [];
    return [...tags, ...collectTags(section.children ?? [], nextPath, nextSectionPath)];
  });
}

function validateSections(sections: SourceSection[]): void {
  const siblingIds = new Set<string>();
  for (const section of sections) {
    expect(section.id).toMatch(sectionIdPattern);
    expect(section.name).toEqual(expect.any(String));
    expect(section.name.length).toBeGreaterThan(0);
    expect(siblingIds.has(section.id)).toBe(false);
    siblingIds.add(section.id);

    const hasTags = Array.isArray(section.tags);
    const hasChildren = Array.isArray(section.children);
    expect(hasTags || hasChildren).toBe(true);
    expect(hasTags && hasChildren).toBe(false);

    if (section.tags) {
      for (const tag of section.tags) {
        expect(tag.en).toEqual(expect.any(String));
        expect(tag.en.length).toBeGreaterThan(0);
        expect(tag.ja).toEqual(expect.any(String));
        expect(tag.ja.length).toBeGreaterThan(0);
      }
    }
    validateSections(section.children ?? []);
  }
}

describe("source data integrity", () => {
  const manifest = readJson<SourceManifest>(path.join(sourceRoot, "manifest.json"));

  it("keeps category source data split by top-level category", () => {
    expect(manifest.categories.length).toBeGreaterThan(1);
    expect(
      readdirSync(path.join(sourceRoot, "tags")).filter((file) => file.endsWith(".json")),
    ).toHaveLength(manifest.categories.length);

    for (const categoryRef of manifest.categories) {
      const category = readJson<SourceCategory>(path.join(sourceRoot, categoryRef.file));
      const tags = collectTags(category.tree);
      expect(category.id).toBe(categoryRef.id);
      expect(category.name).toBe(categoryRef.name);
      validateSections(category.tree);
      expect(tags.length).toBeGreaterThanOrEqual(0);
      for (const tag of tags) {
        expect(tag.en).toEqual(expect.any(String));
        expect(tag.en.length).toBeGreaterThan(0);
        expect(tag.ja).toEqual(expect.any(String));
        expect(tag.ja.length).toBeGreaterThan(0);
        expect(tag.path.length).toBeGreaterThan(0);
        expect(tag.sectionPath.length).toBe(tag.path.length);
      }
    }
  });

  it("keeps free-input source data split into stable chunks", () => {
    expect(manifest.freeInputTags.chunks.length).toBeGreaterThan(1);

    for (const chunkRef of manifest.freeInputTags.chunks) {
      const chunk = readJson<{ id: string; items: Array<{ tag: string; count: number }> }>(
        path.join(sourceRoot, chunkRef.file),
      );
      expect(chunk.id).toBe(chunkRef.id);
      expect(chunk.items).toHaveLength(chunkRef.count);
      for (const item of chunk.items) {
        expect(item.tag).toEqual(expect.any(String));
        expect(item.tag.length).toBeGreaterThan(0);
        expect(item.count).toEqual(expect.any(Number));
      }
    }
  });
});

describe("generated data integrity", () => {
  const sourceManifest = readJson<SourceManifest>(path.join(sourceRoot, "manifest.json"));
  const generatedManifest = readJson<GeneratedManifest>(path.join(generatedRoot, "manifest.json"));

  it("preserves source category counts and stable references in generated category data", () => {
    const sourceCounts = new Map(
      sourceManifest.categories.map((categoryRef) => {
        const category = readJson<SourceCategory>(path.join(sourceRoot, categoryRef.file));
        return [categoryRef.id, collectTags(category.tree).length];
      }),
    );

    for (const category of generatedManifest.categories) {
      const generated = readJson<{ id: string; tagCount: number; sections: unknown[] }>(
        path.join(generatedRoot, category.file),
      );
      expect(generated.id).toBe(category.id);
      expect(generated.tagCount).toBe(sourceCounts.get(category.id));
      expect(category.tagCount).toBe(sourceCounts.get(category.id));
    }
  });

  it("generates a search index that covers tags and free-input candidates", () => {
    const sourceTagCount = sourceManifest.categories.reduce((total, categoryRef) => {
      const category = readJson<SourceCategory>(path.join(sourceRoot, categoryRef.file));
      return total + collectTags(category.tree).length;
    }, 0);
    const sourceFreeCount = sourceManifest.freeInputTags.chunks.reduce(
      (total, chunkRef) => total + chunkRef.count,
      0,
    );

    let generatedSearchCount = 0;
    let sampleTagEntry: unknown;
    let sampleFreeEntry: unknown;

    for (const chunkRef of generatedManifest.search.chunks) {
      const chunk = readJson<{ entries: unknown[] }>(path.join(generatedRoot, chunkRef.file));
      generatedSearchCount += chunk.entries.length;
      sampleTagEntry ??= chunk.entries.find((entry) => (entry as { type?: string }).type === "tag");
      sampleFreeEntry ??= chunk.entries.find(
        (entry) => (entry as { type?: string }).type === "free",
      );
    }

    expect(generatedSearchCount).toBe(sourceTagCount + sourceFreeCount);
    expect(generatedManifest.search.totalCount).toBe(generatedSearchCount);
    expect(generatedManifest.search.tokenIndexFile).toBe("search/token-index.json");
    if (!generatedManifest.search.tokenIndexFile) {
      throw new Error("Generated manifest is missing search.tokenIndexFile");
    }
    const tokenIndex = readJson<Record<string, string[]>>(
      path.join(generatedRoot, generatedManifest.search.tokenIndexFile),
    );
    const chunkIds = new Set(generatedManifest.search.chunks.map((chunk) => chunk.id));
    expect(tokenIndex.masterpiece?.every((chunkId) => chunkIds.has(chunkId))).toBe(true);
    expect(sampleTagEntry).toEqual(
      expect.objectContaining({
        type: "tag",
        categoryId: expect.any(String),
        path: expect.any(Array),
        sectionPath: expect.any(Array),
        id: expect.any(String),
      }),
    );
    expect(sampleFreeEntry).toEqual(
      expect.objectContaining({
        type: "free",
        tag: expect.any(String),
        count: expect.any(Number),
      }),
    );
  });
});
