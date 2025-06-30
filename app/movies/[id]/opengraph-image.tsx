import { ImageResponse } from "next/og";
import { fetchMediaDetails } from "@/app/actions";

export const alt = "Movie | NyumatFlix";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

// Define a type for movie genres
interface Genre {
  id: number;
  name: string;
}

export default async function Image({ params }: { params: { id: string } }) {
  const movie = await fetchMediaDetails(params.id);

  if (!movie) {
    // Fallback image for movies not found
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
            Movie Not Found
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

  const title = movie.title || "Movie";
  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : "";
  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : "";
  const releaseYear = movie.release_date
    ? new Date(movie.release_date).getFullYear()
    : "";
  const rating = movie.vote_average
    ? ((movie.vote_average / 10) * 5).toFixed(1)
    : "";

  // Format categories
  let categories = "";
  if (movie.genres && movie.genres.length > 0) {
    categories = movie.genres
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
          backgroundColor: "#0f172a",
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
              "linear-gradient(to right, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.7) 50%, rgba(15, 23, 42, 0.4) 100%)",
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
              <img
                src={posterUrl}
                width={300}
                height={450}
                style={{
                  objectFit: "cover",
                }}
              />
            </div>
          )}

          {/* Movie info */}
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
              {releaseYear && (
                <span
                  style={{
                    marginLeft: "15px",
                    color: "#e2e8f0",
                    fontWeight: 600,
                  }}
                >
                  ({releaseYear})
                </span>
              )}
            </h1>

            {categories && (
              <div
                style={{
                  fontSize: 24,
                  color: "#94a3b8",
                  marginBottom: "20px",
                }}
              >
                {categories}
              </div>
            )}

            {movie.overview && (
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
                {movie.overview}
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
            backgroundColor: "rgba(15, 23, 42, 0.8)",
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
