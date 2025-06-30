import { ImageResponse } from "next/og";

export const alt = "TV Shows | NyumatFlix";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
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
          backgroundColor: "#1e40af",
          backgroundImage: "linear-gradient(to bottom, #1e40af, #3b82f6)",
          padding: 40,
          fontFamily: "Inter, sans-serif",
          position: "relative",
        }}
      >
        {/* Blurred gradient background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.4,
            filter: "blur(20px)",
          }}
        />

        {/* Content container with slight transparency */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            backgroundColor: "rgba(30, 64, 175, 0.8)",
            padding: "40px 60px",
            borderRadius: 15,
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.6)",
          }}
        >
          <h1
            style={{
              fontSize: 80,
              fontWeight: 700,
              color: "white",
              textAlign: "center",
              margin: 0,
              marginBottom: 16,
              textShadow: "0 2px 10px rgba(0, 0, 0, 0.3)",
            }}
          >
            TV Shows
          </h1>
          <p
            style={{
              fontSize: 32,
              color: "#e2e8f0",
              textAlign: "center",
              margin: 0,
              marginBottom: 24,
              maxWidth: 800,
            }}
          >
            Discover popular and top-rated series on NyumatFlix
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 20,
            }}
          >
            <span
              style={{
                fontSize: 24,
                color: "white",
                backgroundColor: "#10b981",
                padding: "8px 20px",
                borderRadius: 40,
                fontWeight: 600,
                marginRight: 12,
              }}
            >
              POPULAR
            </span>
            <span
              style={{
                fontSize: 24,
                color: "white",
                backgroundColor: "#8b5cf6",
                padding: "8px 20px",
                borderRadius: 40,
                fontWeight: 600,
              }}
            >
              TOP RATED
            </span>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 30,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            NYUMATFLIX
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
