import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@saarthi/core": resolve(__dirname, "../core/src/index.ts"),
      "@saarthi/babel": resolve(__dirname, "../babel/src/index.ts"),
    },
  },
});
