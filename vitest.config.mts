// vitest.config.ts
import react from "@vitejs/plugin-react";
import { loadEnv } from "vite";
import magicalSvg from "vite-plugin-magical-svg";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    magicalSvg({
      target: "react",
    }),
  ],
  test: {
    environment: "jsdom",
    reporters: process.env.GITHUB_ACTIONS ? ["dot", "github-actions"] : ["dot"],
    setupFiles: ["./setupTests.ts"],
    globals: true,
    silent: false,
    env: loadEnv("", process.cwd(), ""),
  },
});
