"use client";
import { Download } from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";

// Modified HackerButton component
interface HackerButtonProps {
  label: string;
  className?: string;
  triggerScramble: boolean;
}

function HackerButton({
  label,
  className,
  triggerScramble,
}: HackerButtonProps) {
  const [displayText, setDisplayText] = useState(label);
  const charset = "abcdefghijklmnopqrstuvwxyz";

  const randomChars = useCallback((length: number) => {
    return Array.from(
      { length },
      () => charset[Math.floor(Math.random() * charset.length)],
    ).join("");
  }, []);

  const scramble = useCallback(
    async (input: string, signal: AbortSignal) => {
      let prefix = "";
      for (let index = 0; index < input.length; index++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (signal.aborted) return;
        prefix += input.charAt(index);
        setDisplayText(prefix + randomChars(input.length - prefix.length));
      }
    },
    [randomChars],
  );

  useEffect(() => {
    const controller = new AbortController();

    if (triggerScramble) {
      void scramble(label, controller.signal);
    } else {
      setDisplayText(label);
    }

    return () => controller.abort();
  }, [triggerScramble, label, scramble]);

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium ring-offset-background transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-primary-foreground hover:bg-primary/90 text-base",
        className,
      )}
    >
      {displayText}
    </span>
  );
}

export default HackerButton;
