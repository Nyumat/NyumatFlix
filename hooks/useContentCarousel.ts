"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { MediaItem } from "@/utils/typings";

// Interface to ensure item has an id property
interface ItemWithId {
  id: number;
}

interface UseContentCarouselOptions<T extends MediaItem & ItemWithId> {
  initialItems: T[];
  onLoadMore?: () => Promise<T[]>;
  hasMoreItems?: boolean;
}

export function useContentCarousel<T extends MediaItem & ItemWithId>({
  initialItems,
  onLoadMore,
  hasMoreItems = false,
}: UseContentCarouselOptions<T>) {
  const [items, setItems] = useState<T[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasMore, setHasMore] = useState(hasMoreItems);
  const isMountedRef = useRef(true);
  const isScrollingRef = useRef(false);
  const lastScrollEndIndexRef = useRef<number>(0);
  // const scrollListenerRef = useRef<() => void>(() => undefined);
  const listenForScrollRef = useRef(true);
  const hasMoreToLoadRef = useRef(hasMoreItems);

  // Use embla carousel with watchSlides option for dynamic content
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    loop: false,
    watchDrag: true,
    dragFree: true,
    dragThreshold: 0.1,
    axis: "x",
  });

  // Clean loading state if it takes too long (network error, etc)
  const clearLoadingTimeout = useCallback(() => {
    if (loadingTimerRef.current) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  }, []);

  // Improved load more function
  const loadMoreItems = useCallback(async () => {
    if (!onLoadMore || !hasMore || loading || !isMountedRef.current) return;

    try {
      // console.log("Loading more items...");
      setLoading(true);
      listenForScrollRef.current = false;

      // Set a safety timeout to clear loading state if it takes too long
      loadingTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          // console.log("Loading timeout reached");
          setLoading(false);
          listenForScrollRef.current = true;
        }
      }, 8000); // 8 seconds timeout

      const newItems = await onLoadMore();
      // console.log(`Loaded ${newItems.length} new items`);

      if (isMountedRef.current) {
        clearLoadingTimeout();

        // Batch these state updates together
        if (newItems.length === 0) {
          setHasMore(false);
          hasMoreToLoadRef.current = false;
        } else {
          setItems((prevItems) => [...prevItems, ...newItems]);
        }

        // Allow a small delay for the DOM to update before recalculating
        requestAnimationFrame(() => {
          if (emblaApi && isMountedRef.current) {
            emblaApi.reInit();
            setLoading(false);
            listenForScrollRef.current = true;
          }
        });
      }
    } catch (error) {
      console.error("Error loading more items:", error);
      if (isMountedRef.current) {
        clearLoadingTimeout();
        setLoading(false);
        listenForScrollRef.current = true;
      }
    }
  }, [onLoadMore, hasMore, loading, emblaApi, clearLoadingTimeout]);

  // Enhanced scroll handler
  const onScroll = useCallback(
    (emblaApi) => {
      if (!listenForScrollRef.current || !emblaApi) return;

      const scrollProgress = emblaApi.scrollProgress();
      const slidesInView = emblaApi.slidesInView();
      const lastSlideIndex = emblaApi.slideNodes().length - 1;
      const lastSlideInView = slidesInView.includes(lastSlideIndex);

      // Check if we're at the end of the carousel (either by progress or last slide in view)
      if (
        (scrollProgress > 0.85 || lastSlideInView) &&
        !loading &&
        hasMoreToLoadRef.current
      ) {
        // console.log("Detected end of carousel, loading more...", {scrollProgress,lastSlideInView,currentItems: items.length,});
        loadMoreItems();
      }
    },
    [loadMoreItems, loading, items.length],
  );

  // Set up scroll and scroll end listeners
  useEffect(() => {
    if (!emblaApi) return;

    const handleScroll = () => {
      isScrollingRef.current = true;
      onScroll(emblaApi);
    };

    const handleSelect = () => {
      if (!isScrollingRef.current) {
        onScroll(emblaApi);
      }
    };

    const handleScrollEnd = () => {
      isScrollingRef.current = false;
      onScroll(emblaApi);
    };

    emblaApi.on("scroll", handleScroll);
    emblaApi.on("select", handleSelect);
    emblaApi.on("settle", handleScrollEnd);

    return () => {
      emblaApi.off("scroll", handleScroll);
      emblaApi.off("select", handleSelect);
      emblaApi.off("settle", handleScrollEnd);
    };
  }, [emblaApi, onScroll]);

  // Handle window resize
  useEffect(() => {
    if (!emblaApi) return;

    const onResize = () => {
      requestAnimationFrame(() => {
        if (emblaApi && isMountedRef.current) {
          emblaApi.reInit();
          onScroll(emblaApi);
        }
      });
    };

    window.addEventListener("resize", onResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [emblaApi, onScroll]);

  // Check if initial items are few and we need to load more
  useEffect(() => {
    if (emblaApi && hasMore && items.length < 8 && onLoadMore) {
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          onScroll(emblaApi);
        }
      });
    }
  }, [emblaApi, hasMore, items.length, onLoadMore, onScroll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearLoadingTimeout();
    };
  }, [clearLoadingTimeout]);

  // Update references when props change
  useEffect(() => {
    setHasMore(hasMoreItems);
    hasMoreToLoadRef.current = hasMoreItems;
  }, [hasMoreItems]);

  useEffect(() => {
    if (
      initialItems.length > 0 &&
      items.length > 0 &&
      initialItems[0].id !== items[0].id
    ) {
      setItems(initialItems);
      lastScrollEndIndexRef.current = 0;
    } else if (initialItems.length > 0 && items.length === 0) {
      setItems(initialItems);
      lastScrollEndIndexRef.current = 0;
    }
  }, [initialItems, items]);

  return {
    items,
    loading,
    hasMore,
    emblaRef,
    emblaApi,
  };
}
