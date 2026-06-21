import { memo } from "react";

export const StableBackground = memo(function StableBackground() {
  return <div className="absolute inset-0 w-full min-h-full z-0 bg-black" />;
});
