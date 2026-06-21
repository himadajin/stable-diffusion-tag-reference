import type { SearchEntry } from "../types";
import { loadManifest, loadSearchChunk, loadSearchTokenIndex } from "./data";

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

export async function searchEntriesFromChunks(query: string, limit = 120): Promise<SearchEntry[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  const manifest = await loadManifest();
  const words = normalized.split(/\s+/).filter(Boolean);
  const results: SearchEntry[] = [];
  const chunks =
    words.length >= 2 && words.every((word) => word.length >= 3)
      ? candidateSearchChunks(manifest.search.chunks, await loadSearchTokenIndex(), words)
      : manifest.search.chunks;

  for (const chunkRef of chunks) {
    const entries = await loadSearchChunk(chunkRef.file);
    for (const entry of entries) {
      if (words.every((word) => entry.searchText.includes(word))) {
        results.push(entry);
        if (results.length >= limit) return results;
      }
    }
  }

  return results;
}

function candidateSearchChunks(
  chunks: Array<{ id: string; file: string; count: number }>,
  tokenIndex: Record<string, string[]>,
  words: string[],
): Array<{ id: string; file: string; count: number }> {
  if (words.some((word) => !tokenIndex[word])) return chunks;

  let candidateIds: Set<string> | null = null;
  for (const word of words) {
    const tokenSet = new Set<string>(tokenIndex[word]);
    if (candidateIds) {
      const nextCandidateIds = new Set<string>();
      for (const chunkId of candidateIds) {
        if (tokenSet.has(chunkId)) nextCandidateIds.add(chunkId);
      }
      candidateIds = nextCandidateIds;
    } else {
      candidateIds = tokenSet;
    }
    if (candidateIds.size === 0) return [];
  }

  if (!candidateIds) return chunks;
  return chunks.filter((chunk) => candidateIds.has(chunk.id));
}

export function entryCopyValue(entry: SearchEntry): string {
  return entry.type === "tag" ? entry.en : entry.tag;
}
