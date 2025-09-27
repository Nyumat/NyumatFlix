"use client";

import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { logger } from "@/lib/utils";
import { MediaItem } from "@/utils/typings";

interface UseContentCarouselOptions {
  initialItems: MediaItem[];
  onLoadMore?: () => Promise<MediaItem[]>;
  hasMoreItems?: boolean;
}

export function useContentCarousel({
  initialItems,
  onLoadMore,
  hasMoreItems = false,
}: UseContentCarouselOptions) {
  const [items, setItems] = useState<MediaItem[]>(initialItems);
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

  // I need to clean up the loading state if it takes too long (e.g. due to a network error).
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
      setLoading(true);
      listenForScrollRef.current = false;

      // I've set a safety timeout to clear the loading state if it takes too long.
      loadingTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          setLoading(false);
          listenForScrollRef.current = true;
        }
      }, 8000); // 8 seconds timeout

      const newItems = await onLoadMore();

      if (isMountedRef.current) {
        clearLoadingTimeout();

        // I'm batching these state updates together for performance.
        if (newItems.length === 0) {
          setHasMore(false);
          hasMoreToLoadRef.current = false;
        } else {
          setItems((prevItems) => [...prevItems, ...newItems]);
        }

        // I'll allow a small delay for the DOM to update before recalculating.
        requestAnimationFrame(() => {
          if (emblaApi && isMountedRef.current) {
            emblaApi.reInit();
            setLoading(false);
            listenForScrollRef.current = true;
          }
        });
      }
    } catch (error) {
      logger.error("Error loading more items", error);
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

      // Here I'm checking if we're at the end of the carousel.
      if (
        (scrollProgress > 0.85 || lastSlideInView) &&
        !loading &&
        hasMoreToLoadRef.current
      ) {
        loadMoreItems();
      }
    },
    [loadMoreItems, loading],
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

  // If the initial items aren't enough, we might need to load more right away.
  useEffect(() => {
    if (emblaApi && hasMore && items.length < 8 && onLoadMore) {
      requestAnimationFrame(() => {
        if (isMountedRef.current) {
          onScroll(emblaApi);
        }
      });
    }
  }, [emblaApi, hasMore, items.length, onLoadMore, onScroll]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearLoadingTimeout();
    };
  }, [clearLoadingTimeout]);

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
