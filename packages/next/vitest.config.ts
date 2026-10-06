import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@sarathi/core": resolve(__dirname, "../core/src/index.ts"),
      "@sarathi/babel": resolve(__dirname, "../babel/src/index.ts"),
    },
  },
});
