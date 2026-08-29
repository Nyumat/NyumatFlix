"use client";

import { AppErrorFallback } from "@/components/ui/app-error-fallback";
import { useEffect } from "react";

type GlobalErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalErrorPage({
  error,
  reset,
}: GlobalErrorPageProps) {
  useEffect(() => {
    console.error("Global error boundary caught an error:", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background font-sans">
        <AppErrorFallback
          reset={reset}
          message="A top-level app error occurred. Try again, or refresh if the page cannot recover."
        />
      </body>
    </html>
  );
}
