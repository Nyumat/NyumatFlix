import { ImageResponse } from "next/og";
import { fetchMediaDetails } from "@/app/actions";
import * as ImageComponent from "next/legacy/image";

export const alt = "TV Show | NyumatFlix";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Define a type for TV show genres
interface Genre {
  id: number;
  name: string;
}

export default async function Image({ params }: { params: { id: string } }) {
  const tvShow = await fetchMediaDetails(params.id);

  if (!tvShow) {
    // Fallback image for TV shows not found
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            backgroundColor: "#0f172a",
            padding: 40,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <h1
            style={{
              fontSize: 60,
              fontWeight: 700,
              color: "white",
              textAlign: "center",
            }}
          >
            TV Show Not Found
          </h1>
          <p
            style={{
              fontSize: 30,
              color: "#94a3b8",
              textAlign: "center",
              margin: 0,
              marginTop: 16,
            }}
          >
            NyumatFlix
          </p>
        </div>
      ),
      { ...size },
    );
  }

  const title = tvShow.name || "TV Show";
  const backdropUrl = tvShow.backdrop_path
    ? `https://image.tmdb.org/t/p/original${tvShow.backdrop_path}`
    : "";
  const posterUrl = tvShow.poster_path
    ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}`
    : "";
  const firstAirYear = tvShow.first_air_date
    ? new Date(tvShow.first_air_date).getFullYear()
    : "";
  const rating = tvShow.vote_average
    ? ((tvShow.vote_average / 10) * 5).toFixed(1)
    : "";

  // Format seasons/episodes info
  const seasonsInfo = tvShow.number_of_seasons
    ? `${tvShow.number_of_seasons} Season${tvShow.number_of_seasons > 1 ? "s" : ""}`
    : "";
  const episodesInfo = tvShow.number_of_episodes
    ? `${tvShow.number_of_episodes} Episode${tvShow.number_of_episodes > 1 ? "s" : ""}`
    : "";

  // Format categories
  let categories = "";
  if (tvShow.genres && tvShow.genres.length > 0) {
    categories = tvShow.genres
      .slice(0, 3)
      .map((genre: Genre) => genre.name)
      .join(" • ");
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          backgroundColor: "#1e40af",
          position: "relative",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Backdrop image with gradient overlay */}
        {backdropUrl && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundImage: `url(${backdropUrl})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "brightness(0.5)",
              zIndex: 0,
            }}
          />
        )}

        {/* Gradient overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              "linear-gradient(to right, rgba(30, 64, 175, 0.9) 0%, rgba(30, 64, 175, 0.7) 50%, rgba(30, 64, 175, 0.4) 100%)",
            zIndex: 1,
          }}
        />

        {/* Content container */}
        <div
          style={{
            display: "flex",
            width: "100%",
            padding: "60px",
            zIndex: 2,
            position: "relative",
          }}
        >
          {/* Poster image */}
          {posterUrl && (
            <div
              style={{
                marginRight: "50px",
                flexShrink: 0,
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
                borderRadius: "8px",
                overflow: "hidden",
                height: "450px",
                width: "300px",
              }}
            >
              <ImageComponent.default
                alt={title}
                src={posterUrl}
                width={300}
                height={450}
                style={{
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {/* TV Show info */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              flexGrow: 1,
              overflow: "hidden",
            }}
          >
            <h1
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: "white",
                margin: 0,
                marginBottom: "8px",
                lineHeight: 1.2,
                textShadow: "0 4px 8px rgba(0, 0, 0, 0.5)",
              }}
            >
              {title}
              {firstAirYear && (
                <span
                  style={{
                    marginLeft: "15px",
                    color: "#e2e8f0",
                    fontWeight: 600,
                  }}
                >
                  ({firstAirYear})
                </span>
              )}
            </h1>

            {categories && (
              <div
                style={{
                  fontSize: 24,
                  color: "#94a3b8",
                  marginBottom: "16px",
                }}
              >
                {categories}
              </div>
            )}

            {/* Seasons/Episodes info */}
            {(seasonsInfo || episodesInfo) && (
              <div
                style={{
                  display: "flex",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                {seasonsInfo && (
                  <div
                    style={{
                      backgroundColor: "#3b82f6",
                      fontSize: 20,
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      color: "white",
                    }}
                  >
                    {seasonsInfo}
                  </div>
                )}

                {episodesInfo && (
                  <div
                    style={{
                      backgroundColor: "#0ea5e9",
                      fontSize: 20,
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontWeight: 600,
                      color: "white",
                    }}
                  >
                    {episodesInfo}
                  </div>
                )}
              </div>
            )}

            {tvShow.overview && (
              <p
                style={{
                  fontSize: 24,
                  color: "#e2e8f0",
                  lineHeight: 1.5,
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "700px",
                  margin: 0,
                  marginBottom: "24px",
                }}
              >
                {tvShow.overview}
              </p>
            )}

            {/* Rating badge */}
            {rating && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: "10px",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#f59e0b",
                    color: "black",
                    fontWeight: 700,
                    fontSize: 28,
                    padding: "8px 16px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  ★ {rating}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* NyumatFlix brand */}
        <div
          style={{
            position: "absolute",
            bottom: 30,
            right: 40,
            backgroundColor: "rgba(30, 64, 175, 0.8)",
            padding: "8px 20px",
            borderRadius: "30px",
            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.4)",
          }}
        >
          <p
            style={{
              color: "white",
              fontSize: 20,
              fontWeight: 700,
              margin: 0,
              letterSpacing: "0.5px",
            }}
          >
            NYUMATFLIX
          </p>
        </div>
      </div>
    ),
    { ...size },
  );
}
