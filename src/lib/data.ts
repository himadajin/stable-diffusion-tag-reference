import type { CategoryData, DataManifest, SearchChunk, SearchEntry } from "../types";

const baseUrl = import.meta.env.BASE_URL;

let manifestPromise: Promise<DataManifest> | null = null;
const categoryCache = new Map<string, Promise<CategoryData>>();
let searchPromise: Promise<SearchEntry[]> | null = null;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function loadManifest(): Promise<DataManifest> {
  manifestPromise ??= fetchJson<DataManifest>("data/manifest.json");
  return manifestPromise;
}

export async function loadCategory(categoryId: string): Promise<CategoryData> {
  if (!categoryCache.has(categoryId)) {
    const manifest = await loadManifest();
    const category = manifest.categories.find((item) => item.id === categoryId);
    if (!category) {
      throw new Error(`Unknown category: ${categoryId}`);
    }
    categoryCache.set(categoryId, fetchJson<CategoryData>(`data/${category.file}`));
  }
  return categoryCache.get(categoryId)!;
}

export async function loadSearchIndex(): Promise<SearchEntry[]> {
  searchPromise ??= (async () => {
    const manifest = await loadManifest();
    const chunks = await Promise.all(
      manifest.search.chunks.map((chunk) => fetchJson<SearchChunk>(`data/${chunk.file}`)),
    );
    return chunks.flatMap((chunk) => chunk.entries);
  })();
  return searchPromise;
}
