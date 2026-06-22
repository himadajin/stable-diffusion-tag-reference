import { CheckIcon, Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Dialog,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { ChevronRight, Heart, Link2 } from "lucide-react";
import type { CSSProperties, ReactNode, UIEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyText } from "./lib/clipboard";
import { loadCategory, loadManifest } from "./lib/data";
import { entryCopyValue, normalizeQuery, searchEntriesFromChunks } from "./lib/search";
import {
  buildCategoryHash,
  buildCategoryShareUrl,
  type CategoryHashLocation,
  parseCategoryHash,
} from "./lib/share-url";
import type {
  CategoryData,
  CategorySection,
  CategorySummary,
  SearchEntry,
  TagEntry,
} from "./types";

type CopyState = {
  value: string;
};

type VirtualCategoryRow =
  | {
      id: string;
      type: "section";
      depth: number;
      name: string;
      path: string[];
      sectionPath: string[];
      tagCount: number;
    }
  | {
      id: string;
      type: "tag";
      tag: TagEntry;
    };

const DESKTOP_TAG_ROW_HEIGHT = 40;
const MOBILE_TAG_ROW_HEIGHT = 64;
const DESKTOP_CONTEXT_TAG_ROW_HEIGHT = 56;
const MOBILE_CONTEXT_TAG_ROW_HEIGHT = 78;
const DESKTOP_SECTION_ROW_HEIGHT = 32;
const MOBILE_SECTION_ROW_HEIGHT = 36;
const VIRTUAL_OVERSCAN_ROWS = 12;
const FAVORITES_CATEGORY_ID = "favorites";
const FAVORITES_STORAGE_KEY = "prompt-tag-viewer:favorites:v2";

type SectionJump = {
  categoryId: string;
  sectionId: string;
  requestId: number;
};

type HistoryMode = "push" | "replace";

function firstBrowsableCategoryId(categories: CategorySummary[]): string {
  return categories.find((category) => category.tagCount > 0)?.id ?? categories[0]?.id ?? "";
}

function resolveHashCategoryId(
  location: CategoryHashLocation | null,
  categories: CategorySummary[],
): string {
  if (!location || location.categoryId === FAVORITES_CATEGORY_ID) return "";
  return categories.some((category) => category.id === location.categoryId)
    ? location.categoryId
    : "";
}

function writeCategoryHash(location: CategoryHashLocation, mode: HistoryMode) {
  if (!location.categoryId) return;
  const hash = buildCategoryHash(location);
  if (window.location.hash === hash) return;
  const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
  if (mode === "push") {
    window.history.pushState(null, "", nextUrl);
  } else {
    window.history.replaceState(null, "", nextUrl);
  }
}

export function App() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [isCategoryLoading, setIsCategoryLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEntry[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavoriteIds());
  const [copyState, setCopyState] = useState<CopyState | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(() => new Set());
  const [expandedSectionKeys, setExpandedSectionKeys] = useState<Set<string>>(() => new Set());
  const [sidebarCategoryData, setSidebarCategoryData] = useState<Map<string, CategoryData>>(
    () => new Map(),
  );
  const [sectionJump, setSectionJump] = useState<SectionJump | null>(null);
  const [pendingUrlLocation, setPendingUrlLocation] = useState<CategoryHashLocation | null>(null);
  const categoryDataCacheRef = useRef(new Map<string, CategoryData>());
  const isDrawerLayout = useMediaQuery("(max-width: 959px)");
  const useMobileTagRows = useMediaQuery("(max-width: 620px)");

  useEffect(() => {
    loadManifest().then((manifest) => {
      const defaultCategoryId = firstBrowsableCategoryId(manifest.categories);
      const parsedLocation = parseCategoryHash(window.location.hash);
      const categoryId = resolveHashCategoryId(parsedLocation, manifest.categories);
      const nextCategoryId = categoryId || defaultCategoryId;

      setCategories(manifest.categories);
      if (nextCategoryId) {
        setActiveCategoryId((current) => current || nextCategoryId);
      }
      if (parsedLocation?.sectionPath.length && parsedLocation.categoryId === nextCategoryId) {
        setPendingUrlLocation(parsedLocation);
      }
      if (nextCategoryId && (!parsedLocation || parsedLocation.categoryId !== nextCategoryId)) {
        writeCategoryHash({ categoryId: nextCategoryId, sectionPath: [] }, "replace");
      }
    });
  }, []);

  useEffect(() => {
    if (!activeCategoryId || activeCategoryId === FAVORITES_CATEGORY_ID) return;
    let isCurrent = true;
    const cachedCategory = categoryDataCacheRef.current.get(activeCategoryId);
    if (cachedCategory) {
      setCategoryData(cachedCategory);
      setIsCategoryLoading(false);
      return;
    }

    setIsCategoryLoading(true);
    loadCategory(activeCategoryId).then((data) => {
      categoryDataCacheRef.current.set(activeCategoryId, data);
      if (!isCurrent) return;
      setCategoryData(data);
      setIsCategoryLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [activeCategoryId]);

  useEffect(() => {
    if (activeCategoryId !== FAVORITES_CATEGORY_ID) return;
    let isCurrent = true;
    setIsCategoryLoading(true);
    loadFavoritesCategory(categories, favoriteIds).then((data) => {
      if (!isCurrent) return;
      setCategoryData(data);
      setIsCategoryLoading(false);
    });
    return () => {
      isCurrent = false;
    };
  }, [activeCategoryId, categories, favoriteIds]);

  useEffect(() => {
    if (!normalizeQuery(query)) {
      setSearchResults([]);
      setIsSearchLoading(false);
      return;
    }

    let isCurrent = true;
    setIsSearchLoading(true);
    searchEntriesFromChunks(query).then((results) => {
      if (!isCurrent) return;
      setSearchResults(results);
      setIsSearchLoading(false);
    });

    return () => {
      isCurrent = false;
    };
  }, [query]);

  useEffect(() => {
    if (!copyState) return;
    const timeout = window.setTimeout(() => setCopyState(null), 1000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const isSearching = normalizeQuery(query).length > 0;
  const activeCategory = categoryData?.id === activeCategoryId ? categoryData : null;
  const activeShareSectionPath =
    activeCategory && activeCategory.id !== FAVORITES_CATEGORY_ID
      ? (findSectionPathById(activeCategory.sections, activeSectionId) ?? [])
      : [];
  const shareUrl =
    activeCategory && activeCategory.id !== FAVORITES_CATEGORY_ID && !isSearching
      ? buildCategoryShareUrl(window.location.href, {
          categoryId: activeCategory.id,
          sectionPath: activeShareSectionPath,
        })
      : undefined;
  const sidebarCategories = useMemo(
    () => [
      {
        id: FAVORITES_CATEGORY_ID,
        name: "お気に入り",
        file: "",
        tagCount: favoriteIds.size,
      },
      ...categories,
    ],
    [categories, favoriteIds.size],
  );
  const activeSectionKey = activeSectionId ? sectionTreeKey(activeCategoryId, activeSectionId) : "";
  const activeSectionAncestorKeys = useMemo(() => {
    if (
      !activeCategory ||
      activeCategory.id === FAVORITES_CATEGORY_ID ||
      !activeShareSectionPath.length
    ) {
      return new Set<string>();
    }
    return new Set(
      findSectionAncestorIdsByPath(activeCategory.sections, activeShareSectionPath).map(
        (sectionId) => sectionTreeKey(activeCategory.id, sectionId),
      ),
    );
  }, [activeCategory, activeShareSectionPath]);

  const cacheCategoryData = useCallback((data: CategoryData) => {
    categoryDataCacheRef.current.set(data.id, data);
    setSidebarCategoryData((current) => {
      if (current.get(data.id) === data) return current;
      const next = new Map(current);
      next.set(data.id, data);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!categoryData) return;
    cacheCategoryData(categoryData);
  }, [cacheCategoryData, categoryData]);

  useEffect(() => {
    if (!activeCategoryId || activeCategoryId === FAVORITES_CATEGORY_ID) return;
    setExpandedCategoryIds((current) => {
      if (current.has(activeCategoryId)) return current;
      const next = new Set(current);
      next.add(activeCategoryId);
      return next;
    });
  }, [activeCategoryId]);

  const expandSectionPath = useCallback(
    (categoryId: string, sectionPath: string[]) => {
      if (categoryId === FAVORITES_CATEGORY_ID) return;
      setExpandedCategoryIds((current) => {
        const next = new Set(current);
        next.add(categoryId);
        return next;
      });
      setExpandedSectionKeys((current) => {
        const next = new Set(current);
        const category = categoryDataCacheRef.current.get(categoryId) ?? categoryData;
        if (category?.id !== categoryId) return next;
        const ancestorIds = findSectionAncestorIdsByPath(category.sections, sectionPath);
        for (const sectionId of ancestorIds) {
          next.add(sectionTreeKey(categoryId, sectionId));
        }
        return next;
      });
    },
    [categoryData],
  );

  async function copyValue(value: string) {
    await copyText(value);
    setCopyState({ value });
  }

  async function copyShareUrl(value: string) {
    await copyText(value);
    setCopyState({ value });
  }

  async function openTagContext(entry: Extract<SearchEntry, { type: "tag" }>) {
    const data = await loadCategory(entry.categoryId);
    cacheCategoryData(data);
    const sectionId = findSectionIdBySectionPath(data.sections, entry.sectionPath) ?? "";
    setActiveCategoryId(entry.categoryId);
    setQuery("");
    setActiveSectionId(sectionId);
    expandSectionPath(entry.categoryId, entry.sectionPath);
    writeCategoryHash(
      {
        categoryId: entry.categoryId,
        sectionPath: sectionId ? entry.sectionPath : [],
      },
      "push",
    );
    if (sectionId) {
      setSectionJump((current) => ({
        categoryId: entry.categoryId,
        sectionId,
        requestId: (current?.requestId ?? 0) + 1,
      }));
    }
    if (isDrawerLayout) setIsSidebarOpen(false);
  }

  function toggleFavorite(tag: TagEntry) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (next.has(tag.id)) {
        next.delete(tag.id);
      } else {
        next.add(tag.id);
      }
      writeFavoriteIds(next);
      return next;
    });
  }

  function selectCategoryFromSidebar(categoryId: string) {
    const cachedCategory = categoryDataCacheRef.current.get(categoryId);
    if (cachedCategory) setCategoryData(cachedCategory);
    setActiveCategoryId(categoryId);
    setQuery("");
    setActiveSectionId("");
    if (categoryId !== FAVORITES_CATEGORY_ID) {
      setExpandedCategoryIds((current) => {
        const next = new Set(current);
        next.add(categoryId);
        return next;
      });
      writeCategoryHash({ categoryId, sectionPath: [] }, "push");
    }
    if (isDrawerLayout) setIsSidebarOpen(false);
  }

  async function jumpToSection(categoryId: string, sectionId: string) {
    const category =
      categoryDataCacheRef.current.get(categoryId) ??
      (categoryId === categoryData?.id ? categoryData : await loadCategory(categoryId));
    cacheCategoryData(category);
    const sectionPath =
      category?.id === categoryId ? (findSectionPathById(category.sections, sectionId) ?? []) : [];

    setCategoryData(category);
    setActiveCategoryId(categoryId);
    setQuery("");
    setActiveSectionId(sectionId);
    expandSectionPath(categoryId, sectionPath);
    writeCategoryHash({ categoryId, sectionPath }, "push");
    setSectionJump((current) => ({
      categoryId,
      sectionId,
      requestId: (current?.requestId ?? 0) + 1,
    }));
    if (isDrawerLayout) setIsSidebarOpen(false);
  }

  async function toggleCategoryBranch(categoryId: string) {
    if (categoryId === FAVORITES_CATEGORY_ID) return;
    if (!categoryDataCacheRef.current.has(categoryId)) {
      const data = await loadCategory(categoryId);
      cacheCategoryData(data);
    }
    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  }

  function toggleSectionBranch(categoryId: string, sectionId: string) {
    const key = sectionTreeKey(categoryId, sectionId);
    setExpandedSectionKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  const restoreLocationFromHash = useCallback(() => {
    if (categories.length === 0) return;

    const parsedLocation = parseCategoryHash(window.location.hash);
    const defaultCategoryId = firstBrowsableCategoryId(categories);
    const categoryId = resolveHashCategoryId(parsedLocation, categories) || defaultCategoryId;
    if (!categoryId) return;

    const sectionPath = parsedLocation?.categoryId === categoryId ? parsedLocation.sectionPath : [];
    setPendingUrlLocation(sectionPath.length ? { categoryId, sectionPath } : null);

    const cachedCategory = categoryDataCacheRef.current.get(categoryId);
    if (cachedCategory) setCategoryData(cachedCategory);
    setActiveCategoryId(categoryId);
    setQuery("");
    setExpandedCategoryIds((current) => {
      const next = new Set(current);
      next.add(categoryId);
      return next;
    });

    if (sectionPath.length === 0) {
      setActiveSectionId("");
    }

    if (!parsedLocation || parsedLocation.categoryId !== categoryId) {
      writeCategoryHash({ categoryId, sectionPath: [] }, "replace");
    }

    if (isDrawerLayout) setIsSidebarOpen(false);
  }, [categories, isDrawerLayout]);

  useEffect(() => {
    if (categories.length === 0) return;
    window.addEventListener("popstate", restoreLocationFromHash);
    window.addEventListener("hashchange", restoreLocationFromHash);
    return () => {
      window.removeEventListener("popstate", restoreLocationFromHash);
      window.removeEventListener("hashchange", restoreLocationFromHash);
    };
  }, [categories.length, restoreLocationFromHash]);

  useEffect(() => {
    if (!pendingUrlLocation || categoryData?.id !== pendingUrlLocation.categoryId) return;

    const sectionId = findSectionIdBySectionPath(
      categoryData.sections,
      pendingUrlLocation.sectionPath,
    );
    setPendingUrlLocation(null);

    if (!sectionId) {
      setActiveSectionId("");
      writeCategoryHash({ categoryId: pendingUrlLocation.categoryId, sectionPath: [] }, "replace");
      return;
    }

    setActiveSectionId(sectionId);
    expandSectionPath(pendingUrlLocation.categoryId, pendingUrlLocation.sectionPath);
    writeCategoryHash(pendingUrlLocation, "replace");
    setSectionJump((current) => ({
      categoryId: pendingUrlLocation.categoryId,
      sectionId,
      requestId: (current?.requestId ?? 0) + 1,
    }));
  }, [categoryData, expandSectionPath, pendingUrlLocation]);

  const updateVisibleSection = useCallback(
    (_topSectionId: string, sectionId: string) => {
      setActiveSectionId(sectionId);

      if (pendingUrlLocation || normalizeQuery(query)) return;
      if (!activeCategoryId || activeCategoryId === FAVORITES_CATEGORY_ID) return;

      const category = categoryDataCacheRef.current.get(activeCategoryId) ?? categoryData;
      if (category?.id !== activeCategoryId) return;

      writeCategoryHash(
        {
          categoryId: activeCategoryId,
          sectionPath: findSectionPathById(category.sections, sectionId) ?? [],
        },
        "replace",
      );
    },
    [activeCategoryId, categoryData, pendingUrlLocation, query],
  );

  return (
    <div className="app-shell">
      <div className="app-layout">
        <div className="desktop-sidebar">
          <CategorySidebar
            categories={sidebarCategories}
            activeCategory={activeCategory}
            activeCategoryId={activeCategoryId}
            activeSectionId={activeSectionId}
            activeSectionAncestorKeys={activeSectionAncestorKeys}
            activeSectionKey={activeSectionKey}
            categoryDataById={sidebarCategoryData}
            expandedCategoryIds={expandedCategoryIds}
            expandedSectionKeys={expandedSectionKeys}
            onSelect={selectCategoryFromSidebar}
            onSelectSection={jumpToSection}
            onToggleCategory={toggleCategoryBranch}
            onToggleSection={toggleSectionBranch}
          />
        </div>
        <Dialog.Root open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <Dialog.Content className="sidebar-drawer-content" aria-describedby={undefined}>
            <Flex align="center" justify="between" px="4" py="3">
              <Heading size="3">カテゴリ</Heading>
              <Dialog.Close>
                <IconButton aria-label="カテゴリを閉じる" color="gray" size="1" variant="ghost">
                  <Cross2Icon />
                </IconButton>
              </Dialog.Close>
            </Flex>
            <CategorySidebar
              categories={sidebarCategories}
              activeCategory={activeCategory}
              activeCategoryId={activeCategoryId}
              activeSectionId={activeSectionId}
              activeSectionAncestorKeys={activeSectionAncestorKeys}
              activeSectionKey={activeSectionKey}
              categoryDataById={sidebarCategoryData}
              expandedCategoryIds={expandedCategoryIds}
              expandedSectionKeys={expandedSectionKeys}
              onSelect={selectCategoryFromSidebar}
              onSelectSection={jumpToSection}
              onToggleCategory={toggleCategoryBranch}
              onToggleSection={toggleSectionBranch}
            />
          </Dialog.Content>
        </Dialog.Root>
        <MainPanel
          activeSectionId={activeSectionId}
          categoryData={categoryData}
          copyState={copyState}
          favoriteIds={favoriteIds}
          isCategoryLoading={isCategoryLoading}
          isSearching={isSearching}
          isSearchLoading={isSearchLoading}
          onCopy={copyValue}
          onCopyShareUrl={copyShareUrl}
          onOpenTagContext={openTagContext}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onQueryChange={setQuery}
          onToggleFavorite={toggleFavorite}
          onVisibleSectionChange={updateVisibleSection}
          query={query}
          searchResults={searchResults}
          sectionJump={sectionJump}
          shareCopied={copyState?.value === shareUrl}
          shareUrl={shareUrl}
          useMobileTagRows={useMobileTagRows}
        />
      </div>
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia(query);
    const updateMatches = () => setMatches(mediaQuery.matches);
    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);
    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, [query]);

  return matches;
}

function useDelayedFlag(value: boolean, delayMs: number): boolean {
  const [delayedValue, setDelayedValue] = useState(false);

  useEffect(() => {
    if (!value) {
      setDelayedValue(false);
      return;
    }

    const timeout = window.setTimeout(() => setDelayedValue(true), delayMs);
    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return delayedValue;
}

function readFavoriteIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return new Set();
  }
}

function writeFavoriteIds(ids: Set<string>) {
  window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids]));
}

async function loadFavoritesCategory(
  categories: CategorySummary[],
  favoriteIds: Set<string>,
): Promise<CategoryData> {
  if (favoriteIds.size === 0) {
    return { id: FAVORITES_CATEGORY_ID, name: "お気に入り", tagCount: 0, sections: [] };
  }

  const sourceCategories = await Promise.all(
    categories.map((category) => loadCategory(category.id)),
  );
  const sections = sourceCategories
    .map((category) => {
      const tags = flattenCategoryRows(category.sections)
        .filter((row): row is Extract<VirtualCategoryRow, { type: "tag" }> => row.type === "tag")
        .map((row) => row.tag)
        .filter((tag) => favoriteIds.has(tag.id));

      return {
        id: `favorites__${category.id}`,
        name: category.name,
        path: [category.name],
        sectionPath: [category.id],
        tagCount: tags.length,
        tags,
      };
    })
    .filter((section) => section.tagCount > 0);

  return {
    id: FAVORITES_CATEGORY_ID,
    name: "お気に入り",
    tagCount: sections.reduce((total, section) => total + section.tagCount, 0),
    sections,
  };
}

function MainPanel({
  activeSectionId,
  categoryData,
  copyState,
  favoriteIds,
  isCategoryLoading,
  isSearching,
  isSearchLoading,
  onCopy,
  onCopyShareUrl,
  onOpenTagContext,
  onOpenSidebar,
  onQueryChange,
  onToggleFavorite,
  onVisibleSectionChange,
  query,
  searchResults,
  sectionJump,
  shareCopied,
  shareUrl,
  useMobileTagRows,
}: {
  activeSectionId: string;
  categoryData: CategoryData | null;
  copyState: CopyState | null;
  favoriteIds: Set<string>;
  isCategoryLoading: boolean;
  isSearching: boolean;
  isSearchLoading: boolean;
  onCopy: (value: string) => void;
  onCopyShareUrl: (value: string) => void;
  onOpenTagContext: (entry: Extract<SearchEntry, { type: "tag" }>) => void;
  onOpenSidebar: () => void;
  onQueryChange: (query: string) => void;
  onToggleFavorite: (tag: TagEntry) => void;
  onVisibleSectionChange: (topSectionId: string, sectionId: string) => void;
  query: string;
  searchResults: SearchEntry[];
  sectionJump: SectionJump | null;
  shareCopied: boolean;
  shareUrl?: string;
  useMobileTagRows: boolean;
}) {
  const showCategoryLoading = useDelayedFlag(isCategoryLoading, 300);

  return (
    <main className="main-panel" aria-label="タグ一覧">
      <DictionaryHeader
        category={categoryData}
        activeSectionId={activeSectionId}
        isCategoryLoading={showCategoryLoading}
        isSearchLoading={isSearchLoading}
        isSearching={isSearching}
        onOpenSidebar={onOpenSidebar}
        onCopyShareUrl={onCopyShareUrl}
        onQueryChange={onQueryChange}
        query={query}
        resultCount={searchResults.length}
        shareCopied={shareCopied}
        shareUrl={shareUrl}
      />
      {isSearching ? (
        <SearchResults
          results={searchResults}
          query={query}
          onCopy={onCopy}
          onOpenTagContext={onOpenTagContext}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          copyValue={copyState?.value}
        />
      ) : categoryData ? (
        <CategoryView
          category={categoryData}
          onCopy={onCopy}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          onVisibleSectionChange={onVisibleSectionChange}
          copyValue={copyState?.value}
          sectionJump={sectionJump}
          useMobileTagRows={useMobileTagRows}
        />
      ) : (
        <Box p="4">
          <Text color="gray">データを読み込んでいます。</Text>
        </Box>
      )}
    </main>
  );
}

function CategorySidebar({
  categories,
  activeCategory,
  activeCategoryId,
  activeSectionId,
  activeSectionAncestorKeys,
  activeSectionKey,
  categoryDataById,
  expandedCategoryIds,
  expandedSectionKeys,
  onSelect,
  onSelectSection,
  onToggleCategory,
  onToggleSection,
}: {
  categories: CategorySummary[];
  activeCategory: CategoryData | null;
  activeCategoryId: string;
  activeSectionId: string;
  activeSectionAncestorKeys: Set<string>;
  activeSectionKey: string;
  categoryDataById: Map<string, CategoryData>;
  expandedCategoryIds: Set<string>;
  expandedSectionKeys: Set<string>;
  onSelect: (categoryId: string) => void;
  onSelectSection: (categoryId: string, sectionId: string) => void;
  onToggleCategory: (categoryId: string) => void;
  onToggleSection: (categoryId: string, sectionId: string) => void;
}) {
  return (
    <aside className="sidebar" aria-label="カテゴリ">
      <Flex align="baseline" justify="between" px="4" py="3">
        <Heading size="3">Categories</Heading>
        <Badge variant="soft" color="gray">
          {categories.length}
        </Badge>
      </Flex>
      <ScrollArea className="sidebar-scroll" scrollbars="vertical">
        <Flex direction="column" gap="1" px="2" pb="3">
          {categories.map((category) => {
            const isActive = category.id === activeCategoryId;
            const categoryData =
              categoryDataById.get(category.id) ?? (isActive ? activeCategory : null);
            const canExpand = category.id !== FAVORITES_CATEGORY_ID;
            const isExpanded =
              canExpand && expandedCategoryIds.has(category.id) && Boolean(categoryData);
            return (
              <div className="category-tree-item" key={category.id}>
                <div className="tree-node-row category-node-row">
                  {canExpand ? (
                    <button
                      aria-label={`${category.name} を${isExpanded ? "閉じる" : "開く"}`}
                      aria-expanded={isExpanded}
                      className="tree-disclosure-button"
                      onClick={() => onToggleCategory(category.id)}
                      type="button"
                    >
                      <ChevronRight aria-hidden="true" size={14} strokeWidth={2} />
                    </button>
                  ) : (
                    <span className="tree-disclosure-spacer" />
                  )}
                  <button
                    className="tree-node-button category-button"
                    data-active={isActive && !activeSectionId && !isExpanded}
                    data-ancestor={isActive && (Boolean(activeSectionId) || isExpanded)}
                    data-current-child={isActive && !isExpanded}
                    onClick={() =>
                      canExpand ? onToggleCategory(category.id) : onSelect(category.id)
                    }
                    type="button"
                  >
                    <span className="tree-node-label">{category.name}</span>
                    <span className="category-count">{category.tagCount.toLocaleString()}</span>
                  </button>
                </div>
                {isExpanded && categoryData?.sections.length ? (
                  <nav className="section-tree" aria-label={`${category.name} のサブカテゴリ`}>
                    <div
                      className="tree-node-row section-node-row"
                      style={{ "--tree-depth": 0 } as CSSProperties}
                    >
                      <span className="tree-disclosure-spacer" />
                      <button
                        className="tree-node-button section-tree-button tree-overview-button"
                        data-active={isActive && !activeSectionId}
                        onClick={() => onSelect(category.id)}
                        type="button"
                      >
                        <span className="tree-node-label">カテゴリ全体</span>
                        <span className="category-count">{category.tagCount.toLocaleString()}</span>
                      </button>
                    </div>
                    {categoryData.sections.map((section) => (
                      <SectionTreeNode
                        activeSectionAncestorKeys={activeSectionAncestorKeys}
                        activeSectionKey={activeSectionKey}
                        categoryId={category.id}
                        depth={0}
                        expandedSectionKeys={expandedSectionKeys}
                        key={section.id}
                        onSelectSection={onSelectSection}
                        onToggleSection={onToggleSection}
                        section={section}
                      />
                    ))}
                  </nav>
                ) : null}
              </div>
            );
          })}
        </Flex>
      </ScrollArea>
    </aside>
  );
}

function SectionTreeNode({
  activeSectionAncestorKeys,
  activeSectionKey,
  categoryId,
  depth,
  expandedSectionKeys,
  onSelectSection,
  onToggleSection,
  section,
}: {
  activeSectionAncestorKeys: Set<string>;
  activeSectionKey: string;
  categoryId: string;
  depth: number;
  expandedSectionKeys: Set<string>;
  onSelectSection: (categoryId: string, sectionId: string) => void;
  onToggleSection: (categoryId: string, sectionId: string) => void;
  section: CategorySection;
}) {
  const sectionKey = sectionTreeKey(categoryId, section.id);
  const hasChildren = Boolean(section.children?.length);
  const isSelected = sectionKey === activeSectionKey;
  const isAncestor = activeSectionAncestorKeys.has(sectionKey) && !isSelected;
  const isExpanded = hasChildren && expandedSectionKeys.has(sectionKey);
  const isBranchContext = hasChildren && (isAncestor || isSelected);

  return (
    <div className="section-tree-group">
      <div
        className="tree-node-row section-node-row"
        style={{ "--tree-depth": depth } as CSSProperties}
      >
        {hasChildren ? (
          <button
            aria-label={`${section.name} を${isExpanded ? "閉じる" : "開く"}`}
            aria-expanded={isExpanded}
            className="tree-disclosure-button"
            onClick={() => onToggleSection(categoryId, section.id)}
            type="button"
          >
            <ChevronRight aria-hidden="true" size={14} strokeWidth={2} />
          </button>
        ) : (
          <span className="tree-disclosure-spacer" />
        )}
        <button
          className="tree-node-button section-tree-button"
          data-active={isSelected && (!hasChildren || !isExpanded)}
          data-ancestor={isBranchContext && isExpanded}
          data-current-child={isBranchContext && !isExpanded}
          onClick={() =>
            hasChildren
              ? onToggleSection(categoryId, section.id)
              : onSelectSection(categoryId, section.id)
          }
          type="button"
        >
          <span className="tree-node-label">{section.name}</span>
          <span className="category-count">{section.tagCount.toLocaleString()}</span>
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <div className="section-tree-children">
          <div
            className="tree-node-row section-node-row"
            style={{ "--tree-depth": depth + 1 } as CSSProperties}
          >
            <span className="tree-disclosure-spacer" />
            <button
              className="tree-node-button section-tree-button tree-overview-button"
              data-active={isSelected}
              onClick={() => onSelectSection(categoryId, section.id)}
              type="button"
            >
              <span className="tree-node-label">セクション全体</span>
              <span className="category-count">{section.tagCount.toLocaleString()}</span>
            </button>
          </div>
          {section.children?.map((child) => (
            <SectionTreeNode
              activeSectionAncestorKeys={activeSectionAncestorKeys}
              activeSectionKey={activeSectionKey}
              categoryId={categoryId}
              depth={depth + 1}
              expandedSectionKeys={expandedSectionKeys}
              key={child.id}
              onSelectSection={onSelectSection}
              onToggleSection={onToggleSection}
              section={child}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DictionaryHeader({
  activeSectionId,
  category,
  isCategoryLoading,
  isSearchLoading,
  isSearching,
  onCopyShareUrl,
  onOpenSidebar,
  query,
  onQueryChange,
  resultCount,
  shareCopied,
  shareUrl,
}: {
  activeSectionId: string;
  category: CategoryData | null;
  isCategoryLoading: boolean;
  isSearchLoading: boolean;
  isSearching: boolean;
  onCopyShareUrl: (value: string) => void;
  onOpenSidebar: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  resultCount: number;
  shareCopied: boolean;
  shareUrl?: string;
}) {
  const breadcrumb =
    category && category.id !== FAVORITES_CATEGORY_ID
      ? (findSectionPath(category.sections, activeSectionId) ?? [category.name])
      : [category?.name ?? "タグ"];
  const title = isSearching ? "検索結果" : breadcrumb.join(" / ");
  const count = isSearching ? undefined : category?.tagCount;

  return (
    <header className="dictionary-header">
      <div className="dictionary-header-top">
        <div className="dictionary-title-group">
          <button className="mobile-category-button" type="button" onClick={onOpenSidebar}>
            カテゴリ
          </button>
          <Heading size="5">{title}</Heading>
          {isSearching ? (
            <Text color="gray" size="2">
              {query}
            </Text>
          ) : null}
        </div>
        <div className="dictionary-header-actions">
          <Text className="dictionary-count" color="gray" size="2">
            {isSearching ? `${resultCount.toLocaleString()} results` : `${count ?? 0} tags`}
          </Text>
          {shareUrl ? (
            <Tooltip
              content={shareCopied ? "共有URLをコピーしました" : "現在位置の共有URLをコピー"}
            >
              <IconButton
                aria-label="現在位置の共有URLをコピー"
                className="share-url-button"
                color={shareCopied ? "indigo" : "gray"}
                size="1"
                variant="ghost"
                onClick={() => onCopyShareUrl(shareUrl)}
              >
                {shareCopied ? (
                  <CheckIcon aria-hidden="true" />
                ) : (
                  <Link2 aria-hidden="true" size={14} strokeWidth={2} />
                )}
              </IconButton>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <div className="dictionary-search-row">
        <Box className="search-field">
          <TextField.Root
            aria-label="タグ検索"
            placeholder="全カテゴリから検索"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
          >
            <TextField.Slot>
              <MagnifyingGlassIcon />
            </TextField.Slot>
            {query ? (
              <TextField.Slot>
                <Tooltip content="検索をクリア">
                  <IconButton
                    aria-label="検索をクリア"
                    size="1"
                    variant="ghost"
                    color="gray"
                    onClick={() => onQueryChange("")}
                  >
                    <Cross2Icon />
                  </IconButton>
                </Tooltip>
              </TextField.Slot>
            ) : null}
          </TextField.Root>
        </Box>
        {isSearchLoading ? (
          <Text className="search-loading-text" color="gray" size="1">
            検索データを読み込み中
          </Text>
        ) : isCategoryLoading && !isSearching ? (
          <Text className="search-loading-text" color="gray" size="1" role="status">
            カテゴリを読み込み中
          </Text>
        ) : null}
      </div>
    </header>
  );
}

function CategoryView({
  category,
  onCopy,
  favoriteIds,
  onToggleFavorite,
  onVisibleSectionChange,
  copyValue,
  sectionJump,
  useMobileTagRows,
}: {
  category: CategoryData;
  onCopy: (value: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (tag: TagEntry) => void;
  onVisibleSectionChange: (topSectionId: string, sectionId: string) => void;
  copyValue?: string;
  sectionJump: SectionJump | null;
  useMobileTagRows: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const hasUserScrolledRef = useRef(false);
  const ignoreNextScrollRef = useRef(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const rows = useMemo(() => flattenCategoryRows(category.sections), [category.sections]);
  const showContext = category.id === FAVORITES_CATEGORY_ID;
  const rowMetrics = useMemo(
    () => collectRowMetrics(rows, useMobileTagRows, showContext),
    [rows, showContext, useMobileTagRows],
  );
  const sectionPositions = useMemo(() => collectSectionPositions(rows), [rows]);
  const currentRowIndex = findRowIndexAtScrollTop(rowMetrics, scrollTop);
  const currentPosition = findCurrentSectionPosition(sectionPositions, currentRowIndex);
  const categoryId = category.id;

  useEffect(() => {
    if (!categoryId) return;
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    hasUserScrolledRef.current = false;
    ignoreNextScrollRef.current = true;
    scrollElement.scrollTop = 0;
    setScrollTop(0);
  }, [categoryId]);

  useEffect(() => {
    if (!sectionJump || sectionJump.categoryId !== categoryId) return;
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const position = sectionPositions.find((section) => section.id === sectionJump.sectionId);
    if (!position) return;
    const nextScrollTop = rowMetrics.tops[position.index] ?? 0;
    hasUserScrolledRef.current = false;
    ignoreNextScrollRef.current = true;
    scrollElement.scrollTop = nextScrollTop;
    setScrollTop(nextScrollTop);
  }, [categoryId, rowMetrics.tops, sectionJump, sectionPositions]);

  useEffect(() => {
    if (!hasUserScrolledRef.current) return;
    onVisibleSectionChange(currentPosition?.topSectionId ?? "", currentPosition?.id ?? "");
  }, [currentPosition?.id, currentPosition?.topSectionId, onVisibleSectionChange]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const updateViewportHeight = () => setViewportHeight(scrollElement.clientHeight || 720);
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, []);

  const startIndex = Math.max(0, currentRowIndex - VIRTUAL_OVERSCAN_ROWS);
  const endIndex = findVisibleEndIndex(
    rowMetrics,
    scrollTop + viewportHeight,
    VIRTUAL_OVERSCAN_ROWS,
  );
  const visibleRows = rows.slice(startIndex, endIndex);
  const topOffset = rowMetrics.tops[startIndex] ?? 0;
  const totalHeight = rowMetrics.totalHeight;
  const handleScroll = useCallback((event: UIEvent<HTMLDivElement>) => {
    if (ignoreNextScrollRef.current) {
      ignoreNextScrollRef.current = false;
    } else {
      hasUserScrolledRef.current = true;
    }
    setScrollTop(event.currentTarget.scrollTop);
  }, []);

  return (
    <section className="category-view">
      {category.id === FAVORITES_CATEGORY_ID && category.tagCount === 0 ? (
        <Box px="5" py="4">
          <Text color="gray">お気に入りに追加したタグはここに表示されます。</Text>
        </Box>
      ) : null}
      <div className="virtual-category-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="virtual-category-list" style={{ height: totalHeight }}>
          <div
            className="virtual-category-window"
            style={{ transform: `translateY(${topOffset}px)` }}
          >
            {visibleRows.map((row) =>
              row.type === "section" ? (
                <VirtualSectionRow
                  depth={row.depth}
                  key={row.id}
                  name={row.name}
                  tagCount={row.tagCount}
                  useMobileTagRows={useMobileTagRows}
                />
              ) : useMobileTagRows ? (
                <VirtualMobileTagRow
                  copyValue={copyValue}
                  favoriteIds={favoriteIds}
                  key={row.id}
                  onCopy={onCopy}
                  onToggleFavorite={onToggleFavorite}
                  showContext={showContext}
                  tag={row.tag}
                />
              ) : (
                <VirtualDesktopTagRow
                  copyValue={copyValue}
                  favoriteIds={favoriteIds}
                  key={row.id}
                  onCopy={onCopy}
                  onToggleFavorite={onToggleFavorite}
                  showContext={showContext}
                  tag={row.tag}
                />
              ),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function flattenCategoryRows(sections: CategorySection[], depth = 0): VirtualCategoryRow[] {
  return sections.flatMap((section) => {
    const rows: VirtualCategoryRow[] = [
      {
        id: section.id,
        type: "section",
        depth,
        name: section.name,
        path: section.path,
        sectionPath: section.sectionPath,
        tagCount: section.tagCount,
      },
    ];

    if (section.tags?.length) {
      rows.push(...section.tags.map((tag) => ({ id: tag.id, type: "tag" as const, tag })));
    }

    if (section.children?.length) {
      rows.push(...flattenCategoryRows(section.children, depth + 1));
    }

    return rows;
  });
}

function findSectionPath(sections: CategorySection[], sectionId: string): string[] | null {
  if (!sectionId) return null;
  for (const section of sections) {
    if (section.id === sectionId) return section.path;
    const childPath = findSectionPath(section.children ?? [], sectionId);
    if (childPath) return childPath;
  }
  return null;
}

function findSectionIdBySectionPath(
  sections: CategorySection[],
  sectionPath: string[],
): string | null {
  for (const section of sections) {
    if (
      section.sectionPath.length === sectionPath.length &&
      section.sectionPath.every((part, index) => part === sectionPath[index])
    ) {
      return section.id;
    }
    const childId = findSectionIdBySectionPath(section.children ?? [], sectionPath);
    if (childId) return childId;
  }
  return null;
}

function findSectionPathById(sections: CategorySection[], sectionId: string): string[] | null {
  if (!sectionId) return null;
  for (const section of sections) {
    if (section.id === sectionId) return section.sectionPath;
    const childPath = findSectionPathById(section.children ?? [], sectionId);
    if (childPath) return childPath;
  }
  return null;
}

function findSectionAncestorIdsByPath(
  sections: CategorySection[],
  sectionPath: string[],
): string[] {
  if (sectionPath.length <= 1) return [];
  for (const section of sections) {
    if (section.sectionPath[0] !== sectionPath[0]) continue;
    if (
      section.sectionPath.length < sectionPath.length &&
      section.sectionPath.every((part, index) => part === sectionPath[index])
    ) {
      return [section.id, ...findSectionAncestorIdsByPath(section.children ?? [], sectionPath)];
    }
  }
  return [];
}

function sectionTreeKey(categoryId: string, sectionId: string): string {
  return `${categoryId}:${sectionId}`;
}

type RowMetrics = {
  heights: number[];
  tops: number[];
  totalHeight: number;
};

function collectRowMetrics(
  rows: VirtualCategoryRow[],
  useMobileTagRows: boolean,
  showContext: boolean,
): RowMetrics {
  let totalHeight = 0;
  const heights: number[] = [];
  const tops: number[] = [];
  for (const row of rows) {
    tops.push(totalHeight);
    const height = rowHeight(row, useMobileTagRows, showContext);
    heights.push(height);
    totalHeight += height;
  }
  return { heights, tops, totalHeight };
}

function rowHeight(row: VirtualCategoryRow, useMobileTagRows: boolean, showContext: boolean) {
  if (row.type === "section") {
    return useMobileTagRows ? MOBILE_SECTION_ROW_HEIGHT : DESKTOP_SECTION_ROW_HEIGHT;
  }
  if (showContext) {
    return useMobileTagRows ? MOBILE_CONTEXT_TAG_ROW_HEIGHT : DESKTOP_CONTEXT_TAG_ROW_HEIGHT;
  }
  return useMobileTagRows ? MOBILE_TAG_ROW_HEIGHT : DESKTOP_TAG_ROW_HEIGHT;
}

function findRowIndexAtScrollTop(metrics: RowMetrics, scrollTop: number): number {
  let low = 0;
  let high = metrics.tops.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const top = metrics.tops[mid] ?? 0;
    const bottom = top + (metrics.heights[mid] ?? 0);
    if (scrollTop < top) {
      high = mid - 1;
    } else if (scrollTop >= bottom) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return Math.max(0, Math.min(metrics.tops.length - 1, low));
}

function findVisibleEndIndex(metrics: RowMetrics, viewportBottom: number, overscanRows: number) {
  const visibleEnd = findRowIndexAtScrollTop(metrics, viewportBottom);
  return Math.min(metrics.tops.length, visibleEnd + overscanRows);
}

type SectionPosition = {
  id: string;
  index: number;
  depth: number;
  path: string[];
  sectionPath: string[];
  topSectionId: string;
};

function collectSectionPositions(rows: VirtualCategoryRow[]): SectionPosition[] {
  let topSectionId = "";
  return rows.flatMap((row, index) => {
    if (row.type !== "section") return [];
    if (row.depth === 0) topSectionId = row.id;
    return [
      {
        id: row.id,
        index,
        depth: row.depth,
        path: row.path,
        sectionPath: row.sectionPath,
        topSectionId,
      },
    ];
  });
}

function findCurrentSectionPosition(
  sectionPositions: SectionPosition[],
  rowIndex: number,
): SectionPosition | null {
  let current: SectionPosition | null = null;
  for (const section of sectionPositions) {
    if (section.index > rowIndex) break;
    current = section;
  }
  return current;
}

function VirtualSectionRow({
  depth,
  name,
  tagCount,
  useMobileTagRows,
}: {
  depth: number;
  name: string;
  tagCount: number;
  useMobileTagRows: boolean;
}) {
  return (
    <div
      className={
        useMobileTagRows ? "virtual-section-row virtual-section-row-mobile" : "virtual-section-row"
      }
      style={{ "--section-depth": depth } as CSSProperties}
    >
      <Text size={useMobileTagRows ? "2" : "1"} weight="medium">
        {name}
      </Text>
      <Text color="gray" size="1">
        {tagCount.toLocaleString()}
      </Text>
    </div>
  );
}

function VirtualDesktopTagRow({
  tag,
  onCopy,
  favoriteIds,
  onToggleFavorite,
  copyValue,
  showContext,
}: {
  tag: TagEntry;
  onCopy: (value: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
  showContext: boolean;
}) {
  return (
    <div className="virtual-tag-row" data-context={showContext}>
      <FavoriteButton
        isFavorite={favoriteIds.has(tag.id)}
        tag={tag}
        onToggleFavorite={onToggleFavorite}
      />
      <div className="tag-copy-cell">
        <TagCopyButton copied={copyValue === tag.en} value={tag.en} onCopy={onCopy} />
      </div>
      <div className="tag-text-cell">
        <Text size="2">{tag.ja}</Text>
        {showContext ? (
          <Text color="gray" size="1">
            {tag.categoryName} / {tag.path.join(" / ")}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

function VirtualMobileTagRow({
  tag,
  onCopy,
  favoriteIds,
  onToggleFavorite,
  copyValue,
  showContext,
}: {
  tag: TagEntry;
  onCopy: (value: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
  showContext: boolean;
}) {
  return (
    <div className="virtual-mobile-tag-row" data-context={showContext}>
      <FavoriteButton
        isFavorite={favoriteIds.has(tag.id)}
        tag={tag}
        onToggleFavorite={onToggleFavorite}
      />
      <div className="mobile-tag-main">
        <TagCopyButton copied={copyValue === tag.en} value={tag.en} onCopy={onCopy} />
        <Text size="2">{tag.ja}</Text>
        {showContext ? (
          <Text color="gray" size="1">
            {tag.categoryName} / {tag.path.join(" / ")}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

function SearchResults({
  results,
  query,
  onCopy,
  onOpenTagContext,
  favoriteIds,
  onToggleFavorite,
  copyValue,
}: {
  results: SearchEntry[];
  query: string;
  onCopy: (value: string) => void;
  onOpenTagContext: (entry: Extract<SearchEntry, { type: "tag" }>) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
}) {
  const tagResults = results.filter(
    (entry): entry is Extract<SearchEntry, { type: "tag" }> => entry.type === "tag",
  );
  const freeResults = results.filter(
    (entry): entry is Extract<SearchEntry, { type: "free" }> => entry.type === "free",
  );

  return (
    <ScrollArea className="content-scroll" scrollbars="vertical">
      <Box px="5" py="4">
        {results.length === 0 ? (
          <Text color="gray">「{query}」に一致するタグはありません。</Text>
        ) : (
          <div className="search-groups">
            <SearchResultGroup title="タグ" count={tagResults.length}>
              {tagResults.map((entry) => (
                <SearchResultRow
                  copyValue={copyValue}
                  entry={entry}
                  favoriteIds={favoriteIds}
                  key={entry.id}
                  onCopy={onCopy}
                  onOpenTagContext={onOpenTagContext}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </SearchResultGroup>
            <SearchResultGroup title="自由入力候補" count={freeResults.length}>
              {freeResults.map((entry) => (
                <SearchResultRow
                  copyValue={copyValue}
                  entry={entry}
                  favoriteIds={favoriteIds}
                  key={entry.id}
                  onCopy={onCopy}
                  onOpenTagContext={onOpenTagContext}
                  onToggleFavorite={onToggleFavorite}
                />
              ))}
            </SearchResultGroup>
          </div>
        )}
      </Box>
    </ScrollArea>
  );
}

function SearchResultGroup({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="search-result-group">
      <div className="search-result-group-heading">
        <Text size="1" weight="medium">
          {title}
        </Text>
        <Text color="gray" size="1">
          {count.toLocaleString()}
        </Text>
      </div>
      <ul className="search-result-list">{children}</ul>
    </section>
  );
}

function SearchResultRow({
  entry,
  onCopy,
  favoriteIds,
  onOpenTagContext,
  onToggleFavorite,
  copyValue,
}: {
  entry: SearchEntry;
  onCopy: (value: string) => void;
  favoriteIds: Set<string>;
  onOpenTagContext: (entry: Extract<SearchEntry, { type: "tag" }>) => void;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
}) {
  const value = entryCopyValue(entry);
  const isTag = entry.type === "tag";

  return (
    <li className="search-result-row">
      {isTag ? (
        <FavoriteButton
          isFavorite={favoriteIds.has(entry.id)}
          tag={entry}
          onToggleFavorite={onToggleFavorite}
        />
      ) : (
        <span aria-hidden="true" />
      )}
      <div className="tag-copy-cell">
        <TagCopyButton copied={copyValue === value} value={value} onCopy={onCopy} />
      </div>
      <div className="tag-text-cell">
        <Text size="2">{isTag ? entry.ja : `自由入力候補 / ${entry.count.toLocaleString()}`}</Text>
        {isTag ? (
          <button className="context-link" type="button" onClick={() => onOpenTagContext(entry)}>
            {entry.categoryName} / {entry.path.join(" / ")}
          </button>
        ) : (
          <Text color="gray" size="1">
            自由入力候補
          </Text>
        )}
      </div>
    </li>
  );
}

function TagCopyButton({
  value,
  onCopy,
  copied,
}: {
  value: string;
  onCopy: (value: string) => void;
  copied: boolean;
}) {
  return (
    <button
      aria-label={`${value} をコピー`}
      className="tag-copy-button"
      data-copied={copied}
      type="button"
      onClick={() => onCopy(value)}
    >
      <span className="tag-copy-value">{value}</span>
      {copied ? <CheckIcon aria-hidden="true" /> : null}
    </button>
  );
}

function FavoriteButton({
  isFavorite,
  tag,
  onToggleFavorite,
}: {
  isFavorite: boolean;
  tag: TagEntry;
  onToggleFavorite: (tag: TagEntry) => void;
}) {
  return (
    <Tooltip content={isFavorite ? "お気に入りから削除" : "お気に入りに追加"}>
      <IconButton
        aria-label={`${tag.en} を${isFavorite ? "お気に入りから削除" : "お気に入りに追加"}`}
        className="favorite-button"
        color="gray"
        data-favorite={isFavorite}
        size="1"
        variant="ghost"
        onClick={() => onToggleFavorite(tag)}
      >
        <Heart
          aria-hidden="true"
          fill={isFavorite ? "currentColor" : "none"}
          size={14}
          strokeWidth={2}
        />
      </IconButton>
    </Tooltip>
  );
}
