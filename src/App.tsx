import {
  Badge,
  Box,
  Button,
  Code,
  Flex,
  Heading,
  IconButton,
  ScrollArea,
  Separator,
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
  PlusIcon,
  ResetIcon,
  TrashIcon,
  TriangleDownIcon,
  TriangleUpIcon,
} from "@radix-ui/react-icons";
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
  SelectedTag,
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

export function App() {
  const [categories, setCategories] = useState<CategorySummary[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>("");
  const [categoryData, setCategoryData] = useState<CategoryData | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchEntry[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [selectedTags, setSelectedTags] = useState<SelectedTag[]>([]);
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
    loadCategory(activeCategoryId).then((data) => {
      if (isCurrent) setCategoryData(data);
    });
    return () => {
      isCurrent = false;
    };
  }, [activeCategoryId]);

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

  async function copyValue(value: string, message = "コピーしました") {
    await copyText(value);
    setCopyState({ value, message });
  }

  function addSelected(tag: SelectedTag) {
    setSelectedTags((current) => {
      if (current.some((item) => item.id === tag.id)) return current;
      return [...current, tag];
    });
  }

  function removeSelected(id: string) {
    setSelectedTags((current) => current.filter((item) => item.id !== id));
  }

  function moveSelected(id: string, direction: -1 | 1) {
    setSelectedTags((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  async function copySelected() {
    if (selectedTags.length === 0) return;
    await copyValue(
      selectedTags.map((item) => item.label).join(", "),
      "選択タグをコピーしました",
    );
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
            <Tabs.Trigger value="selected">選択 ({selectedTags.length})</Tabs.Trigger>
          </Tabs.List>
          <Box pt="3">
            <Tabs.Content value="categories">
              {mobileView === "categories" ? (
                <CategorySidebar
                  categories={categories}
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
                  isSearching={isSearching}
                  isSearchLoading={isSearchLoading}
                  onAdd={addSelected}
                  onCopy={copyValue}
                  onOpenCategory={openCategory}
                  onQueryChange={setQuery}
                  query={query}
                  searchResults={searchResults}
                  showSearchHeader={false}
                  useMobileTagRows={useMobileTagRows}
                />
              ) : null}
            </Tabs.Content>
            <Tabs.Content value="selected">
              {mobileView === "selected" ? (
                <SelectionPanel
                  selectedTags={selectedTags}
                  onCopySelected={copySelected}
                  onRemove={removeSelected}
                  onMove={moveSelected}
                  onClear={() => setSelectedTags([])}
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
          categories={categories}
          activeCategoryId={activeCategoryId}
          onSelect={openCategory}
        />
        <MainPanel
          categoryData={categoryData}
          copyState={copyState}
          isSearching={isSearching}
          isSearchLoading={isSearchLoading}
          onAdd={addSelected}
          onCopy={copyValue}
          onOpenCategory={openCategory}
          onQueryChange={setQuery}
          query={query}
          searchResults={searchResults}
          showSearchHeader
          useMobileTagRows={false}
        />
        <SelectionPanel
          selectedTags={selectedTags}
          onCopySelected={copySelected}
          onRemove={removeSelected}
          onMove={moveSelected}
          onClear={() => setSelectedTags([])}
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

function MainPanel({
  categoryData,
  copyState,
  isSearching,
  isSearchLoading,
  onAdd,
  onCopy,
  onOpenCategory,
  onQueryChange,
  query,
  searchResults,
  showSearchHeader,
  useMobileTagRows,
}: {
  categoryData: CategoryData | null;
  copyState: CopyState | null;
  isSearching: boolean;
  isSearchLoading: boolean;
  onAdd: (tag: SelectedTag) => void;
  onCopy: (value: string) => void;
  onOpenCategory: (categoryId: string) => void;
  onQueryChange: (query: string) => void;
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
          onAdd={onAdd}
          onOpenCategory={onOpenCategory}
          copyValue={copyState?.value}
          useMobileTagRows={useMobileTagRows}
        />
      ) : categoryData ? (
        <CategoryView
          category={categoryData}
          onCopy={onCopy}
          onAdd={onAdd}
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
  onAdd,
  copyValue,
  useMobileTagRows,
}: {
  category: CategoryData;
  onCopy: (value: string) => void;
  onAdd: (tag: SelectedTag) => void;
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
      <div
        className="virtual-category-scroll"
        ref={scrollRef}
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {useMobileTagRows ? null : (
          <div className="virtual-table-header" role="row">
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
                  key={row.id}
                  onAdd={onAdd}
                  onCopy={onCopy}
                  tag={row.tag}
                />
              ) : (
                <VirtualDesktopTagRow
                  copyValue={copyValue}
                  key={row.id}
                  onAdd={onAdd}
                  onCopy={onCopy}
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
  onAdd,
  copyValue,
}: {
  tag: TagEntry;
  onCopy: (value: string) => void;
  onAdd: (tag: SelectedTag) => void;
  copyValue?: string;
}) {
  return (
    <div className="virtual-tag-row" role="row">
      <div>
        <Code color="gray">{tag.en}</Code>
      </div>
      <Text size="2">{tag.ja}</Text>
      <Text color="gray" size="1">
        {tag.path.join(" / ")}
      </Text>
      <RowActions
        value={tag.en}
        selectedTag={{ id: tag.id, label: tag.en, source: "tag" }}
        onCopy={onCopy}
        onAdd={onAdd}
        copied={copyValue === tag.en}
      />
    </div>
  );
}

function VirtualMobileTagRow({
  tag,
  onCopy,
  onAdd,
  copyValue,
}: {
  tag: TagEntry;
  onCopy: (value: string) => void;
  onAdd: (tag: SelectedTag) => void;
  copyValue?: string;
}) {
  return (
    <div className="virtual-mobile-tag-row">
      <div className="mobile-tag-main">
        <Code color="gray">{tag.en}</Code>
        <Text size="2">{tag.ja}</Text>
        <Text color="gray" size="1">
          {tag.path.join(" / ")}
        </Text>
      </div>
      <RowActions
        value={tag.en}
        selectedTag={{ id: tag.id, label: tag.en, source: "tag" }}
        onCopy={onCopy}
        onAdd={onAdd}
        copied={copyValue === tag.en}
      />
    </div>
  );
}

function SearchResults({
  results,
  query,
  onCopy,
  onAdd,
  onOpenCategory,
  copyValue,
  useMobileTagRows,
}: {
  results: SearchEntry[];
  query: string;
  onCopy: (value: string) => void;
  onAdd: (tag: SelectedTag) => void;
  onOpenCategory: (categoryId: string) => void;
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
                value,
                label: entry.type === "tag" ? entry.ja : `自由入力候補 / ${entry.count.toLocaleString()}`,
                context:
                  entry.type === "tag"
                    ? `${entry.categoryName} / ${entry.path.join(" / ")}`
                    : "自由入力候補",
                selectedTag: { id: entry.id, label: value, source: entry.type },
                categoryId: entry.type === "tag" ? entry.categoryId : undefined,
              };
            })}
            onCopy={onCopy}
            onAdd={onAdd}
            onOpenCategory={onOpenCategory}
            copyValue={copyValue}
          />
        ) : (
            <Table.Root size="1" variant="surface" className="tag-table">
            <Table.Header>
              <Table.Row>
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
                        selectedTag={{
                          id: entry.id,
                          label: value,
                          source: entry.type,
                        }}
                        onCopy={onCopy}
                        onAdd={onAdd}
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
  onAdd,
  onOpenCategory,
  copyValue,
}: {
  rows: Array<{
    id: string;
    value: string;
    label: string;
    context: string;
    selectedTag: SelectedTag;
    categoryId?: string;
  }>;
  onCopy: (value: string) => void;
  onAdd: (tag: SelectedTag) => void;
  onOpenCategory?: (categoryId: string) => void;
  copyValue?: string;
}) {
  return (
    <div className="mobile-tag-list" aria-label="モバイルタグ一覧">
      {rows.map((row) => (
        <div className="mobile-tag-row" key={row.id}>
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
            selectedTag={row.selectedTag}
            onCopy={onCopy}
            onAdd={onAdd}
            copied={copyValue === row.value}
          />
        </div>
      ))}
    </div>
  );
}

function RowActions({
  value,
  selectedTag,
  onCopy,
  onAdd,
  copied,
}: {
  value: string;
  selectedTag: SelectedTag;
  onCopy: (value: string) => void;
  onAdd: (tag: SelectedTag) => void;
  copied: boolean;
}) {
  return (
    <Flex gap="1" justify="end">
      <Tooltip content="英語タグをコピー">
        <IconButton aria-label={`${value} をコピー`} size="1" variant="soft" onClick={() => onCopy(value)}>
          {copied ? <CheckIcon /> : <ClipboardCopyIcon />}
        </IconButton>
      </Tooltip>
      <Tooltip content="一時選択リストに追加">
        <IconButton
          aria-label={`${value} を選択リストに追加`}
          color="gray"
          size="1"
          variant="soft"
          onClick={() => onAdd(selectedTag)}
        >
          <PlusIcon />
        </IconButton>
      </Tooltip>
    </Flex>
  );
}

function SelectionPanel({
  selectedTags,
  onCopySelected,
  onRemove,
  onMove,
  onClear,
}: {
  selectedTags: SelectedTag[];
  onCopySelected: () => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onClear: () => void;
}) {
  return (
    <aside className="selection-panel" aria-label="一時選択リスト">
      <Flex align="baseline" justify="between" px="4" py="3">
        <Heading size="3">Selected</Heading>
        <Badge variant="soft" color="gray">
          {selectedTags.length}
        </Badge>
      </Flex>
      <Separator size="4" />
      <Flex gap="2" px="4" py="3">
        <Button size="2" disabled={selectedTags.length === 0} onClick={onCopySelected}>
          <ClipboardCopyIcon />
          まとめてコピー
        </Button>
        <Tooltip content="選択をクリア">
          <IconButton
            aria-label="選択をクリア"
            color="gray"
            disabled={selectedTags.length === 0}
            onClick={onClear}
            variant="soft"
          >
            <ResetIcon />
          </IconButton>
        </Tooltip>
      </Flex>
      <ScrollArea className="selection-scroll" scrollbars="vertical">
        {selectedTags.length === 0 ? (
          <Box px="4" py="3">
            <Text color="gray" size="2">
              タグ行の追加ボタンから、まとめてコピーするタグを一時的に集められます。
            </Text>
          </Box>
        ) : (
          <Flex direction="column" gap="1" px="2" pb="3">
            {selectedTags.map((tag, index) => (
              <Flex align="center" className="selected-row" gap="2" key={tag.id}>
                <Code className="selected-code" color="gray">
                  {tag.label}
                </Code>
                <Flex gap="1" ml="auto">
                  <Tooltip content="上へ移動">
                    <IconButton
                      aria-label={`${tag.label} を上へ移動`}
                      color="gray"
                      disabled={index === 0}
                      size="1"
                      variant="ghost"
                      onClick={() => onMove(tag.id, -1)}
                    >
                      <TriangleUpIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="下へ移動">
                    <IconButton
                      aria-label={`${tag.label} を下へ移動`}
                      color="gray"
                      disabled={index === selectedTags.length - 1}
                      size="1"
                      variant="ghost"
                      onClick={() => onMove(tag.id, 1)}
                    >
                      <TriangleDownIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip content="削除">
                    <IconButton
                      aria-label={`${tag.label} を削除`}
                      color="gray"
                      size="1"
                      variant="ghost"
                      onClick={() => onRemove(tag.id)}
                    >
                      <TrashIcon />
                    </IconButton>
                  </Tooltip>
                </Flex>
              </Flex>
            ))}
          </Flex>
        )}
      </ScrollArea>
    </aside>
  );
}
