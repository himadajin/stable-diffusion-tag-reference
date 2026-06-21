import type { CategoryData, DataManifest, SearchChunk, SearchEntry } from "../types";

const baseUrl = import.meta.env.BASE_URL;

let manifestPromise: Promise<DataManifest> | null = null;
const categoryCache = new Map<string, Promise<CategoryData>>();
const searchChunkCache = new Map<string, Promise<SearchEntry[]>>();
let searchTokenIndexPromise: Promise<Record<string, string[]>> | null = null;

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
  const manifest = await loadManifest();
  const chunks = await Promise.all(manifest.search.chunks.map((chunk) => loadSearchChunk(chunk.file)));
  return chunks.flat();
}

export async function loadSearchChunk(file: string): Promise<SearchEntry[]> {
  if (!searchChunkCache.has(file)) {
    searchChunkCache.set(file, fetchJson<SearchChunk>(`data/${file}`).then((chunk) => chunk.entries));
  }
  return searchChunkCache.get(file)!;
}

export async function loadSearchTokenIndex(): Promise<Record<string, string[]>> {
  searchTokenIndexPromise ??= (async () => {
    const manifest = await loadManifest();
    if (!manifest.search.tokenIndexFile) return {};
    return fetchJson<Record<string, string[]>>(`data/${manifest.search.tokenIndexFile}`);
  })();
  return searchTokenIndexPromise;
}
