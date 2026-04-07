"use client";

import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface BackButtonProps {
  className?: string;
  fallbackUrl?: string;
}

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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  if (!mounted) {
    return <div className="h-8 w-8 shrink-0" aria-hidden />;
  }

  if (HIDE_BACK_BUTTON_ROUTES.includes(pathname)) {
    return null;
  }

  return (
    <button
      type="button"
      title="Go back"
      onClick={handleBack}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "h-8 w-8 rounded-full backdrop-blur-md bg-white/10 border border-white/30 text-white hover:bg-white/20 hover:border-white/40 transition-all shrink-0 flex items-center justify-center shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-transparent",
        className,
      )}
      aria-label="Go back"
    >
      <ChevronLeft
        size={18}
        className="text-white drop-shadow-lg"
        strokeWidth={2.5}
      />
    </button>
  );
}
