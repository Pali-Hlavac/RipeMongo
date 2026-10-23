// Vite config for the Tauri webview frontend and the Vitest test runner.
import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** Port Tauri expects the dev server on (see `build.devUrl` in tauri.conf.json). */
const DEV_SERVER_PORT = 1420;
const tauriDevHost = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    host: tauriDevHost ?? false,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  // The editor is lazy-loaded; without this, opening it the first time makes the dev server
  // re-optimize dependencies mid-session and the import fails until a reload.
  optimizeDeps: { include: ["monaco-editor/editor/editor.api"] },
  envPrefix: ["VITE_", "TAURI_ENV_"],
  build: {
    target: "es2022",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
    restoreMocks: true,
  },
});
