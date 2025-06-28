"use client";

import { Calendar, Clock, DollarSign, Star } from "lucide-react";

interface HeroDetailsProps {
  formattedDate: string;
  runtime?: number;
  budget?: number;
  voteAverage?: number;
  isWatch: boolean;
  seasons?: number;
  episodes?: number;
}

export function HeroDetails({
  formattedDate,
  runtime,
  budget,
  voteAverage,
  isWatch,
  seasons,
  episodes,
}: HeroDetailsProps) {
  const showDuration = runtime !== undefined;
  const showBudget = budget !== undefined && budget > 0;
  const showSeasons = seasons !== undefined && seasons > 0;
  const showEpisodes = episodes !== undefined && episodes > 0;

  return (
    <div className="flex items-center flex-wrap gap-3 mb-4 text-gray-300">
      {formattedDate && (
        <div className="flex items-center">
          <Calendar className="mr-2" size={16} />
          <span suppressHydrationWarning>{formattedDate}</span>
        </div>
      )}

      {isWatch && showDuration && (
        <div className="flex items-center">
          <Clock className="mr-2" size={16} />
          <span>{runtime} min</span>
        </div>
      )}

      {isWatch && showBudget && (
        <div className="flex items-center">
          <DollarSign className="mr-2" size={16} />
          <span>${budget?.toLocaleString()}</span>
        </div>
      )}

      {isWatch && showSeasons && (
        <div className="flex items-center">
          <span className="mr-2">Seasons: {seasons}</span>
        </div>
      )}

      {isWatch && showEpisodes && (
        <div className="flex items-center">
          <span className="mr-2">Episodes: {episodes}</span>
        </div>
      )}

      {voteAverage !== undefined && (
        <div className="flex items-center">
          <Star className="mr-2" size={16} />
          <span>{voteAverage?.toFixed(1)}</span>
        </div>
      )}
    </div>
  );
}
