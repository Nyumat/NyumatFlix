"use client";

import { Play, Plus } from "lucide-react";
import Link from "next/link";

interface HeroButtonsProps {
  isWatch: boolean;
  handleWatch: () => void;
  handlePlayTrailer: () => void;
  mediaId: number;
}

export function HeroButtons({
  isWatch,
  handleWatch,
  handlePlayTrailer,
  mediaId,
}: HeroButtonsProps) {
  return (
    <div className="flex items-center space-x-4">
      {isWatch ? (
        <button
          className="bg-primary text-primary-foreground py-3 px-6 rounded-full font-bold hover:bg-primary/80 transition flex items-center"
          onClick={handleWatch}
        >
          <Play className="mr-2" size={20} />
          Watch Now
        </button>
      ) : (
        <Link href={`/movies/${mediaId}`}>
          <div className="bg-primary text-primary-foreground py-3 px-6 rounded-full font-bold hover:bg-primary/80 transition flex items-center">
            <Play className="mr-2" size={20} />
            Watch Now
          </div>
        </Link>
      )}

      <button
        className="border border-foreground/20 text-foreground py-3 px-6 rounded-full font-bold hover:bg-foreground hover:text-background transition flex items-center"
        onClick={handlePlayTrailer}
      >
        <Plus className="mr-2" size={20} />
        Watch Trailer
      </button>
    </div>
  );
}
