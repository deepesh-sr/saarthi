import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist/app",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@saarthi/core": resolve(__dirname, "../core/src/index.ts"),
    },
  },
});
