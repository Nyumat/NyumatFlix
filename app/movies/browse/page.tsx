import { ContentLoader } from "@/components/animated/load-more";
import { Suspense } from "react";
import { InfiniteContent } from "./inf-scroll";
import { MovieCategory } from "@/utils/typings";

export default async function Page({
  searchParams,
}: {
  searchParams: {
    type?: MovieCategory;
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
