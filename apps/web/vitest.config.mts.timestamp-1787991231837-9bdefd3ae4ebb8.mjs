// vitest.config.mts
import react from "file:///Users/tn/dev/sidequests/NyumatFlix/node_modules/.bun/@vitejs+plugin-react@4.7.0+0d39c2a4db8a8645/node_modules/@vitejs/plugin-react/dist/index.js";
import { fileURLToPath } from "node:url";
import { loadEnv } from "file:///Users/tn/dev/sidequests/NyumatFlix/node_modules/.bun/vite@5.4.21+6a182af1af168a26/node_modules/vite/dist/node/index.js";
import magicalSvg from "file:///Users/tn/dev/sidequests/NyumatFlix/node_modules/.bun/vite-plugin-magical-svg@1.9.0+0d39c2a4db8a8645/node_modules/vite-plugin-magical-svg/dist/index.js";
import tsconfigPaths from "file:///Users/tn/dev/sidequests/NyumatFlix/node_modules/.bun/vite-tsconfig-paths@5.1.4+be5a1af0784152ee/node_modules/vite-tsconfig-paths/dist/index.js";
import { defineConfig } from "file:///Users/tn/dev/sidequests/NyumatFlix/node_modules/.bun/vitest@2.1.9+97c958ff0823be39/node_modules/vitest/dist/config.js";
var __vite_injected_original_import_meta_url =
  "file:///Users/tn/dev/sidequests/NyumatFlix/apps/web/vitest.config.mts";
var vitest_config_default = defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(
        new URL("./", __vite_injected_original_import_meta_url),
      ),
      "next/server": "next/server.js",
      "server-only": fileURLToPath(
        new URL(
          "./test/mocks/server-only.ts",
          __vite_injected_original_import_meta_url,
        ),
      ),
    },
  },
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
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**", "packages/**"],
    env: loadEnv("", process.cwd(), ""),
    server: {
      deps: {
        inline: ["zod", "next-auth"],
      },
    },
  },
});
export { vitest_config_default as default };
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZXN0LmNvbmZpZy5tdHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvdG4vZGV2L3NpZGVxdWVzdHMvTnl1bWF0RmxpeC9hcHBzL3dlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL3RuL2Rldi9zaWRlcXVlc3RzL055dW1hdEZsaXgvYXBwcy93ZWIvdml0ZXN0LmNvbmZpZy5tdHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL3RuL2Rldi9zaWRlcXVlc3RzL055dW1hdEZsaXgvYXBwcy93ZWIvdml0ZXN0LmNvbmZpZy5tdHNcIjtpbXBvcnQgcmVhY3QgZnJvbSBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgeyBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCBtYWdpY2FsU3ZnIGZyb20gXCJ2aXRlLXBsdWdpbi1tYWdpY2FsLXN2Z1wiO1xuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSBcInZpdGUtdHNjb25maWctcGF0aHNcIjtcbmltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlc3QvY29uZmlnXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHJlc29sdmU6IHtcbiAgICBhbGlhczoge1xuICAgICAgXCJAXCI6IGZpbGVVUkxUb1BhdGgobmV3IFVSTChcIi4vXCIsIGltcG9ydC5tZXRhLnVybCkpLFxuICAgICAgXCJuZXh0L3NlcnZlclwiOiBcIm5leHQvc2VydmVyLmpzXCIsXG4gICAgICBcInNlcnZlci1vbmx5XCI6IGZpbGVVUkxUb1BhdGgoXG4gICAgICAgIG5ldyBVUkwoXCIuL3Rlc3QvbW9ja3Mvc2VydmVyLW9ubHkudHNcIiwgaW1wb3J0Lm1ldGEudXJsKSxcbiAgICAgICksXG4gICAgfSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgdHNjb25maWdQYXRocygpLFxuICAgIG1hZ2ljYWxTdmcoe1xuICAgICAgdGFyZ2V0OiBcInJlYWN0XCIsXG4gICAgfSksXG4gIF0sXG4gIHRlc3Q6IHtcbiAgICBlbnZpcm9ubWVudDogXCJqc2RvbVwiLFxuICAgIHJlcG9ydGVyczogcHJvY2Vzcy5lbnYuR0lUSFVCX0FDVElPTlMgPyBbXCJkb3RcIiwgXCJnaXRodWItYWN0aW9uc1wiXSA6IFtcImRvdFwiXSxcbiAgICBzZXR1cEZpbGVzOiBbXCIuL3NldHVwVGVzdHMudHNcIl0sXG4gICAgZ2xvYmFsczogdHJ1ZSxcbiAgICBzaWxlbnQ6IGZhbHNlLFxuICAgIGV4Y2x1ZGU6IFtcbiAgICAgIFwiKiovbm9kZV9tb2R1bGVzLyoqXCIsXG4gICAgICBcIioqL2Rpc3QvKipcIixcbiAgICAgIFwiZTJlLyoqXCIsXG4gICAgICBcInBhY2thZ2VzLyoqXCIsXG4gICAgXSxcbiAgICBlbnY6IGxvYWRFbnYoXCJcIiwgcHJvY2Vzcy5jd2QoKSwgXCJcIiksXG4gICAgc2VydmVyOiB7XG4gICAgICBkZXBzOiB7XG4gICAgICAgIGlubGluZTogW1wiem9kXCIsIFwibmV4dC1hdXRoXCJdLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQTRULE9BQU8sV0FBVztBQUM5VSxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGVBQWU7QUFDeEIsT0FBTyxnQkFBZ0I7QUFDdkIsT0FBTyxtQkFBbUI7QUFDMUIsU0FBUyxvQkFBb0I7QUFMc0ssSUFBTSwyQ0FBMkM7QUFPcFAsSUFBTyx3QkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxjQUFjLElBQUksSUFBSSxNQUFNLHdDQUFlLENBQUM7QUFBQSxNQUNqRCxlQUFlO0FBQUEsTUFDZixlQUFlO0FBQUEsUUFDYixJQUFJLElBQUksK0JBQStCLHdDQUFlO0FBQUEsTUFDeEQ7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsV0FBVztBQUFBLE1BQ1QsUUFBUTtBQUFBLElBQ1YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLGFBQWE7QUFBQSxJQUNiLFdBQVcsUUFBUSxJQUFJLGlCQUFpQixDQUFDLE9BQU8sZ0JBQWdCLElBQUksQ0FBQyxLQUFLO0FBQUEsSUFDMUUsWUFBWSxDQUFDLGlCQUFpQjtBQUFBLElBQzlCLFNBQVM7QUFBQSxJQUNULFFBQVE7QUFBQSxJQUNSLFNBQVM7QUFBQSxNQUNQO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRjtBQUFBLElBQ0EsS0FBSyxRQUFRLElBQUksUUFBUSxJQUFJLEdBQUcsRUFBRTtBQUFBLElBQ2xDLFFBQVE7QUFBQSxNQUNOLE1BQU07QUFBQSxRQUNKLFFBQVEsQ0FBQyxPQUFPLFdBQVc7QUFBQSxNQUM3QjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
