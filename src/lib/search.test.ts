import { describe, expect, it } from "vitest";
import type { SearchEntry } from "../types";
import { entryCopyValue, normalizeQuery, searchEntries } from "./search";

const entries: SearchEntry[] = [
  {
    type: "tag",
    id: "quality__positive__0001",
    categoryId: "quality",
    categoryName: "品質",
    path: ["ポジティブ"],
    sectionPath: ["positive"],
    en: "masterpiece",
    ja: "傑作",
    searchText: "masterpiece 傑作 品質 ポジティブ",
  },
  {
    type: "free",
    id: "free__chunk-001__0001",
    tag: "cinematic lighting",
    count: 240,
    searchText: "cinematic lighting",
  },
];

describe("searchEntries", () => {
  it("matches English, Japanese, and free-input candidates", () => {
    expect(searchEntries(entries, "傑作")).toHaveLength(1);
    expect(searchEntries(entries, "master")).toHaveLength(1);
    expect(searchEntries(entries, "cinematic")).toHaveLength(1);
  });

  it("normalizes whitespace and full-width characters", () => {
    expect(normalizeQuery("　ＭＡＳＴＥＲＰＩＥＣＥ ")).toBe("masterpiece");
  });

  it("returns the copy value for both entry types", () => {
    expect(entryCopyValue(entries[0])).toBe("masterpiece");
    expect(entryCopyValue(entries[1])).toBe("cinematic lighting");
  });
});
