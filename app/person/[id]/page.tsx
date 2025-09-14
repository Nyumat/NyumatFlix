import { getPersonDetails } from "@/app/actions";
import { ContentContainer } from "@/components/layout/content-container";
import { PageContainer } from "@/components/layout/page-container";
import { BackButton } from "@/components/ui/back-button";
import { Calendar, MapPin, User } from "lucide-react";
import { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { memo } from "react";
import { PersonInfiniteContent } from "./inf-scroll";

interface PersonPageProps {
  params: {
    id: string;
  };
}

export async function generateMetadata({
  params,
}: PersonPageProps): Promise<Metadata> {
  const personId = parseInt(params.id);

  if (isNaN(personId)) {
    return {
      title: "Person Not Found",
    };
  }

  try {
    const person = await getPersonDetails(personId);

    if (!person) {
      return {
        title: "Person Not Found",
      };
    }

    return {
      title: `${person.name} - Filmography`,
      description: person.biography
        ? person.biography.substring(0, 160)
        : `View all movies and TV shows featuring ${person.name}`,
    };
  } catch {
    return {
      title: "Person Not Found",
    };
  }
}

const StableBackground = memo(function StableBackground() {
  return (
    <div className="absolute inset-0 w-full min-h-full z-0">
      <div
        className="w-full min-h-full bg-repeat bg-center"
        style={{
          backgroundImage: "url('/movie-banner.webp')",
          filter: "blur(8px)",
          opacity: 0.3,
        }}
      />
      <div className="absolute inset-0 bg-black/50 -mt-4 -mb-4" />
    </div>
  );
});

export default async function PersonPage({ params }: PersonPageProps) {
  const personId = parseInt(params.id);

  if (isNaN(personId)) {
    notFound();
  }

  const person = await getPersonDetails(personId);

  if (!person) {
    notFound();
  }

  return (
    <PageContainer className="pb-4 mb-4">
      <BackButton />
      <div className="relative min-h-screen">
        <StableBackground />
        <div className="relative z-10">
          <ContentContainer
            className="container mx-auto px-4 mt-6 relative z-10"
            topSpacing={false}
          >
            {/* Person Header Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
              {/* Profile Image */}
              <div className="lg:col-span-1">
                <div className="rounded-lg overflow-hidden shadow-xl mt-4 mb-4">
                  {person.profile_path ? (
                    <Image
                      src={`https://image.tmdb.org/t/p/w500${person.profile_path}`}
                      alt={person.name || "Person"}
                      width={500}
                      height={750}
                      className="w-full h-auto"
                    />
                  ) : (
                    <div className="w-full h-[750px] flex items-center justify-center bg-muted">
                      <User size={120} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>

              {/* Person Details */}
              <div className="lg:col-span-2">
                <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-lg p-6 space-y-6 shadow-xl">
                  <h1 className="text-3xl md:text-4xl font-bold text-white">
                    {person.name}
                  </h1>

                  <div className="space-y-3">
                    {person.birthday && (
                      <div className="flex items-center space-x-3">
                        <Calendar size={18} className="text-gray-400" />
                        <span className="text-white">
                          Born: {new Date(person.birthday).toLocaleDateString()}
                        </span>
                      </div>
                    )}

                    {person.place_of_birth && (
                      <div className="flex items-center space-x-3">
                        <MapPin size={18} className="text-gray-400" />
                        <span className="text-white">
                          {person.place_of_birth}
                        </span>
                      </div>
                    )}

                    {person.known_for_department && (
                      <div className="flex items-center space-x-3">
                        <User size={18} className="text-gray-400" />
                        <span className="text-white">
                          Known for: {person.known_for_department}
                        </span>
                      </div>
                    )}
                  </div>

                  {person.biography && (
                    <div className="space-y-3">
                      <h2 className="text-xl font-semibold text-white">
                        Biography
                      </h2>
                      <p className="text-gray-300 leading-relaxed">
                        {person.biography}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Filmography Section */}
            <div className="bg-black/60 backdrop-blur-md border border-white/20 rounded-lg p-6 shadow-xl">
              <div className="space-y-4 mb-6">
                <h2 className="text-2xl font-bold text-white">Filmography</h2>
                <p className="text-gray-300">
                  All movies and TV shows featuring {person.name}, sorted by
                  role importance
                </p>
              </div>

              <PersonInfiniteContent personId={personId} />
            </div>
          </ContentContainer>
        </div>
      </div>
    </PageContainer>
  );
}
