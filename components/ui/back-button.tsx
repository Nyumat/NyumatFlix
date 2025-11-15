"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "./button";

interface BackButtonProps {
  className?: string;
  fallbackUrl?: string;
}

// routes where we should hide the back button
const HIDE_BACK_BUTTON_ROUTES = [
  "/",
  "/home",
  "/movies",
  "/tvshows",
  "/search",
  "/watchlist",
];

export function BackButton({
  className,
  fallbackUrl = "/home",
}: BackButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  const handleMouseEnter = () => {
    router.prefetch(fallbackUrl);
  };

  // hide on top-level routes
  if (HIDE_BACK_BUTTON_ROUTES.includes(pathname)) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      title="Go back"
      onClick={handleBack}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "relative h-8 w-8 rounded-full",
        className,
      )}
      aria-label="Go back"
    >
      <ChevronLeft size={16} />
    </Button>
  );
}
