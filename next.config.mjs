/** @type {import('next').NextConfig} */
const moviPlayerResolveAliases = {
  "movi-player/element": false,
  "movi-player": false,
};

const nextConfig = {
  assetPrefix:
    process.env.NODE_ENV === "production"
      ? "https://cdn.nyumatflix.com"
      : undefined,
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/scrape": ["./node_modules/undici/**/*"],
    "/api/scrape/anime": ["./node_modules/undici/**/*"],
  },
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
  rewrites: async () => {
    return [
      {
        source: "/assets/client-runtime.js",
        destination: "https://cloud.umami.is/script.js",
      },
      {
        source: "/client/api/send",
        destination: "https://gateway.umami.is/api/send",
      },
    ];
  },
  transpilePackages: ["gsap", "@react-three/fiber", "@react-three/drei"],
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
      {
        protocol: "https",
        hostname: "media.kitsu.app",
        pathname: "/**",
      },
    ],
  },
  experimental: {
    taint: true,
    browserDebugInfoInTerminal:
      process.env.NEXT_BROWSER_DEBUG === "1" &&
      process.env.NODE_ENV !== "production",
    optimizePackageImports: [
      "@radix-ui/react-accordion",
      "@radix-ui/react-alert-dialog",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-collapsible",
      "@radix-ui/react-context-menu",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-hover-card",
      "@radix-ui/react-label",
      "@radix-ui/react-menubar",
      "@radix-ui/react-navigation-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-progress",
      "@radix-ui/react-radio-group",
      "@radix-ui/react-scroll-area",
      "@radix-ui/react-select",
      "@radix-ui/react-separator",
      "@radix-ui/react-slider",
      "@radix-ui/react-switch",
      "@radix-ui/react-tabs",
      "@radix-ui/react-toast",
      "@radix-ui/react-toggle",
      "@radix-ui/react-toggle-group",
      "@radix-ui/react-tooltip",
    ],
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  turbopack: {
    resolveAlias: {
      "movi-player/element": {
        browser: "./lib/movi/movi-player-bundle-stub.ts",
      },
      "movi-player": {
        browser: "./lib/movi/movi-player-bundle-stub.ts",
      },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        // movi-player must load via <script type="module"> — bundling breaks WASM literals.
        ...moviPlayerResolveAliases,
      };
    }
    return config;
  },
};

export default nextConfig;
