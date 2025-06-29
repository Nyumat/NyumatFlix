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
    <div className={`w-full ${topSpacing ? "mt-4" : ""} ${className}`}>
      {children}
    </div>
  );
}
