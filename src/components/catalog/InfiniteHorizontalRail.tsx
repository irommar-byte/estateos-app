"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const DEFAULT_PAGE_SIZE = 12;
const LOAD_MORE_THRESHOLD_PX = 480;

type InfiniteHorizontalRailProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T, index: number) => string | number;
  pageSize?: number;
  className?: string;
  /**
   * When true, after the last unique item the rail recycles from the start.
   * Default false — only unique items; stop when everything is shown.
   */
  loop?: boolean;
};

/**
 * Horizontal Apple-TV-style rail that appends the next page when the user
 * scrolls near the end. Does not duplicate items unless `loop` is enabled.
 */
export default function InfiniteHorizontalRail<T>({
  items,
  renderItem,
  getKey,
  pageSize = DEFAULT_PAGE_SIZE,
  className = "",
  loop = false,
}: InfiniteHorizontalRailProps<T>) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    setVisibleCount(pageSize);
    const root = scrollerRef.current;
    if (root) root.scrollLeft = 0;
  }, [items, pageSize]);

  const displayItems = useMemo(() => {
    if (!items.length) return [] as Array<{ item: T; index: number; cycle: number }>;
    const count = loop
      ? Math.max(visibleCount, Math.min(pageSize, items.length))
      : Math.min(visibleCount, items.length);
    const rows: Array<{ item: T; index: number; cycle: number }> = [];
    for (let i = 0; i < count; i += 1) {
      const index = i % items.length;
      const cycle = Math.floor(i / items.length);
      if (!loop && cycle > 0) break;
      rows.push({ item: items[index]!, index, cycle });
    }
    return rows;
  }, [items, loop, pageSize, visibleCount]);

  const canLoadMore = items.length > 0 && (loop || visibleCount < items.length);

  const loadMore = useCallback(() => {
    if (!canLoadMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setVisibleCount((prev) => {
      if (!loop && prev >= items.length) return prev;
      const next = prev + pageSize;
      return loop ? next : Math.min(next, items.length);
    });
    window.setTimeout(() => {
      loadingMoreRef.current = false;
    }, 120);
  }, [canLoadMore, items.length, loop, pageSize]);

  useEffect(() => {
    const root = scrollerRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel || !canLoadMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          loadMore();
        }
      },
      { root, rootMargin: `0px ${LOAD_MORE_THRESHOLD_PX}px 0px 0px`, threshold: 0.01 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore, displayItems.length]);

  const onScroll = useCallback(() => {
    const root = scrollerRef.current;
    if (!root || !canLoadMore) return;
    const remaining = root.scrollWidth - root.scrollLeft - root.clientWidth;
    if (remaining <= LOAD_MORE_THRESHOLD_PX) {
      loadMore();
    }
  }, [canLoadMore, loadMore]);

  if (!items.length) return null;

  return (
    <div
      ref={scrollerRef}
      onScroll={onScroll}
      className={`flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin] ${className}`.trim()}
    >
      {displayItems.map(({ item, index, cycle }) => (
        <Fragment key={`${String(getKey(item, index))}-${cycle}`}>
          {renderItem(item, index)}
        </Fragment>
      ))}
      {canLoadMore ? <div ref={sentinelRef} className="h-1 w-8 shrink-0" aria-hidden /> : null}
    </div>
  );
}
