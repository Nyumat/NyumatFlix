"use client";

import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
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
      variant="ghost"
      size="sm"
      onClick={handleBack}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "fixed top-20 left-6 z-50 bg-background/80 backdrop-blur-md border border-border/50 hover:bg-background/90 transition-all duration-200",
        className,
      )}
      aria-label="Go back"
    >
      <ArrowLeft className="w-4 h-4 mr-2" />
      Back
    </Button>
  );
}
