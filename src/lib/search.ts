import type { SearchEntry } from "../types";

export function normalizeQuery(query: string): string {
  return query.normalize("NFKC").trim().toLowerCase();
}

export function searchEntries(entries: SearchEntry[], query: string, limit = 120): SearchEntry[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const words = normalized.split(/\s+/).filter(Boolean);
  const results: SearchEntry[] = [];

  for (const entry of entries) {
    if (words.every((word) => entry.searchText.includes(word))) {
      results.push(entry);
      if (results.length >= limit) break;
    }
  }

  return results;
}

export function entryCopyValue(entry: SearchEntry): string {
  return entry.type === "tag" ? entry.en : entry.tag;
}
