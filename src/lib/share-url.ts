export type CategoryHashLocation = {
  categoryId: string;
  sectionPath: string[];
};

const idSegmentPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseCategoryHash(hash: string): CategoryHashLocation | null {
  const source = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!source) return null;

  const params = new URLSearchParams(source);
  const categoryId = params.get("category")?.trim() ?? "";
  if (!idSegmentPattern.test(categoryId)) return null;

  const section = params.get("section")?.trim() ?? "";
  const sectionPath = section ? section.split("/") : [];
  if (sectionPath.some((part) => !idSegmentPattern.test(part))) {
    return { categoryId, sectionPath: [] };
  }

  return { categoryId, sectionPath };
}

export function buildCategoryHash({ categoryId, sectionPath }: CategoryHashLocation): string {
  const section = sectionPath.length ? `&section=${sectionPath.join("/")}` : "";
  return `#category=${categoryId}${section}`;
}

export function buildCategoryShareUrl(href: string, location: CategoryHashLocation): string {
  const url = new URL(href);
  url.hash = buildCategoryHash(location);
  return url.toString();
}
