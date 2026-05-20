/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects: async () => {
    return [
      {
        source: "/home",
        destination: "/",
        permanent: true,
      },
      {
        source: "/movie",
        destination: "/movies",
        permanent: true,
      },
      {
        source: "/tv",
        destination: "/tvshows",
        permanent: true,
      },
      {
        source: "/movies/top_rated",
        destination: "/movies?view=top_rated",
        permanent: true,
      },
    ];
  },
  transpilePackages: [
    "gsap",
    "react-three-fiber",
    "@react-three/drei",
    "three",
  ],
  images: {
    unoptimized: true,
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "github.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "image.tmdb.org",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "s4.anilist.co",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    taint: true,
    browserDebugInfoInTerminal: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
