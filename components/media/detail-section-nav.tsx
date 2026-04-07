"use client";

import { cn } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useState } from "react";

const SCROLL_OFFSET_PX = 96;

export type DetailSectionItem = {
  id: string;
  label: string;
};

type DetailSectionNavProps = {
  sections: DetailSectionItem[];
  className?: string;
};

export const DetailSectionNav = ({
  sections,
  className,
}: DetailSectionNavProps) => {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? "");

  const sectionIdsKey = useMemo(
    () => sections.map((s) => s.id).join(","),
    [sections],
  );

  useEffect(() => {
    if (!sectionIdsKey) return;

    const ids = sectionIdsKey.split(",").filter(Boolean);
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const first = intersecting[0];
        if (first?.target.id) {
          setActiveId(first.target.id);
        }
      },
      {
        rootMargin: "-12% 0px -55% 0px",
        threshold: [0, 0.1, 0.25, 0.5],
      },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIdsKey]);

  const handleNavigate = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top =
      el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET_PX;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveId(id);
  }, []);

  if (sections.length === 0) return null;

  return (
    <nav aria-label="On this page" className={cn("mb-6 sm:mb-8", className)}>
      <div className="max-w-screen scrollbar-hidden -mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-visible lg:px-0">
        <div
          className="inline-flex min-h-10 w-max max-w-none items-center gap-1 rounded-md border border-border/60 bg-muted/80 p-1 text-muted-foreground backdrop-blur-sm"
          role="tablist"
        >
          {sections.map(({ id, label }) => {
            const isActive = activeId === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={id}
                onClick={() => handleNavigate(id)}
                className={cn(
                  "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
