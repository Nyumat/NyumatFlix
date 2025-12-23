import { memo } from "react";

export const StableBackground = memo(function StableBackground() {
  return (
    <div className="absolute inset-0 w-full min-h-full z-0">
      <div
        className="w-full min-h-full bg-repeat bg-center"
        style={{
          backgroundImage: "url('/movie-banner.webp')",
          filter: "blur(8px)",
          opacity: 0.3,
        }}
      />
      <div className="absolute inset-0 bg-black/50 -mt-4 -mb-4" />
    </div>
  );
});
