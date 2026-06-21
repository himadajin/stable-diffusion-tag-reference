import {
  Badge,
  Box,
  Code,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Table,
  Tabs,
  Text,
  TextField,
  Tooltip,
} from "@radix-ui/themes";
import {
  CheckIcon,
  ClipboardCopyIcon,
  Cross2Icon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { Heart } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
      tagCount: number;
    }
  | {
      id: string;
      type: "tag";
      tag: TagEntry;
    };

const DESKTOP_CATEGORY_ROW_HEIGHT = 36;
const MOBILE_CATEGORY_ROW_HEIGHT = 74;
const VIRTUAL_OVERSCAN_ROWS = 12;
const FAVORITES_CATEGORY_ID = "favorites";
const FAVORITES_STORAGE_KEY = "prompt-tag-viewer:favorites:v1";

export function App() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEntry[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => readFavoriteIds());
  const [copyState, setCopyState] = useState<CopyState | null>(null);
  const [mobileView, setMobileView] = useState("tags");
  const isMobileLayout = useMediaQuery("(max-width: 900px)");
  const useMobileTagRows = useMediaQuery("(max-width: 620px)");

  useEffect(() => {
    loadManifest().then((manifest) => {
      setCategories(manifest.categories);
      setActiveCategoryId(
        (current) => current || manifest.categories.find((category) => category.tagCount > 0)?.id || "",
      );
    });
  }, []);

  useEffect(() => {
    if (!activeCategoryId) return;
    let isCurrent = true;
    setCategoryData(null);
    const dataPromise =
      activeCategoryId === FAVORITES_CATEGORY_ID
        ? loadFavoritesCategory(categories, favoriteIds)
        : loadCategory(activeCategoryId);
    dataPromise.then((data) => {
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

  function openCategory(categoryId: string) {
    setActiveCategoryId(categoryId);
    setQuery("");
    setMobileView("tags");
  }

  if (isMobileLayout) {
    return (
      <div className="app-shell">
        <div className="mobile-layout">
        <SearchHeader
          query={query}
          onQueryChange={setQuery}
          copyState={copyState}
          isLoading={isSearchLoading}
        />
        <Tabs.Root value={mobileView} onValueChange={setMobileView}>
          <Tabs.List>
            <Tabs.Trigger value="categories">カテゴリ</Tabs.Trigger>
            <Tabs.Trigger value="tags">タグ</Tabs.Trigger>
          </Tabs.List>
          <Box pt="3">
            <Tabs.Content value="categories">
              {mobileView === "categories" ? (
                <CategorySidebar
                  categories={sidebarCategories}
                  activeCategoryId={activeCategoryId}
                  onSelect={openCategory}
                />
              ) : null}
            </Tabs.Content>
            <Tabs.Content value="tags">
              {mobileView === "tags" ? (
                <MainPanel
                  categoryData={categoryData}
                  copyState={copyState}
                  favoriteIds={favoriteIds}
                  isSearching={isSearching}
                  isSearchLoading={isSearchLoading}
                  onCopy={copyValue}
                  onOpenCategory={openCategory}
                  onQueryChange={setQuery}
                  onToggleFavorite={toggleFavorite}
                  query={query}
                  searchResults={searchResults}
                  showSearchHeader={false}
                  useMobileTagRows={useMobileTagRows}
                />
              ) : null}
            </Tabs.Content>
          </Box>
        </Tabs.Root>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="desktop-layout">
        <CategorySidebar
          categories={sidebarCategories}
          activeCategoryId={activeCategoryId}
          onSelect={openCategory}
        />
        <MainPanel
          categoryData={categoryData}
          copyState={copyState}
          favoriteIds={favoriteIds}
          isSearching={isSearching}
          isSearchLoading={isSearchLoading}
          onCopy={copyValue}
          onOpenCategory={openCategory}
          onQueryChange={setQuery}
          onToggleFavorite={toggleFavorite}
          query={query}
          searchResults={searchResults}
          showSearchHeader
          useMobileTagRows={false}
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

  const sourceCategories = await Promise.all(categories.map((category) => loadCategory(category.id)));
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
  categoryData,
  copyState,
  favoriteIds,
  isSearching,
  isSearchLoading,
  onCopy,
  onOpenCategory,
  onQueryChange,
  onToggleFavorite,
  query,
  searchResults,
  showSearchHeader,
  useMobileTagRows,
}: {
  categoryData: CategoryData | null;
  copyState: CopyState | null;
  favoriteIds: Set<string>;
  isSearching: boolean;
  isSearchLoading: boolean;
  onCopy: (value: string) => void;
  onOpenCategory: (categoryId: string) => void;
  onQueryChange: (query: string) => void;
  onToggleFavorite: (tag: TagEntry) => void;
  query: string;
  searchResults: SearchEntry[];
  showSearchHeader: boolean;
  useMobileTagRows: boolean;
}) {
  return (
    <main className="main-panel" aria-label="タグ一覧">
      {showSearchHeader ? (
        <SearchHeader
          query={query}
          onQueryChange={onQueryChange}
          copyState={copyState}
          isLoading={isSearchLoading}
        />
      ) : null}
      {isSearching ? (
        <SearchResults
          results={searchResults}
          query={query}
          onCopy={onCopy}
          onOpenCategory={onOpenCategory}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          copyValue={copyState?.value}
          useMobileTagRows={useMobileTagRows}
        />
      ) : categoryData ? (
        <CategoryView
          category={categoryData}
          onCopy={onCopy}
          favoriteIds={favoriteIds}
          onToggleFavorite={onToggleFavorite}
          copyValue={copyState?.value}
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
  activeCategoryId,
  onSelect,
}: {
  categories: CategorySummary[];
  activeCategoryId: string;
  onSelect: (categoryId: string) => void;
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
          {categories.map((category) => (
            <button
              className="category-button"
              data-active={category.id === activeCategoryId}
              key={category.id}
              onClick={() => onSelect(category.id)}
              type="button"
            >
              <span>{category.name}</span>
              <span className="category-count">{category.tagCount.toLocaleString()}</span>
            </button>
          ))}
        </Flex>
      </ScrollArea>
    </aside>
  );
}

function SearchHeader({
  query,
  onQueryChange,
  copyState,
  isLoading,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  copyState: CopyState | null;
  isLoading: boolean;
}) {
  return (
    <header className="search-header">
      <Box className="search-field">
        <TextField.Root
          aria-label="タグ検索"
          placeholder="日本語名・英語タグ・自由入力候補を検索"
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
      <Text className="copy-status" color={copyState ? "indigo" : "gray"} size="2">
        {copyState ? copyState.message : isLoading ? "検索データを読み込み中" : " "}
      </Text>
    </header>
  );
}

function CategoryView({
  category,
  onCopy,
  favoriteIds,
  onToggleFavorite,
  copyValue,
  useMobileTagRows,
}: {
  category: CategoryData;
  onCopy: (value: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
  useMobileTagRows: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(720);
  const rowHeight = useMobileTagRows ? MOBILE_CATEGORY_ROW_HEIGHT : DESKTOP_CATEGORY_ROW_HEIGHT;
  const rows = useMemo(() => flattenCategoryRows(category.sections), [category.sections]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;
    scrollElement.scrollTop = 0;
    setScrollTop(0);
  }, [category.id]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) return;

    const updateViewportHeight = () => setViewportHeight(scrollElement.clientHeight || 720);
    updateViewportHeight();
    window.addEventListener("resize", updateViewportHeight);
    return () => window.removeEventListener("resize", updateViewportHeight);
  }, [useMobileTagRows]);

  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_OVERSCAN_ROWS);
  const visibleCount = Math.ceil(viewportHeight / rowHeight) + VIRTUAL_OVERSCAN_ROWS * 2;
  const endIndex = Math.min(rows.length, startIndex + visibleCount);
  const visibleRows = rows.slice(startIndex, endIndex);
  const topOffset = startIndex * rowHeight;
  const totalHeight = rows.length * rowHeight;

  return (
    <section className="category-view">
      <Box className="category-view-header" px="5" py="4">
        <Flex align="baseline" gap="3" mb="3">
          <Heading size="5">{category.name}</Heading>
          <Badge variant="soft" color="gray">
            {category.tagCount.toLocaleString()} tags
          </Badge>
        </Flex>
      </Box>
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
        {useMobileTagRows ? null : (
          <div className="virtual-table-header" role="row">
            <Text aria-hidden="true" color="gray" size="1">
              {" "}
            </Text>
            <Text color="gray" size="1" weight="medium">
              English tag
            </Text>
            <Text color="gray" size="1" weight="medium">
              日本語名
            </Text>
            <Text color="gray" size="1" weight="medium">
              カテゴリ文脈
            </Text>
            <Text className="virtual-action-heading" color="gray" size="1" weight="medium">
              操作
            </Text>
          </div>
        )}
        <div className="virtual-category-list" style={{ height: totalHeight }}>
          <div className="virtual-category-window" style={{ transform: `translateY(${topOffset}px)` }}>
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
                  tag={row.tag}
                />
              ) : (
                <VirtualDesktopTagRow
                  copyValue={copyValue}
                  favoriteIds={favoriteIds}
                  key={row.id}
                  onCopy={onCopy}
                  onToggleFavorite={onToggleFavorite}
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
      className={useMobileTagRows ? "virtual-section-row virtual-section-row-mobile" : "virtual-section-row"}
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
}: {
  tag: TagEntry;
  onCopy: (value: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
}) {
  return (
    <div className="virtual-tag-row" role="row">
      <FavoriteButton
        isFavorite={favoriteIds.has(tag.id)}
        tag={tag}
        onToggleFavorite={onToggleFavorite}
      />
      <div>
        <Code color="gray">{tag.en}</Code>
      </div>
      <Text size="2">{tag.ja}</Text>
      <Text color="gray" size="1">
        {tag.path.join(" / ")}
      </Text>
      <RowActions
        value={tag.en}
        onCopy={onCopy}
        copied={copyValue === tag.en}
      />
    </div>
  );
}

function VirtualMobileTagRow({
  tag,
  onCopy,
  favoriteIds,
  onToggleFavorite,
  copyValue,
}: {
  tag: TagEntry;
  onCopy: (value: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
}) {
  return (
    <div className="virtual-mobile-tag-row">
      <FavoriteButton
        isFavorite={favoriteIds.has(tag.id)}
        tag={tag}
        onToggleFavorite={onToggleFavorite}
      />
      <div className="mobile-tag-main">
        <Code color="gray">{tag.en}</Code>
        <Text size="2">{tag.ja}</Text>
        <Text color="gray" size="1">
          {tag.path.join(" / ")}
        </Text>
      </div>
      <RowActions
        value={tag.en}
        onCopy={onCopy}
        copied={copyValue === tag.en}
      />
    </div>
  );
}

function SearchResults({
  results,
  query,
  onCopy,
  onOpenCategory,
  favoriteIds,
  onToggleFavorite,
  copyValue,
  useMobileTagRows,
}: {
  results: SearchEntry[];
  query: string;
  onCopy: (value: string) => void;
  onOpenCategory: (categoryId: string) => void;
  favoriteIds: Set<string>;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
  useMobileTagRows: boolean;
}) {
  return (
    <ScrollArea className="content-scroll" scrollbars="vertical">
      <Box px="5" py="4">
        <Flex align="baseline" gap="3" mb="3">
          <Heading size="5">Search results</Heading>
          <Badge variant="soft" color="gray">
            {results.length.toLocaleString()}
          </Badge>
        </Flex>
        {results.length === 0 ? (
          <Text color="gray">「{query}」に一致するタグはありません。</Text>
        ) : useMobileTagRows ? (
          <MobileTagRows
            rows={results.map((entry) => {
              const value = entryCopyValue(entry);
              return {
                id: entry.id,
                entry,
                value,
                label: entry.type === "tag" ? entry.ja : `自由入力候補 / ${entry.count.toLocaleString()}`,
                context:
                  entry.type === "tag"
                    ? `${entry.categoryName} / ${entry.path.join(" / ")}`
                    : "自由入力候補",
                categoryId: entry.type === "tag" ? entry.categoryId : undefined,
              };
            })}
            onCopy={onCopy}
            favoriteIds={favoriteIds}
            onOpenCategory={onOpenCategory}
            onToggleFavorite={onToggleFavorite}
            copyValue={copyValue}
          />
        ) : (
            <Table.Root size="1" variant="surface" className="tag-table">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell className="favorite-cell"></Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>English tag</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>日本語名 / 出典</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>カテゴリ文脈</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell className="action-cell">操作</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {results.map((entry) => {
                const value = entryCopyValue(entry);
                return (
                  <Table.Row key={entry.id}>
                    <Table.Cell className="favorite-cell">
                      {entry.type === "tag" ? (
                        <FavoriteButton
                          isFavorite={favoriteIds.has(entry.id)}
                          tag={entry}
                          onToggleFavorite={onToggleFavorite}
                        />
                      ) : null}
                    </Table.Cell>
                    <Table.Cell>
                      <Code color="gray">{value}</Code>
                    </Table.Cell>
                    <Table.Cell>
                      {entry.type === "tag" ? (
                        entry.ja
                      ) : (
                        <Text color="gray">自由入力候補 / {entry.count.toLocaleString()}</Text>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {entry.type === "tag" ? (
                        <button
                          className="context-link"
                          type="button"
                          onClick={() => onOpenCategory(entry.categoryId)}
                        >
                          {entry.categoryName} / {entry.path.join(" / ")}
                        </button>
                      ) : (
                        <Text color="gray" size="1">
                          自由入力候補
                        </Text>
                      )}
                    </Table.Cell>
                    <Table.Cell className="action-cell">
                      <RowActions
                        value={value}
                        onCopy={onCopy}
                        copied={copyValue === value}
                      />
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        )}
      </Box>
    </ScrollArea>
  );
}

function MobileTagRows({
  rows,
  onCopy,
  favoriteIds,
  onOpenCategory,
  onToggleFavorite,
  copyValue,
}: {
  rows: Array<{
    id: string;
    entry: SearchEntry;
    value: string;
    label: string;
    context: string;
    categoryId?: string;
  }>;
  onCopy: (value: string) => void;
  favoriteIds: Set<string>;
  onOpenCategory?: (categoryId: string) => void;
  onToggleFavorite: (tag: TagEntry) => void;
  copyValue?: string;
}) {
  return (
    <div className="mobile-tag-list" aria-label="モバイルタグ一覧">
      {rows.map((row) => (
        <div className="mobile-tag-row" key={row.id}>
          {row.entry.type === "tag" ? (
            <FavoriteButton
              isFavorite={favoriteIds.has(row.entry.id)}
              tag={row.entry}
              onToggleFavorite={onToggleFavorite}
            />
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="mobile-tag-main">
            <Code color="gray">{row.value}</Code>
            <Text size="2">{row.label}</Text>
            {row.categoryId && onOpenCategory ? (
              <button className="context-link" type="button" onClick={() => onOpenCategory(row.categoryId!)}>
                {row.context}
              </button>
            ) : (
              <Text color="gray" size="1">
                {row.context}
              </Text>
            )}
          </div>
          <RowActions
            value={row.value}
            onCopy={onCopy}
            copied={copyValue === row.value}
          />
        </div>
      ))}
    </div>
  );
}

function RowActions({
  value,
  onCopy,
  copied,
}: {
  value: string;
  onCopy: (value: string) => void;
  copied: boolean;
}) {
  return (
    <Flex gap="1" justify="end">
      <Tooltip content="英語タグをコピー">
        <IconButton aria-label={`${value} をコピー`} size="1" variant="soft" onClick={() => onCopy(value)}>
          {copied ? <CheckIcon /> : <ClipboardCopyIcon />}
        </IconButton>
      </Tooltip>
    </Flex>
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
        variant={isFavorite ? "soft" : "ghost"}
        onClick={() => onToggleFavorite(tag)}
      >
        <Heart aria-hidden="true" fill={isFavorite ? "currentColor" : "none"} size={14} strokeWidth={2} />
      </IconButton>
    </Tooltip>
  );
}
