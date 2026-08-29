import type { SVGProps } from "react";

export function MalIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      {/* Background shape with rounded corners */}
      <rect width="100" height="100" rx="20" fill="#2E51A2" />
      {/* Official styled MAL text emblem in white */}
      <path
        fill="#FFFFFF"
        d="M20 28h13.6l8.8 14.8L51.2 28H64.8v44H52.4V46.6L44.2 59.8h-3.6l-8.2-13.2V72H20V28zm48.8 0h12.4v33.2H92V72H68.8V28z"
      />
    </svg>
  );
}
