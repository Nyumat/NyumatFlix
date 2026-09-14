"use client";

import useEmblaCarousel, {
  type UseEmblaCarouselType,
} from "embla-carousel-react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  carouselOffsetPanState,
  shouldSnapCarouselWheelPan,
} from "@/lib/carousel-pan";
import { cn } from "@/lib/utils";

type CarouselApi = UseEmblaCarouselType[1];
type UseCarouselParameters = Parameters<typeof useEmblaCarousel>;
type CarouselOptions = UseCarouselParameters[0];
type CarouselPlugin = UseCarouselParameters[1];

const carouselApis = new WeakMap<HTMLElement, NonNullable<CarouselApi>>();

const readCarouselEnginePanState = (api: NonNullable<CarouselApi>) => {
  const engine = api.internalEngine();
  return carouselOffsetPanState(
    engine.offsetLocation.get(),
    engine.limit.min,
    engine.limit.max,
  );
};

const restoreCarouselScrollProgress = (
  api: NonNullable<CarouselApi>,
  progress: number,
) => {
  const clamped = Math.max(0, Math.min(1, progress));
  const engine = api.internalEngine();
  const desired = engine.limit.max - clamped * engine.limit.length;
  const current = engine.offsetLocation.get();
  const distance = desired - current;
  if (Math.abs(distance) < 0.5) return true;

  engine.scrollBody.useDuration(0).useFriction(0);
  engine.scrollTo.distance(distance, false);
  return true;
};

export const captureCarouselScrollProgress = (element: Element) => {
  const carousel = element.closest<HTMLElement>("[data-carousel-root]");
  if (!carousel) return null;
  const api = carouselApis.get(carousel);
  if (!api) return null;
  return api.scrollProgress();
};

export const captureAllCarouselScrollProgresses = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-carousel-root]"))
    .map((root) => carouselApis.get(root)?.scrollProgress())
    .filter((progress): progress is number => typeof progress === "number");

export const restorePageCarouselScrolls = (progresses: number[]) => {
  const roots = Array.from(
    document.querySelectorAll<HTMLElement>("[data-carousel-root]"),
  );
  let restored = 0;

  for (let i = 0; i < Math.min(roots.length, progresses.length); i++) {
    const root = roots[i];
    const progress = progresses[i];
    if (!root || typeof progress !== "number" || !Number.isFinite(progress)) {
      continue;
    }
    const api = carouselApis.get(root);
    if (!api) continue;
    if (restoreCarouselScrollProgress(api, progress)) restored += 1;
  }

  return restored;
};

/**
 * Restore the carousel to its prior free-scroll offset when possible.
 * Avoids api.scrollTo(index), which snaps the clicked card to the start and
 * makes neighboring cards appear to "switch".
 */
export const revealCarouselItem = (
  element: Element,
  scrollProgress?: number,
) => {
  const carousel = element.closest<HTMLElement>("[data-carousel-root]");
  const item = element.closest<HTMLElement>("[data-carousel-item]");
  if (!carousel || !item) return false;

  const api = carouselApis.get(carousel);
  if (!api) return false;

  if (typeof scrollProgress === "number" && Number.isFinite(scrollProgress)) {
    return restoreCarouselScrollProgress(api, scrollProgress);
  }

  const items = Array.from(
    carousel.querySelectorAll<HTMLElement>("[data-carousel-item]"),
  ).filter(
    (candidate) => candidate.closest("[data-carousel-root]") === carousel,
  );
  const itemIndex = items.indexOf(item);
  if (itemIndex < 0) return false;

  // Last resort: only nudge if the card is fully off-screen in the viewport.
  const bounds = item.getBoundingClientRect();
  const viewport =
    carousel.querySelector<HTMLElement>("[data-carousel-viewport]") ?? carousel;
  const viewBounds = viewport.getBoundingClientRect();
  const fullyHidden =
    bounds.right < viewBounds.left || bounds.left > viewBounds.right;
  if (!fullyHidden) return true;

  api.scrollTo(itemIndex, true);
  return true;
};

type CarouselProps = {
  opts?: CarouselOptions;
  plugins?: CarouselPlugin;
  orientation?: "horizontal" | "vertical";
  setApi?: (api: CarouselApi) => void;
};

