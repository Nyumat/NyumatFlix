import { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

/**
 * A reusable page container component that provides consistent
 * styling across all pages (home, movies, TV shows, etc.)
 */
export function PageContainer({
  children,
  className = "",
}: PageContainerProps) {
  return (
    <div className={`min-h-screen bg-background ${className}`}>{children}</div>
  );
}
