"use client";

import Image from "next/image";
import { BackgroundImageProps } from "./types";

export function BackgroundImage({
  isFullPage,
  imageUrl,
  title,
  logo,
  hideTitle = false,
}: BackgroundImageProps) {
  const backgroundImage = imageUrl;

  return (
    <div
      className={`${
        isFullPage
          ? "fixed -mt-5 h-[100dvh] w-full"
          : "absolute w-full h-[40vh] inset-x-0"
      } z-0 overflow-hidden`}
    >
      <Image
        src={backgroundImage}
        alt={title}
        width={1920}
        height={1080}
        className="rounded-lg object-cover w-full h-full"
        priority
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-l from-black/70 via-black/50 to-transparent opacity-70" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-black/50 to-transparent opacity-70" />
      {!hideTitle && (isFullPage || logo) && title && (
        <div className="absolute inset-0 flex items-center justify-center">
          {logo ? (
            <div className="max-w-[300px] md:max-w-[500px] w-auto px-4">
              <Image
                src={`https://image.tmdb.org/t/p/w500${logo.file_path}`}
                alt={title}
                width={logo.width}
                height={logo.height}
                className="max-w-full h-auto"
              />
            </div>
          ) : (
            <div className="text-center my-12 mt-44">
              {logo ? (
                <div className="flex justify-center items-center">
                  <Image
                    src={logo}
                    alt={title}
                    width={400}
                    height={200}
                    className="max-w-full h-auto"
                    priority
                  />
                </div>
              ) : (
                <h1 className="text-6xl md:text-7xl font-bold text-foreground tracking-tight px-4">
                  {title}
                </h1>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
