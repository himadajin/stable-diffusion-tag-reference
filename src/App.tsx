import { CheckIcon, Cross2Icon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import {
  Badge,
  Box,
  Code,
  Dialog,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import { Heart } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { copyText } from "./lib/clipboard";
import { loadCategory, loadManifest } from "./lib/data";
import { entryCopyValue, normalizeQuery, searchEntriesFromChunks } from "./lib/search";
import type {
  CategoryData,
  CategorySection,
  CategorySummary,
  SearchEntry,
  TagEntry,
} from "./types";

type CopyState = {
  value: string;
  message: string;
};

type VirtualCategoryRow =
  | {
      id: string;
      type: "section";
      depth: number;
      name: string;
      path: string[];
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
const FAVORITES_STORAGE_KEY = "prompt-tag-viewer:favorites:v1";

type SectionJump = {
  categoryId: string;
  sectionId: string;
  requestId: number;
};

export function App() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEntry[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavoriteIds());
  const [copyState, setCopyState] = useState<CopyState | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTopSectionId, setActiveTopSectionId] = useState<string>("");
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [manualExpandedTopSectionId, setManualExpandedTopSectionId] = useState<string | null>(null);
  const [sectionJump, setSectionJump] = useState<SectionJump | null>(null);
  const isDrawerLayout = useMediaQuery("(max-width: 959px)");
  const useMobileTagRows = useMediaQuery("(max-width: 620px)");

  useEffect(() => {
    loadManifest().then((manifest) => {
      setCategories(manifest.categories);
      setActiveCategoryId(
        (current) =>
          current || manifest.categories.find((category) => category.tagCount > 0)?.id || "",
      );
    });
  }, []);

  useEffect(() => {
    if (!activeCategoryId || activeCategoryId === FAVORITES_CATEGORY_ID) return;
    let isCurrent = true;
    setCategoryData(null);
    loadCategory(activeCategoryId).then((data) => {
      if (isCurrent) setCategoryData(data);
    });
    return () => {
      isCurrent = false;
    };
  }, [activeCategoryId]);

  useEffect(() => {
    if (activeCategoryId !== FAVORITES_CATEGORY_ID) return;
    let isCurrent = true;
    setCategoryData(null);
    loadFavoritesCategory(categories, favoriteIds).then((data) => {
      if (isCurrent) setCategoryData(data);
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
    const timeout = window.setTimeout(() => setCopyState(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const isSearching = normalizeQuery(query).length > 0;
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

  async function copyValue(value: string, message = "コピーしました") {
    await copyText(value);
    setCopyState({ value, message });
  }

  async function openTagContext(entry: Extract<SearchEntry, { type: "tag" }>) {
    const data = await loadCategory(entry.categoryId);
    const sectionId = findSectionIdByPath(data.sections, entry.path) ?? "";
    setActiveCategoryId(entry.categoryId);
    setQuery("");
    setActiveSectionId(sectionId);
    setManualExpandedTopSectionId(null);
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
    setActiveCategoryId(categoryId);
    setQuery("");
    setActiveTopSectionId("");
    setActiveSectionId("");
    setManualExpandedTopSectionId(null);
  }

  function jumpToSection(categoryId: string, sectionId: string) {
    setActiveCategoryId(categoryId);
    setQuery("");
    setActiveSectionId(sectionId);
    setManualExpandedTopSectionId(null);
    setSectionJump((current) => ({
      categoryId,
      sectionId,
      requestId: (current?.requestId ?? 0) + 1,
    }));
    if (isDrawerLayout) setIsSidebarOpen(false);
  }

  function toggleTopSection(sectionId: string) {
    setManualExpandedTopSectionId((current) => (current === sectionId ? null : sectionId));
  }

  const updateVisibleSection = useCallback((topSectionId: string, sectionId: string) => {
    setActiveTopSectionId(topSectionId);
    setActiveSectionId(sectionId);
  }, []);

  return (
    <div className="app-shell">
      <div className="app-layout">
        <div className="desktop-sidebar">
          <CategorySidebar
            categories={sidebarCategories}
            activeCategory={categoryData}
            activeCategoryId={activeCategoryId}
            activeSectionId={activeSectionId}
            activeTopSectionId={activeTopSectionId}
            expandedTopSectionId={manualExpandedTopSectionId ?? activeTopSectionId}
            onSelect={selectCategoryFromSidebar}
            onSelectSection={jumpToSection}
            onToggleTopSection={toggleTopSection}
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
              activeCategory={categoryData}
              activeCategoryId={activeCategoryId}
              activeSectionId={activeSectionId}
              activeTopSectionId={activeTopSectionId}
              expandedTopSectionId={manualExpandedTopSectionId ?? activeTopSectionId}
              onSelect={selectCategoryFromSidebar}
              onSelectSection={jumpToSection}
              onToggleTopSection={toggleTopSection}
            />
          </Dialog.Content>
        </Dialog.Root>
        <MainPanel
          activeSectionId={activeSectionId}
          categoryData={categoryData}
          copyState={copyState}
          favoriteIds={favoriteIds}
          isSearching={isSearching}
          isSearchLoading={isSearchLoading}
          onCopy={copyValue}
          onOpenTagContext={openTagContext}
          onOpenSidebar={() => setIsSidebarOpen(true)}
          onQueryChange={setQuery}
          onToggleFavorite={toggleFavorite}
          onVisibleSectionChange={updateVisibleSection}
          query={query}
          searchResults={searchResults}
          sectionJump={sectionJump}
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
  isSearching,
  isSearchLoading,
  onCopy,
  onOpenTagContext,
  onOpenSidebar,
  onQueryChange,
  onToggleFavorite,
  onVisibleSectionChange,
  query,
  searchResults,
  sectionJump,
  useMobileTagRows,
}: {
  activeSectionId: string;
  categoryData: CategoryData | null;
  copyState: CopyState | null;
  favoriteIds: Set<string>;
  isSearching: boolean;
  isSearchLoading: boolean;
  onCopy: (value: string) => void;
  onOpenTagContext: (entry: Extract<SearchEntry, { type: "tag" }>) => void;
  onOpenSidebar: () => void;
  onQueryChange: (query: string) => void;
  onToggleFavorite: (tag: TagEntry) => void;
  onVisibleSectionChange: (topSectionId: string, sectionId: string) => void;
  query: string;
  searchResults: SearchEntry[];
  sectionJump: SectionJump | null;
  useMobileTagRows: boolean;
}) {
  return (
    <main className="main-panel" aria-label="タグ一覧">
      <DictionaryHeader
        category={categoryData}
        activeSectionId={activeSectionId}
        isLoading={isSearchLoading}
        isSearching={isSearching}
        onOpenSidebar={onOpenSidebar}
        onQueryChange={onQueryChange}
        query={query}
        resultCount={searchResults.length}
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
  activeTopSectionId,
  expandedTopSectionId,
  onSelect,
  onSelectSection,
  onToggleTopSection,
}: {
  categories: CategorySummary[];
  activeCategory: CategoryData | null;
  activeCategoryId: string;
  activeSectionId: string;
  onSelect: (categoryId: string) => void;
  activeTopSectionId: string;
  expandedTopSectionId: string;
  onSelectSection: (categoryId: string, sectionId: string) => void;
  onToggleTopSection: (sectionId: string) => void;
}) {
  const activeTopSections =
    activeCategory && activeCategory.id !== FAVORITES_CATEGORY_ID ? activeCategory.sections : [];

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
            return (
              <div className="category-tree-item" key={category.id}>
                <button
                  className="category-button"
                  data-active={isActive}
                  onClick={() => onSelect(category.id)}
                  type="button"
                >
                  <span>{category.name}</span>
                  <span className="category-count">{category.tagCount.toLocaleString()}</span>
                </button>
                {isActive && activeTopSections.length > 0 ? (
                  <nav className="section-tree" aria-label={`${category.name} のサブカテゴリ`}>
                    {activeTopSections.map((section) => {
                      const isTopActive = section.id === activeTopSectionId;
                      const isExpanded = section.id === expandedTopSectionId;
                      const hasChildren = Boolean(section.children?.length);
                      return (
                        <div className="section-tree-group" key={section.id}>
                          <button
                            className="section-tree-button section-tree-button-top"
                            data-active={isTopActive}
                            data-expanded={isExpanded}
                            onClick={() =>
                              hasChildren
                                ? onToggleTopSection(section.id)
                                : onSelectSection(category.id, section.id)
                            }
                            type="button"
                          >
                            <span>{section.name}</span>
                            <span className="category-count">
                              {section.tagCount.toLocaleString()}
                            </span>
                          </button>
                          {hasChildren && isExpanded ? (
                            <div className="section-tree-children">
                              {section.children?.map((child) => (
                                <button
                                  className="section-tree-button section-tree-button-child"
                                  data-active={child.id === activeSectionId}
                                  key={child.id}
                                  onClick={() => onSelectSection(category.id, child.id)}
                                  type="button"
                                >
                                  <span>{child.name}</span>
                                  <span className="category-count">
                                    {child.tagCount.toLocaleString()}
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
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

function DictionaryHeader({
  activeSectionId,
  category,
  isLoading,
  isSearching,
  onOpenSidebar,
  query,
  onQueryChange,
  resultCount,
}: {
  activeSectionId: string;
  category: CategoryData | null;
  isLoading: boolean;
  isSearching: boolean;
  onOpenSidebar: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  resultCount: number;
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
        <Text className="dictionary-count" color="gray" size="2">
          {isSearching ? `${resultCount.toLocaleString()} results` : `${count ?? 0} tags`}
        </Text>
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
        {isLoading ? (
          <Text className="search-loading-text" color="gray" size="1">
            検索データを読み込み中
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
    scrollElement.scrollTop = 0;
    setScrollTop(0);
    onVisibleSectionChange("", "");
  }, [categoryId, onVisibleSectionChange]);

  useEffect(() => {
    if (!sectionJump || sectionJump.categoryId !== categoryId) return;
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    const position = sectionPositions.find((section) => section.id === sectionJump.sectionId);
    if (!position) return;
    const nextScrollTop = rowMetrics.tops[position.index] ?? 0;
    scrollElement.scrollTop = nextScrollTop;
    setScrollTop(nextScrollTop);
  }, [categoryId, rowMetrics.tops, sectionJump, sectionPositions]);

  useEffect(() => {
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

  return (
    <section className="category-view">
      {category.id === FAVORITES_CATEGORY_ID && category.tagCount === 0 ? (
        <Box px="5" py="4">
          <Text color="gray">お気に入りに追加したタグはここに表示されます。</Text>
        </Box>
      ) : null}
      <div
        className="virtual-category-scroll"
        ref={scrollRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
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

function findSectionIdByPath(sections: CategorySection[], path: string[]): string | null {
  for (const section of sections) {
    if (
      section.path.length === path.length &&
      section.path.every((part, index) => part === path[index])
    ) {
      return section.id;
    }
    const childId = findSectionIdByPath(section.children ?? [], path);
    if (childId) return childId;
  }
  return null;
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
      <Code color="gray">{value}</Code>
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
        color={isFavorite ? "indigo" : "gray"}
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
