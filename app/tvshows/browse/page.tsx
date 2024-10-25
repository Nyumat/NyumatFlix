import { ContentLoader } from "@/components/animated/load-more";
import { TVShowCategory } from "@/utils/typings";
import { Suspense } from "react";
import { InfiniteContent } from "./inf-scroll";

export default async function Page({
  searchParams,
}: {
  searchParams: {
    type?: TVShowCategory;
  };
}) {
  const type = searchParams.type || "popular";
  return (
    <div>
      <main>
        <Suspense
          fallback={
            <div className="mb-20">
              <ContentLoader />
            </div>
          }
        >
          <InfiniteContent type={type} />
        </Suspense>
      </main>
    </div>
  );
}
