/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The "demo" mode build is what ships to GitHub Pages (docs/CONTEXT.md §17.5): it always
// runs against the web (mock) plugin implementations and is served from a /photovault/ subpath.
// The default build is what Capacitor bundles into the iOS app, served from the app root.
export default defineConfig(({ mode }) => ({
  base: mode === "demo" ? "/photovault/" : "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    exclude: ["**/node_modules/**", "**/tests/e2e/**"],
  },
}));
