export type CategorySummary = {
  id: string;
  name: string;
  file: string;
  tagCount: number;
};

export type DataManifest = {
  version: number;
  categories: CategorySummary[];
  search: {
    chunks: Array<{ id: string; file: string; count: number }>;
    tokenIndexFile?: string;
    totalCount: number;
  };
};

export type TagEntry = {
  id: string;
  categoryId: string;
  categoryName: string;
  path: string[];
  en: string;
  ja: string;
};

export type CategorySection = {
  id: string;
  name: string;
  path: string[];
  tagCount: number;
  tags?: TagEntry[];
  children?: CategorySection[];
};

export type CategoryData = {
  id: string;
  name: string;
  tagCount: number;
  sections: CategorySection[];
};

export type TagSearchEntry = {
  type: "tag";
  id: string;
  categoryId: string;
  categoryName: string;
  path: string[];
  en: string;
  ja: string;
  searchText: string;
};

export type FreeSearchEntry = {
  type: "free";
  id: string;
  tag: string;
  count: number;
  searchText: string;
};

export type SearchEntry = TagSearchEntry | FreeSearchEntry;

export type SearchChunk = {
  id: string;
  entries: SearchEntry[];
};

export type SelectedTag = {
  id: string;
  label: string;
  source: "tag" | "free";
};
