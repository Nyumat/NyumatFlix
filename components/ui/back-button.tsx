"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "./button";

interface BackButtonProps {
  className?: string;
  fallbackUrl?: string;
}

export function BackButton({
  className,
  fallbackUrl = "/home",
}: BackButtonProps) {
  const [isClient, setIsClient] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    setCanGoBack(window.history.length > 1);
  }, []);

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  const handleMouseEnter = () => {
    router.prefetch(fallbackUrl);
  };

  return (
    <Button
      title="Go back"
      disabled={!isClient || !canGoBack}
      aria-disabled={!isClient || !canGoBack}
      onClick={handleBack}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "absolute top-6 left-6 z-30 bg-background/80 hover:bg-background/90 backdrop-blur-sm transition-colors rounded-full p-2 text-foreground border border-border disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
      aria-label="Go back"
    >
      <ChevronLeft size={24} />
    </Button>
  );
}
