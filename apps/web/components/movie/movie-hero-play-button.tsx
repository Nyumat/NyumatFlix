"use client";

import { requestDetailPlay } from "@/lib/playback/detail-autoplay-href";
import { pages } from "@/config/pages";
import { Play } from "lucide-react";
import { useRouter } from "next/navigation";

export function MovieHeroPlayButton({ itemId }: { itemId: number }) {
  const router = useRouter();
  const href = `${pages.movie.root.link}/${itemId}`;

  return (
    <button
      type="button"
      onClick={() =>
        requestDetailPlay((target) => router.push(target), href, {
          mediaType: "movie",
        })
      }
      className="inline-flex cursor-pointer items-center justify-center whitespace-nowrap rounded-full border border-white/60 bg-white px-4 py-2 text-sm font-bold text-black shadow-lg transition hover:border-white/70 hover:bg-white/90 hover:shadow-xl"
    >
      <Play className="mr-2 size-4 fill-black text-black" />
      Play
    </button>
  );
}
