/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "gsap",
    "react-three-fiber",
    "@react-three/drei",
    "three",
  ],
  optimizeFonts: true,
  images: {
    unoptimized: true,
    // minimumCacheTTL: 2678400,
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
    ],
  },
  experimental: {
    scrollRestoration: true,
    taint: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
};

export default nextConfig;
