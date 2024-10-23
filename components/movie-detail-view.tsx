"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, DollarSign, PlayCircle, Star } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

export function MovieDetailView({ details }) {
  const [showTrailer, setShowTrailer] = useState(false);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const trailer = details.videos.results.find(
    (video) => video.type === "Trailer",
  );

  return (
    <div className="container mx-auto p-4 bg-gray-100 dark:bg-gray-900">
      <div className="flex flex-col lg:flex-row gap-8 mb-8">
        <div className="lg:w-2/3">
          <h1 className="text-4xl font-bold mb-2">{details.title}</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
            {details.tagline}
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {details.genres.map((genre) => (
              <Badge key={genre.id} variant="secondary">
                {genre.name}
              </Badge>
            ))}
          </div>
          <p className="text-lg mb-6">{details.overview}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center">
              <Calendar className="mr-2" />
              <div>
                <p className="font-semibold">Release Date</p>
                <p suppressHydrationWarning>
                  {formatDate(details.release_date)}
                </p>
              </div>
            </div>
            <div className="flex items-center">
              <Clock className="mr-2" />
              <div>
                <p className="font-semibold">Runtime</p>
                <p>{details.runtime} minutes</p>
              </div>
            </div>
            <div className="flex items-center">
              <DollarSign className="mr-2" />
              <div>
                <p className="font-semibold">Budget</p>
                <p>${details.budget.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center">
              <Star className="mr-2" />
              <div>
                <p className="font-semibold">Rating</p>
                <p>{details.vote_average.toFixed(1)} / 10</p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setShowTrailer(!showTrailer)}
            className="flex items-center"
          >
            <PlayCircle className="mr-2" />
            {showTrailer ? "Hide Trailer" : "Watch Trailer"}
          </Button>
        </div>
      </div>

      {showTrailer && trailer && (
        <div className="mb-8">
          <iframe
            width="100%"
            height="500"
            src={`https://www.youtube.com/embed/${trailer.key}`}
            title="Movie Trailer"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="rounded-lg shadow-lg"
          ></iframe>
        </div>
      )}

      <Tabs defaultValue="cast" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="cast">Cast</TabsTrigger>
          <TabsTrigger value="crew">Crew</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>
        <TabsContent value="cast">
          <Card>
            <CardHeader>
              <CardTitle>Cast</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {details.credits.cast.slice(0, 20).map((actor) => (
                    <div
                      key={actor.id}
                      className="flex flex-col items-center text-center"
                    >
                      <Avatar className="w-24 h-24 mb-2">
                        <AvatarImage
                          src={`https://image.tmdb.org/t/p/w200${actor.profile_path}`}
                        />
                        <AvatarFallback>
                          {actor.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold">{actor.name}</p>
                      <p className="text-sm text-gray-500">{actor.character}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="crew">
          <Card>
            <CardHeader>
              <CardTitle>Crew</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {details.credits.crew.slice(0, 20).map((member) => (
                    <div
                      key={`${member.id}-${member.job}`}
                      className="text-center"
                    >
                      <p className="font-semibold">{member.name}</p>
                      <p className="text-sm text-gray-500">{member.job}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {details.recommendations.results.slice(0, 15).map((movie) => (
                    <div key={movie.id} className="text-center">
                      <Image
                        src={`https://image.tmdb.org/t/p/w200${movie.poster_path}`}
                        alt={movie.title}
                        className="rounded-lg shadow-md mb-2 w-full"
                        width={200}
                        height={300}
                      />
                      <p className="font-semibold text-sm">{movie.title}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
