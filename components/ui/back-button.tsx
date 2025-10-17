"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "./button";

interface BackButtonProps {
  className?: string;
  fallbackUrl?: string;
}

export function BackButton({
  className,
  fallbackUrl = "/home",
}: BackButtonProps) {
  if (typeof window === "undefined") {
    return null;
  }

  const router = useRouter();

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
      disabled={window.history.length <= 1}
      aria-disabled={window.history.length <= 1}
      onClick={handleBack}
      onMouseEnter={handleMouseEnter}
      className="absolute top-6 left-6 z-30 bg-background/80 hover:bg-background/90 backdrop-blur-sm transition-colors rounded-full p-2 text-foreground border border-border disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label="Go back"
    >
      <ChevronLeft size={24} />
    </Button>
  );
}