type CarouselContextProps = {
  carouselRef: ReturnType<typeof useEmblaCarousel>[0];
  api: ReturnType<typeof useEmblaCarousel>[1];
  scrollPrev: () => void;
  scrollNext: () => void;
  canScrollPrev: boolean;
  canScrollNext: boolean;
} & CarouselProps;

const CarouselContext = React.createContext<CarouselContextProps | null>(null);

type CarouselContentProps = React.HTMLAttributes<HTMLDivElement> & {
  /** Classes for the fixed viewport around the moving track. */
  viewportClassName?: string;
};

function useCarousel() {
  const context = React.useContext(CarouselContext);

  if (!context) {
    throw new Error("useCarousel must be used within a <Carousel />");
  }

  return context;
}

const Carousel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & CarouselProps
>(
  (
    {
      orientation = "horizontal",
      opts,
      setApi,
      plugins,
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const [carouselRef, api] = useEmblaCarousel(
      {
        // Keep the final slide reachable when a row is free-dragged. Individual
        // carousels can still opt out when they intentionally need loose bounds.
        containScroll: "trimSnaps",
        ...opts,
        axis: orientation === "horizontal" ? "x" : "y",
      },
      plugins,
    );
    const [canScrollPrev, setCanScrollPrev] = React.useState(false);
    const [canScrollNext, setCanScrollNext] = React.useState(false);
    const rootRef = React.useRef<HTMLDivElement | null>(null);
    const setRootRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    const scrollPrev = React.useCallback(() => {
      if (!api) {
        return;
      }

      if (api.canScrollPrev()) {
        api.scrollPrev();
        return;
      }

      if (readCarouselEnginePanState(api).canPanPrev) {
        restoreCarouselScrollProgress(api, 0);
      }
    }, [api]);

    const scrollNext = React.useCallback(() => {
      if (!api) {
        return;
      }

      if (api.canScrollNext()) {
        api.scrollNext();
        return;
      }

      if (readCarouselEnginePanState(api).canPanNext) {
        restoreCarouselScrollProgress(api, 1);
      }
    }, [api]);

    const handleKeyDown = React.useCallback(
      (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          scrollPrev();
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          scrollNext();
        }
      },
      [scrollPrev, scrollNext],
    );

    React.useEffect(() => {
      if (!api || !setApi) {
        return;
      }

      setApi(api);
    }, [api, setApi]);

    React.useLayoutEffect(() => {
      const root = rootRef.current;
      if (!root || !api) return;

      carouselApis.set(root, api);
      return () => {
        carouselApis.delete(root);
      };
    }, [api]);

    React.useEffect(() => {
      if (!api) {
        return;
      }

      const updateScrollAvailability = (carouselApi: CarouselApi) => {
        if (!carouselApi) {
          return;
        }

        const panState = readCarouselEnginePanState(carouselApi);
        setCanScrollPrev(panState.canPanPrev);
        setCanScrollNext(panState.canPanNext);
      };

      updateScrollAvailability(api);
      api.on("reInit", updateScrollAvailability);
      api.on("select", updateScrollAvailability);
      api.on("scroll", updateScrollAvailability);

      return () => {
        api.off("reInit", updateScrollAvailability);
        api.off("select", updateScrollAvailability);
        api.off("scroll", updateScrollAvailability);
      };
    }, [api]);

    return (
      <CarouselContext.Provider
        value={{
          carouselRef,
          api: api,
          opts,
          orientation:
            orientation || (opts?.axis === "y" ? "vertical" : "horizontal"),
          scrollPrev,
          scrollNext,
          canScrollPrev,
          canScrollNext,
        }}
      >
        <div
          ref={setRootRef}
          data-carousel-root=""
          onKeyDownCapture={handleKeyDown}
          className={cn("relative", className)}
          role="region"
          aria-roledescription="carousel"
          {...props}
        >
          {children}
        </div>
      </CarouselContext.Provider>
    );
  },
);
Carousel.displayName = "Carousel";

