import { MediaItem } from "@/utils/typings";
import { ContentRow, ContentRowProps } from "./content-row";
import { Suspense } from "react";

// This component is a server wrapper for the client-side ContentRow component
// It allows for proper SSR and Suspense support
export function ServerContentRow<T extends MediaItem>(
  props: ContentRowProps<T>,
) {
  return (
    <Suspense fallback={<ContentRowSkeleton />}>
      <ContentRow {...props} />
    </Suspense>
  );
}

// Simple skeleton UI when content is loading
function ContentRowSkeleton() {
  return (
    <div className="mx-4 md:mx-8 mb-8">
      <div className="mb-6">
        <div className="h-8 w-40 bg-gray-700/50 rounded-md animate-pulse"></div>
      </div>
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="min-w-0 shrink-0 basis-[48%] sm:basis-[35%] md:basis-[28%] lg:basis-[22%] xl:basis-[18%] animate-pulse"
          >
            <div className="bg-gray-700/50 rounded-lg aspect-[2/3]"></div>
            <div className="mt-2">
              <div className="h-4 w-3/4 bg-gray-700/50 rounded-md mb-2"></div>
              <div className="h-3 w-1/2 bg-gray-700/50 rounded-md"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
