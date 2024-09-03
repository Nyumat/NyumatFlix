// vitest.config.ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import magicalSvg from "vite-plugin-magical-svg";
import { loadEnv } from 'vite'

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
    setupFiles: ["./setupTests.js"],
    globals: true,
    silent: false,
    env: loadEnv('', process.cwd(), ''),
  },
});