const CarouselContent = React.forwardRef<HTMLDivElement, CarouselContentProps>(
  ({ className, viewportClassName, ...props }, ref) => {
    const { api, carouselRef, orientation } = useCarousel();
    const apiRef = React.useRef(api);
    const orientationRef = React.useRef(orientation);
    const viewportRef = React.useRef<HTMLDivElement | null>(null);
    const setViewportRef = React.useCallback(
      (node: HTMLDivElement | null) => {
        viewportRef.current = node;
        carouselRef(node);
      },
      [carouselRef],
    );

    React.useEffect(() => {
      apiRef.current = api;
      orientationRef.current = orientation;
    }, [api, orientation]);

    React.useEffect(() => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const handleWheel = (event: WheelEvent) => {
        const currentApi = apiRef.current;
        if (
          orientationRef.current !== "horizontal" ||
          !currentApi ||
          event.ctrlKey
        ) {
          return;
        }

        const absX = Math.abs(event.deltaX);
        const absY = Math.abs(event.deltaY);
        const shiftWheel = event.shiftKey && absY > 0;
        const horizontalDelta = shiftWheel ? event.deltaY : event.deltaX;

        if (Math.abs(horizontalDelta) < 0.2) return;
        // Keep clearly vertical page-scroll, but treat diagonal Mac
        // trackpad swipes as carousel pans.
        if (!shiftWheel && absY > absX * 1.15) return;

        const goingNext = horizontalDelta > 0;
        const panState = readCarouselEnginePanState(currentApi);
        const canPan = goingNext ? panState.canPanNext : panState.canPanPrev;
        if (!canPan) return;

        event.preventDefault();

        const deltaMultiplier =
          event.deltaMode === 1
            ? 16
            : event.deltaMode === 2
              ? viewport.clientWidth
              : 1;
        const signedDistance = -(horizontalDelta * deltaMultiplier);
        const moveDistance = Math.abs(signedDistance);
        const panDirection = goingNext ? "next" : "prev";

        if (shouldSnapCarouselWheelPan(panDirection, moveDistance, panState)) {
          restoreCarouselScrollProgress(currentApi, goingNext ? 1 : 0);
          return;
        }

        const engine = currentApi.internalEngine();
        engine.scrollBody.useDuration(0).useFriction(0);
        engine.scrollTo.distance(signedDistance, false);
      };

      viewport.addEventListener("wheel", handleWheel, {
        passive: false,
        capture: true,
      });
      return () => {
        viewport.removeEventListener("wheel", handleWheel, { capture: true });
      };
    }, []);

    return (
      <div
        ref={setViewportRef}
        data-carousel-viewport=""
        className={cn(
          "scrollbar-hide w-full min-w-0 overflow-hidden overscroll-x-contain",
          viewportClassName,
        )}
      >
        <div
          ref={ref}
          data-carousel-content=""
          className={cn(
            "flex min-w-0",
            orientation === "horizontal" ? "-ml-4" : "-mt-4 flex-col",
            orientation === "horizontal" && "pr-4",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
CarouselContent.displayName = "CarouselContent";

const CarouselItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  const { orientation } = useCarousel();

  return (
    <div
      ref={ref}
      data-carousel-item=""
      role="group"
      aria-roledescription="slide"
      className={cn(
        "min-w-0 shrink-0 grow-0 basis-full",
        orientation === "horizontal" ? "pl-4" : "pt-4",
        className,
      )}
      {...props}
    />
  );
});
CarouselItem.displayName = "CarouselItem";

const CarouselPrevious = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollPrev, canScrollPrev } = useCarousel();

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute  h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-left-12 top-1/2 -translate-y-1/2"
          : "-top-12 left-1/2 -translate-x-1/2 rotate-90",
        className,
      )}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      {...props}
    >
      <ArrowLeft className="h-4 w-4" />
      <span className="sr-only">Previous slide</span>
    </Button>
  );
});
CarouselPrevious.displayName = "CarouselPrevious";

const CarouselNext = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<typeof Button>
>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollNext, canScrollNext } = useCarousel();

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn(
        "absolute h-8 w-8 rounded-full",
        orientation === "horizontal"
          ? "-right-12 top-1/2 -translate-y-1/2"
          : "-bottom-12 left-1/2 -translate-x-1/2 rotate-90",
        className,
      )}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ArrowRight className="h-4 w-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  );
});
CarouselNext.displayName = "CarouselNext";

export {
  type CarouselApi,
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
};
