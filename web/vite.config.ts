import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Dev runs on its own origin and proxies the API to the app, which answers only to its own Host (changeOrigin).
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy: { "/api": { target: "http://127.0.0.1:8765", changeOrigin: true } } },
  build: { outDir: "dist", assetsDir: "assets", emptyOutDir: true },
  test: { environment: "jsdom", setupFiles: ["src/test-setup.ts"], restoreMocks: true },
});
