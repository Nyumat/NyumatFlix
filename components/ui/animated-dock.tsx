"use client";

import { ChevronUp, Grid2X2, List } from "lucide-react";
import { useEffect, useState } from "react";
import type { ViewMode } from "@/components/content-grid";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface DockItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  variant?: "default" | "ghost";
}

interface AnimatedDockProps {
  items: DockItem[];
  showScrollToTop?: boolean;
  className?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export function AnimatedDock({
  items,
  showScrollToTop = true,
  className,
  position = "bottom-right",
}: AnimatedDockProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", toggleVisibility);
    return () => window.removeEventListener("scroll", toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const positionClasses = {
    "bottom-right": "bottom-6 right-6",
    "bottom-left": "bottom-6 left-6",
    "top-right": "top-6 right-6",
    "top-left": "top-6 left-6",
  };

  const allItems = [
    ...(items || []),
    ...(showScrollToTop
      ? [
          {
            id: "scroll-to-top",
            icon: <ChevronUp className="w-5 h-5" />,
            label: "Scroll to top",
            onClick: scrollToTop,
            active: false,
          },
        ]
      : []),
  ];

  if (!isVisible && showScrollToTop) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex items-center gap-2 p-2 bg-background/80 backdrop-blur-md border border-border/50 rounded-full shadow-lg transition-all duration-300",
        positionClasses[position],
        isExpanded ? "scale-105" : "scale-100",
        className,
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {allItems.map((item, _index) => (
        <Button
          key={item.id}
          variant={item.active ? "default" : "ghost"}
          size="sm"
          onClick={item.onClick}
          className={cn(
            "relative h-10 w-10 rounded-full transition-all duration-200 hover:scale-110",
            item.active && "bg-primary text-primary-foreground",
            isExpanded && "w-auto px-3",
          )}
          aria-label={item.label}
        >
          <div className="flex items-center gap-2">
            {item.icon}
            {isExpanded && (
              <span className="text-sm font-medium opacity-0 animate-in fade-in duration-200">
                {item.label}
              </span>
            )}
          </div>

          {/* Animated background pulse for active items */}
          {item.active && (
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse" />
          )}
        </Button>
      ))}
    </div>
  );
}

// Preset component for view mode controls
interface ViewModeDockProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showScrollToTop?: boolean;
  className?: string;
  position?: "bottom-right" | "bottom-left" | "top-right" | "top-left";
}

export function ViewModeDock({
  viewMode,
  onViewModeChange,
  showScrollToTop = true,
  className,
  position = "bottom-right",
}: ViewModeDockProps) {
  const items: DockItem[] = [
    {
      id: "grid-view",
      icon: <Grid2X2 className="w-5 h-5" />,
      label: "Grid view",
      onClick: () => onViewModeChange("grid"),
      active: viewMode === "grid",
    },
    {
      id: "list-view",
      icon: <List className="w-5 h-5" />,
      label: "List view",
      onClick: () => onViewModeChange("list"),
      active: viewMode === "list",
    },
  ];

  return (
    <AnimatedDock
      items={items}
      showScrollToTop={showScrollToTop}
      className={className}
      position={position}
    />
  );
}
