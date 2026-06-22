import { describe, expect, it } from "vitest";
import { buildCategoryHash, buildCategoryShareUrl, parseCategoryHash } from "./share-url";

describe("share URL helpers", () => {
  it("builds readable category hashes", () => {
    expect(buildCategoryHash({ categoryId: "quality", sectionPath: [] })).toBe("#category=quality");
    expect(buildCategoryHash({ categoryId: "body", sectionPath: ["hair", "hairstyles"] })).toBe(
      "#category=body&section=hair/hairstyles",
    );
  });

  it("parses category hashes", () => {
    expect(parseCategoryHash("#category=body&section=hair/hairstyles")).toEqual({
      categoryId: "body",
      sectionPath: ["hair", "hairstyles"],
    });
  });

  it("rejects unsupported hashes", () => {
    expect(parseCategoryHash("")).toBeNull();
    expect(parseCategoryHash("#/body/hair")).toBeNull();
    expect(parseCategoryHash("#category=favorites")).toEqual({
      categoryId: "favorites",
      sectionPath: [],
    });
    expect(parseCategoryHash("#category=body&section=髪")).toEqual({
      categoryId: "body",
      sectionPath: [],
    });
  });

  it("replaces the hash on a full URL", () => {
    expect(
      buildCategoryShareUrl("https://example.test/app/?q=1#old", {
        categoryId: "body",
        sectionPath: ["hair"],
      }),
    ).toBe("https://example.test/app/?q=1#category=body&section=hair");
  });
});
