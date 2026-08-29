"use client";

import { Button } from "@/components/ui/button";

type AppErrorFallbackProps = {
  reset?: () => void;
  title?: string;
  message?: string;
};

export function AppErrorFallback({
  reset,
  title = "Something went wrong",
  message = "The app hit an unexpected error. You can try again without losing your place.",
}: AppErrorFallbackProps) {
  return (
    <div className="mx-auto flex min-h-[55vh] w-full max-w-2xl items-center justify-center px-4 py-16">
      <div className="w-full rounded-lg border border-border/70 bg-card/55 p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {message}
        </p>
        {reset ? (
          <Button className="mt-6" onClick={reset} type="button">
            Try again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
