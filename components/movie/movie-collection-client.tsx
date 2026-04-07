"use client";

import { fetchCollectionDetails } from "@/app/actions/media-detail-tab-data";
import { MediaBackdrop } from "@/components/media/media-shared";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/query-keys";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

type MovieCollectionClientProps = {
  collectionId: number;
};

export const MovieCollectionClient = ({
  collectionId,
}: MovieCollectionClientProps) => {
  const { data: collection } = useQuery({
    queryKey: queryKeys.movieCollection(collectionId),
    queryFn: () => fetchCollectionDetails(collectionId),
  });

  if (!collection) return null;

  return (
    <div className="h-hero relative w-full">
      <MediaBackdrop image={collection.backdrop_path} alt={collection.name} />
      <div className="overlay">
        <div className="p-4 md:p-10">
          <p className="line-clamp-3 text-xs text-muted-foreground md:text-lg">
            Part of
          </p>
          <h2 className="line-clamp-1 text-lg font-medium md:text-2xl">
            {collection.name}
          </h2>
          <p className="mb-4 line-clamp-1 max-w-2xl text-muted-foreground">
            Includes: {collection.parts.map((part) => part.title).join(", ")}
          </p>
          <Button asChild>
            <Link href={`/collection/${collectionId}`}>
              View the collection
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};
