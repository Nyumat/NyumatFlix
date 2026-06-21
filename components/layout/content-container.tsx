import { ReactNode } from "react";

interface ContentContainerProps {
  children: ReactNode;
  className?: string;
  topSpacing?: boolean; // Controls spacing at the top
}

/**
 * A reusable content container component that provides consistent
 * styling for page content (used inside PageContainer)
 */
export function ContentContainer({
  children,
  className = "",
  topSpacing = true,
}: ContentContainerProps) {
  return (
    <div
      className={`w-full ${topSpacing ? "pt-6 md:pt-8" : "pt-0"} ${className}`}
    >
      {children}
    </div>
  );
}
