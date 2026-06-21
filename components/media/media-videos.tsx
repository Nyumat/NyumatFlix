"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { type Video } from "@/tmdb/models";
import { yt } from "@/tmdb/utils";
import { Play } from "lucide-react";
import Image from "next/image";
import React, { type ComponentProps } from "react";

interface MediaVideosCardProps extends ComponentProps<"div"> {
  name: string;
  ytKey: string;
}

export const MediaVideosCard: React.FC<MediaVideosCardProps> = ({
  name,
  ytKey,
  className,
  ...props
}) => (
  <div
    className={cn(
      "relative aspect-video cursor-pointer overflow-hidden rounded-md border border-white/10 bg-black",
      className,
    )}
    {...props}
  >
    <Image
      className="object-cover"
      src={yt.thumbnail(ytKey)}
      alt={name}
      fill
      sizes="(max-width: 768px) 100vw, 33vw"
    />
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between bg-linear-to-t from-black/90 via-black/25 to-black/40 p-4 md:p-6">
      <div className="flex flex-1 items-center justify-center">
        <Play
          className="size-10 text-white drop-shadow-md md:size-12"
          aria-hidden
        />
      </div>
      <h3 className="line-clamp-2 text-center text-sm font-semibold text-white drop-shadow md:text-left md:text-lg">
        {name}
      </h3>
    </div>
  </div>
);

interface MediaVideosProps {
  videos: Video[];
}

export const MediaVideos: React.FC<MediaVideosProps> = ({ videos }) => {
  if (!videos?.length) return <div className="empty-box">No videos</div>;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {videos.map(({ id, key, name }) => (
        <Dialog key={id} modal>
          <DialogTrigger asChild>
            <MediaVideosCard name={name} ytKey={key} />
          </DialogTrigger>

          <DialogContent className="max-w-(--breakpoint-lg)">
            <DialogHeader>
              <DialogTitle>{name}</DialogTitle>
            </DialogHeader>

            <iframe
              className="aspect-square size-full rounded-md sm:aspect-video"
              src={yt.video(key, true)}
              allow="autoplay; encrypted-media"
              allowFullScreen={true}
            />
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
};
