"use client";

import { Calendar, Clock, DollarSign, Star } from "lucide-react";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface HeroDetailsProps {
  formattedDate: string;
  runtime?: number;
  budget?: number;
  voteAverage?: number;
  isWatch: boolean;
  seasons?: number;
  episodes?: number;
  isUpcoming?: boolean;
}

export function HeroDetails({
  formattedDate,
  runtime,
  budget,
  voteAverage,
  isWatch,
  seasons,
  episodes,
  isUpcoming = false,
}: HeroDetailsProps) {
  const showDuration = runtime !== undefined && runtime > 0 && !isUpcoming;
  const showBudget = budget !== undefined && budget > 0 && !isUpcoming;
  const showSeasons = seasons !== undefined && seasons > 0;
  const showEpisodes = episodes !== undefined && episodes > 0;
  const showRating =
    voteAverage !== undefined && voteAverage > 0 && !isUpcoming;

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

      {showRating && (
        <div className="flex items-center">
          <Star className="mr-2" size={16} />
          <span>{voteAverage?.toFixed(1)}</span>
        </div>
      )}

      {isUpcoming && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="chrome" className="text-sm px-4 py-1.5 cursor-help">
              Upcoming
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>This content is not yet available for streaming</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
