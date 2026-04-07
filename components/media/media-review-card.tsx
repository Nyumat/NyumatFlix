import type { Review } from "@/tmdb/models";
import { format, tmdbImage } from "@/tmdb/utils";
import { Star } from "lucide-react";
import Image from "next/image";

type MediaReviewCardProps = {
  review: Review;
};

export const MediaReviewCard = ({ review }: MediaReviewCardProps) => {
  const { author, author_details, content, created_at, updated_at } = review;
  const avatar = author_details?.avatar_path;
  const rating = author_details?.rating;

  return (
    <article className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4 shadow-sm backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative size-10 shrink-0 overflow-hidden rounded-full bg-muted">
          {avatar ? (
            <Image
              src={tmdbImage.profile(
                avatar.startsWith("/") ? avatar.slice(1) : avatar,
                "w185",
              )}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex size-full items-center justify-center text-xs text-muted-foreground">
              {author.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium leading-tight text-foreground">{author}</p>
          <p className="text-xs text-muted-foreground">
            {format.date(created_at)}
            {updated_at !== created_at
              ? ` · edited ${format.date(updated_at)}`
              : ""}
          </p>
        </div>
        {typeof rating === "number" && rating > 0 && (
          <div className="flex items-center gap-1 text-sm text-amber-500">
            <Star className="size-4 fill-current" aria-hidden />
            <span>{rating}/10</span>
          </div>
        )}
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {content}
      </p>
    </article>
  );
};
